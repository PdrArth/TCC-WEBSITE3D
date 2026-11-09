"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldEnvironmentManifest } from '@/lib/experience-contract';
import type { EnvironmentState } from '@/lib/experience/environment.mjs';
import { createPondVisitors, createPondVisitorState, advancePondVisitors, writeDuckPose, writeTurtlePose, type PondVisitorPose, type PondVisitorContext } from '@/lib/experience/pond-visitors.mjs';

type Kind = 'duckBody'|'duckWing'|'duckHead'|'duckBill'|'turtleShell'|'turtleBody'|'turtleHead'|'turtleFeet';
type Props = {
  environment:WorldEnvironmentManifest; environmentState:MutableRefObject<EnvironmentState>;
  quality:'high'|'low'; active:boolean; moving:boolean; reducedMotion:boolean;
  onDiscovery?:(id:'ducks'|'turtles')=>void;
};
const noRaycast = () => {};
const freshPose = ():PondVisitorPose => ({x:0,y:0,z:0,heading:0,roll:0,tuck:0,gait:0,scale:1,mode:'resting',visible:true});
function currentVisitorContext(environmentState:MutableRefObject<EnvironmentState>,active:boolean,moving:boolean,reducedMotion:boolean):PondVisitorContext {
  const environment=environmentState.current;
  return {weather:environment.weather,hour:environment.hour,ice:environment.ice,wind:environment.wind,waterLevel:environment.waterLevel,active,moving,reducedMotion};
}

function tint(geometry:THREE.BufferGeometry,color='#ffffff') {
  const tint=new THREE.Color(color),position=geometry.getAttribute('position'),colors=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++){colors[i*3]=tint.r;colors[i*3+1]=tint.g;colors[i*3+2]=tint.b;}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
function ellipsoid(position:[number,number,number],size:[number,number,number],color='#ffffff') {
  const geometry=new THREE.SphereGeometry(1,12,8);geometry.scale(...size);geometry.translate(...position);return tint(geometry,color);
}
function merge(parts:THREE.BufferGeometry[]) {
  const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());
  if(!geometry)throw new Error('Pond visitor geometry could not be prepared');
  return geometry;
}
function visitorGeometry():Record<Kind,THREE.BufferGeometry> {
  const duckBody=merge([
    ellipsoid([0,.225,-.025],[.285,.215,.435]),
    ellipsoid([0,.22,-.385],[.16,.095,.21]),
    ellipsoid([0,.39,.205],[.105,.145,.12]),
  ]);
  const duckWing=merge([
    ellipsoid([-.249,.255,-.04],[.065,.125,.27]),
    ellipsoid([.249,.255,-.04],[.065,.125,.27]),
  ]);
  const duckHead=merge([
    ellipsoid([0,0,0],[.157,.158,.175]),
    ellipsoid([-.135,.025,.075],[.018,.022,.021],'#292f2c'),
    ellipsoid([.135,.025,.075],[.018,.022,.021],'#292f2c'),
  ]);
  const duckBill=ellipsoid([0,-.038,.190],[.107,.035,.155]);
  const turtleShell=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);
  turtleShell.scale(.345,.235,.465);
  const positions=turtleShell.getAttribute('position'),colors=new Float32Array(positions.count*3),dark=new THREE.Color('#466347'),light=new THREE.Color('#7f8e59');
  for(let i=0;i<positions.count;i++) {
    const angle=Math.atan2(positions.getX(i),positions.getZ(i)),height=positions.getY(i),ridge=Math.cos(angle*6+height*20);
    const color=light.clone().lerp(dark,ridge>.66?.65:.12);colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  turtleShell.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const turtleBody=merge([ellipsoid([0,-.005,0],[.31,.065,.42]),ellipsoid([0,-.018,-.435],[.035,.035,.16])]);
  const turtleHead=merge([
    ellipsoid([0,0,.025],[.102,.077,.14]),
    ellipsoid([-.084,.036,.077],[.017,.015,.015],'#27342c'),
    ellipsoid([.084,.036,.077],[.017,.015,.015],'#27342c'),
  ]);
  const turtleFeet=ellipsoid([0,0,0],[.069,.055,.145]);
  return {duckBody,duckWing,duckHead,duckBill,turtleShell,turtleBody,turtleHead,turtleFeet};
}

/** Small instanced visitors; none of their geometry can intercept garden clicks. */
export default function PondVisitors({environment,environmentState,quality,active,moving,reducedMotion,onDiscovery}:Props) {
  const {camera,gl}=useThree();
  const prepared=useMemo(()=>createPondVisitors(environment,quality),[environment,quality]);
  const state=useMemo(()=>createPondVisitorState(prepared),[prepared]);
  const geometry=useMemo(()=>visitorGeometry(),[]);
  const materials=useMemo(()=>Object.fromEntries((Object.keys(geometry) as Kind[]).map(kind=>[kind,new THREE.MeshStandardMaterial({
    color:kind==='duckBill'?'#d59a45':kind==='duckWing'?'#eadbb7':kind==='turtleHead'||kind==='turtleFeet'||kind==='turtleBody'?'#7a8956':'#ffffff',
    vertexColors:true,roughness:.9,flatShading:true,
  })])) as Record<Kind,THREE.MeshStandardMaterial>,[geometry]);
  const meshes=useRef<Partial<Record<Kind,THREE.InstancedMesh>>>({}),discovered=useRef(new Set<'ducks'|'turtles'>()),report=useRef(0),renderAge=useRef(Infinity);
  const poses=useMemo(()=>({duck:freshPose(),turtle:freshPose()}),[]);
  const rig=useMemo(()=>{const root=new THREE.Object3D(),head=new THREE.Object3D(),foot=new THREE.Object3D();root.add(head,foot);return {root,head,foot};},[]);
  const projected=useMemo(()=>new THREE.Vector3(),[]);
  const context=useCallback(()=>currentVisitorContext(environmentState,active,moving,reducedMotion),[environmentState,active,moving,reducedMotion]);
  const update=useCallback(()=>{
    const current=context();
    for(let i=0;i<prepared.ducks.length;i++) {
      const pose=writeDuckPose(poses.duck,i,state,prepared,current);
      rig.root.position.set(pose.x,pose.y,pose.z);rig.root.rotation.set(0,pose.heading,pose.roll);rig.root.scale.setScalar(pose.scale);
      rig.head.position.set(0,.53-pose.tuck*.16,.27-pose.tuck*.16);rig.head.scale.setScalar(1);rig.head.rotation.set(pose.tuck*.22,0,0);
      rig.root.updateMatrixWorld(true);
      meshes.current.duckBody?.setMatrixAt(i,rig.root.matrixWorld);meshes.current.duckWing?.setMatrixAt(i,rig.root.matrixWorld);
      meshes.current.duckHead?.setMatrixAt(i,rig.head.matrixWorld);meshes.current.duckBill?.setMatrixAt(i,rig.head.matrixWorld);
    }
    for(let i=0;i<prepared.turtles.length;i++) {
      const pose=writeTurtlePose(poses.turtle,i,state,prepared,current);
      rig.root.position.set(pose.x,pose.y,pose.z);rig.root.rotation.set(0,pose.heading,0);rig.root.scale.setScalar(pose.scale);
      rig.head.position.set(0,.035,.39-pose.tuck*.18);rig.head.scale.setScalar(1-pose.tuck*.22);rig.head.rotation.set(0,0,0);
      rig.root.updateMatrixWorld(true);
      meshes.current.turtleShell?.setMatrixAt(i,rig.root.matrixWorld);meshes.current.turtleBody?.setMatrixAt(i,rig.root.matrixWorld);meshes.current.turtleHead?.setMatrixAt(i,rig.head.matrixWorld);
      for(let foot=0;foot<4;foot++) {
        const side=foot%2?1:-1,front=foot<2?1:-1;
        rig.foot.position.set(side*.257,-.025,front*.24);rig.foot.rotation.set(0,side*(.38+front*pose.gait),0);rig.foot.scale.setScalar(1);rig.foot.updateMatrixWorld(true);
        meshes.current.turtleFeet?.setMatrixAt(i*4+foot,rig.foot.matrixWorld);
      }
    }
    for(const mesh of Object.values(meshes.current))if(mesh)mesh.instanceMatrix.needsUpdate=true;
  },[context,prepared,rig,poses,state]);
  useEffect(()=>()=>{Object.values(geometry).forEach(part=>part.dispose());Object.values(materials).forEach(material=>material.dispose());},[geometry,materials]);
  useLayoutEffect(()=>{
    const bodyColors=['#a99673','#d4bf87','#e4c96e','#dcbf67'],headColors=['#577867','#a18b65','#e9cd77','#dfc171'];
    for(let i=0;i<prepared.ducks.length;i++) {
      meshes.current.duckBody?.setColorAt(i,new THREE.Color(bodyColors[i%bodyColors.length]));
      meshes.current.duckHead?.setColorAt(i,new THREE.Color(headColors[i%headColors.length]));
    }
    if(meshes.current.duckBody?.instanceColor)meshes.current.duckBody.instanceColor.needsUpdate=true;
    if(meshes.current.duckHead?.instanceColor)meshes.current.duckHead.instanceColor.needsUpdate=true;
    update();
  },[prepared,state,geometry,update]); // Three owns the instanced buffers outside React.
  useFrame((_,delta)=>{
    advancePondVisitors(state,delta,context(),prepared);
    renderAge.current+=Math.min(.1,Math.max(0,delta));
    if(renderAge.current>=.05){renderAge.current=0;update();}
    report.current+=Math.min(.1,Math.max(0,delta));if(report.current<.5)return;report.current=0;
    gl.domElement.setAttribute('data-garden-ducks',String(prepared.ducks.length));
    gl.domElement.setAttribute('data-garden-turtles',String(prepared.turtles.length));
    gl.domElement.setAttribute('data-garden-pond-resting',String(state.ducks.filter(duck=>duck.mode==='resting').length+state.turtles.filter(turtle=>turtle.mode==='resting').length));
    gl.domElement.setAttribute('data-garden-pond-time',state.elapsed.toFixed(2));
    if(!active||!onDiscovery)return;
    for(const species of ['ducks','turtles'] as const) {
      if(discovered.current.has(species))continue;
      for(let i=0;i<prepared[species].length;i++) {
        const pose=species==='ducks'?writeDuckPose(poses.duck,i,state,prepared,context()):writeTurtlePose(poses.turtle,i,state,prepared,context());
        projected.set(pose.x,pose.y+(species==='ducks'?.4:.1),pose.z).project(camera);
        if(projected.z>=-1&&projected.z<1&&Math.abs(projected.x)<.93&&Math.abs(projected.y)<.93) {
          discovered.current.add(species);onDiscovery(species);break;
        }
      }
    }
  });
  const count=(kind:Kind)=>kind.startsWith('duck')?prepared.ducks.length:prepared.turtles.length*(kind==='turtleFeet'?4:1);
  return <group name="pond_visitors" dispose={null}>{(Object.keys(geometry) as Kind[]).map(kind=><instancedMesh key={kind} name={`pond_${kind}`} ref={mesh=>{if(mesh)meshes.current[kind]=mesh;else delete meshes.current[kind];}} args={[geometry[kind],materials[kind],count(kind)]} frustumCulled={false} receiveShadow raycast={noRaycast}/>)}</group>;
}
