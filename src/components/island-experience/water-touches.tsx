"use client";
import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {touchRipple,type WaterTouches} from '@/lib/experience/garden-interactions.mjs';
import {lakeWaveHeight} from '@/lib/experience/lake-dynamics.mjs';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';
export default function WaterTouchesView({touches,environmentState,height}:{touches:MutableRefObject<WaterTouches>;environmentState:MutableRefObject<EnvironmentState>;height:number}){
  const {gl}=useThree(),mesh=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]);
  const live=useRef(true),sequence=useRef(-1);
  const count=touches.current.rings.length*2;
  const geometry=useMemo(()=>{const g=new THREE.RingGeometry(.94,1,36);g.setAttribute('touchOpacity',new THREE.InstancedBufferAttribute(new Float32Array(count),1));return g;},[count]);
  const material=useMemo(()=>{
    const m=new THREE.MeshBasicMaterial({color:'#d4eee2',transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide});
    m.onBeforeCompile=shader=>{shader.vertexShader='attribute float touchOpacity; varying float vTouchOpacity;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTouchOpacity=touchOpacity;');shader.fragmentShader='varying float vTouchOpacity;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vTouchOpacity;');};
    m.customProgramCacheKey=()=> 'garden-touch-rings-v1';return m;
  },[]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useFrame(()=>{
    if(!mesh.current||!live.current&&sequence.current===touches.current.sequence)return;
    sequence.current=touches.current.sequence;const state=environmentState.current,opacity=geometry.getAttribute('touchOpacity');let active=0;
    touches.current.rings.forEach((ring,i)=>{for(let echo=0;echo<2;echo++){
      const p=touchRipple(ring,state.elapsed,echo),index=i*2+echo;
      dummy.position.set(ring.x,height+state.waterLevel+lakeWaveHeight(ring.x,ring.z,state.elapsed,state.wind,state.ice)+.025,ring.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(p.visible?p.radius:0);dummy.updateMatrix();mesh.current!.setMatrixAt(index,dummy.matrix);opacity.setX(index,p.opacity);if(p.visible)active++;
    }});
    live.current=active>0;mesh.current.visible=live.current;mesh.current.instanceMatrix.needsUpdate=true;opacity.needsUpdate=true;
    gl.domElement.setAttribute('data-garden-touch-count',String(touches.current.sequence));gl.domElement.setAttribute('data-garden-touch-rings',String(active));
  });
  return <instancedMesh ref={mesh} name="garden_touch_ripples" args={[geometry,material,count]} frustumCulled={false} raycast={()=>{}} />;
}
