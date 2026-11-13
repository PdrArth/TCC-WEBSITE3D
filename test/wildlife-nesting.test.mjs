import test from 'node:test';
import assert from 'node:assert/strict';
import {createNestState,advanceNest} from '../src/lib/experience/nesting.mjs';
import {createBirdState,advanceBird} from '../src/lib/experience/bird-life.mjs';
import {foliageSway} from '../src/lib/experience/foliage-motion.mjs';

test('nests require a parent, reveal eggs gradually and have a finite clutch',()=>{
  const nest=createNestState();
  for(let i=0;i<1200;i++)advanceNest(nest,.1,false);assert.equal(nest.eggs,0);
  for(let i=0;i<29;i++)advanceNest(nest,.1,true);assert.equal(nest.eggs,0);
  advanceNest(nest,.1,true);assert.equal(nest.eggs,1);assert.equal(nest.reveal,0);
  for(let i=0;i<1200;i++)advanceNest(nest,.1,true);assert.equal(nest.eggs,1,'one egg per visit, even during a long stay');
  for(let visit=0;visit<8;visit++){
    for(let i=0;i<600;i++)advanceNest(nest,.1,false);
    for(let i=0;i<80;i++)advanceNest(nest,.1,true);
  }
  assert.equal(nest.eggs,3);assert.equal(nest.reveal,1);
  const before=structuredClone(nest);advanceNest(nest,0,true);advanceNest(nest,NaN,true);assert.deepEqual(nest,before);
});

test('a bird stays long enough to lay, returns to its nest and follows a swaying perch',()=>{
  const perches=[{position:[0,3,0],island:'pesquisa',nest:true},{position:[5,4,0],island:'gerar'},{position:[-5,3,2],island:'comparar'}],shelters=[{position:[0,1,12],island:'moradia'}];
  const bird=createBirdState(0,perches,shelters),nest=createNestState();let visits=0,occupied=false,maxPerchError=0;
  for(let frame=0;frame<60*180;frame++){
    perches[0].position[0]=Math.sin(frame/60)*.12;
    advanceBird(bird,1/60,true,perches,shelters);
    const atNest=!bird.flight&&!bird.sheltered&&!bird.shoulder&&perches[bird.perch].nest;
    if(atNest&&!occupied)visits++;occupied=atNest;
    advanceNest(nest,1/60,atNest);
    if(atNest&&bird.rest>1)maxPerchError=Math.max(maxPerchError,Math.abs(bird.pose.x-perches[0].position[0]));
  }
  assert.ok(visits>=3);assert.ok(nest.eggs>=2);assert.ok(maxPerchError<.02,'the bird remains on the moving branch');
});

test('wind animation is bounded and storm gusts are stronger than a calm breeze',()=>{
  let calm=0,storm=0,range=0;
  for(let i=0;i<600;i++){
    const a=foliageSway(i/30,.22,.8,7),b=foliageSway(i/30,1,.8,42);
    calm+=a*a;storm+=b*b;range=Math.max(range,Math.abs(b));
  }
  assert.ok(storm>calm*9);assert.ok(range>.08&&range<.15);
});
