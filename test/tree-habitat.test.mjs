import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeSourceWorld} from '../scripts/world/prepare-runtime-world.mjs';
import {createTreeHabitat,attachTrunkFruit} from '../src/lib/experience/tree-habitat.mjs';
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
