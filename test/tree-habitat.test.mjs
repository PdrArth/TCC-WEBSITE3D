import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeSourceWorld} from '../scripts/world/prepare-runtime-world.mjs';
import * as THREE from 'three';
import {createTreeHabitat,updateTreeHabitat,attachTrunkFruit} from '../src/lib/experience/tree-habitat.mjs';
import {createBirdState,advanceBird} from '../src/lib/experience/bird-life.mjs';

test('both world assets retain their species, gain nine full crowns and a supported tree nest',async()=>{
  for(const name of ['archipelago-v9.glb','archipelago-v19-low.glb']){
    const {scene}=await decodeSourceWorld(await readFile(new URL('../public/experience/world/'+name,import.meta.url)));
    const habitat=createTreeHabitat(scene);
    assert.equal(habitat.crowns.length,9);assert.equal(habitat.perches.length,10);
    assert.ok(habitat.crowns.every(crown=>!/palmeira|araucaria|banana/.test(crown.name)));
    assert.ok(habitat.nest[0]>-8&&habitat.nest[0]<-6&&habitat.nest[1]>2.5&&habitat.nest[2]>8);
    assert.ok(habitat.perches.every(perch=>perch.position.every(Number.isFinite)&&perch.position[1]>2));
    const untouched=[];scene.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name!=='v9 jabuticaba fruit')untouched.push([mesh,mesh.geometry.attributes.position.array.slice()]);});
    assert.ok(attachTrunkFruit(scene)>=49);assert.equal(attachTrunkFruit(scene),0,'fruit repair is idempotent');
    for(const [mesh,positions] of untouched)assert.deepEqual(mesh.geometry.attributes.position.array,positions,'trees, plants and buildings stay in their authored locations');
    scene.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
  }
});

test('the nest and all tree perches remain attached while the authored branches sway',async()=>{
  const {scene}=await decodeSourceWorld(await readFile(new URL('../public/experience/world/archipelago-v19-low.glb',import.meta.url)));
  const habitat=createTreeHabitat(scene),nest=habitat.nest,perches=[...habitat.perches],positions=perches.map(perch=>perch.position);
  const initial=[...nest],rotations=habitat.crowns.map(crown=>crown.object.rotation.clone());
  assert.equal(perches[0].nest,true);
  for(const crown of habitat.crowns)crown.object.rotation.z+=.09;
  updateTreeHabitat(habitat);
  assert.strictEqual(habitat.nest,nest,'nest coordinates are shared with its consumers');
  assert.ok(Math.hypot(...nest.map((value,index)=>value-initial[index]))>.04,'the tree nest visibly follows the moving branch');
  for(let index=0;index<perches.length;index++){
    const anchor=habitat.anchors[index],expected=anchor.local.clone().applyMatrix4(anchor.object.matrixWorld);
    assert.strictEqual(habitat.perches[index],perches[index]);assert.strictEqual(perches[index].position,positions[index]);
    assert.ok(expected.distanceTo(new THREE.Vector3(...perches[index].position))<1e-8,'a resting bird follows the same physical anchor');
  }
  assert.ok(new THREE.Vector3().setFromMatrixPosition(habitat.nestMatrix).distanceTo(new THREE.Vector3(...nest))<1e-8);
  habitat.crowns.forEach((crown,index)=>crown.object.rotation.copy(rotations[index]));updateTreeHabitat(habitat);
  assert.ok(Math.hypot(...nest.map((value,index)=>value-initial[index]))<1e-8,'wind cycles cannot accumulate drift');
  scene.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
});

test('sheltered birds keep looking, breathing and stretching without sliding off their perch',()=>{
  const perches=[{island:'pesquisa',position:[0,3,0]},{island:'gerar',position:[5,3,0]}],shelters=[{island:'moradia',position:[0,1,5]}];
  const bird=createBirdState(1,perches,shelters,true),looks=new Set(),folds=new Set();
  for(let i=0;i<1200;i++){
    const pose=advanceBird(bird,1/60,false,perches,shelters);
    assert.deepEqual([pose.x,pose.y,pose.z],shelters[0].position);
    looks.add(pose.look.toFixed(3));folds.add(pose.fold.toFixed(3));
  }
  assert.ok(looks.size>100);assert.ok(folds.size>30);assert.equal(bird.flight,null);
});
