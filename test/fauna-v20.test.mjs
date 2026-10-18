import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { createEnvironmentManifest, insidePolygon } from "../src/lib/experience/environment.mjs";
import { birdFlightShare, createFishRoutes, faunaCount, fishAppearance, fishColors, fishSegmentIsClear, writeBirdPose, writeFishPose } from "../src/components/island-experience/scene-motion.mjs";

const manifest = JSON.parse(await readFile(new URL("../public/experience/world/manifest-v20.json", import.meta.url), "utf8"));
function lakeFixture() {
  const environment = structuredClone(manifest.environment ?? createEnvironmentManifest());
  environment.decorativeLand ??= [{ id: "garden-islet", center: [0,9], radius: 3.1, height: .092 }];
  environment.waterObstacles ??= [{ center: [0,0], radius: .16 }, { center: [-6,5], radius: .09 }];
  return environment;
}
const environment = lakeFixture();
assert.equal(environment.fishRoutes?.routes.length,20,"v20 must ship its prepared fish school without startup navigation work");
const schools = [environment.fishRoutes,...[7,2020,617].map(seed => createFishRoutes(environment,20,seed))];
const circles = [...environment.land, ...environment.decorativeLand, ...environment.waterObstacles];
function checkFishWater(pose) {
  assert.ok(Object.values(pose).every(Number.isFinite));
  assert.ok(insidePolygon(pose.x,pose.z,environment.water.shoreline),"fish stays inside the actual shoreline polygon");
  for(const land of circles) assert.ok(Math.hypot(pose.x-land.center[0],pose.z-land.center[1])>=land.radius+.54,"body and the largest articulated tail clear land and bridge supports");
  assert.ok(pose.y+.046*1.26<environment.water.height-.05,"the whole fish remains below the water and any ice cover");
}

test("v20 fauna counts, colors and sizes retain fixed instanced draw budgets", async () => {
  assert.deepEqual([faunaCount("birds","low"),faunaCount("birds","high"),faunaCount("fish","low"),faunaCount("fish","high")],[8,12,24,40]);
  assert.equal(new Set(Array.from({length:20},(_,i)=>fishAppearance(i).color)).size,4);
  assert.equal(new Set(Array.from({length:20},(_,i)=>fishAppearance(i).scale)).size,5);
  assert.deepEqual(fishColors,["#e8b653","#e78068","#f5e6bf","#65b8ad"]);
  const atmosphere=await readFile(new URL("../src/components/island-experience/atmosphere.tsx",import.meta.url),"utf8");
  const scenery=await readFile(new URL("../src/components/island-experience/scenery.tsx",import.meta.url),"utf8");
  assert.equal((atmosphere.match(/<instancedMesh name="bird_/g)??[]).length,3);
  assert.equal((scenery.match(/<instancedMesh name="lake_fish_/g)??[]).length,2);
  assert.match(atmosphere,/scale = 1\.4\*/);
});

test("v20 fish routes are seeded, prepared once and sampled without changing route buffers", () => {
  const original=JSON.stringify(environment);
  const a=createFishRoutes(environment,12,79), b=createFishRoutes(structuredClone(environment),12,79), c=createFishRoutes(environment,12,80);
  assert.deepEqual(a,b); assert.notEqual(a.routes[0].phase,c.routes[0].phase);
  assert.equal(JSON.stringify(environment),original);
  const route=a.routes[0], points=route.points, cumulative=route.cumulative, snapshot=JSON.stringify(a);
  const pose={x:0,y:0,z:0,heading:0,tail:0};
  for(let time=0;time<120;time+=.23) assert.equal(writeFishPose(pose,0,time,a),pose);
  assert.equal(a.routes[0].points,points);assert.equal(a.routes[0].cumulative,cumulative);assert.equal(JSON.stringify(a),snapshot);
});

test("v20 fish sweeps reject crossings missed by endpoint-only validation", () => {
  const fixture={water:{height:-.16,shoreline:[[-10,-10],[10,-10],[10,10],[-10,10]]},land:[],decorativeLand:[{center:[0,0],radius:1}],waterObstacles:[],bridges:[]};
  assert.equal(fishSegmentIsClear([-3,0],[3,0],fixture),false,"clear endpoints cannot cut across the decorative island");
  fixture.decorativeLand=[];fixture.waterObstacles=[{center:[0,0],radius:.1}];
  assert.equal(fishSegmentIsClear([-3,0],[3,0],fixture),false,"the intervening bridge pillar blocks the whole segment");
  fixture.waterObstacles=[];fixture.bridges=[{from:[-3,0],to:[3,0],width:.2,height:-.05}];
  assert.equal(fishSegmentIsClear([0,-3],[0,3],fixture),false,"low decks block a transverse crossing");
  fixture.bridges[0].height=.6;
  assert.equal(fishSegmentIsClear([0,-3],[0,3],fixture),true,"raised decks have enough clearance between supports");
  fixture.bridges=[];fixture.water.shoreline=[[-3,-3],[3,-3],[3,3],[1,3],[1,-1],[-1,-1],[-1,3],[-3,3]];
  assert.equal(fishSegmentIsClear([-2,2],[2,2],fixture,.1),false,"a concave shoreline notch is not water");
});

test("v20 complete seeded fish trajectories and every prepared segment clear all authored obstacles", () => {
  for(const school of schools) for(let index=0;index<school.routes.length;index++) {
    const route=school.routes[index];
    assert.ok(route.length>80,"the prepared loop travels beyond a little central orbit");
    for(let i=0;i<route.points.length;i++) {
      const a=route.points[i],b=route.points[(i+1)%route.points.length];
      assert.ok(fishSegmentIsClear(a,b,environment),"every rendered segment, including the loop closure, is swept-clear");
      for(const ratio of [0,.25,.5,.75,1]) checkFishWater({x:a[0]+(b[0]-a[0])*ratio,z:a[1]+(b[1]-a[1])*ratio,y:school.waterHeight-.132});
    }
    const duration=route.length/route.speed;
    const pose={};
    for(let time=0;time<duration+1;time+=.37) checkFishWater(writeFishPose(pose,index,time,school));
    for(const time of [1e4,1e7,NaN,-10]) checkFishWater(writeFishPose(pose,index,time,school));
  }
});

test("v20 each quality prefix reaches lake center, far margins and every side of the new islet", () => {
  for(const count of [12,20]) {
    const zones=new Set(), school=schools[0];
    for(let index=0;index<count;index++) for(let time=0;time<230;time+=1.13) {
      const pose=writeFishPose({},index,time,school);
      const radial=Math.hypot((pose.x-environment.water.center[0])/environment.water.radii[0],(pose.z-environment.water.center[1])/environment.water.radii[1]);
      if(Math.hypot(pose.x,pose.z+2)<3)zones.add("center");
      if(radial>.8)zones.add("margin");
      const dx=pose.x, dz=pose.z-9, radius=Math.hypot(dx,dz);
      if(radius>3.5&&radius<5.4)zones.add(Math.abs(dx)>Math.abs(dz)?dx>0?"islet-east":"islet-west":dz>0?"islet-south":"islet-north");
    }
    assert.deepEqual([...zones].sort(),["center","islet-east","islet-north","islet-south","islet-west","margin"]);
  }
});

test("v20 fish motion is continuous across loop seams and stays under ice at every snow/ice strength", () => {
  const school=schools[0], pose={};
  for(let index=0;index<20;index++) {
    const route=school.routes[index], seam=(1-route.phase)*route.length/route.speed;
    const before={...writeFishPose(pose,index,seam-.001,school)}, after=writeFishPose(pose,index,seam+.001,school);
    assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<.003);
    for(const cover of [0,.25,.5,.75,1]) {
      const under=writeFishPose(pose,index,50+cover,school);
      assert.ok(under.y+.046*route.scale<environment.water.height-.05,"ice and snow never lift fish above the water mesh");
    }
  }
});

test("v20 at least two birds cross the visible scene in the first eight seconds", () => {
  const camera=new THREE.PerspectiveCamera(manifest.initialCamera.fov,1280/720,.1,160);
  camera.position.set(...manifest.initialCamera.position);camera.lookAt(new THREE.Vector3(...manifest.initialCamera.target));camera.updateMatrixWorld(true);
  let crosses=0;
  for(let index=0;index<8;index++) {
    const start=writeBirdPose({},index,0,0,true,0,manifest.birdPerches), visible=[];
    for(let time=.1;time<=8;time+=.1) {
      const pose=writeBirdPose({},index,time,0,true,0,manifest.birdPerches);
      const screen=new THREE.Vector3(pose.x,pose.y,pose.z).project(camera);
      if(pose.mode!==0&&Math.abs(screen.x)<.85&&Math.abs(screen.y)<.85)visible.push(pose);
    }
    if(visible.some(pose=>Math.hypot(pose.x-start.x,pose.z-start.z)>5))crosses++;
  }
  assert.ok(crosses>=2,`${crosses} visible crossings in the opening eight seconds`);
});

test("v20 adverse weather and night keep every bird visible at a fixed refuge without normal flight", () => {
  for(const weather of ["storm","rain","snow","freezing-rain","hail"])assert.equal(birdFlightShare(weather,13,"day"),0);
  assert.equal(birdFlightShare("clear",23,"night"),0);
  assert.equal(manifest.birdShelters?.length,12,"shelters are authored separately under the porch roof");
  for(let index=0;index<12;index++) {
    const refuge=manifest.birdShelters[index%manifest.birdShelters.length];
    assert.notDeepEqual(refuge.position,manifest.birdPerches[index%manifest.birdPerches.length].position,"a storm refuge is not an exposed bridge railing");
    const normal=writeBirdPose({},index,6,0,true,0,manifest.birdPerches);
    assert.deepEqual(writeBirdPose({},index,6,0,true,0,manifest.birdPerches,manifest.birdShelters),normal,"clear-weather flights continue to use normal perches");
    let previous=Infinity;
    for(const blend of [0,.25,.5,.75,1]) {
      const pose=writeBirdPose({},index,6,0,false,blend,manifest.birdPerches,manifest.birdShelters);
      const distance=Math.hypot(pose.x-refuge.position[0],pose.y-refuge.position[1],pose.z-refuge.position[2]);
      assert.ok(distance<=previous);previous=distance;
    }
    for(const time of [0,.1,8,25,91,1e5]) {
      const pose=writeBirdPose({},index,time,0,false,1,manifest.birdPerches,manifest.birdShelters);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.deepEqual([pose.x,pose.y,pose.z],refuge.position);
      assert.equal(pose.mode,0);assert.equal(pose.flap,.16);assert.equal(pose.fold,.84);
      const scale=1.4*(.9+index%3*.09);
      assert.ok(pose.y+.105-.072*scale>=refuge.position[1]-.01,"bird feet stay on the porch floor, rather than sinking through it");
    }
  }
});
