"use client";

/* eslint-disable react-hooks/immutability -- The frame loop updates Three.js geometry buffers and shader uniforms, not React state. */

import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {WorldEnvironmentManifest} from '@/lib/experience-contract';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';
import {lakeSpillway} from '@/lib/experience/lake-dynamics.mjs';

const noRaycast=()=>{};

/** Rain spills over the lake's own lip; the falling sheet dissipates below the island. */
export default function LakeOverflow({environment,environmentState,quality='high'}:{environment:WorldEnvironmentManifest;environmentState:MutableRefObject<EnvironmentState>;quality?:'high'|'low'}) {
  const {gl}=useThree();
  const outlet=useMemo(()=>lakeSpillway(environment),[environment]);
  const stream=useRef<THREE.Mesh>(null),foam=useRef<THREE.InstancedMesh>(null);
  const material=useRef<THREE.MeshStandardMaterial>(null);
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  const waterTime=useMemo(()=>({value:0}),[]);
  const rows=quality==='high'?33:21,columns=quality==='high'?19:11;
  const ribbon=useMemo(()=>{
    const vertices:number[]=[],indices:number[]=[],uv:number[]=[];
    for(let row=0;row<rows;row++) {
      const t=row/(rows-1),edge=.27,fall=Math.max(0,(t-edge)/(1-edge));
      const z=t<=edge?-.55+t/edge*(outlet.length+.55):outlet.length+Math.sin(fall*Math.PI/2)*.35;
      for(let col=0;col<columns;col++) {
        const across=col/(columns-1);
        vertices.push((across-.5)*outlet.width,.018-outlet.drop*fall*fall,z);
        uv.push(across,t);
      }
      if(row<rows-1)for(let col=0;col<columns-1;col++) {
        const a=row*columns+col;
        indices.push(a,a+columns,a+1,a+1,a+columns,a+columns+1);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  },[outlet,rows,columns]);
  const base=useMemo(()=>Float32Array.from(ribbon.getAttribute('position').array),[ribbon]);
  useEffect(()=>()=>ribbon.dispose(),[ribbon]);
  const lastUpdate=useRef(-Infinity);
  useFrame(()=>{
    const state=environmentState.current,flow=state.outflow,visible=flow>.008;
    waterTime.value=state.elapsed;
    if(stream.current)stream.current.visible=visible;
    if(foam.current)foam.current.visible=visible;
    if(material.current)material.current.opacity=Math.min(.86,flow*1.4);
    if(visible&&state.elapsed-lastUpdate.current>=.04) {
      lastUpdate.current=state.elapsed;
      const positions=ribbon.getAttribute('position');
      for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
        const i=row*columns+col,start=Math.max(0,1-row/((rows-1)*.27));
        positions.setY(i,base[i*3+1]+(state.waterLevel-.055)*start+Math.sin(state.elapsed*5-row*.55+col*.7)*.006*flow);
      }
      positions.needsUpdate=true;
      for(let i=0;i<16;i++) {
        const drift=(state.elapsed*.7+i*.618)%1;
        dummy.position.set((i/15-.5)*outlet.width*.92,.035,outlet.length-.20+drift*.24);
        dummy.rotation.set(0,i*.8,0);dummy.scale.set(.07+flow*.05,.014,.035+drift*.07);
        dummy.updateMatrix();foam.current?.setMatrixAt(i,dummy.matrix);
      }
      if(foam.current)foam.current.instanceMatrix.needsUpdate=true;
    }
    gl.domElement.setAttribute('data-world-waterfall-style','infinity-edge');
    gl.domElement.setAttribute('data-world-waterfall-flow',flow.toFixed(3));
    gl.domElement.setAttribute('data-world-waterfall-active',String(visible));
    gl.domElement.setAttribute('data-world-waterfall-position',outlet.position.map(v=>v.toFixed(2)).join(','));
    gl.domElement.setAttribute('data-world-waterfall-draining',String(state.overflowing));
  });
  return <group name="lake_infinity_edge" position={outlet.position} rotation-y={outlet.yaw}>
    <mesh ref={stream} name="lake_infinity_falling_sheet" geometry={ribbon} visible={false} renderOrder={3} raycast={noRaycast}>
      <meshStandardMaterial ref={material} color="#a4ccc6" roughness={.32} transparent depthWrite={false} side={THREE.DoubleSide} onBeforeCompile={shader=>{
        shader.uniforms.fallTime=waterTime;
        shader.vertexShader='varying vec2 vFallUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFallUv=uv;');
        shader.fragmentShader='uniform float fallTime; varying vec2 vFallUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float streak=pow(.5+.5*sin(vFallUv.x*125.0+sin(vFallUv.y*9.0-fallTime*3.0)),8.0);
          float current=.5+.5*sin(vFallUv.y*52.0-fallTime*9.0+sin(vFallUv.x*38.0));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.96,.93),streak*.38+current*.13);
          diffuseColor.a*=smoothstep(0.0,.045,vFallUv.x)*(1.0-smoothstep(.955,1.0,vFallUv.x));
          diffuseColor.a*=1.0-smoothstep(.56,1.0,vFallUv.y);
        `);
      }}/>
    </mesh>
    <instancedMesh ref={foam} name="lake_infinity_crest_foam" args={[undefined,undefined,16]} frustumCulled={false} visible={false} raycast={noRaycast}><sphereGeometry args={[1,5,4]}/><meshBasicMaterial color="#dae8df" transparent opacity={.6} depthWrite={false}/></instancedMesh>
  </group>;
}
