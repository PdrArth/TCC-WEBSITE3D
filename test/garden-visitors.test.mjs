import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFeedSpot,requestFishFood,createFeedingFish,advanceFeedingFish,writeFeedingFishPose,foodCrumbPose} from '../src/lib/experience/fish-feeding.mjs';
import {createFishSchools,fishSegmentIsClear} from '../src/components/island-experience/scene-motion.mjs';
import {fireflyPresence,fireflyPose,flowerBeds} from '../src/lib/experience/garden-life.mjs';
const environment=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v20.json',import.meta.url),'utf8')).environment;
const routes=createFishSchools(environment.fishRoutes,24),emptyPose=()=>({x:0,y:0,z:0,heading:0,tail:0});

test('food is finite, rate limited and restricted to unfrozen water with room for the fish',()=>{
  const spot=createFeedSpot(),water=[0,environment.water.height,-2];
  for(const point of [[-11,0,9],[100,0,100],[NaN,0,0]])assert.equal(requestFishFood(spot,point,0,environment),false);
  assert.equal(requestFishFood(spot,water,0,environment,.8),false);
  assert.equal(requestFishFood(spot,water,0,environment),true);assert.equal(requestFishFood(spot,water,1,environment),false);
  assert.equal(spot.sequence,1);assert.ok(spot.radius>=.45);
  assert.ok(foodCrumbPose(0,.5,spot).scale>0);assert.equal(foodCrumbPose(0,10,spot).visible,false);assert.equal(foodCrumbPose(0,10,spot).scale,0);
  assert.equal(requestFishFood(spot,water,4,environment),true);assert.equal(spot.sequence,2);
});

test('nearby fish approach food, eat in different orbits and return to their route without a jump or a land crossing',()=>{
  const spot=createFeedSpot(),state=createFeedingFish(24);requestFishFood(spot,[0,environment.water.height,-2],0,environment);advanceFeedingFish(state,spot,0,routes,environment);
  const selected=state.fish.map((f,i)=>f.mode==='approach'?i:-1).filter(i=>i>=0);assert.ok(selected.length>0&&selected.length<=6);
  let peak=0;const previous=Array.from({length:24},(_,i)=>({...writeFeedingFishPose(emptyPose(),i,0,routes,state)}));
  for(let frame=1;frame<=45*30;frame++){
    const time=frame/30;advanceFeedingFish(state,spot,time,routes,environment);peak=Math.max(peak,spot.eaters);
    for(const index of selected){const pose=writeFeedingFishPose(emptyPose(),index,time,routes,state),last=previous[index];
      assert.ok(Math.hypot(pose.x-last.x,pose.z-last.z)<1.8/30+.0001,'movement must stay continuous');
      assert.ok(fishSegmentIsClear([last.x,last.z],[pose.x,pose.z],environment,.45),'fish cannot cut across a bank or island');previous[index]={...pose};
    }
  }
  assert.ok(peak>0);assert.ok(state.fish.every(f=>f.mode==='route'));assert.ok(selected.every(i=>state.fish[i].offset>0));assert.equal(state.fish.length,24);
});

test('moving the food or freezing the lake sends swimmers home continuously and does not extend the food lifetime',()=>{
  const spot=createFeedSpot(),state=createFeedingFish(24);requestFishFood(spot,[0,environment.water.height,-2],0,environment);
  for(let frame=0;frame<=120;frame++)advanceFeedingFish(state,spot,frame/30,routes,environment);
  const before=state.fish.map((_,i)=>({...writeFeedingFishPose(emptyPose(),i,4,routes,state)}));
  assert.ok(requestFishFood(spot,[2,environment.water.height,-3],4,environment));advanceFeedingFish(state,spot,4+1/30,routes,environment,.8);
  for(let i=0;i<24;i++){const pose=writeFeedingFishPose(emptyPose(),i,4+1/30,routes,state);assert.ok(Math.hypot(pose.x-before[i].x,pose.z-before[i].z)<.07);}
  assert.equal(spot.eaters,0);assert.equal(requestFishFood(spot,[0,environment.water.height,-2],8,environment,.8),false);
  assert.equal(foodCrumbPose(3,14,spot).visible,false);
});

test('fireflies belong to calm summer nights, with independent smooth light and motion',()=>{
  for(const season of ['spring','autumn','winter'])assert.equal(fireflyPresence(season,'clear',1),0);
  for(const weather of ['drizzle','rain','storm','hail','snow','freezing-rain'])assert.equal(fireflyPresence('summer',weather,1),0);
  assert.equal(fireflyPresence('summer','clear',0),0);assert.ok(fireflyPresence('summer','fog',1)>.9);
  const bed=flowerBeds(environment,'high')[0],pulses=[];
  for(let i=0;i<42;i++){
    const a=fireflyPose(i,20,bed),b=fireflyPose(i,20+1/60,bed);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.02);assert.ok(a.y>bed.y+1.2&&a.y<bed.y+2.1);assert.ok(a.glow>=.26&&a.glow<=1);pulses.push(a.glow.toFixed(3));
  }
  assert.ok(new Set(pulses).size>25,'the lights cannot blink together');
});
