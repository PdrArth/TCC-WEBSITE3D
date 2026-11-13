"use client";

import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import type {NestState} from '@/lib/experience/nesting.mjs';

const noRaycast=()=>{};
const smooth=(value:number)=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};

/** Matching uneven rims form one closed egg before the two shell halves open. */
function shellHalf(upper:boolean){
  const sides=12,rows=6,positions:number[]=[],indices:number[]=[];
  for(let row=0;row<=rows;row++)for(let side=0;side<=sides;side++){
    const angle=(side%sides)*Math.PI*2/sides,seam=Math.PI/2+(side%2?.085:-.085);
    const theta=upper?seam*row/rows:seam+(Math.PI-seam)*row/rows;
    const y=Math.cos(theta),radius=Math.sin(theta)*(1-y*.10);
    positions.push(Math.cos(angle)*radius,y,Math.sin(angle)*radius);
  }
  for(let row=0;row<rows;row++)for(let side=0;side<sides;side++){
    const a=row*(sides+1)+side,b=a+sides+1;
    indices.push(a,a+1,b,b,a+1,b+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

/** Only two fixed slots: egg motion follows the nesting clock and never creates more animals. */
export default function NestEggs({state,variant}:{state:NestState|MutableRefObject<NestState>;variant:'bird'|'duck'}){
  const upper=useRef<THREE.InstancedMesh>(null),lower=useRef<THREE.InstancedMesh>(null);
  const geometry=useMemo(()=>({upper:shellHalf(true),lower:shellHalf(false)}),[]);
  const material=useMemo(()=>new THREE.MeshStandardMaterial({color:variant==='bird'?'#d6e3ce':'#f5ebc9',roughness:.92,flatShading:true,side:THREE.DoubleSide}),[variant]);
  const pose=useMemo(()=>new THREE.Object3D(),[]);
  useEffect(()=>()=>{geometry.upper.dispose();geometry.lower.dispose();},[geometry]);
  useEffect(()=>()=>material.dispose(),[material]);
  useFrame(()=>{
    if(!upper.current||!lower.current)return;
    const nest='current' in state?state.current:state,bird=variant==='bird';
    for(let index=0;index<2;index++){
      const slot=nest.slots?.[index],side=index===0?-1:1,hatch=slot?.hatch??0;
      const reveal=slot?.laid?THREE.MathUtils.clamp(slot.reveal,0,1):0;
      const shell=reveal*(1-smooth((hatch-.55)/.45)),opening=smooth(hatch/.72);
      const shaking=smooth(((slot?.incubation??0)-27)/5)*(1-smooth(hatch/.30));
      const tremor=Math.sin((nest.elapsed??0)*31+index*2.7)*shaking*.055;
      const x=side*(bird?.10:.13),y=bird?.11:.15,z=.06;
      const width=bird?.066:.095,height=bird?.09:.128;
      pose.position.set(x+side*opening*(bird?.095:.13),y+Math.sin(opening*Math.PI)*height*.55,z);
      pose.rotation.set(opening*.18,index*.8,side*(.12+opening*1.18)+tremor);
      pose.scale.set(width*shell,height*shell,width*shell);pose.updateMatrix();upper.current.setMatrixAt(index,pose.matrix);
      pose.position.set(x-side*opening*width*.45,y-opening*height*.17,z-opening*width*.22);
      pose.rotation.set(-opening*.23,index*.8,side*.12-side*opening*.48+tremor);
      pose.updateMatrix();lower.current.setMatrixAt(index,pose.matrix);
    }
    upper.current.instanceMatrix.needsUpdate=true;lower.current.instanceMatrix.needsUpdate=true;
  });
  return <group name={`${variant}_nest_hatching_eggs`} dispose={null}>
    <instancedMesh ref={upper} args={[geometry.upper,material,2]} frustumCulled={false} raycast={noRaycast} castShadow/>
    <instancedMesh ref={lower} args={[geometry.lower,material,2]} frustumCulled={false} raycast={noRaycast} castShadow/>
  </group>;
}
