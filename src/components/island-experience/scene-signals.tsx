"use client";
import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';
import type {WorldEnvironmentManifest,Vec3} from '@/lib/experience-contract';
import type {ScenicAudioFrame,ScenicActors} from '@/lib/experience/scene-signals';
import {lakeSpillway} from '@/lib/experience/lake-dynamics.mjs';
import {createRenderBudget,advanceRenderBudget,resolutionLimits,mobileViewport} from '@/lib/experience/render-budget.mjs';
export default function SceneSignals({actors,environment,environmentState,active,intro,quality,onSoundFrame,onPixelRatio}:{
  actors:MutableRefObject<ScenicActors>;environment:WorldEnvironmentManifest;environmentState:MutableRefObject<EnvironmentState>;
  active:boolean;intro:boolean;quality:'high'|'low';onSoundFrame?: (frame:ScenicAudioFrame)=>void;onPixelRatio:(ratio:number)=>void;
}){
  const {camera,gl,size}=useThree(),budget=useRef(createRenderBudget(intro?.7:1)),clock=useRef(0),forward=useMemo(()=>new THREE.Vector3(),[]),up=useMemo(()=>new THREE.Vector3(),[]);
  const mobile=mobileViewport(size.width,size.height,typeof window!=='undefined'&&window.matchMedia('(pointer: coarse)').matches);
  const limits=useMemo(()=>resolutionLimits(size.width,size.height,quality,mobile,intro),[size.width,size.height,quality,mobile,intro]);
  const frame=useMemo<ScenicAudioFrame>(()=>{
    const outlet=lakeSpillway(environment),point:Vec3=[outlet.position[0]+outlet.direction[0]*outlet.length,outlet.position[1]-outlet.drop*.5,outlet.position[2]+outlet.direction[1]*outlet.length];
    return {active:false,listener:[0,0,0],forward:[0,0,-1],up:[0,1,0],birds:actors.current.birds,waterfall:{position:point,flow:0}};
  },[actors,environment]);
  useEffect(()=>{budget.current=createRenderBudget(limits.max);onPixelRatio(limits.max);},[limits,onPixelRatio]);
  useEffect(()=>{frame.active=active&&!intro;onSoundFrame?.(frame);return()=>{frame.active=false;onSoundFrame?.(frame);};},[active,intro,frame,onSoundFrame]);
  useFrame((_,delta)=>{
    const ratio=advanceRenderBudget(budget.current,delta,limits,active&&!intro&&document.visibilityState==='visible'&&document.hasFocus());
    if(Math.abs(gl.getPixelRatio()-ratio)>.001)onPixelRatio(ratio);
    clock.current+=Math.min(.1,Math.max(0,delta));if(clock.current<.10)return;clock.current=0;
    camera.getWorldDirection(forward);up.set(0,1,0).applyQuaternion(camera.quaternion);
    camera.position.toArray(frame.listener);forward.toArray(frame.forward);up.toArray(frame.up);frame.birds=actors.current.birds;frame.active=active&&!intro;
    frame.waterfall.flow=environmentState.current.outflow;onSoundFrame?.(frame);
    gl.domElement.setAttribute('data-world-resolution',ratio.toFixed(2));gl.domElement.setAttribute('data-world-resolution-range',[limits.min,limits.max].map(value=>value.toFixed(2)).join(','));
    gl.domElement.setAttribute('data-world-render-pixels',String(gl.domElement.width*gl.domElement.height));
  });return null;
}
