"use client";
import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {touchRipple,type WaterTouches} from '@/lib/experience/garden-interactions.mjs';
import {lakeWaveParameters} from '@/lib/experience/lake-dynamics.mjs';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';
export default function WaterTouchesView({touches,environmentState,height}:{touches:MutableRefObject<WaterTouches>;environmentState:MutableRefObject<EnvironmentState>;height:number}){
  const {gl}=useThree(),mesh=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]);
  const live=useRef(true),sequence=useRef(-1);
  const count=touches.current.rings.length*2;
  const uniforms=useMemo(()=>({touchTime:{value:0},touchHeight:{value:height},touchAmplitude:{value:0},touchSpeed:{value:1},touchThawed:{value:1}}),[height]);
  const geometry=useMemo(()=>{const g=new THREE.RingGeometry(.86,1,48);g.setAttribute('touchOpacity',new THREE.InstancedBufferAttribute(new Float32Array(count),1));return g;},[count]);
  const material=useMemo(()=>{
    const m=new THREE.MeshBasicMaterial({color:'#effff4',transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide});
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='attribute float touchOpacity; varying float vTouchOpacity; varying float vTouchRim; uniform float touchTime; uniform float touchHeight; uniform float touchAmplitude; uniform float touchSpeed;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTouchOpacity=touchOpacity; vTouchRim=length(position.xy);').replace('#include <project_vertex>',`
        vec4 rippleWorld=modelMatrix*instanceMatrix*vec4(transformed,1.0);
        float t=touchTime*touchSpeed;
        float x=rippleWorld.x,z=rippleWorld.z;
        rippleWorld.y=touchHeight+touchAmplitude*(.6*sin(x*.92+z*.37-t)+.3*sin(-x*.44+z*1.19-t*1.24)+.1*sin(x*2.1+z*1.5-t*1.8))+.055;
        vec4 mvPosition=viewMatrix*rippleWorld;
        gl_Position=projectionMatrix*mvPosition;
      `);
      shader.fragmentShader='varying float vTouchOpacity; varying float vTouchRim; uniform float touchThawed;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(vec3(.28,.49,.43),diffuseColor.rgb,smoothstep(.88,.92,vTouchRim)); diffuseColor.a*=vTouchOpacity*touchThawed;');
    };
    m.customProgramCacheKey=()=> 'garden-touch-rings-v3';return m;
  },[uniforms]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useFrame(()=>{
    if(!mesh.current||!live.current&&sequence.current===touches.current.sequence)return;
    sequence.current=touches.current.sequence;const state=environmentState.current,opacity=geometry.getAttribute('touchOpacity'),wave=lakeWaveParameters(state.wind,state.ice);let active=0;
    uniforms.touchTime.value=state.elapsed;uniforms.touchHeight.value=height+state.waterLevel;uniforms.touchAmplitude.value=wave.amplitude;uniforms.touchSpeed.value=wave.speed;uniforms.touchThawed.value=1-state.ice;
    touches.current.rings.forEach((ring,i)=>{for(let echo=0;echo<2;echo++){
      const p=touchRipple(ring,state.elapsed,echo),index=i*2+echo;
      dummy.position.set(ring.x,height+state.waterLevel,ring.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(p.visible?p.radius:0);dummy.updateMatrix();mesh.current!.setMatrixAt(index,dummy.matrix);opacity.setX(index,p.opacity);if(p.visible)active++;
    }});
    live.current=active>0;mesh.current.visible=live.current;mesh.current.instanceMatrix.needsUpdate=true;opacity.needsUpdate=true;
    gl.domElement.setAttribute('data-garden-touch-count',String(touches.current.sequence));gl.domElement.setAttribute('data-garden-touch-rings',String(active));
  });
  return <instancedMesh ref={mesh} name="garden_touch_ripples" args={[geometry,material,count]} renderOrder={2} frustumCulled={false} raycast={()=>{}} />;
}
