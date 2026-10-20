import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWaterTouches,addWaterTouch,touchRipple,createGreeting,requestGreeting,advanceGreeting,advanceResidentWithGreeting} from '../src/lib/experience/garden-interactions.mjs';
import {createResidentState,writeResidentPose,advanceResident} from '../src/lib/experience/island-life.mjs';
import {resolutionLimits,createRenderBudget,advanceRenderBudget} from '../src/lib/experience/render-budget.mjs';
const world=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v20.json',import.meta.url),'utf8')),environment=world.environment;

test('water taps stay on unfrozen water, respect shore clearance and reuse a finite pool',()=>{
  const touches=createWaterTouches(8),water=[0,-.16,-2];
  assert.equal(addWaterTouch(touches,[-11,.092,9],0,environment),false);
  assert.equal(addWaterTouch(touches,[100,0,100],0,environment),false);
  assert.equal(addWaterTouch(touches,water,0,environment,.8),false);
  assert.equal(addWaterTouch(touches,water,NaN,environment),false);
  for(let i=0;i<40;i++)assert.ok(addWaterTouch(touches,water,i*.25,environment));
  assert.equal(touches.rings.length,8);assert.equal(touches.sequence,40);
  assert.equal(addWaterTouch(touches,water,9.80,environment),false,'a rapid duplicate tap is ignored');
  const ring=touches.rings[7];assert.ok(ring.radius>1.3&&ring.radius<=1.65);
  assert.ok(touchRipple(ring,ring.born+.5).opacity>.1);
  assert.ok(touchRipple(ring,ring.born+1).radius>touchRipple(ring,ring.born+.2).radius);
  assert.ok(touchRipple(ring,ring.born+1.8).visible,'a tap stays readable for more than the old 1.65 seconds');
  for(const echo of [0,1])assert.equal(touchRipple(ring,ring.born+3,echo).visible,false);
});

test('a greeting stops the route, turns the body before waving and resumes from the same foot position',()=>{
  const state=createResidentState(world.islandLife,1),greeting=createGreeting(),pose=writeResidentPose({},state,world.islandLife);
  greeting.welcomePending=false;requestGreeting(greeting);
  const position=[...state.position],routeDistance=state.routeDistance,gait=state.gait,cameraHeading=state.heading+1.4;
  const context={weather:'clear',hour:13,moving:true,visible:true},camera={distance:40,cameraHeading};
  let gesture=advanceResidentWithGreeting(state,greeting,pose,.1,context,world.islandLife,camera);
  assert.equal(gesture.active,true);assert.equal(gesture.wave,0,'he turns before lifting his arm');
  for(let i=0;i<18;i++)gesture=advanceResidentWithGreeting(state,greeting,pose,.1,context,world.islandLife,camera);
  assert.deepEqual(state.position,position);assert.equal(state.routeDistance,routeDistance);assert.equal(state.gait,gait);
  assert.ok(Math.abs(Math.atan2(Math.sin(cameraHeading-state.heading),Math.cos(cameraHeading-state.heading)))<.002);
  assert.ok(gesture.wave>.99);assert.equal(Math.abs(pose.leftLeg),0);assert.equal(Math.abs(pose.rightLeg),0);
  for(let i=0;i<21;i++)advanceResidentWithGreeting(state,greeting,pose,.1,context,world.islandLife,camera);
  assert.ok(state.routeDistance>routeDistance);assert.ok(Math.hypot(...state.position.map((v,i)=>v-position[i]))<.6,'resume has no teleport');
  assert.equal(greeting.count,1);
});

test('the welcome waits for entry and availability, while a new storm interrupts a greeting immediately',()=>{
  const state=createResidentState(world.islandLife,2),greeting=createGreeting(),pose=writeResidentPose({},state,world.islandLife),camera={distance:40,cameraHeading:1.2};
  const context={weather:'clear',hour:13,moving:true,visible:true};
  for(let i=0;i<10;i++)advanceResidentWithGreeting(state,greeting,pose,.1,{...context,intro:true},world.islandLife,camera);
  assert.equal(greeting.count,0);
  advanceResidentWithGreeting(state,greeting,pose,.1,context,world.islandLife,camera);assert.equal(greeting.count,1);
  const before=[...state.position];advanceResidentWithGreeting(state,greeting,pose,.1,{...context,weather:'storm'},world.islandLife,camera);
  assert.equal(state.phase,'returning');assert.equal(greeting.age,10);assert.ok(Math.hypot(...state.position.map((v,i)=>v-before[i]))<=.216);
  for(let i=0;i<10;i++)advanceResidentWithGreeting(state,greeting,pose,.1,{...context,hour:23},world.islandLife,camera);
  assert.equal(greeting.count,1,'bedtime cannot trigger another welcome');
});

test('a click cannot interrupt the first reach of fruit gathering before the fruit becomes visible',()=>{
  const state=createResidentState(world.islandLife,3),greeting=createGreeting(),pose=writeResidentPose({},state,world.islandLife),context={weather:'clear',hour:13,moving:true,visible:true};
  for(let i=0;i<5000&&state.phase!=='gathering';i++)advanceResident(state,.1,context,world.islandLife);
  assert.equal(state.phase,'gathering');greeting.welcomePending=false;requestGreeting(greeting);
  const gesture=advanceResidentWithGreeting(state,greeting,pose,.1,context,world.islandLife,{distance:40,cameraHeading:1});
  assert.equal(pose.fruit,false);assert.equal(gesture.active,false);assert.equal(greeting.count,0);assert.ok(state.phaseTime>0);
});

test('the resident acknowledges approach once, re-arms at a distance and respects occupied or sheltered activities',()=>{
  const state=createGreeting(),near={available:true,distance:7,heading:0,cameraHeading:.5};
  advanceGreeting(state,.1,near);assert.equal(state.count,1);
  for(let i=0;i<10;i++)advanceGreeting(state,.1,near);
  const greeting=advanceGreeting(state,.1,near);assert.ok(greeting.wave>.99);assert.ok(greeting.look>0);
  for(let i=0;i<350;i++)advanceGreeting(state,.1,near);
  assert.equal(state.count,1,'remaining close must not repeat the wave');
  advanceGreeting(state,.1,{...near,distance:16});advanceGreeting(state,.1,near);assert.equal(state.count,2);
  for(let i=0;i<100;i++){requestGreeting(state);const p=advanceGreeting(state,.1,{...near,available:false});assert.equal(p.wave,0);}
  assert.equal(state.count,2,'sleep, fishing, fruit picking, watering and shelter are not interrupted');
  requestGreeting(state);advanceGreeting(state,.1,near);assert.equal(state.count,3);
});

test('adaptive resolution decreases sustained render cost without reacting to a background one-FPS stream',()=>{
  const limits=resolutionLimits(390,844,'low',true),state=createRenderBudget(1);
  for(let i=0;i<210;i++)advanceRenderBudget(state,.05,limits,true);
  assert.ok(state.value<=.81&&state.value>=limits.min);
  const slow=state.value;
  for(let i=0;i<200;i++)advanceRenderBudget(state,1,limits,true);
  assert.equal(state.value,slow,'a throttled tab cannot cause a downgrade');
  for(let i=0;i<100;i++)advanceRenderBudget(state,.05,limits,false);
  assert.equal(state.value,slow,'inactive views cannot change quality');
  for(let i=0;i<1000;i++)advanceRenderBudget(state,1/60,limits,true);
  assert.ok(state.value>slow&&state.value<=limits.max);
  const detailed=resolutionLimits(430,932,'high',true);
  assert.ok(430*932*detailed.max**2<=720001);
  assert.ok(resolutionLimits(844,390,'low',true).max===limits.max);
});
