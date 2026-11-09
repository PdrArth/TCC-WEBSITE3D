import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {surfaceAt} from '../src/lib/experience/environment.mjs';
import {createPondVisitors,createPondVisitorState,advancePondVisitors,writeDuckPose,writeTurtlePose,duckSegmentIsClear,turtleGroundIsClear} from '../src/lib/experience/pond-visitors.mjs';
const environment=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v20.json',import.meta.url),'utf8')).environment;
const calm={weather:'clear',hour:13,ice:0,wind:.2,active:true,moving:true};
const run=(state,prepared,seconds,context=calm,fps=60)=>{for(let frame=0;frame<Math.round(seconds*fps);frame++)advancePondVisitors(state,1/fps,context,prepared);return state;};

test('duck loops use open water with body clearance and cannot swim under any pedestrian bridge',()=>{
  const visitors=createPondVisitors(environment,'high');assert.equal(visitors.ducks.length,4);assert.equal(visitors.turtles.length,2);
  for(const route of visitors.ducks) {
    assert.ok(route.length>4);
    for(let i=0;i<route.points.length;i++)assert.ok(duckSegmentIsClear(route.points[i],route.points[(i+1)%route.points.length],environment),'every visible chord needs body and bridge clearance');
  }
  const bridge=environment.bridges.find(bridge=>Math.hypot(bridge.to[0]-bridge.from[0],bridge.to[1]-bridge.from[1])>2),middle=bridge.from.map((v,i)=>(v+bridge.to[i])/2);
  assert.equal(duckSegmentIsClear(middle,middle,environment),false);
  const low=createPondVisitors(environment,'low');assert.equal(low.ducks.length,3);assert.equal(low.turtles.length,2);
});

test('turtles rest and crawl on real shore land rather than through the lake, beds or pavilions',()=>{
  const visitors=createPondVisitors(environment,'high'),state=createPondVisitorState(visitors);let walked=false,rested=false;
  for(const route of visitors.turtles) {
    const island=environment.land.find(island=>island.id===route.island);
    for(let i=0;i<=100;i++){const t=i/100,a=route.points[0],b=route.points[1];assert.ok(turtleGroundIsClear([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],island,environment));}
  }
  for(let frame=0;frame<60*80;frame++) {
    advancePondVisitors(state,1/60,calm,visitors);
    for(let i=0;i<visitors.turtles.length;i++) {
      const pose=writeTurtlePose({},i,state,visitors,calm),surface=surfaceAt(pose.x,pose.z,environment);
      assert.equal(surface.kind,'land');assert.ok(Math.abs(pose.y-surface.height-.085)<1e-8);
      walked||=pose.mode==='crawling';rested||=pose.mode==='resting';
    }
  }
  assert.ok(walked&&rested,'the turtle has long resting periods between short crawls');
});

test('weather changes send visitors to their prepared resting points without a jump or unsafe shortcut',()=>{
  const prepared=createPondVisitors(environment,'high'),state=createPondVisitorState(prepared);run(state,prepared,16);
  let ducks=state.ducks.map((_,i)=>writeDuckPose({},i,state,prepared,calm)),turtles=state.turtles.map((_,i)=>writeTurtlePose({},i,state,prepared,calm));
  const storm={...calm,weather:'storm',ice:.8,wind:1};
  for(let frame=0;frame<60*60;frame++) {
    advancePondVisitors(state,1/60,storm,prepared);
    for(let i=0;i<prepared.ducks.length;i++) {
      const pose=writeDuckPose({},i,state,prepared,storm),previous=ducks[i];
      assert.ok(Math.hypot(pose.x-previous.x,pose.z-previous.z)<.9/60+.00001);
      assert.ok(duckSegmentIsClear([previous.x,previous.z],[pose.x,pose.z],environment));ducks[i]=pose;
    }
    for(let i=0;i<prepared.turtles.length;i++) {
      const pose=writeTurtlePose({},i,state,prepared,storm),previous=turtles[i];assert.ok(Math.hypot(pose.x-previous.x,pose.z-previous.z)<.16/60+.00001);turtles[i]=pose;
    }
  }
  assert.ok(state.ducks.every(duck=>duck.mode==='resting'&&duck.tuck>.85));
  assert.ok(state.turtles.every(turtle=>turtle.mode==='resting'&&turtle.tuck>.91));
  const positions=state.ducks.map((_,i)=>writeDuckPose({},i,state,prepared,storm));advancePondVisitors(state,1/60,calm,prepared);
  state.ducks.forEach((_,i)=>{const pose=writeDuckPose({},i,state,prepared,calm);assert.ok(Math.hypot(pose.x-positions[i].x,pose.z-positions[i].z)<.012);});
});

test('visitor clocks and routes are independent of frame rate, and inactive or reduced-motion scenes stay still',()=>{
  const prepared=createPondVisitors(environment,'high'),low=createPondVisitorState(prepared),high=createPondVisitorState(prepared);
  run(low,prepared,45,calm,30);run(high,prepared,45,calm,120);
  assert.ok(Math.abs(low.elapsed-high.elapsed)<1e-8);
  for(let i=0;i<prepared.ducks.length;i++) {
    const a=writeDuckPose({},i,low,prepared,calm),b=writeDuckPose({},i,high,prepared,calm);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-8);
  }
  for(let i=0;i<prepared.turtles.length;i++)assert.ok(Math.abs(low.turtles[i].distance-high.turtles[i].distance)<1e-8);
  const before=structuredClone(low);
  for(const options of [{active:false},{moving:false},{reducedMotion:true}])run(low,prepared,30,{...calm,...options});
  assert.deepEqual(low,before);
  advancePondVisitors(low,NaN,calm,prepared);advancePondVisitors(low,-1,calm,prepared);assert.deepEqual(low,before);
  const first=writeDuckPose({},0,low,prepared,calm),second=writeDuckPose({},1,low,prepared,calm);
  assert.ok(Math.hypot(first.x-second.x,first.z-second.z)>2,'independent water areas do not turn into a single-file procession');
});
