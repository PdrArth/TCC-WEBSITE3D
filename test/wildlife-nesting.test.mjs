import test from 'node:test';
import assert from 'node:assert/strict';
import {createNestState,advanceNest,NEST_CAPACITY,INCUBATION_SECONDS,youngAppearance} from '../src/lib/experience/nesting.mjs';
import {createBirdState,advanceBird} from '../src/lib/experience/bird-life.mjs';
import {createBirdFamily,birdFamilyCare,advanceBirdFamily} from '../src/lib/experience/bird-family.mjs';
import {foliageSway} from '../src/lib/experience/foliage-motion.mjs';
const runNest=(nest,seconds,occupied)=>{for(let i=0;i<Math.round(seconds*60);i++)advanceNest(nest,1/60,occupied);};

test('eggs need an adult to incubate, hatch once and grow into a bounded family',()=>{
  const nest=createNestState();
  runNest(nest,60,false);assert.equal(nest.eggs,0);
  runNest(nest,15,true);assert.equal(nest.eggs,2);assert.equal(nest.young,0);
  const incubated=nest.slots.map(slot=>slot.incubation);
  runNest(nest,60,false);assert.deepEqual(nest.slots.map(slot=>slot.incubation),incubated,'unattended eggs cannot hatch');
  runNest(nest,40,true);assert.equal(nest.eggs,0);assert.equal(nest.young,NEST_CAPACITY);
  let previous=nest.slots.map(youngAppearance);
  for(let frame=0;frame<60*200;frame++){
    advanceNest(nest,1/60,false);
    const next=nest.slots.map(youngAppearance);
    next.forEach((baby,i)=>{assert.ok(baby.growth>=previous[i].growth);assert.ok(baby.growth-previous[i].growth<.001);});
    previous=next;
  }
  assert.equal(nest.phase,'settled');assert.ok(previous.every(baby=>baby.growth===1));
  runNest(nest,1800,true);assert.equal(nest.young,2);assert.equal(nest.eggs,0);assert.equal(nest.slots.length,2,'no accumulating broods');
  const before=structuredClone(nest);advanceNest(nest,0,true);advanceNest(nest,NaN,true);assert.deepEqual(nest,before);
});

test('the parent keeps eggs and small birds covered through rain, storms and clicks; fledging waits for clear weather',()=>{
  const perches=[{position:[0,3,0],island:'pesquisa',nest:true},{position:[5,4,0],island:'gerar'},{position:[-5,3,2],island:'comparar'}],shelters=[{position:[0,1,12],island:'moradia'}];
  const parent=createBirdState(0,perches,shelters),nest=createNestState(),family=createBirdFamily();
  let maxError=0,hatched=false,smallestScale=Infinity,largestScale=0,firstFlight=false;
  for(let frame=0;frame<60*310;frame++){
    const t=frame/60,mayFly=t<4||t>150;
    perches[0].position[0]=Math.sin(t)*.12;
    const care=birdFamilyCare(nest,family,perches);
    advanceBird(parent,1/60,mayFly,perches,shelters,{available:true,position:[10,2,0],heading:0},1,care);
    const atNest=!parent.flight&&!parent.sheltered&&!parent.shoulder&&parent.perch===0;
    advanceNest(nest,1/60,atNest);advanceBirdFamily(family,nest,1/60,mayFly,perches,shelters);
    if(nest.eggs>0){assert.ok(atNest,'weather and startle must not abandon the eggs');assert.equal(parent.pose.brood,1);}
    if(atNest&&t>1)maxError=Math.max(maxError,Math.abs(parent.pose.x-perches[0].position[0]));
    if(t<150)assert.ok(family.children.every(child=>!child.fledged),'first flight is held in bad weather');
    for(const child of family.children)if(child.visible){smallestScale=Math.min(smallestScale,child.scale);largestScale=Math.max(largestScale,child.scale);}
    hatched||=nest.young===2;firstFlight||=family.children.every(child=>child.fledged);
  }
  assert.ok(hatched&&firstFlight);assert.ok(maxError<.02);
  assert.ok(smallestScale<.5&&largestScale>1.3);assert.ok(family.children.length===2);
});

test('hatching is gradual and nursery timers do not advance when the scene is paused',()=>{
  const nest=createNestState();runNest(nest,3.1,true);
  nest.slots[0].incubation=INCUBATION_SECONDS-.02;
  let prior=youngAppearance(nest.slots[0]).reveal,observedIntermediate=false;
  for(let i=0;i<250;i++){
    advanceNest(nest,1/60,true);const current=youngAppearance(nest.slots[0]).reveal;
    assert.ok(current>=prior&&current-prior<.03);observedIntermediate||=current>0&&current<1;prior=current;
  }
  assert.ok(observedIntermediate);
  const frozen=structuredClone(nest);for(let i=0;i<60;i++)advanceNest(nest,0,true);assert.deepEqual(nest,frozen);
});

test('wind animation is bounded and storm gusts are stronger than a calm breeze',()=>{
  let calm=0,storm=0,range=0;
  for(let i=0;i<600;i++){
    const a=foliageSway(i/30,.22,.8,7),b=foliageSway(i/30,1,.8,42);
    calm+=a*a;storm+=b*b;range=Math.max(range,Math.abs(b));
  }
  assert.ok(storm>calm*9);assert.ok(range>.08&&range<.15);
});
