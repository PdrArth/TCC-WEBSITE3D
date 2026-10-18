import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {optimizeWorld,selectedBatchPavilion} from "../src/components/island-experience/optimize-world.mjs";
import {createEnvironmentManifest,createEnvironmentState,advanceEnvironment,surfaceAt} from "../src/lib/experience/environment.mjs";

test("batching preserves world-space geometry and selection of different pavilions",()=>{
 const scene=new THREE.Group(),material=new THREE.MeshStandardMaterial({name:"Wall"});
 for(const [id,x] of [["pesquisa",-11],["gerar",14]]){
  const group=new THREE.Group();group.name=`pavilion_${id}`;group.position.x=x;
  for(let i=0;i<4;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);mesh.position.z=i;group.add(mesh);}scene.add(group);
 }
 const result=optimizeWorld(scene,"low");assert.equal(result.originalPrimitives,8);assert.equal(result.primitives,1);
 const mesh=scene.children.find(o=>o.isMesh);mesh.geometry.computeBoundingBox();
 assert.equal(mesh.geometry.boundingBox.min.x,-11.5);assert.equal(mesh.geometry.boundingBox.max.x,14.5);
 assert.equal(selectedBatchPavilion(mesh,0),"pesquisa");assert.equal(selectedBatchPavilion(mesh,48),"gerar");
 assert.equal(selectedBatchPavilion(mesh,undefined),null);
});
test("animated foliage pivots and the water retain their geometry and names",()=>{
 const scene=new THREE.Group(),material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry();
 const water=new THREE.Mesh(geometry,material);water.name="lake_water";scene.add(water);
 const crown=new THREE.Group();crown.name="ambient_leaves_pesquisa_ipe";const leaf=new THREE.Mesh(geometry,material);crown.add(leaf);scene.add(crown);
 const staticMesh=new THREE.Mesh(geometry,material);scene.add(staticMesh);
 let disposed=false;geometry.addEventListener("dispose",()=>{disposed=true;});
 optimizeWorld(scene,"high");
 assert.equal(scene.getObjectByName("lake_water"),water);assert.equal(scene.getObjectByName(crown.name),crown);assert.equal(crown.children[0],leaf);
 assert.equal(disposed,false,"A geometry shared with animation must not be disposed by batching");
});
test("precipitation distinguishes shores, islands and bridges across the actual lake",()=>{
 const env=createEnvironmentManifest();
 for(const [x,z] of [[0,0],[-18,0],[18,0],[0,15]])assert.equal(surfaceAt(x,z,env).kind,"water");
 assert.equal(surfaceAt(-11,9,env).kind,"land");assert.equal(surfaceAt(-12.5,4,env).kind,"land");
 assert.equal(surfaceAt(40,40,env).kind,"outside");assert.equal(surfaceAt(0,0,env).height,-.16);
});
test("snow and edge ice accumulate and thaw gradually without changing seasons",()=>{
 const state=createEnvironmentState("clear","winter",21);
 for(let i=0;i<200;i++)advanceEnvironment(state,.1,"snow","winter",21);
 assert.equal(state.snow,1);assert.equal(state.ice,1);assert.ok(state.night>.95);
 for(let i=0;i<100;i++)advanceEnvironment(state,.1,"clear","winter",13);
 assert.ok(state.snow>0&&state.snow<1);assert.ok(state.ice>0&&state.ice<1);assert.equal(state.season,"winter");
});
