"use client";

import {useEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {seasonInfo,vegetationDensity,type Season} from '@/lib/experience/seasons.mjs';
import type {EnvironmentState} from '@/lib/experience/environment.mjs';
import {updateTreeHabitat,type TreeHabitat} from '@/lib/experience/tree-habitat.mjs';
import type {NestState} from '@/lib/experience/nesting.mjs';
import NestEggs from './nest-eggs';

const noRaycast=()=>{};

/** A handful of overlapping, irregular leaf clusters fill the existing broadleaf crowns. */
export default function LivingTrees({habitat,season,environmentState,nesting}:{habitat:TreeHabitat;season:Season;environmentState:MutableRefObject<EnvironmentState>;nesting?:MutableRefObject<NestState>}){
  const {gl}=useThree();
  const leaves=useRef<THREE.InstancedMesh>(null),clock=useRef(-Infinity);
  const nest=useRef<THREE.Group>(null);
  const seasonal=useRef<{density:number;color:THREE.Color}[]>([]);
  const pose=useMemo(()=>new THREE.Object3D(),[]),matrix=useMemo(()=>new THREE.Matrix4(),[]);
  const color=useMemo(()=>new THREE.Color(),[]),snow=useMemo(()=>new THREE.Color('#e8ece2'),[]),evergreen=useMemo(()=>new THREE.Color(seasonInfo.summer.palette.dark),[]);
  const geometry=useMemo(()=>new THREE.IcosahedronGeometry(1,1),[]);
  const clusters=useMemo(()=>habitat.crowns.flatMap((crown,index)=>Array.from({length:8},(_,i)=>{
    const angle=i*2.39996+crown.seed,outer=i>0;
    return {crown,index,i,x:crown.center[0]+(outer?Math.cos(angle)*crown.radius*.49:0),y:crown.center[1]+(outer?Math.sin(i*1.7)*crown.height*.18:.16),z:crown.center[2]+(outer?Math.sin(angle)*crown.radius*.46:0),size:outer?.57+(i%3)*.035:.76};
  })),[habitat]);
  const nestGeometry=useMemo(()=>{
    if(!habitat.nest)return null;
    const parts:THREE.BufferGeometry[]=[];
    for(let i=0;i<4;i++){
      const ring=new THREE.TorusGeometry(.32+i*.017,.035,5,15);ring.rotateX(-Math.PI/2);ring.translate(0,i*.025,0);parts.push(ring);
    }
    const makeTwig=(from:THREE.Vector3,to:THREE.Vector3,radius:number)=>{
      const direction=to.clone().sub(from),part=new THREE.CylinderGeometry(radius*.7,radius,direction.length(),5);
      part.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));part.translate(...from.clone().add(to).multiplyScalar(.5).toArray());parts.push(part);
    };
    for(let i=0;i<11;i++){
      const angle=i*2.39996,at=new THREE.Vector3(Math.cos(angle)*.34,.03+i%3*.026,Math.sin(angle)*.34);
      makeTwig(at.clone().add(new THREE.Vector3(-Math.sin(angle)*.14,0,Math.cos(angle)*.14)),at.clone().add(new THREE.Vector3(Math.sin(angle)*.14,.03,-Math.cos(angle)*.14)),.012);
    }
    const crown=habitat.crowns.find(item=>item.name==='ambient_leaves_pesquisa_jabuticabeira')??habitat.crowns[0];
    const trunk=crown.object.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3(...habitat.nest));trunk.y=-.48;
    makeTwig(trunk,new THREE.Vector3(0,-.05,0),.066);
    makeTwig(trunk.clone().lerp(new THREE.Vector3(0,-.05,0),.7),new THREE.Vector3(.25,-.035,.14),.025);
    const merged=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());return merged;
  },[habitat]);
  useEffect(()=>()=>{geometry.dispose();nestGeometry?.dispose();},[geometry,nestGeometry]);
  useEffect(()=>{clock.current=-Infinity;seasonal.current=[];},[habitat]);
  useFrame(()=>{
    const state=environmentState.current;
    updateTreeHabitat(habitat);
    if(nest.current){nest.current.matrix.copy(habitat.nestMatrix);nest.current.updateMatrixWorld(true);}
    if(!leaves.current||state.elapsed-clock.current<.05)return;
    const delta=Number.isFinite(clock.current)?Math.max(0,state.elapsed-clock.current):0;
    const alpha=1-Math.exp(-.85*delta);
    clock.current=state.elapsed;
    for(let index=0;index<clusters.length;index++){
      const cluster=clusters[index],crown=cluster.crown,density=vegetationDensity(season,crown.name);
      const palette=seasonInfo[season].palette;
      color.set(cluster.i%3===0?palette.sage:cluster.i%3===1?palette.dark:palette.deep);
      if(/jabuticabeira|pitangueira/.test(crown.name))color.lerp(evergreen,.40);
      color.lerp(snow,state.snow*.68);
      const progress=seasonal.current[index]??={density,color:color.clone()};
      progress.density+=(density-progress.density)*alpha;progress.color.lerp(color,alpha);
      const richness=.38+.62*progress.density;
      const wind=.018+state.wind*state.wind*.065,phase=crown.seed+cluster.i*1.71;
      const sway=(Math.sin(state.elapsed*1.3+phase)+Math.sin(state.elapsed*.43+crown.seed)*.45)*wind;
      const flutter=Math.sin(state.elapsed*(2.1+cluster.i*.11)+phase)*wind*.35;
      pose.position.set(cluster.x+sway,cluster.y+flutter*.23,cluster.z+sway*.38);
      pose.rotation.set(cluster.i*.23+flutter,crown.seed+cluster.i*.48+sway*.4,cluster.i*.13+flutter*.65);
      pose.scale.set(crown.radius*cluster.size*richness,crown.height*cluster.size*.55*richness,crown.radius*cluster.size*(.86+cluster.i%2*.12)*richness);
      pose.updateMatrix();matrix.multiplyMatrices(crown.object.matrixWorld,pose.matrix);leaves.current.setMatrixAt(index,matrix);
      leaves.current.setColorAt(index,progress.color);
    }
    leaves.current.instanceMatrix.needsUpdate=true;if(leaves.current.instanceColor)leaves.current.instanceColor.needsUpdate=true;
    gl.domElement.setAttribute('data-garden-full-crowns',String(habitat.crowns.length));
    gl.domElement.setAttribute('data-garden-bird-nests',String(habitat.nest?1:0));
    gl.domElement.setAttribute('data-garden-canopy-density',seasonal.current.map(value=>value.density.toFixed(3)).filter((_,index)=>index%8===0).join(','));
    gl.domElement.setAttribute('data-garden-nest-position',habitat.nest?.map(value=>value.toFixed(3)).join(',')??'');
  });
  return <group name="garden_canopy_habitat">
    <instancedMesh name="garden_full_broadleaf_crowns" ref={leaves} args={[geometry,undefined,clusters.length]} frustumCulled={false} raycast={noRaycast} castShadow receiveShadow><meshStandardMaterial color="#ffffff" roughness={.93} flatShading/></instancedMesh>
    {nestGeometry&&habitat.nest&&<group ref={nest} name="bird_nest_on_research_tree" matrixAutoUpdate={false}>
      <mesh geometry={nestGeometry} raycast={noRaycast} castShadow><meshStandardMaterial color="#88704e" roughness={1}/></mesh>
      <mesh position={[0,.005,0]} rotation-x={-Math.PI/2} raycast={noRaycast}><circleGeometry args={[.30,16]}/><meshStandardMaterial color="#5c503b" roughness={1} side={THREE.DoubleSide}/></mesh>
      {nesting&&<NestEggs state={nesting} variant="bird"/>}
    </group>}
  </group>;
}
