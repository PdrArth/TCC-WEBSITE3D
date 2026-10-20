"use client";
import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {flowerBeds,fireflyPresence,fireflyPose} from '@/lib/experience/garden-life.mjs';
import type {WorldEnvironmentManifest} from '@/lib/experience-contract';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';
import type {Season} from '@/lib/experience/seasons.mjs';

export default function Fireflies({environment,environmentState,season,quality,moving,reducedMotion}:{environment:WorldEnvironmentManifest;environmentState:MutableRefObject<EnvironmentState>;season:Season;quality:'high'|'low';moving:boolean;reducedMotion:boolean}){
  const {gl,invalidate}=useThree(),points=useRef<THREE.Points>(null),presence=useRef(0),lastUpdate=useRef(-Infinity),lastCount=useRef(-1);
  const count=quality==='high'?42:24,beds=useMemo(()=>flowerBeds(environment,'high'),[environment]);
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));g.setAttribute('fireflyGlow',new THREE.BufferAttribute(new Float32Array(count),1));return g;},[count]);
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{presence:{value:0},pixelRatio:{value:1}},vertexShader:`attribute float fireflyGlow; varying float glow; uniform float pixelRatio;
    void main(){glow=fireflyGlow;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=20.0*pixelRatio;}`,
    fragmentShader:`varying float glow; uniform float presence;
    void main(){float r=length(gl_PointCoord*2.0-1.0);if(r>1.0)discard;float halo=exp(-r*r*4.0)*(1.0-r);float core=1.0-smoothstep(.10,.28,r);gl_FragColor=vec4(mix(vec3(.75,.91,.35),vec3(1.0,.96,.68),core),presence*glow*(halo*.75+core*.9));
    #include <colorspace_fragment>
    }`}),[]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useEffect(()=>{lastUpdate.current=-Infinity;invalidate();},[season,quality,invalidate]);
  useFrame((_,delta)=>{
    if(!points.current||!beds.length)return;
    const state=environmentState.current,target=fireflyPresence(season,state.weather,state.night,state.wind),dt=moving?Math.min(.1,Math.max(0,delta)):0;
    presence.current+=(target-presence.current)*(1-Math.exp(-dt*1.5));
    if(target===0&&presence.current<.004){presence.current=0;points.current.visible=false;if(lastCount.current!==0){lastCount.current=0;gl.domElement.setAttribute('data-garden-fireflies','0');gl.domElement.setAttribute('data-garden-firefly-intensity','0.000');}return;}
    points.current.visible=presence.current>.004;material.uniforms.presence.value=presence.current;material.uniforms.pixelRatio.value=gl.getPixelRatio();
    if(points.current.visible&&(reducedMotion||state.elapsed-lastUpdate.current>=.05)){
      lastUpdate.current=state.elapsed;const positions=geometry.getAttribute('position'),glows=geometry.getAttribute('fireflyGlow');
      for(let i=0;i<count;i++){const pose=fireflyPose(i,reducedMotion?0:state.elapsed,beds[(i*5)%beds.length]);positions.setXYZ(i,pose.x,pose.y,pose.z);glows.setX(i,pose.glow);}
      positions.needsUpdate=true;glows.needsUpdate=true;
    }
    lastCount.current=points.current.visible?count:0;gl.domElement.setAttribute('data-garden-fireflies',String(lastCount.current));gl.domElement.setAttribute('data-garden-firefly-intensity',presence.current.toFixed(3));
    if(reducedMotion&&Math.abs(target-presence.current)>.005)invalidate();
  });
  return <points ref={points} name="summer_garden_fireflies" geometry={geometry} material={material} renderOrder={3} frustumCulled={false} raycast={()=>{}}/>;
}
