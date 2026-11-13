import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {decodeSourceWorld} from '../scripts/world/prepare-runtime-world.mjs';
import {createPondVisitors,createPondVisitorState,advancePondVisitors,writeDuckPose,writeDucklingPose,writeTurtlePose,writeCrabPose,duckSegmentIsClear,pondRoutePointIsClear,turtleGroundIsClear} from '../src/lib/experience/pond-visitors.mjs';
import {lakeWaveHeight} from '../src/lib/experience/lake-dynamics.mjs';
const environment=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v20.json',import.meta.url),'utf8')).environment;
const calm={weather:'clear',hour:13,ice:0,wind:.2,active:true,moving:true};
const run=(state,prepared,seconds,context=calm,fps=60)=>{for(let frame=0;frame<Math.round(seconds*fps);frame++)advancePondVisitors(state,1/fps,context,prepared);return state;};
const writers={ducks:writeDuckPose,turtles:writeTurtlePose,crabs:writeCrabPose};

test('each visitor has a continuous shore-to-water route, clear of buildings and pedestrian bridges',()=>{
  for(const quality of ['high','low']) {
    const prepared=createPondVisitors(environment,quality);
    assert.equal(prepared.ducks.length,quality==='high'?4:3);assert.equal(prepared.turtles.length,2);assert.equal(prepared.crabs.length,2);
    for(const species of Object.keys(writers))for(const route of prepared[species]) {
      const island=environment.land.find(island=>island.id===route.island),clearance=species==='ducks'?.40:species==='turtles'?.30:.36;
      assert.ok(route.length>4);
      assert.ok(turtleGroundIsClear(route.points[64],island,environment,clearance),'rest stops support the whole body');
      const openWater={...environment,land:environment.land.filter(item=>item!==island)};
      for(let i=0;i<route.points.length;i++) {
        assert.ok(pondRoutePointIsClear(route.points[i],island,environment,clearance));
        assert.ok(duckSegmentIsClear(route.points[i],route.points[(i+1)%route.points.length],openWater,clearance));
      }
    }
    assert.ok(prepared.turtles.every(route=>route.scale<=.76),'turtles are smaller than the old 1.08/1.18 scale');
  }
  const bridge=environment.bridges[0],middle=bridge.from.map((v,i)=>(v+bridge.to[i])/2);
  assert.equal(duckSegmentIsClear(middle,middle,environment),false);
});

test('every duck, turtle and crab crosses water and land independently, without jumping at the bank',()=>{
  const prepared=createPondVisitors(environment,'high'),state=createPondVisitorState(prepared),seen={},previous={};
  for(const species of Object.keys(writers)){seen[species]=prepared[species].map(()=>new Set());previous[species]=prepared[species].map((_,i)=>writers[species]({},i,state,prepared,calm));}
  for(let frame=0;frame<60*85;frame++) {
    const context={...calm,weather:frame<1500?'clear':'rain',wind:.2+.8*(1-Math.exp(-Math.max(0,frame-1500)/60)),waterLevel:.03};
    advancePondVisitors(state,1/60,context,prepared);
    for(const species of Object.keys(writers))for(let i=0;i<prepared[species].length;i++) {
      const pose=writers[species]({},i,state,prepared,context),before=previous[species][i];
      assert.ok(Object.values(pose).filter(v=>typeof v==='number').every(Number.isFinite));
      assert.ok(Math.hypot(pose.x-before.x,pose.z-before.z)<.75/60);
      if(frame>0)assert.ok(Math.abs(pose.y-before.y)<.018,'the body climbs out smoothly instead of snapping to ground height');
      if(pose.land>.99)seen[species][i].add('land');if(pose.land<.01)seen[species][i].add('water');
      previous[species][i]=pose;
    }
  }
  for(const species of Object.keys(writers))for(const habitats of seen[species])assert.deepEqual([...habitats].sort(),['land','water']);
  assert.ok(state.nest.eggs+state.nest.young>=1,'the parent reaches its land nest and raises a brood');
});

test('rain, storms and strong wind cannot leave ducks parked for the rest of the session',()=>{
  const prepared=createPondVisitors(environment,'high');
  for(const weather of ['drizzle','rain','storm','hail','clear']) {
    const state=createPondVisitorState(prepared),travel=prepared.ducks.map(()=>0),moving=prepared.ducks.map(()=>0);
    let previous=prepared.ducks.map((_,i)=>writeDuckPose({},i,state,prepared,calm));
    for(let frame=0;frame<30*60;frame++) {
      const context={...calm,weather,wind:1};advancePondVisitors(state,1/30,context,prepared);
      previous=prepared.ducks.map((_,i)=>{const pose=writeDuckPose({},i,state,prepared,context);travel[i]+=Math.hypot(pose.x-previous[i].x,pose.z-previous[i].z);if(state.ducks[i].rest===0)moving[i]++;return pose;});
    }
    assert.ok(travel.slice(1).every(length=>length>15),weather);
    assert.ok(moving.slice(1).every(frames=>frames>1000),weather+' still allows brief shore visits');
    assert.ok(state.nest.young>0||state.nest.occupied,'the nesting parent is caring for eggs, not stopped by the rain');
  }
});

test('swimming ducks sit in the water and never expose walking feet, including after icy weather',()=>{
  const prepared=createPondVisitors(environment,'high'),state=createPondVisitorState(prepared);
  for(const ice of [0,.4,.9])for(const weather of ['clear','rain','storm','snow']){
    const context={...calm,ice,weather,wind:1,waterLevel:.07};
    for(let i=0;i<500;i++){
      advancePondVisitors(state,.05,context,prepared);
      state.ducks.forEach((_,index)=>{
        const pose=writeDuckPose({},index,state,prepared,context);
        if(pose.land>.001)return;
        const surface=environment.water.height+.07+lakeWaveHeight(pose.x,pose.z,state.elapsed,1,ice);
        assert.equal(pose.mode,'swimming');assert.equal(pose.walk,0);
        assert.ok(pose.y+.01*pose.scale<surface-.1,'belly is partly submerged');
        assert.ok(pose.y+.44*pose.scale>surface,'back remains above water');
      });
    }
  }
});

test('two ducklings hatch at the nest, grow smoothly and follow the same safe shoreline without spawning more',()=>{
  const prepared=createPondVisitors(environment,'high'),state=createPondVisitorState(prepared),history=[null,null],habitats=[new Set(),new Set()];
  let firstScale=Infinity,lastScale=0;
  for(let frame=0;frame<30*300;frame++){
    advancePondVisitors(state,1/30,calm,prepared);
    for(let i=0;i<2;i++){
      const pose=writeDucklingPose({},i,state,prepared,calm);if(!pose.visible)continue;
      firstScale=Math.min(firstScale,pose.scale);lastScale=Math.max(lastScale,pose.scale);
      if(history[i])assert.ok(Math.hypot(pose.x-history[i].x,pose.z-history[i].z)<.025,'baby follows continuously');
      if(pose.land<.01){habitats[i].add('water');assert.equal(pose.walk,0);}
      if(pose.land>.99)habitats[i].add('land');history[i]=pose;
    }
  }
  assert.equal(state.nest.young,2);assert.equal(state.ducklings.length,2);assert.equal(state.nest.eggs,0);
  assert.ok(firstScale<.3&&lastScale>.95);
  for(const places of habitats)assert.deepEqual([...places].sort(),['land','water']);
  run(state,prepared,900);assert.equal(state.nest.young,2);assert.equal(state.nest.eggs,0);
});

test('visitor clocks are frame independent and only inactivity or explicit pause freezes them',()=>{
  const prepared=createPondVisitors(environment,'high'),low=createPondVisitorState(prepared),high=createPondVisitorState(prepared);
  run(low,prepared,90,calm,30);run(high,prepared,90,calm,120);
  assert.ok(Math.abs(low.elapsed-high.elapsed)<1e-8);
  for(const species of Object.keys(writers))for(let i=0;i<prepared[species].length;i++) {
    const a=writers[species]({},i,low,prepared,calm),b=writers[species]({},i,high,prepared,calm);
    const tolerance=species==='ducks'&&prepared.ducks[i].nest?.02:1e-7;
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<tolerance,species+' route timing (including frame-rounded hatch events)');
  }
  const before=structuredClone(low);
  for(const options of [{active:false},{moving:false},{paused:true}])run(low,prepared,30,{...calm,...options});
  assert.deepEqual(low,before);
  advancePondVisitors(low,NaN,calm,prepared);advancePondVisitors(low,-1,calm,prepared);assert.deepEqual(low,before);
  run(low,prepared,2,{...calm,reducedMotion:true});assert.ok(low.elapsed>before.elapsed+1.9);
  assert.notDeepEqual(low.ducks,before.ducks);
});

test('land stops sit on the actual island meshes in both quality assets',async()=>{
  const prepared=createPondVisitors(environment,'high');
  for(const name of ['archipelago-v9.glb','archipelago-v19-low.glb']) {
    const {scene}=await decodeSourceWorld(await readFile(new URL('../public/experience/world/'+name,import.meta.url)));
    scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
    for(const species of Object.keys(writers))for(const route of prepared[species]) {
      const [x,z]=route.points[64];ray.set(new THREE.Vector3(x,route.height+.2,z),new THREE.Vector3(0,-1,0));ray.far=.4;
      const hit=ray.intersectObject(scene,true)[0];
      assert.ok(hit&&Math.abs(hit.point.y-route.height)<.012,species+' '+route.island+' needs a real landing');
    }
    scene.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
  }
});
