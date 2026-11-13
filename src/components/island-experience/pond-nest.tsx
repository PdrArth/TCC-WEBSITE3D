"use client";

import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {NestState} from '@/lib/experience/nesting.mjs';

const noRaycast=()=>{};

/** One small reed nest on the duck's actual land stop, with a finite clutch. */
export default function PondNest({position,state}:{position:[number,number,number];state:NestState}) {
  const eggs=useRef<(THREE.Mesh|null)[]>([]);
  const eggGeometry=useMemo(()=>new THREE.SphereGeometry(.095,10,8).scale(1,1.35,1),[]);
  const geometry=useMemo(()=>{
    const parts:THREE.BufferGeometry[]=[];
    for(let i=0;i<4;i++) {
      const ring=new THREE.TorusGeometry(.35+i*.018,.035,5,18);
      ring.rotateX(-Math.PI/2);ring.translate(0,.025+i*.023,0);parts.push(ring);
    }
    for(let i=0;i<12;i++) {
      const angle=i*2.39996,twig=new THREE.CylinderGeometry(.009,.015,.28,4);
      twig.rotateZ(Math.PI/2);twig.rotateY(angle);twig.translate(Math.cos(angle)*.36,.07,Math.sin(angle)*.36);parts.push(twig);
    }
    const merged=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());return merged;
  },[]);
  useEffect(()=>()=>{geometry?.dispose();eggGeometry.dispose();},[geometry,eggGeometry]);
  useFrame(()=>{
    eggs.current.forEach((egg,i)=>{
      if(!egg)return;
      const amount=i<state.eggs-1?1:i===state.eggs-1?state.reveal:0;
      egg.visible=amount>0;egg.scale.setScalar(Math.max(.001,amount));
    });
  });
  return <group name="duck_reed_nest" position={position}>
    {geometry&&<mesh geometry={geometry} raycast={noRaycast} receiveShadow castShadow><meshStandardMaterial color="#b5a06c" roughness={1}/></mesh>}
    <mesh rotation-x={-Math.PI/2} position-y={.018} raycast={noRaycast}><circleGeometry args={[.33,16]}/><meshStandardMaterial color="#7b7250" roughness={1}/></mesh>
    {[0,1,2].map(i=><mesh key={i} geometry={eggGeometry} ref={mesh=>{eggs.current[i]=mesh;}} position={[Math.cos(i*2.4)*.13,.15,Math.sin(i*2.4)*.13]} rotation-z={(i-1)*.22} visible={false} raycast={noRaycast} castShadow>
      <meshStandardMaterial color="#f5ebc9" roughness={.85}/>
    </mesh>)}
  </group>;
}
