"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldEnvironmentManifest } from "@/lib/experience-contract";
import type { EnvironmentState } from "@/lib/experience/environment.mjs";
import { lakeSpillway } from "@/lib/experience/lake-dynamics.mjs";

const noRaycast = () => {};

/** A small stone overflow in the outer bank; no island, building or route is moved. */
export default function LakeOverflow({ environment, environmentState,quality='high' }: { environment: WorldEnvironmentManifest; environmentState: MutableRefObject<EnvironmentState>;quality?:'high'|'low' }) {
  const { gl } = useThree();
  const outlet = useMemo(() => lakeSpillway(environment), [environment]);
  const stones = useRef<THREE.InstancedMesh>(null), streaks = useRef<THREE.InstancedMesh>(null), foam = useRef<THREE.InstancedMesh>(null);
  const stream = useRef<THREE.Mesh>(null), waterMaterial = useRef<THREE.MeshStandardMaterial>(null), foamMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rows = quality==='high'?41:25, columns = quality==='high'?13:7;
  const waterTime = useMemo(() => ({value:0}), []);
  const ribbon = useMemo(() => {
    const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
    for (let row = 0; row < rows; row++) {
      const fall = Math.max(0, (row - 8) / (rows - 9));
      const z = row <= 8 ? -.40 + row / 8 * (outlet.length + .40) : outlet.length + fall * .43;
      for (let col = 0; col < columns; col++) {
        vertices.push((col / (columns - 1) - .5) * outlet.width * (.81-fall*.12), .022-outlet.drop * fall * fall, z);
        uv.push(col/(columns-1),row/(rows-1));
      }
      if (row < rows - 1) for (let col = 0; col < columns - 1; col++) { const a = row * columns + col; indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }, [outlet,rows,columns]);
  const base = useMemo(() => Float32Array.from(ribbon.getAttribute("position").array), [ribbon]);
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  const basin = useMemo(() => {
    const vertices: number[] = [], indices: number[] = [], count = 20;
    const rings = [[1.46,.86,-.31],[1.58,.96,.11],[1.20,.65,.13],[1.06,.54,-.13]];
    for (const [rx,rz,height] of rings) for (let i=0;i<count;i++) {
      const angle=i/count*Math.PI*2, edge=1+.035*Math.sin(i*2.7);
      vertices.push(Math.cos(angle)*rx*edge,-outlet.drop+height,Math.sin(angle)*rz*edge+outlet.length+.42);
    }
    for (let ring=0;ring<rings.length-1;ring++) for (let i=0;i<count;i++) {
      const a=ring*count+i,b=ring*count+(i+1)%count,c=a+count,d=b+count;
      indices.push(a,c,b,b,c,d);
    }
    const floor=vertices.length/3; vertices.push(0,-outlet.drop-.13,outlet.length+.42);
    const bottom=vertices.length/3; vertices.push(0,-outlet.drop-.31,outlet.length+.42);
    for(let i=0;i<count;i++) indices.push(3*count+i,floor,3*count+(i+1)%count,i,(i+1)%count,bottom);
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  },[outlet]);
  const rockSupport = useMemo(() => {
    // A faceted outcrop overlaps the original bank and the back of the bowl.
    const geometry=new THREE.IcosahedronGeometry(1,1);
    geometry.scale(1.18,.67,.82); geometry.translate(0,-.64,outlet.length-.60); return geometry;
  },[outlet]);
  useEffect(() => () => {basin.dispose();rockSupport.dispose();},[basin,rockSupport]);
  useEffect(() => {
    for (let index = 0; index < 6; index++) {
      const side = index % 2 ? 1 : -1, z = Math.floor(index / 2) * .30 + .08;
      dummy.position.set(side * (outlet.width / 2 - .045), -.015, z); dummy.rotation.set(.06 * Math.sin(index), index * .61, .08 * Math.cos(index)); dummy.scale.set(.25, .19 + index % 3 * .018, .26); dummy.updateMatrix(); stones.current?.setMatrixAt(index, dummy.matrix);
    }
    if (stones.current) stones.current.instanceMatrix.needsUpdate = true;
  }, [dummy, outlet]);
  useFrame(() => {
    const state = environmentState.current, flow = state.outflow, visible = flow > .008;
    waterTime.value=state.elapsed;
    if (stream.current) { stream.current.visible = visible; stream.current.scale.x = .32 + flow * .68; }
    if (streaks.current) streaks.current.visible = visible;
    if (foam.current) foam.current.visible = visible;
    if (waterMaterial.current) waterMaterial.current.opacity = .76 + flow * .20;
    if (foamMaterial.current) foamMaterial.current.opacity = flow * .42;
    if (visible) {
      const positions = ribbon.getAttribute("position");
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const offset = (row * columns + col) * 3, start = Math.max(0, 1 - row / 8);
        positions.setY(row * columns + col, base[offset + 1] + (state.waterLevel - .055) * start + Math.sin(state.elapsed * 7 - row * .75 + col * .9) * .006 * flow);
      }
      positions.needsUpdate = true; ribbon.computeVertexNormals();
      for (let index = 0; index < 28; index++) {
        const t = (state.elapsed * (.67 + index % 3 * .035) + index * .618034) % 1, across = Math.sin(index * 2.4) * outlet.width * (.15 + flow * .24);
        dummy.position.set(across, -outlet.drop + Math.sin(t*Math.PI)*.24, outlet.length + .39 + t * .26); dummy.rotation.set(t * .55, index, .05 * Math.sin(index)); dummy.scale.set(.010 + flow * .008, .016 + t * .020, .012); dummy.updateMatrix(); streaks.current?.setMatrixAt(index, dummy.matrix);
      }
      for (let index = 0; index < 5; index++) {
        const t = (state.elapsed * .8 + index * .2) % 1;
        dummy.position.set(Math.sin(index * 2) * .53, -outlet.drop + .036, outlet.length + .39 + t * .14); dummy.rotation.set(-Math.PI / 2, 0, index); dummy.scale.setScalar((.15 + t * .45) * flow); dummy.updateMatrix(); foam.current?.setMatrixAt(index, dummy.matrix);
      }
      if (streaks.current) streaks.current.instanceMatrix.needsUpdate = true;
      if (foam.current) foam.current.instanceMatrix.needsUpdate = true;
    }
    gl.domElement.setAttribute("data-world-waterfall-flow", flow.toFixed(3)); gl.domElement.setAttribute("data-world-waterfall-active", String(visible)); gl.domElement.setAttribute("data-world-waterfall-position", outlet.position.map(value => value.toFixed(2)).join(","));
    gl.domElement.setAttribute("data-world-waterfall-draining",String(state.overflowing));
  });
  return <group name="lake_rain_overflow" position={outlet.position} rotation-y={outlet.yaw}>
    <instancedMesh ref={stones} name="lake_overflow_stone_banks" args={[undefined, undefined, 6]} frustumCulled={false} raycast={noRaycast}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#a8a18b" roughness={.94} /></instancedMesh>
    <mesh name="lake_overflow_rock_ledge" geometry={rockSupport} raycast={noRaycast}><meshStandardMaterial color="#797765" roughness={1} flatShading /></mesh>
    <mesh name="lake_overflow_stone_basin" geometry={basin} raycast={noRaycast}><meshStandardMaterial color="#a19b83" roughness={.96} flatShading /></mesh>
    <mesh name="lake_overflow_receiving_pool" position={[0,-outlet.drop-.025,outlet.length+.42]} scale={[1.14,.055,.59]} raycast={noRaycast}><sphereGeometry args={[1,20,8]}/><meshStandardMaterial color="#91aaa3" roughness={.45}/></mesh>
    <mesh ref={stream} name="lake_overflow_falling_water" geometry={ribbon} visible={false} renderOrder={3} raycast={noRaycast}><meshStandardMaterial ref={waterMaterial} color="#a4ccc6" roughness={.36} metalness={0} transparent depthWrite={false} side={THREE.DoubleSide} onBeforeCompile={shader=>{
      shader.uniforms.fallTime=waterTime;
      shader.vertexShader='varying vec2 vFallUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFallUv=uv;');
      shader.fragmentShader='uniform float fallTime; varying vec2 vFallUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float lines=pow(.5+.5*sin(vFallUv.x*94.0+sin(vFallUv.y*12.0-fallTime*4.0)),7.0);
        float flow=.5+.5*sin(vFallUv.y*65.0-fallTime*10.0+sin(vFallUv.x*32.0));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.96,.92),lines*.55+flow*.16);
      `);
    }}/></mesh>
    <instancedMesh ref={streaks} name="lake_overflow_spray" args={[undefined, undefined, 28]} visible={false} frustumCulled={false} raycast={noRaycast}><sphereGeometry args={[1, 5, 4]} /><meshBasicMaterial color="#d4e8dd" transparent opacity={.70} depthWrite={false} /></instancedMesh>
    <instancedMesh ref={foam} name="lake_overflow_foam" args={[undefined, undefined, 5]} visible={false} frustumCulled={false} raycast={noRaycast}><ringGeometry args={[.68, 1, 18]} /><meshBasicMaterial ref={foamMaterial} color="#d4e8dd" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></instancedMesh>
  </group>;
}
