"use client";
import {useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {ScenicActors} from '@/lib/experience/scene-signals';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';
import type {WorldEnvironmentManifest} from '@/lib/experience-contract';
import type {DiscoveryId} from '@/lib/experience/discoveries.mjs';
export default function GardenObservations({active,actors,environment,environmentState,onDiscovery}:{active:boolean;actors:MutableRefObject<ScenicActors>;environment:WorldEnvironmentManifest;environmentState:MutableRefObject<EnvironmentState>;onDiscovery?:(id:DiscoveryId)=>void}) {
  const {camera}=useThree(),clock=useRef(0),point=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((_,delta)=>{
    if(!active||!onDiscovery)return;clock.current+=Math.min(.1,delta);if(clock.current<1)return;clock.current=0;
    const visible=(x:number,y:number,z:number)=>{point.set(x,y,z).project(camera);return point.z>=-1&&point.z<=1&&Math.abs(point.x)<.96&&Math.abs(point.y)<.96;};
    if(actors.current.birds.some(position=>visible(...position)))onDiscovery('birds');
    const state=environmentState.current,[x,z]=environment.water.center;
    if(state.ice<.35&&visible(x,environment.water.height,z))onDiscovery('fish');
    if(state.night<.3&&!['rain','storm','snow','hail','freezing-rain'].includes(state.weather)&&environment.land.some(land=>visible(land.center[0],land.height+.5,land.center[1])))onDiscovery('butterflies');
    if(state.outflow>.01)onDiscovery('waterfall');
  });return null;
}
