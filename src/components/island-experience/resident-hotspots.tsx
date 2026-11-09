"use client";
import {useLayoutEffect,useMemo,useRef} from 'react';
import {type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import type {IslandLifeLayout} from '@/lib/experience/island-life.mjs';
export default function ResidentHotspots({layout,disabled,onActivity}:{layout?:IslandLifeLayout;disabled:boolean;onActivity?:(id:string)=>void}) {
  const mesh=useRef<THREE.InstancedMesh>(null);
  const points=useMemo(()=>layout?.activityPoints.filter(point=>point.kind==='sitting'||point.kind==='fishing')??[],[layout]);
  const geometry=useMemo(()=>new THREE.BoxGeometry(1.1,.9,1.1),[]);
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  useLayoutEffect(()=>{if(!mesh.current)return;points.forEach((point,index)=>{dummy.position.set(point.position[0],point.position[1]+.25,point.position[2]);dummy.updateMatrix();mesh.current!.setMatrixAt(index,dummy.matrix);});mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();return()=>geometry.dispose();},[points,dummy,geometry]);
  const choose=(event:ThreeEvent<MouseEvent>)=>{if(disabled||event.instanceId===undefined)return;event.stopPropagation();const point=points[event.instanceId];if(point)onActivity?.(point.id);};
  return points.length?<instancedMesh ref={mesh} name="resident_activity_targets" args={[geometry,undefined,points.length]} visible={!disabled} onClick={choose} onPointerOver={event=>{if(!disabled){event.stopPropagation();const target=event.nativeEvent.target;if(target instanceof HTMLCanvasElement)target.style.cursor='pointer';}}} onPointerOut={event=>{const target=event.nativeEvent.target;if(target instanceof HTMLCanvasElement)target.style.cursor='';}}><meshBasicMaterial transparent opacity={0} depthWrite={false}/></instancedMesh>:null;
}
