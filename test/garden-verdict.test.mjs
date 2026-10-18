import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {decodeSourceWorld} from '../scripts/world/prepare-runtime-world.mjs';
import {bankAnchor,groundShoreStones} from '../src/lib/experience/shore-stones.mjs';
import {createBirdState,advanceBird} from '../src/lib/experience/bird-life.mjs';
import {createResidentState,advanceResident,writeResidentPose,sampleLifePath} from '../src/lib/experience/island-life.mjs';
import {surfaceAt} from '../src/lib/experience/environment.mjs';
const manifest=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v20.json',import.meta.url),'utf8'));
const {birdPerches:perches,birdShelters:shelters,islandLife:layout,environment}=manifest;
const xyz=pose=>[pose.x,pose.y,pose.z],dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('all 67 authored shore pebbles fit the irregular bank in both render qualities',async()=>{
 for(const asset of [manifest.assets.world,manifest.assets.worldLow]){
  const {scene}=await decodeSourceWorld(await readFile(new URL('../public'+asset,import.meta.url)));
  const untouched=[];scene.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name!=='Rock limestone')untouched.push([mesh,mesh.geometry.attributes.position.array.slice()]);});
  assert.equal(groundShoreStones(scene,environment),67);assert.equal(groundShoreStones(scene,environment),0,'applying twice must not move the stones again');
  for(const [mesh,positions] of untouched)assert.deepEqual(mesh.geometry.attributes.position.array,positions,'island/building geometry stays byte-exact');
  scene.traverse(mesh=>{if(!mesh.isMesh||mesh.material.name!=='Rock limestone')return;const attr=mesh.geometry.attributes.position,p=new THREE.Vector3();for(let i=0;i<attr.count;i++){
   p.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);const anchor=bankAnchor(p.x,p.z,environment);if(!anchor)continue;
   const [cx,cz]=environment.water.center,r=Math.hypot(p.x-cx,p.z-cz)/Math.hypot(anchor.x-cx,anchor.z-cz);
   assert.ok(r>.975&&r<1.025,`stone vertex outside the bank: ${r}`);
  }});
  scene.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
 }
});

test('rain transitions and mid-flight reversals preserve bird position and have bounded speed',()=>{
 for(let i=0;i<12;i++){
  const state=createBirdState(i,perches,shelters),dt=1/60;let previous=xyz(state.pose),travel=0,arched=false;
  for(let frame=0;frame<3000;frame++){
   const fly=frame<120||frame>=220&&frame<300||frame>=1800;
   const pose=advanceBird(state,dt,fly,perches,shelters);const step=dist(xyz(pose),previous);
   assert.ok(step<.18,`bird ${i} snapped ${step}m on frame ${frame}`);assert.ok(Object.values(pose).every(Number.isFinite));travel+=step;arched ||= pose.y>4;previous=xyz(pose);
   if(frame===1750){assert.equal(state.sheltered,true);assert.ok(dist(xyz(pose),shelters[i%shelters.length].position)<1e-7);}
  }
  assert.ok(travel>20&&arched);assert.equal(state.sheltered,false);
 }
});

test('the companion lands on a shoulder and departs continuously when the resident stands',()=>{
 const state=createBirdState(0,perches,shelters),companion={available:true,position:[-11,.092+1.36,12.4],heading:0};
 for(let f=0;f<2400&&!state.shoulder;f++)advanceBird(state,1/60,true,perches,shelters,companion);
 assert.ok(state.shoulder);assert.ok(dist(xyz(state.pose),companion.position)<1e-7);
 const previous=xyz(state.pose);companion.available=false;advanceBird(state,1/60,true,perches,shelters,companion);
 assert.equal(state.shoulder,false);assert.ok(state.flight);assert.ok(dist(previous,xyz(state.pose))<.01);
});

test('each island has a water-facing fishing spot and seats reuse physical stairs and furniture',async()=>{
 const fishing=layout.activityPoints.filter(a=>a.kind==='fishing');assert.equal(new Set(fishing.map(a=>a.island).filter(Boolean)).size,7);
 for(const activity of fishing)assert.equal(surfaceAt(activity.target[0],activity.target[2],environment).kind,'water',activity.id);
 const {scene}=await decodeSourceWorld(await readFile(new URL('../public'+manifest.assets.world,import.meta.url)));scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
 for(const edge of layout.walkingGraph.edges.filter(e=>e.kind==='furniture'))for(let d=0;d<=edge.length;d+=.08){
  const p=sampleLifePath(edge.points,d);ray.set(new THREE.Vector3(p[0],p[1]+.15,p[2]),new THREE.Vector3(0,-1,0));const [hit]=ray.intersectObject(scene,true);
  assert.ok(hit&&p[1]-hit.point.y<.05,`${edge.id} must have an actual step or floor beneath it`);
 }
 for(const activity of layout.activityPoints.filter(a=>a.kind==='sitting')){
  ray.set(new THREE.Vector3(activity.position[0],activity.seatHeight+.1,activity.position[2]),new THREE.Vector3(0,-1,0));const [hit]=ray.intersectObject(scene,true);
  assert.ok(hit&&Math.abs(hit.point.y-activity.seatHeight)<.03,`${activity.id} seat must match the original model`);
  const state=createResidentState(layout);Object.assign(state,{phase:'sitting',phaseTime:3,position:[...activity.position],activityIndex:layout.activityPoints.indexOf(activity)});
  const pose=writeResidentPose({},state,layout);assert.ok(Math.abs(pose.y+pose.bodyOffsetY+.52*layout.resident.scale-activity.seatHeight)<.001);
 }
 scene.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
});

test('changing the time while already indoors reclines gradually and keeps sleep through storms',()=>{
 const state=createResidentState(layout),day={weather:'storm',hour:14,night:0};
 for(let i=0;i<1600&&state.phase!=='interior';i++)advanceResident(state,.1,day,layout);
 for(let i=0;i<300;i++)advanceResident(state,.1,day,layout);assert.equal(state.sleepBlend,0);
 advanceResident(state,1/60,{...day,hour:22,night:1},layout);const first=writeResidentPose({},state,layout);assert.ok(first.sleepBlend>0&&first.sleepBlend<.01);
 for(let i=0;i<1200;i++)advanceResident(state,.1,{...day,hour:22,night:1},layout);assert.equal(state.phase,'interior');assert.equal(writeResidentPose({},state,layout).sleepBlend,1);
});
