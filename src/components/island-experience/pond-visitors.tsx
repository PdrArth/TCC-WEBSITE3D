"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldEnvironmentManifest } from '@/lib/experience-contract';
import type { EnvironmentState } from '@/lib/experience/environment.mjs';
import { createPondVisitors, createPondVisitorState, advancePondVisitors, writeDuckPose, writeDucklingPose, writeTurtlePose, writeCrabPose, type PondVisitorPose, type PondVisitorContext } from '@/lib/experience/pond-visitors.mjs';
import {NEST_CAPACITY} from '@/lib/experience/nesting.mjs';
import PondNest from './pond-nest';

type Kind = 'duckBody'|'duckWing'|'duckHead'|'duckBill'|'duckFeet'|'turtleShell'|'turtleBody'|'turtleHead'|'turtleFeet'|'crabBody'|'crabLeg'|'crabClaw';
type Props = {
  environment:WorldEnvironmentManifest; environmentState:MutableRefObject<EnvironmentState>;
  quality:'high'|'low'; active:boolean; moving:boolean; reducedMotion:boolean;
  onDiscovery?:(id:'ducks'|'turtles'|'crabs')=>void;
};
const noRaycast = () => {};
const freshPose = ():PondVisitorPose => ({x:0,y:0,z:0,heading:0,roll:0,tuck:0,gait:0,scale:1,land:0,walk:0,growth:1,mode:'resting',visible:true});
function currentVisitorContext(environmentState:MutableRefObject<EnvironmentState>,active:boolean,moving:boolean,reducedMotion:boolean):PondVisitorContext {
  const environment=environmentState.current;
  return {weather:environment.weather,hour:environment.hour,time:environment.elapsed,ice:environment.ice,wind:environment.wind,waterLevel:environment.waterLevel,active,moving,reducedMotion};
}

function tint(geometry:THREE.BufferGeometry,color='#ffffff') {
  const tint=new THREE.Color(color),position=geometry.getAttribute('position'),colors=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++){colors[i*3]=tint.r;colors[i*3+1]=tint.g;colors[i*3+2]=tint.b;}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
function ellipsoid(position:[number,number,number],size:[number,number,number],color='#ffffff') {
  const geometry=new THREE.SphereGeometry(1,12,8);geometry.scale(...size);geometry.translate(...position);return tint(geometry,color);
}
function limb(from:[number,number,number],to:[number,number,number],radius:number,color:string) {
  const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),axis=end.clone().sub(start);
  const geometry=new THREE.CylinderGeometry(radius*.72,radius,axis.length(),6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize()));
  geometry.translate(...start.add(end).multiplyScalar(.5).toArray());return tint(geometry,color);
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
  const duckFeet=merge([limb([0,.035,0],[0,-.095,.02],.022,'#ce8d3d'),ellipsoid([0,-.1,.065],[.075,.02,.105],'#db9a45')]);
  const shell=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);
  shell.scale(.345,.255,.465);
  const positions=shell.getAttribute('position'),colors=new Float32Array(positions.count*3),dark=new THREE.Color('#344e35'),light=new THREE.Color('#879557');
  for(let i=0;i<positions.count;i++) {
    const angle=Math.atan2(positions.getX(i),positions.getZ(i)),height=positions.getY(i),ridge=Math.cos(angle*6+height*20);
    const color=light.clone().lerp(dark,ridge>.66?.65:.12);colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  shell.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const turtleShell=merge([shell,ellipsoid([0,.005,0],[.35,.035,.47],'#435637')]);
  const turtleBody=merge([ellipsoid([0,-.01,0],[.325,.065,.435],'#d2bd75'),ellipsoid([0,-.018,-.435],[.035,.035,.16])]);
  const turtleHead=merge([
    ellipsoid([0,0,.025],[.113,.085,.155]),
    ellipsoid([-.092,.04,.085],[.021,.02,.02],'#182d25'),
    ellipsoid([.092,.04,.085],[.021,.02,.02],'#182d25'),
    ellipsoid([0,-.03,.135],[.07,.025,.048],'#c2b56b'),
  ]);
  const turtleFeet=ellipsoid([0,0,0],[.09,.047,.16]);
  const crabBody=merge([
    ellipsoid([0,0,0],[.25,.12,.18],'#b95632'),
    ellipsoid([0,-.045,.015],[.225,.055,.165],'#e4a565'),
    ...[-1,1].flatMap(side=>[
      ellipsoid([side*.11,.13,.14],[.017,.085,.018],'#ae4d2f'),
      ellipsoid([side*.11,.205,.15],[.033,.032,.032],'#232d25'),
      ellipsoid([side*.103,.215,.17],[.008,.008,.008],'#fff0c8'),
    ]),
  ]);
  const crabLeg=merge([limb([0,0,0],[.14,.025,-.025],.028,'#b95632'),limb([.14,.025,-.025],[.27,-.11,-.055],.022,'#cc7547')]);
  const crabClaw=merge([
    limb([0,0,0],[0,.04,.14],.036,'#ba5c36'),
    ellipsoid([0,.045,.18],[.065,.055,.085],'#d78249'),
    ellipsoid([-.040,.045,.265],[.026,.032,.082],'#edb174'),
    ellipsoid([.040,.045,.265],[.026,.032,.082],'#edb174'),
  ]);
  return {duckBody,duckWing,duckHead,duckBill,duckFeet,turtleShell,turtleBody,turtleHead,turtleFeet,crabBody,crabLeg,crabClaw};
}

/** Small instanced visitors; none of their geometry can intercept garden clicks. */
export default function PondVisitors({environment,environmentState,quality,active,moving,reducedMotion,onDiscovery}:Props) {
  const {camera,gl}=useThree();
  // Keep paths and nesting state when adaptive rendering hides the fourth duck.
  const prepared=useMemo(()=>createPondVisitors(environment,'high'),[environment]);
  const duckCount=Math.min(prepared.ducks.length,quality==='high'?4:3);
  const state=useMemo(()=>createPondVisitorState(prepared),[prepared]);
  const geometry=useMemo(()=>visitorGeometry(),[]);
  const materials=useMemo(()=>Object.fromEntries((Object.keys(geometry) as Kind[]).map(kind=>[kind,new THREE.MeshStandardMaterial({
    color:kind==='duckBill'?'#d59a45':kind==='duckWing'?'#eadbb7':kind==='turtleHead'||kind==='turtleFeet'||kind==='turtleBody'?'#7a8956':'#ffffff',
    vertexColors:true,roughness:.9,flatShading:true,
  })])) as Record<Kind,THREE.MeshStandardMaterial>,[geometry]);
  const meshes=useRef<Partial<Record<Kind,THREE.InstancedMesh>>>({}),discovered=useRef(new Set<'ducks'|'turtles'|'crabs'>()),report=useRef(0),renderAge=useRef(Infinity);
  const poses=useMemo(()=>({duck:freshPose(),turtle:freshPose(),crab:freshPose()}),[]);
  const rig=useMemo(()=>{const root=new THREE.Object3D(),head=new THREE.Object3D(),foot=new THREE.Object3D();root.add(head,foot);return {root,head,foot};},[]);
  const projected=useMemo(()=>new THREE.Vector3(),[]);
  const context=useCallback(()=>currentVisitorContext(environmentState,active,moving,reducedMotion),[environmentState,active,moving,reducedMotion]);
  const update=useCallback(()=>{
    const current=context();
    for(let i=0;i<duckCount+NEST_CAPACITY;i++) {
      const pose=i<duckCount?writeDuckPose(poses.duck,i,state,prepared,current):writeDucklingPose(poses.duck,i-duckCount,state,prepared,current);
      if(!pose.visible)pose.scale=0;
      rig.root.position.set(pose.x,pose.y,pose.z);rig.root.rotation.set(0,pose.heading,pose.roll);rig.root.scale.setScalar(pose.scale);
      rig.head.position.set(0,.53-pose.tuck*.16+Math.sin(state.elapsed*2+i)*.012,.27-pose.tuck*.16);rig.head.scale.setScalar(1+(1-pose.growth)*.20);rig.head.rotation.set(pose.tuck*.22,Math.sin(state.elapsed*.75+i*1.7)*.14,0);
      rig.root.updateMatrixWorld(true);
      meshes.current.duckBody?.setMatrixAt(i,rig.root.matrixWorld);meshes.current.duckWing?.setMatrixAt(i,rig.root.matrixWorld);
      meshes.current.duckHead?.setMatrixAt(i,rig.head.matrixWorld);meshes.current.duckBill?.setMatrixAt(i,rig.head.matrixWorld);
      for(let foot=0;foot<2;foot++) {
        const side=foot?1:-1;
        rig.foot.position.set(side*.13,Math.max(0,side*pose.gait)*.045*pose.walk,side*pose.gait*.15*pose.walk);
        rig.foot.rotation.set(side*pose.gait*.7*pose.walk,0,0);rig.foot.scale.setScalar(pose.visible?pose.walk:0);rig.foot.updateMatrixWorld(true);
        meshes.current.duckFeet?.setMatrixAt(i*2+foot,rig.foot.matrixWorld);
      }
    }
    for(let i=0;i<prepared.turtles.length;i++) {
      const pose=writeTurtlePose(poses.turtle,i,state,prepared,current);
      rig.root.position.set(pose.x,pose.y,pose.z);rig.root.rotation.set(0,pose.heading,0);rig.root.scale.setScalar(pose.scale);
      rig.head.position.set(0,.035,.39-pose.tuck*.18);rig.head.scale.setScalar(1-pose.tuck*.22);rig.head.rotation.set(0,Math.sin(state.elapsed*.7+i)*.12,0);
      rig.root.updateMatrixWorld(true);
      meshes.current.turtleShell?.setMatrixAt(i,rig.root.matrixWorld);meshes.current.turtleBody?.setMatrixAt(i,rig.root.matrixWorld);meshes.current.turtleHead?.setMatrixAt(i,rig.head.matrixWorld);
      for(let foot=0;foot<4;foot++) {
        const side=foot%2?1:-1,front=foot<2?1:-1;
        rig.foot.position.set(side*.257,-.025,front*.24);rig.foot.rotation.set(0,side*(.38+front*pose.gait),0);rig.foot.scale.setScalar(1);rig.foot.updateMatrixWorld(true);
        meshes.current.turtleFeet?.setMatrixAt(i*4+foot,rig.foot.matrixWorld);
      }
    }
    for(let i=0;i<prepared.crabs.length;i++) {
      const pose=writeCrabPose(poses.crab,i,state,prepared,current);
      rig.root.position.set(pose.x,pose.y,pose.z);rig.root.rotation.set(0,pose.heading,0);rig.root.scale.setScalar(pose.scale);rig.root.updateMatrixWorld(true);
      meshes.current.crabBody?.setMatrixAt(i,rig.root.matrixWorld);
      for(let leg=0;leg<8;leg++) {
        const side=leg%2?1:-1,row=Math.floor(leg/2),swing=pose.gait*(row%2?1:-1);
        rig.foot.position.set(side*.19,-.01,.12-row*.08);rig.foot.rotation.set(0,(side<0?Math.PI:0)+(row-1.5)*.19+swing,side*swing*.35);rig.foot.scale.setScalar(1);rig.foot.updateMatrixWorld(true);
        meshes.current.crabLeg?.setMatrixAt(i*8+leg,rig.foot.matrixWorld);
      }
      for(let claw=0;claw<2;claw++) {
        const side=claw?1:-1;
        rig.head.position.set(side*.17,.015,.12);rig.head.rotation.set(-.1-pose.tuck*.4,side*(.30+Math.sin(state.elapsed*1.4+i+claw)*.16),0);rig.head.scale.setScalar(claw?1:.88);rig.head.updateMatrixWorld(true);
        meshes.current.crabClaw?.setMatrixAt(i*2+claw,rig.head.matrixWorld);
      }
    }
    for(const mesh of Object.values(meshes.current))if(mesh)mesh.instanceMatrix.needsUpdate=true;
  },[context,prepared,rig,poses,state,duckCount]);
  useEffect(()=>()=>{Object.values(geometry).forEach(part=>part.dispose());Object.values(materials).forEach(material=>material.dispose());},[geometry,materials]);
  useLayoutEffect(()=>{
    const bodyColors=['#a99673','#d4bf87','#e4c96e','#dcbf67'],headColors=['#577867','#a18b65','#e9cd77','#dfc171'];
    for(let i=0;i<duckCount;i++) {
      meshes.current.duckBody?.setColorAt(i,new THREE.Color(bodyColors[i%bodyColors.length]));
      meshes.current.duckHead?.setColorAt(i,new THREE.Color(headColors[i%headColors.length]));
    }
    for(let i=duckCount;i<duckCount+NEST_CAPACITY;i++){
      meshes.current.duckBody?.setColorAt(i,new THREE.Color('#e4cc7e'));
      meshes.current.duckHead?.setColorAt(i,new THREE.Color('#f2db92'));
    }
    if(meshes.current.duckBody?.instanceColor)meshes.current.duckBody.instanceColor.needsUpdate=true;
    if(meshes.current.duckHead?.instanceColor)meshes.current.duckHead.instanceColor.needsUpdate=true;
    update();
  },[prepared,state,geometry,update,duckCount]); // Three owns the instanced buffers outside React.
  useFrame((_,delta)=>{
    advancePondVisitors(state,delta,context(),prepared);
    renderAge.current+=Math.min(.1,Math.max(0,delta));
    if(renderAge.current>=.05){renderAge.current=0;update();}
    report.current+=Math.min(.1,Math.max(0,delta));if(report.current<.5)return;report.current=0;
    gl.domElement.setAttribute('data-garden-ducks',String(duckCount));
    gl.domElement.setAttribute('data-garden-turtles',String(prepared.turtles.length));
    gl.domElement.setAttribute('data-garden-crabs',String(prepared.crabs.length));
    gl.domElement.setAttribute('data-garden-turtle-modes',state.turtles.map(turtle=>turtle.mode).join(','));
    gl.domElement.setAttribute('data-garden-duck-modes',state.ducks.slice(0,duckCount).map(duck=>duck.mode).join(','));
    gl.domElement.setAttribute('data-garden-crab-modes',state.crabs.map(crab=>crab.mode).join(','));
    gl.domElement.setAttribute('data-garden-duck-eggs',String(state.nest.eggs));
    gl.domElement.setAttribute('data-garden-ducklings',String(state.nest.young));
    gl.domElement.setAttribute('data-garden-duck-nest-phase',state.nest.phase);
    gl.domElement.setAttribute('data-garden-duck-brooding',String(state.nest.occupied));
    gl.domElement.setAttribute('data-garden-duckling-growth',state.nest.slots.map(slot=>(Math.min(1,slot.age/180)).toFixed(2)).join(','));
    gl.domElement.setAttribute('data-garden-duck-position',prepared.ducks.slice(0,duckCount).map((_,i)=>{const p=writeDuckPose(poses.duck,i,state,prepared,context());return [p.x,p.y,p.z].map(v=>v.toFixed(2)).join(',');}).join(';'));
    gl.domElement.setAttribute('data-garden-pond-resting',String(state.ducks.filter(duck=>duck.mode==='resting').length+state.turtles.filter(turtle=>turtle.mode==='resting').length));
    gl.domElement.setAttribute('data-garden-pond-time',state.elapsed.toFixed(2));
    if(!active||!onDiscovery)return;
    for(const species of ['ducks','turtles','crabs'] as const) {
      if(discovered.current.has(species))continue;
      for(let i=0;i<(species==='ducks'?duckCount:prepared[species].length);i++) {
        const pose=species==='ducks'?writeDuckPose(poses.duck,i,state,prepared,context()):species==='turtles'?writeTurtlePose(poses.turtle,i,state,prepared,context()):writeCrabPose(poses.crab,i,state,prepared,context());
        projected.set(pose.x,pose.y+(species==='ducks'?.4:.1),pose.z).project(camera);
        if(projected.z>=-1&&projected.z<1&&Math.abs(projected.x)<.93&&Math.abs(projected.y)<.93) {
          discovered.current.add(species);onDiscovery(species);break;
        }
      }
    }
  });
  const count=(kind:Kind)=>kind.startsWith('duck')?(duckCount+NEST_CAPACITY)*(kind==='duckFeet'?2:1):kind.startsWith('crab')?prepared.crabs.length*(kind==='crabLeg'?8:kind==='crabClaw'?2:1):prepared.turtles.length*(kind==='turtleFeet'?4:1);
  const nest=prepared.ducks.find(route=>route.nest);
  return <group name="pond_visitors">
    <group dispose={null}>{(Object.keys(geometry) as Kind[]).map(kind=><instancedMesh key={kind} name={`pond_${kind}`} ref={mesh=>{if(mesh)meshes.current[kind]=mesh;else delete meshes.current[kind];}} args={[geometry[kind],materials[kind],count(kind)]} frustumCulled={false} receiveShadow raycast={noRaycast}/>)}</group>
    {nest&&<PondNest position={[nest.points[64][0],nest.height+.012,nest.points[64][1]]} state={state.nest}/>}
  </group>;
}
