import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEnvironmentState, advanceEnvironment, surfaceAt } from '../src/lib/experience/environment.mjs';
import { lakeSpillway, lakeWaveHeight, lakeWaveParameters } from '../src/lib/experience/lake-dynamics.mjs';
import { createFishSchools, faunaCount, fishSegmentIsClear, writeFishPose } from '../src/components/island-experience/scene-motion.mjs';
import { advanceResident, createResidentState, fishingMoment, residentBed, writeResidentPose } from '../src/lib/experience/island-life.mjs';
import { createCaughtFishGeometry } from '../src/lib/experience/life-geometry.mjs';

const manifest=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v20.json',import.meta.url),'utf8'));
const env=manifest.environment, layout=manifest.islandLife;
const tick=(state,seconds,weather)=>{for(let i=0;i<seconds*30;i++)advanceEnvironment(state,1/30,weather,'spring',13);};

test('sustained rain raises a bounded lake and starts overflow only after reaching its stone lip',()=>{
  const state=createEnvironmentState(); tick(state,12,'storm'); assert.equal(state.outflow,0);
  tick(state,10,'storm'); assert.ok(state.outflow>.7); assert.ok(state.waterLevel>=.055&&state.waterLevel<=.09);
  const before=state.outflow; tick(state,1,'clear'); assert.ok(state.outflow>0&&Math.abs(state.outflow-before)<.2,'rain ending cannot switch off the waterfall abruptly');
  tick(state,100,'clear'); assert.ok(state.outflow<.001); assert.ok(state.waterLevel<.001);
  const frozen=structuredClone(state); advanceEnvironment(frozen,0,'storm','winter',21); assert.equal(frozen.waterLevel,state.waterLevel); assert.equal(frozen.outflow,state.outflow);
});

test('overflow uses a finite volume and pauses to refill even during a sustained storm',()=>{
  const state=createEnvironmentState();
  let started=false,stopped=false,restarted=false,longestRun=0,run=0;
  for(let i=0;i<120*30;i++) {
    advanceEnvironment(state,1/30,'storm','spring',13);
    if(state.outflow>.008) {
      if(stopped)restarted=true;
      started=true;run+=1/30;longestRun=Math.max(longestRun,run);
    } else {if(started)stopped=true;run=0;}
    assert.ok(state.waterStorage>=0&&state.waterStorage<=1);
  }
  assert.ok(started&&stopped&&restarted,'a storm must have distinct overflow and refill periods');
  assert.ok(longestRun<13,'the same overflow cannot continue indefinitely');
  tick(state,20,'clear'); assert.ok(state.outflow<.001); assert.equal(state.overflowing,false);
});

test('freezing damps flow, while drizzle does not produce a heavy-rain waterfall',()=>{
  const dry=createEnvironmentState(); tick(dry,120,'drizzle'); assert.equal(dry.outflow,0);
  const frozen=createEnvironmentState(); tick(frozen,50,'storm'); const flowing=frozen.outflow; tick(frozen,40,'freezing-rain'); assert.ok(frozen.outflow<flowing*.2); assert.ok(frozen.ice>.9);
});

test('wind-driven waves are finite, bounded and much stronger in storms than on a calm frozen lake',()=>{
  let calm=0,storm=0;
  for(let t=0;t<40;t+=.2)for(const [x,z] of [[0,0],[-5,3],[10,-8]]) {
    calm=Math.max(calm,Math.abs(lakeWaveHeight(x,z,t,.22)));
    const value=lakeWaveHeight(x,z,t,1); storm=Math.max(storm,Math.abs(value)); assert.ok(Number.isFinite(value)&&Math.abs(value)<=.101);
  }
  assert.ok(storm>calm*5); assert.ok(lakeWaveParameters(1,1).amplitude<lakeWaveParameters(1,0).amplitude*.05);
  assert.ok(env.water.height+.09+lakeWaveParameters(1).amplitude<Math.min(...env.land.map(land=>land.height)),'crests and water rise cannot flood the academic islands');
  const outlet=lakeSpillway(env); assert.ok(outlet.position[2]>14);
  for(const land of [...env.land,...env.decorativeLand])assert.ok(Math.hypot(outlet.position[0]-land.center[0],outlet.position[2]-land.center[1])>land.radius+1.5);
});

test('both quality settings gain visible schools without changing their validated swimming corridors',()=>{
  assert.equal(faunaCount('fish','low'),24); assert.equal(faunaCount('fish','high'),40);
  for(const count of [24,40]) {
    const school=createFishSchools(env.fishRoutes,count); assert.equal(school.routes.length,count);
    for(let i=0;i<count;i++) {
      const route=school.routes[i]; for(let j=0;j<route.points.length;j+=10)assert.ok(fishSegmentIsClear(route.points[j],route.points[(j+1)%route.points.length],env));
      for(const time of [0,30,100]){const p=writeFishPose({},i,time,school); assert.ok(fishSegmentIsClear([p.x,p.z],[p.x,p.z],env,.45)); assert.ok(p.y<env.water.height); const surface=surfaceAt(p.x,p.z,env); if(surface.kind==='land')assert.ok(surface.height-p.y>.28,'raised bridges must stay above the fish');}
      if(i)assert.notEqual(route.speed,school.routes[i-1].speed);
      assert.ok(route.direction===1||route.direction===-1);
    }
  }
});

test('the fishing stop includes a bite, gradual reel and displayed fish, and interruption clears the catch',()=>{
  const geometry=createCaughtFishGeometry(); try {assert.ok(geometry.index.count>100); assert.ok(geometry.attributes.position.array.every(Number.isFinite)); assert.ok(geometry.boundingSphere.radius>.2);} finally {geometry.dispose();}
  assert.equal(fishingMoment(2).caught,false); assert.equal(fishingMoment(2.8).bite,true);
  assert.ok(fishingMoment(3.8).lift>0&&fishingMoment(3.8).lift<1); assert.equal(fishingMoment(5.5).show,true); assert.equal(fishingMoment(7.9).caught,false);
  const resident=createResidentState(layout),day={weather:'clear',hour:13};
  for(let i=0;i<500&&resident.phase!=='fishing';i++)advanceResident(resident,.1,day,layout);
  assert.equal(resident.phase,'fishing');
  for(let i=0;i<55;i++)advanceResident(resident,.1,day,layout);
  const pose=writeResidentPose({},resident,layout); assert.ok(pose.caughtFish&&pose.catchLift>.95);
  advanceResident(resident,.1,{weather:'storm',hour:13},layout); assert.equal(writeResidentPose({},resident,layout).caughtFish,false);
});

test('the bed fits the unchanged house, leaves the door clear and supports nighttime sleep',()=>{
  const bed=residentBed(layout.home); assert.ok(bed.width<1.3&&bed.length<layout.home.footprint[1]); assert.ok(bed.center[0]+bed.width/2<layout.home.door[0]-.5);
  const resident=createResidentState(layout),night={weather:'clear',hour:22,night:1};
  for(let i=0;i<1500&&resident.phase!=='interior';i++)advanceResident(resident,.1,night,layout);
  assert.equal(resident.phase,'interior'); for(let i=0;i<20;i++)advanceResident(resident,.1,night,layout);
  const pose=writeResidentPose({},resident,layout); assert.ok(pose.sleeping); assert.equal(pose.sleepBlend,1); assert.equal(pose.seated,false); assert.deepEqual([pose.x,pose.y,pose.z],bed.foot);
  advanceResident(resident,.1,{...night,weather:'storm'},layout); assert.equal(resident.shelterReason,'weather'); assert.equal(writeResidentPose({},resident,layout).sleeping,true,'a rainy night still means sleeping in bed');
  for(let i=0;i<800;i++)advanceResident(resident,.1,night,layout);
  assert.equal(resident.phase,'interior'); assert.equal(writeResidentPose({},resident,layout).sleeping,true);
  for(let i=0;i<20;i++)advanceResident(resident,.1,{weather:'clear',hour:9,night:0},layout);
  assert.equal(writeResidentPose({},resident,layout).sleeping,false);
});
