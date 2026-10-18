import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createEnvironmentManifest, surfaceAt } from "../src/lib/experience/environment.mjs";
import { advanceHail, advanceRainImpacts, atmospherePalette, birdFlightShare, createHailField, createRainField, createRainImpacts, createRainSprayGeometry, lightningTargets, weatherVisualProfile, ThunderClock } from "../src/components/island-experience/scene-motion.mjs";

const environment = createEnvironmentManifest();
const near = (actual,expected) => assert.ok(Math.abs(actual-expected)<.00001,`${actual} should equal ${expected}`);

test("rain reaches exposed shoreline water on every side and respects the water elevation", () => {
  const points = environment.water.shoreline.map(([x,z]) => [x*.91,environment.water.center[1]+(z-environment.water.center[1])*.91]).filter(([x,z]) => surfaceAt(x,z,environment).kind==="water");
  assert.ok(points.length>40,"water coverage includes the margin gaps between islands");
  const field = createRainField(points.length,22), impacts = createRainImpacts(points.length);
  points.forEach(([x,z],index) => { const o=index*6; field.positions[o]=x; field.positions[o+1]=environment.water.height+.1; field.positions[o+2]=z; field.speeds[index]=10; });
  advanceRainImpacts(field,impacts,.04,0,{environment});
  assert.equal(impacts.count,points.length);
  let west=false,east=false,north=false,south=false;
  for (let index=0;index<points.length;index++) {
    const o=index*3,x=impacts.positions[o],z=impacts.positions[o+2];
    assert.equal(surfaceAt(x,z,environment).kind,"water"); near(impacts.positions[o+1],environment.water.height+.025);
    west ||= x < -17; east ||= x > 17; north ||= z < -19; south ||= z > 14;
  }
  assert.ok(west&&east&&north&&south,"ripples are not restricted to a center rectangle");
});

test("rain never emits a water ring on an island, bridge or outside the shoreline", () => {
  const bridge = environment.bridges[0];
  const points = [...environment.land.map(land=>land.center),[(bridge.from[0]+bridge.to[0])/2,(bridge.from[1]+bridge.to[1])/2],[21,21],[0,0]];
  const field = createRainField(points.length,22), impacts = createRainImpacts(points.length);
  points.forEach(([x,z],index) => {const o=index*6;field.positions[o]=x;field.positions[o+1]=surfaceAt(x,z,environment).height+.02;field.positions[o+2]=z;field.speeds[index]=10;});
  advanceRainImpacts(field,impacts,.04,0,{environment});
  assert.equal(impacts.count,1); near(impacts.positions[0],0); near(impacts.positions[2],0);
});

test("a supplied manifest controls water impacts instead of a hard-coded lake plane", () => {
  const lowered = {...environment,water:{...environment.water,height:-.7}};
  const field = createRainField(1,22), impacts = createRainImpacts(1);
  field.positions.set([0,-.65,0,0,-.3,0]); field.speeds[0]=8;
  advanceRainImpacts(field,impacts,.05,0,{environment:lowered});
  assert.equal(impacts.count,1); near(impacts.positions[1],-.675);
  const positions=field.positions.slice(),ages=impacts.ages.slice();
  advanceRainImpacts(field,impacts,0,0,{environment:lowered});
  assert.deepEqual(field.positions,positions); assert.deepEqual(impacts.ages,ages);
});

test("hail bounces on solid islands and bridges while water swallows stones without any bounce", () => {
  const field=createHailField(3), bridge=environment.bridges[0];
  const bridgePoint=[(bridge.from[0]+bridge.to[0])/2,(bridge.from[1]+bridge.to[1])/2];
  const locations=[environment.land[0].center,bridgePoint,[0,0]];
  locations.forEach(([x,z],index)=>{const floor=surfaceAt(x,z,environment).height;field.positions.set([x,floor+.07,z],index*3);field.velocities[index]=-4;});
  advanceHail(field,.03,environment);
  assert.equal(field.bounces[0],1);assert.ok(field.velocities[0]>0);
  assert.equal(field.bounces[1],1);assert.ok(field.velocities[1]>0);
  assert.equal(field.bounces[2],0);assert.equal(field.sinking[2],1);assert.ok(field.velocities[2]<0);
  assert.ok(field.positions[7]<environment.water.height);assert.equal(field.waterHits,1);
  for(let frame=0;frame<300;frame++)advanceHail(field,.02,environment);
  assert.equal(field.bounces[2],0,"the water particle never gains an upward bounce");
  assert.ok(field.waterHits>1);assert.ok(field.respawns>1);assert.ok(field.positions.every(Number.isFinite));
});

test("storms and hail stay overcast at sunset, while clear weather retains a warm sunset", () => {
  for(const weather of ["storm","hail"])for(let hour=0;hour<24;hour+=.25){
    const palette=atmospherePalette(weather,"dusk",hour),sky=new THREE.Color(palette.sky);
    assert.ok(sky.b>sky.r,"closed weather cannot inherit the orange clear-sky sunset");
    assert.ok(palette.intensity<=1);assert.ok(palette.cloud>=.94);
  }
  const clear=new THREE.Color(atmospherePalette("clear","dusk",17.5).sky);
  assert.ok(clear.r>clear.b*1.5);
  for(const weather of ["clear","storm","hail"]){
    const before=atmospherePalette(weather,undefined,17.499),after=atmospherePalette(weather,undefined,17.501);
    assert.ok(Math.abs(before.intensity-after.intensity)<.003,"the shared continuous hour changes the light smoothly");
  }
});

test("the first storm strike waits 2-4 seconds and later strikes vary between 3.5 and 7 seconds", () => {
  for(const random of [()=>0,()=>.5,()=>1]){
    const clock=new ThunderClock(random);let elapsed=0;
    while(!clock.advance(.05,true,random)&&elapsed<5)elapsed+=.05;
    assert.ok(elapsed>=1.9&&elapsed<=4.05);
    assert.ok(clock.remaining>=3.5&&clock.remaining<=7);
  }
  const clock=new ThunderClock(()=>0);clock.remaining=.01;
  clock.advance(.02,true,()=>0);const first=clock.remaining;
  clock.remaining=.01;clock.advance(.02,true,()=>1);assert.equal(clock.remaining,first+3.5);
});

test("light drizzle keeps the center and every lake quadrant wet without a larger particle pool", () => {
  const profile=weatherVisualProfile("drizzle");
  for(const quality of ["high","low"])for(const wet of [1,.45]){
    const field=createRainField(quality==="high"?420:180,22,environment),impacts=createRainImpacts(quality==="high"?96:44);
    const count=Math.round(field.speeds.length*profile.rainRatio*wet);
    const buffers=[field.positions.buffer,field.cycles.buffer,impacts.positions.buffer,impacts.ages.buffer];
    const quarters=new Set();
    for(let frame=0;frame<600;frame++){
      advanceRainImpacts(field,impacts,.05,1,{count,speed:profile.rainSpeed,environment});
      let central=0;
      for(let slot=0;slot<impacts.ages.length;slot++)if(impacts.ages[slot]<1.35){
        const o=slot*3,x=impacts.positions[o],z=impacts.positions[o+2],radius=Math.hypot(x,z+2);
        assert.equal(surfaceAt(x,z,environment).kind,"water");
        if(radius<6)central++;
        if(radius>10)quarters.add((x<0?1:0)+(z<-2?2:0));
      }
      if(frame>=40)assert.ok(central>0,`${quality}/${wet} drizzle must not leave the center empty after settling`);
    }
    assert.equal(quarters.size,4,"the same sparse field reaches all four outer lake quadrants");
    [field.positions.buffer,field.cycles.buffer,impacts.positions.buffer,impacts.ages.buffer].forEach((buffer,index)=>assert.equal(buffer,buffers[index]));
    assert.equal(impacts.ages.length,quality==="high"?96:44);
  }
});

test("new rain origins are circular and change only after the real surface impact", () => {
  const field=createRainField(180,22,environment),impacts=createRainImpacts(2);
  for(let index=0;index<28;index++){
    const radius=Math.hypot(field.positions[index*6],field.positions[index*6+2]+2);
    assert.ok(radius<=22.00001);
    if(index%4===0)assert.ok(radius<6,"even the lightest drizzle prefix includes the lake center");
  }
  field.positions.set([0,2,0,0,2.3,0]);field.speeds[0]=10;
  advanceRainImpacts(field,impacts,.05,0,{count:1,environment});
  near(field.positions[0],0);near(field.positions[2],0);assert.equal(field.cycles[0],0);assert.equal(impacts.count,0);
  advanceRainImpacts(field,impacts,.2,0,{count:1,environment});
  assert.equal(field.cycles[0],1);assert.equal(impacts.count,1);
  near(impacts.positions[0],0);near(impacts.positions[2],0);near(impacts.positions[1],environment.water.height+.025);
  assert.ok(Math.hypot(field.positions[0],field.positions[2])>1,"only the next fall receives the new origin");
  assert.equal(field.positions[5],field.positions[2]);
});

test("the merged splash has open round sides without flat square caps", () => {
  const geometry=createRainSprayGeometry(),normals=geometry.getAttribute("normal");
  assert.equal(geometry.index.count,54,"three six-sided open cones remain one small static geometry");
  for(let index=0;index<normals.count;index++)assert.ok(normals.getY(index)>-.5,"a downward facing bottom cap must not be present");
  assert.ok(geometry.getAttribute("position").array.every(Number.isFinite));geometry.dispose();
});

test("v14 storm targets alternate central lake and exposed margins, clear of islands and bridges", async () => {
  const manifest=JSON.parse(await readFile(new URL("../public/experience/world/manifest-v14.json",import.meta.url),"utf8"));
  const targets=manifest.weatherScenery.lightningTargets;
  assert.deepEqual(targets,lightningTargets,"the fallback and shipped world share the same route");
  let center=0,margin=0;
  for(const [x,y,z] of targets){
    const surface=surfaceAt(x,z,manifest.environment);
    assert.notEqual(surface.kind,"land");
    for(const land of manifest.environment.land)assert.ok(Math.hypot(x-land.center[0],z-land.center[1])>land.radius+2);
    if(Math.hypot(x,z+2)<10){center++;assert.equal(surface.kind,"water");near(y,manifest.environment.water.height);}
    else margin++;
  }
  assert.ok(center>=4&&margin>=3);
  assert.ok(Math.hypot(targets[0][0],targets[0][2]+2)<6,"the first visible strike is in the open lake");
});

test("thunder follows the flash after a small delay, fires once, and cancels on pause or weather exit", () => {
  const clock=new ThunderClock(()=>0);clock.remaining=.01;
  assert.equal(clock.advance(.02,true,()=>0),true);assert.equal(clock.takeThunder(),false);
  clock.advance(.1,true);assert.equal(clock.takeThunder(),false);
  clock.advance(.2,true);assert.equal(clock.takeThunder(),true);assert.equal(clock.takeThunder(),false);
  clock.remaining=.01;clock.advance(.02,true,()=>0);const remaining=clock.remaining;
  clock.advance(1,false);assert.equal(clock.glow,0);assert.equal(clock.remaining,remaining);assert.equal(clock.takeThunder(),false);
  clock.advance(1,true);assert.equal(clock.takeThunder(),false,"resume cannot replay a stale queued sound");
  clock.remaining=.01;clock.advance(.02,true,()=>0);clock.cancel();clock.advance(1,true);assert.equal(clock.takeThunder(),false);
  clock.reset(()=>0,true);assert.equal(clock.soundRemaining,-1);assert.equal(clock.glow,0);
});

test("bird traffic reduces in drizzle and twilight and takes refuge during hard rain and night", () => {
  const day=birdFlightShare("clear",12);
  assert.equal(day,1);assert.ok(birdFlightShare("drizzle",12)<day*.4);assert.ok(birdFlightShare("clear",18)<day);
  for(const weather of ["rain","storm","hail","snow","freezing-rain"])assert.equal(birdFlightShare(weather,12),0);
  assert.equal(birdFlightShare("clear",22),0);assert.equal(birdFlightShare("clear",4),0);
  assert.equal(birdFlightShare("clear",undefined,"night"),0);
});
