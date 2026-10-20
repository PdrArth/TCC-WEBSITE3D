"use client";
import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {foodCrumbPose,type FeedSpot} from '@/lib/experience/fish-feeding.mjs';
import {lakeWaveHeight} from '@/lib/experience/lake-dynamics.mjs';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';

export default function FishFood({spot,environmentState,height}:{spot:MutableRefObject<FeedSpot>;environmentState:MutableRefObject<EnvironmentState>;height:number}){
  const {gl}=useThree(),mesh=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]),geometry=useMemo(()=>new THREE.IcosahedronGeometry(1,0),[]);
  const previous=useRef({live:true,sequence:-1});
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useFrame(()=>{
    const state=environmentState.current,food=spot.current;
    if(!mesh.current||!previous.current.live&&previous.current.sequence===food.sequence)return;
    previous.current.sequence=food.sequence;let live=0;
    for(let i=0;i<12;i++){
      const pose=foodCrumbPose(i,state.elapsed,food),scale=state.ice>.35?0:pose.scale;
      dummy.position.set(pose.x,height+state.waterLevel+lakeWaveHeight(pose.x,pose.z,state.elapsed,state.wind,state.ice)+.045,pose.z);dummy.scale.setScalar(scale);dummy.rotation.set(0,i*2.3,0);dummy.updateMatrix();mesh.current.setMatrixAt(i,dummy.matrix);live+=Number(scale>0);
    }
    previous.current.live=live>0;mesh.current.visible=live>0;mesh.current.instanceMatrix.needsUpdate=true;
    gl.domElement.setAttribute('data-garden-food-portions',String(food.sequence));gl.domElement.setAttribute('data-garden-food-crumbs',String(live));
  });
  return <instancedMesh ref={mesh} args={[geometry,undefined,12]} name="garden_fish_food" renderOrder={2} frustumCulled={false} raycast={()=>{}}><meshStandardMaterial color="#d8af6a" roughness={.95}/></instancedMesh>;
}
