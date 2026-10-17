import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FrameCadence } from "../lib/experience/navigation.mjs";
import { rainDropScale, weatherVisualProfile, daylightPalette, CameraOrbit, orbitPosition, environmentSeconds, createRainImpacts, advanceRainImpacts, createHailField, advanceHail, writeBranchedLightning, writeFishPose, advanceSnow, createSnowField, createBirdGeometry, clampZoom, wheelZoom, advanceRain, birdFlightPaths, birdsMayFly, createRainField, easeCamera, easeHeading, fieldOfView, mayAdaptQuality, motionSeconds, overviewDistanceScale, restingPose, ThunderClock, writeBirdPose, writeLightningBolt } from "../components/island-experience/scene-motion.mjs";

const manifest = JSON.parse(await readFile(new URL("../public/experience/world/manifest-v9.json", import.meta.url), "utf8"));
const vector = values => new THREE.Vector3(...values);

test("a visible but unfocused background tab cannot downgrade or disable the 3D world", () => {
  assert.equal(mayAdaptQuality(true, false, false, true, false), false);
  assert.equal(mayAdaptQuality(true, false, false, false, true), false);
  assert.equal(mayAdaptQuality(true, false, false, true, true), true);
  assert.equal(mayAdaptQuality(false, false, false, true, true), false);
  assert.equal(mayAdaptQuality(true, true, false, true, true), false);
  assert.equal(mayAdaptQuality(true, false, true, true, true), false);
  assert.equal(mayAdaptQuality(true, false, false, true, true, 1), false, "embedded 1 Hz throttling is not slow rendering");
  assert.equal(mayAdaptQuality(true, false, false, true, true, 1 / 20), true, "sustained 20 fps can still select the light model");
});

function settle(camera, target, pose, immediate = false) {
  let pending = true;
  let frames = 0;
  while (pending && frames++ < 240) pending = easeCamera(camera, target, vector(pose.position), vector(pose.target), pose.fov, 1 / 60, immediate);
  assert.equal(pending, false, "a demand-rendered transition must finish without an extra input event");
  return frames;
}

test("opening and closing a pavilion converges smoothly without a scroll or camera reset", () => {
  const overview = restingPose(manifest, null);
  const detail = restingPose(manifest, "validar");
  const camera = new THREE.PerspectiveCamera(overview.fov, 16 / 9, .1, 160);
  const target = vector(overview.target);
  camera.position.copy(vector(overview.position));
  easeCamera(camera, target, vector(detail.position), vector(detail.target), detail.fov, 1 / 60);
  assert.ok(camera.position.distanceTo(vector(detail.position)) > 1, "the first frame must not snap to the pavilion");
  settle(camera, target, detail);
  const before = camera.position.clone();
  easeCamera(camera, target, vector(overview.position), vector(overview.target), overview.fov, 1 / 60);
  assert.ok(camera.position.distanceTo(before) > 0);
  assert.ok(camera.position.distanceTo(vector(overview.position)) > 1);
  settle(camera, target, overview);
  assert.deepEqual(camera.position.toArray(), overview.position);
  assert.deepEqual(target.toArray(), overview.target);
  const label = vector(manifest.pavilions.validar.focus).project(camera);
  camera.updateMatrixWorld(true);
  const freshLabel = vector(manifest.pavilions.validar.focus).project(camera);
  assert.ok(label.distanceTo(freshLabel) < 1e-12, "labels already see the final camera matrix before the next renderer frame");
});

test("reduced motion applies the final camera and its projection in one frame", () => {
  const pose = manifest.pavilions.gerar.camera;
  const camera = new THREE.PerspectiveCamera(34, .6, .1, 160);
  const target = new THREE.Vector3();
  assert.equal(easeCamera(camera, target, vector(pose.position), vector(pose.target), pose.fov, 0, true), false);
  assert.deepEqual(camera.position.toArray(), pose.position);
  assert.equal(camera.fov, pose.fov);
  assert.ok(vector(pose.target).project(camera).length() < 1.1);
});

test("a resumed long frame remains bounded and normal frame rates give the same camera motion", () => {
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 160);
  const target = new THREE.Vector3();
  const destination = new THREE.Vector3(10, 10, 10);
  const cadence = new FrameCadence();
  easeCamera(camera, target, destination, new THREE.Vector3(1, 1, 1), 42, cadence.sample(90).elapsed);
  assert.ok(camera.position.distanceTo(destination) > 10, "a paused clock cannot jump straight to the target");
  easeCamera(camera, target, destination, new THREE.Vector3(1, 1, 1), 42, cadence.sample(1).elapsed);
  assert.equal(easeCamera(camera, target, destination, new THREE.Vector3(1, 1, 1), 42, cadence.sample(1).elapsed), false, "a real one-FPS stream must still converge in two seconds after resuming");
  const fast = new THREE.PerspectiveCamera(34, 1, .1, 160);
  const slow = new THREE.PerspectiveCamera(34, 1, .1, 160);
  const fastTarget = new THREE.Vector3();
  const slowTarget = new THREE.Vector3();
  for (let frame = 0; frame < 30; frame++) easeCamera(fast, fastTarget, destination, target, 42, 1 / 60);
  for (let frame = 0; frame < 10; frame++) easeCamera(slow, slowTarget, destination, target, 42, 1 / 20);
  assert.ok(fast.position.distanceTo(slow.position) < 1e-10);
});

test("intro and portrait framing preserve the authored manifest", () => {
  const original = JSON.stringify(manifest);
  const intro = restingPose(manifest, null, true);
  assert.ok(vector(intro.position).distanceTo(vector(intro.target)) > vector(manifest.initialCamera.position).distanceTo(vector(manifest.initialCamera.target)));
  assert.equal(fieldOfView(34, 1600, 900), 34);
  assert.ok(fieldOfView(34, 390, 844) <= 64);
  assert.ok(fieldOfView(42, 390, 844, true) <= 72);
  assert.equal(fieldOfView(34, 0, 0), 34);
  assert.equal(JSON.stringify(manifest), original);
});

test("all seven destinations remain inside desktop and phone overview bounds", () => {
  for (const [width, height] of [[1280, 720], [691, 697], [390, 844], [844, 390]]) {
    const pose = manifest.initialCamera;
    const target = vector(pose.target);
    const camera = new THREE.PerspectiveCamera(fieldOfView(pose.fov, width, height), width / height, .1, 160);
    camera.position.copy(vector(pose.position).sub(target).multiplyScalar(overviewDistanceScale(pose.fov, width, height)).add(target));
    camera.lookAt(target); camera.updateMatrixWorld(true);
    for (const [id, island] of Object.entries(manifest.pavilions)) {
      const point = vector(island.focus).project(camera);
      assert.ok(Math.abs(point.x) < .93 && Math.abs(point.y) < .85, `${id} must remain reachable at ${width}x${height}`);
    }
  }
});

test("the intro keeps all seven island centers framed throughout a full revolution", () => {
  const authored=JSON.stringify(manifest.initialCamera);
  const pose=restingPose(manifest,null,true);
  for(const [width,height] of [[1280,720],[691,697],[390,844]]) {
    const camera=new THREE.PerspectiveCamera(fieldOfView(pose.fov,width,height),width/height,.1,160);
    for(let step=0;step<24;step++) {
      camera.position.set(...orbitPosition(pose.position,pose.target,step*Math.PI/12,0,1/overviewDistanceScale(pose.fov,width,height)));
      camera.lookAt(vector(pose.target)); camera.updateMatrixWorld(true);
      for(const [id,island] of Object.entries(manifest.pavilions)) {
        const point=vector(island.focus).project(camera);
        assert.ok(Math.abs(point.x)<.92&&Math.abs(point.y)<.85,`${id} must stay in frame through intro rotation at ${width}x${height}`);
      }
    }
  }
  assert.equal(JSON.stringify(manifest.initialCamera),authored);
});

test("rain uses a fixed small buffer, pauses and stays finite after repeated updates", () => {
  for (const count of [72, 180]) {
    const field = createRainField(count);
    assert.equal(field.positions.length, count * 6);
    const originalBuffer = field.positions.buffer;
    const paused = field.positions.slice();
    advanceRain(field, 0);
    advanceRain(field, NaN);
    assert.deepEqual(field.positions, paused);
    for (let frame = 0; frame < 1000; frame++) advanceRain(field, frame % 200 === 0 ? 60 : 1 / 60);
    assert.equal(field.positions.buffer, originalBuffer, "no per-frame allocation is needed for rain");
    for (let index = 0; index < count; index++) {
      const offset = index * 6;
      assert.ok(field.positions[offset] >= -14 && field.positions[offset] <= 14);
      assert.ok(field.positions[offset + 1] >= 0 && field.positions[offset + 1] < 13);
      assert.ok(field.positions.subarray(offset, offset + 6).every(Number.isFinite));
    }
  }
});

test("bird flight and wingbeats change visibly and do not slow down with one-FPS rendering", () => {
  const pose = () => ({ x: 0, y: 0, z: 0, heading: 0, bank: 0, flap: 0 });
  const start = writeBirdPose(pose(), 0, 0);
  let fastTime = 0;
  let slowTime = 0;
  for (let frame = 0; frame < 600; frame++) fastTime += motionSeconds(1 / 60);
  for (let frame = 0; frame < 10; frame++) slowTime += motionSeconds(1);
  const fast = writeBirdPose(pose(), 0, fastTime);
  const slow = writeBirdPose(pose(), 0, slowTime);
  assert.ok(Math.hypot(start.x - fast.x, start.z - fast.z) > 10, "a bird covers the island within seconds");
  assert.ok(Math.hypot(fast.x - slow.x, fast.y - slow.y, fast.z - slow.z) < 1e-9);
  assert.notEqual(writeBirdPose(pose(), 0, .1).flap, writeBirdPose(pose(), 0, .2).flap);
  assert.equal(writeBirdPose(pose(), 0, .1, 0, false).flap, writeBirdPose(pose(), 0, 10, 0, false).flap);
  assert.ok(writeBirdPose(pose(), 0, 10, 1).y > fast.y + 1.5, "selecting a bird makes the flock rise");
});

test("the flock crosses different islands on varied routes and withdraws into foliage in rain", () => {
  assert.equal(birdsMayFly("clear"), true);
  assert.equal(birdsMayFly("dusk"), true);
  assert.equal(birdsMayFly("rain"), false);
  assert.equal(birdsMayFly("storm"), false);
  assert.ok(birdFlightPaths.length >= 6);
  const families = new Set();
  for (let index = 0; index < 14; index++) {
    const positions = [];
    const headings = new Set();
    for (let time = 0; time < 50; time += .5) {
      const pose = writeBirdPose({}, index, time);
      assert.ok(Object.values(pose).every(Number.isFinite));
      positions.push([pose.x, pose.z]);
      headings.add(Math.round(pose.heading * 10));
    }
    const radii = positions.map(([x, z]) => Math.hypot(x, z));
    assert.ok(Math.max(...radii) - Math.min(...radii) > 5, "routes cross the archipelago rather than circling a fixed radius");
    assert.ok(headings.size > 15, "gliding and changes of course coexist");
    families.add(positions.slice(0, 5).flat().map(value => value.toFixed(1)).join(","));
    const refuge = writeBirdPose({}, index, 12, 0, true, 1);
    assert.ok(refuge.y < 3, "weather brings birds into the lower garden canopy");
    assert.equal(refuge.flap, .16);
  }
  assert.equal(families.size, 14);
});

test("a localized lightning bolt ends on scenery and cannot hit a content island", () => {
  const lightningTargets = manifest.weatherScenery.lightningTargets;
  assert.ok(lightningTargets.length > 0);
  const positions = new Float32Array(9 * 6);
  for (let index = 0; index < lightningTargets.length; index++) {
    const target = lightningTargets[index];
    assert.equal(writeLightningBolt(positions, target, index), positions, "a strike reuses one GPU buffer");
    assert.ok(positions.every(Number.isFinite));
    const endpoint = [...positions.subarray(positions.length - 3)];
    endpoint.forEach((value, axis) => assert.ok(Math.abs(value - target[axis]) < .00001));
    for (const island of Object.values(manifest.islands)) assert.ok(Math.hypot(target[0] - island.center[0], target[2] - island.center[2]) > island.radius + 2);
  }
});

test("direct island camera changes complete in a short transition and never mutate the manifest", () => {
  const original = JSON.stringify(manifest);
  const overview = manifest.initialCamera;
  const camera = new THREE.PerspectiveCamera(overview.fov, 16 / 9, .1, 160);
  camera.position.copy(vector(overview.position));
  const target = vector(overview.target);
  for (const id of Object.keys(manifest.pavilions)) {
    const pose = restingPose(manifest, id);
    let pending = true;
    let frames = 0;
    while (pending && frames++ < 100) pending = easeCamera(camera, target, vector(pose.position), vector(pose.target), pose.fov, 1 / 60, false, 7);
    assert.equal(pending, false);
    assert.ok(frames < 90, "an island selection completes within 1.5 seconds at 60 FPS");
    assert.deepEqual(camera.position.toArray(), pose.position);
  }
  assert.equal(JSON.stringify(manifest), original);
});

test("rain consumes real seconds across slow and fast render cadences", () => {
  const fast = createRainField(4);
  const slow = createRainField(4);
  for (let frame = 0; frame < 60; frame++) advanceRain(fast, 1 / 60);
  advanceRain(slow, 1);
  for (let index = 0; index < fast.positions.length; index++) assert.ok(Math.abs(fast.positions[index] - slow.positions[index]) < .0001);
});

test("avatar turns take the shortest arc smoothly and reduced motion can apply it immediately", () => {
  const start = 179 * Math.PI / 180;
  const goal = -179 * Math.PI / 180;
  const smoothed = easeHeading(start, goal, 1 / 60);
  assert.ok(smoothed > start && smoothed < 181 * Math.PI / 180);
  assert.ok(Math.abs(Math.sin(easeHeading(start, goal, 0, true)) - Math.sin(goal)) < 1e-12);
});

test("the shipped avatar's Idle and Walk clips deform its actual skeleton", async () => {
  const bytes = await readFile(new URL("../public/experience/world/avatar.glb", import.meta.url));
  const avatar = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const bones = [];
  avatar.scene.traverse(object => { if (object.isBone) bones.push(object); });
  const mixer = new THREE.AnimationMixer(avatar.scene);
  for (const name of ["Idle", "Walk"]) {
    const clip = avatar.animations.find(clip => clip.name === name);
    assert.ok(clip, `${name} is present in the actual GLB`);
    mixer.clipAction(clip).reset().play();
    mixer.update(0);
    const initial = bones.map(bone => bone.quaternion.toArray());
    mixer.update(.2);
    const changed = bones.filter((bone, index) => bone.quaternion.toArray().some((value, axis) => Math.abs(value - initial[index][axis]) > 1e-6));
    assert.ok(changed.length > 0, `${name} moves the skeleton instead of only translating the avatar root`);
    if (name === "Walk") assert.ok(changed.some(bone => /leg/i.test(bone.name)), "walking must move a leg");
    mixer.stopAllAction();
  }
  mixer.uncacheRoot(avatar.scene);
});

test("storm events stay 3.5 to 7 seconds apart and reduced or paused motion cannot flash", () => {
  const clock = new ThunderClock(() => 0);
  const events = [];
  for (let second = 1; second <= 100; second++) if (clock.advance(1, true, () => 0)) events.push(second);
  assert.ok(events.length > 1);
  for (let index = 1; index < events.length; index++) assert.ok(events[index] - events[index - 1] >= 3.5 && events[index] - events[index - 1] <= 7);
  const remaining = clock.remaining;
  for (let second = 0; second < 100; second++) assert.equal(clock.advance(1, false), false);
  assert.equal(clock.glow, 0);
  assert.equal(clock.remaining, remaining, "time is suspended with the scene");
  assert.equal(clock.advance(NaN, true), false);
});


test("overview zoom is bounded, continuous and survives a detail visit and return", () => {
  const bounds = { minZoom: .8, maxZoom: 2 };
  assert.equal(clampZoom(NaN, bounds), 1);
  assert.equal(clampZoom(100, bounds), 2);
  assert.equal(clampZoom(-100, bounds), .8);
  assert.ok(wheelZoom(1, -100, bounds) > 1);
  assert.ok(wheelZoom(1, 100, bounds) < 1);
  assert.equal(wheelZoom(1, NaN, bounds), 1);
  const overview = restingPose(manifest, null);
  const zoom = 1.7;
  const position = vector(overview.position).sub(vector(overview.target)).multiplyScalar(1/zoom).add(vector(overview.target));
  const camera = new THREE.PerspectiveCamera(overview.fov, 16/9, .1, 160);
  camera.position.copy(position);
  const target = vector(overview.target);
  const zoomed = { ...overview, position: position.toArray() };
  settle(camera,target,restingPose(manifest,"gerar"));
  const before = camera.position.clone();
  easeCamera(camera,target,position,vector(overview.target),overview.fov,1/60);
  assert.ok(camera.position.distanceTo(before) < before.distanceTo(position)*.2);
  settle(camera,target,zoomed);
  assert.ok(camera.position.distanceTo(position) < 1e-10);
});

test("bird anatomy has real head/beak/tail and a shoulder pivot with a proportionate wingspan", () => {
  const bird = createBirdGeometry();
  for (const geometry of Object.values(bird)) { geometry.computeBoundingBox(); assert.ok(geometry.attributes.position.count > 0); }
  const bodySize = bird.bodies.boundingBox.getSize(new THREE.Vector3());
  const wingSize = bird.wing.boundingBox.getSize(new THREE.Vector3());
  assert.ok(bird.beak.boundingBox.max.z > bird.bodies.boundingBox.max.z, "beak sits in front of the head");
  assert.ok(bird.bodies.boundingBox.min.z < -.25, "tail extends behind the body");
  assert.equal(bird.wing.boundingBox.min.x, 0, "wing starts at the shoulder");
  assert.ok(wingSize.x*2 / bodySize.z > 1 && wingSize.x*2 / bodySize.z < 2, "wings no longer dwarf the whole bird");
  Object.values(bird).forEach(geometry => geometry.dispose());
});

test("birds rest on actual island perches, take off, glide and land without route discontinuities", () => {
  const perches = Array.from({length:7},(_,index)=>({island:String(index),position:[Math.cos(index*2*Math.PI/7)*13,2.3,Math.sin(index*2*Math.PI/7)*13]}));
  const modes = new Set(), points = [];
  for(let time=0;time<70;time+=.05) {
    const pose = writeBirdPose({},0,time,0,true,0,perches);
    assert.ok(Object.values(pose).every(Number.isFinite));
    modes.add(pose.mode); points.push(pose);
  }
  for(let index=1;index<points.length;index++) assert.ok(Math.hypot(points[index].x-points[index-1].x,points[index].y-points[index-1].y,points[index].z-points[index-1].z)<.2);
  assert.deepEqual([...modes].sort(),[0,1,2,3,4]);
  const initial = writeBirdPose({},0,0,0,true,0,perches);
  assert.deepEqual([initial.x,initial.y,initial.z],perches[0].position);
  const sheltered = writeBirdPose({},2,50,0,true,1,perches);
  assert.deepEqual([sheltered.x,sheltered.y,sheltered.z],perches[2].position);
  assert.equal(sheltered.mode,0); assert.equal(sheltered.fold,.84);
  assert.equal(birdsMayFly("clear","night"),false);
  for(const weather of ["snow","hail","freezing-rain"]) assert.equal(birdsMayFly(weather),false);
});

test("snow and hail use reusable bounded buffers, with slower falling snow", () => {
  const snow=createSnowField(30), hail=createSnowField(30), original=snow.positions.buffer;
  const before=snow.positions.slice(); advanceSnow(snow,0); assert.deepEqual(snow.positions,before);
  advanceSnow(snow,.1); advanceSnow(hail,.1,true);
  assert.ok(before[4]-hail.positions[4] > before[4]-snow.positions[4]);
  for(let index=0;index<1000;index++) advanceSnow(snow,.1,false,3);
  assert.equal(snow.positions.buffer,original);
  for(let index=0;index<30;index++) { assert.ok(snow.positions[index*3]>=-22&&snow.positions[index*3]<22); assert.ok(snow.positions[index*3+1]>=0&&snow.positions[index*3+1]<16); }
});


test("camera orbit distinguishes taps from drag and suppresses only the completed drag click", () => {
  const orbit=new CameraOrbit();
  orbit.begin(10,20); assert.equal(orbit.move(13,24,500,500),false); assert.equal(orbit.end(),false); assert.equal(orbit.consumeClick(),false);
  orbit.begin(10,20); assert.equal(orbit.move(30,22,500,500),true); assert.notEqual(orbit.yaw,0); assert.equal(orbit.end(),true); assert.equal(orbit.consumeClick(),true); assert.equal(orbit.consumeClick(),false);
  orbit.begin(0,0); orbit.move(50,10000,500,500); assert.equal(orbit.pitch,.24);
  orbit.reset(); assert.equal(orbit.yaw,0); assert.equal(orbit.pitch,0); assert.equal(orbit.dragging,false); assert.equal(orbit.consumeClick(),false);
});

test("orbit keeps radius, bounded elevation and returns exactly to its authored pose after reset", () => {
  const pose=manifest.initialCamera, target=vector(pose.target), orbit=new CameraOrbit();
  orbit.begin(0,0); orbit.move(100,-50,500,500); orbit.end();
  const position=vector(orbitPosition(pose.position,pose.target,orbit.yaw,orbit.pitch));
  assert.ok(Math.abs(position.distanceTo(target)-vector(pose.position).distanceTo(target))<1e-10);
  assert.ok(position.y>target.y);
  orbit.reset(); assert.ok(vector(orbitPosition(pose.position,pose.target,orbit.yaw,orbit.pitch)).distanceTo(vector(pose.position))<1e-10);
});

test("calm reduced motion still advances environment time without permitting a resumed long-frame jump", () => {
  assert.ok(environmentSeconds(1,true)>0); assert.ok(environmentSeconds(1,true)<environmentSeconds(1,false));
  assert.equal(environmentSeconds(NaN,true),0); assert.equal(environmentSeconds(60,false),2);
  const cadence=new FrameCadence(); assert.equal(environmentSeconds(cadence.sample(60).elapsed,true),0);
});

test("rain impacts reuse a bounded pool and expire instead of accumulating splash objects", () => {
  const field=createRainField(10), impacts=createRainImpacts(4);
  for(let index=0;index<10;index++) { field.positions[index*6]=-4+index*.6; field.positions[index*6+1]=.01; field.positions[index*6+2]=-3+index*.4; }
  const buffers=[field.positions.buffer,impacts.positions.buffer,impacts.ages.buffer];
  advanceRainImpacts(field,impacts,.05); assert.equal(impacts.count,4,"live ripples cannot be overwritten by the next six impacts"); assert.ok(impacts.ages.every(age=>age>0&&age<.05));
  for(let frame=0;frame<1000;frame++) advanceRainImpacts(field,impacts,.05,2);
  assert.equal(field.positions.buffer,buffers[0]); assert.equal(impacts.positions.buffer,buffers[1]); assert.equal(impacts.ages.buffer,buffers[2]);
  assert.ok(field.positions.every(Number.isFinite)); assert.ok(impacts.positions.every(Number.isFinite));
  for(let index=0;index<10;index++) assert.equal(field.positions[index*6+5],field.positions[index*6+2],"a wide rain field keeps both ends of each streak on the same depth plane");
  const pause=field.positions.slice(); advanceRainImpacts(field,impacts,0); assert.deepEqual(field.positions,pause);
});

test("small hail stones fall, bounce, settle and respawn without growing buffers", () => {
  const hail=createHailField(20), buffer=hail.positions.buffer;
  for(let frame=0;frame<400;frame++) advanceHail(hail,.05);
  assert.ok(hail.totalBounces>20); assert.ok(hail.respawns>20); assert.equal(hail.positions.buffer,buffer);
  assert.ok(hail.positions.every(Number.isFinite)); assert.ok(hail.bounces.every(value=>value<=2));
  for(let index=0;index<20;index++) assert.ok(hail.positions[index*3+1]>=-.49&&hail.positions[index*3+1]<=14);
  const pose=hail.positions.slice(); advanceHail(hail,0); advanceHail(hail,NaN); assert.deepEqual(hail.positions,pose);
});

test("branched lightning keeps its main strike on the actual surface target", () => {
  const positions=new Float32Array(21*6), target=[5,.3,-7]; writeBranchedLightning(positions,target,2);
  assert.ok(positions.every(Number.isFinite)); assert.ok(positions.subarray(54).some(value=>value!==0));
  [...positions.subarray(51,54)].forEach((value,axis)=>assert.ok(Math.abs(value-target[axis])<.00001));
  assert.equal(writeBranchedLightning(positions,target,4),positions);
});

test("fish swim inside the unobstructed lake center, below its water surface", () => {
  for(let index=0;index<6;index++) for(let time=0;time<100;time+=.5) {
    const pose=writeFishPose({x:0,y:0,z:0,heading:0,tail:0},index,time);
    assert.ok(Object.values(pose).every(Number.isFinite)); assert.ok(Math.abs(pose.x)<6); assert.ok(pose.z>-7&&pose.z<5); assert.ok(pose.y<-.16&&pose.y>-.28);
  }
});


test("the 24-hour palette keeps sunset warm and blends light continuously across phase boundaries", () => {
  const day={sky:"#e2ebe6",upper:"#fff5df",lower:"#9ba587",sun:"#fff0d2",fill:"#e1edf0",cloudColor:"#f1f4ef",ambient:2.3,intensity:3.3,fillIntensity:.65,exposure:1.12,rain:.6,cloud:.9,sunPosition:[-8,16,10]};
  const dawn={...day,sky:"#e7bc94",intensity:1.8}, dusk={...day,sky:"#ee9c6d",sun:"#ff883a",intensity:3.2,sunPosition:[-18,5.5,5]}, night={...day,sky:"#243a53",intensity:.72};
  const palette=hour=>daylightPalette(hour,day,dawn,dusk,night);
  assert.equal(palette(17.5).sky,dusk.sky); assert.equal(palette(17.5).sun,dusk.sun); assert.equal(palette(12).intensity,day.intensity); assert.equal(palette(0).sky,night.sky); assert.equal(palette(24).sky,night.sky);
  assert.equal(palette(18).rain,day.rain); assert.equal(palette(18).cloud,day.cloud);
  for(const boundary of [5.5,7,9,15.5,17.5,20,20.5]) { const a=palette(boundary-.001),b=palette(boundary+.001); assert.ok(Math.abs(a.intensity-b.intensity)<.01); const ca=new THREE.Color(a.sky),cb=new THREE.Color(b.sky); assert.ok(Math.abs(ca.r-cb.r)+Math.abs(ca.g-cb.g)+Math.abs(ca.b-cb.b)<.02); }
});

test("automatic orbit runs in overview, yields to manipulation and resumes after five visible seconds", () => {
  const orbit=new CameraOrbit();
  assert.equal(orbit.advanceAuto(1,true),true);
  assert.ok(orbit.yaw*180/Math.PI>=3&&orbit.yaw*180/Math.PI<=4);
  const overviewYaw=orbit.yaw;
  orbit.advanceAuto(1,false); assert.equal(orbit.yaw,overviewYaw,"detail, reduced motion or a hidden tab cannot rotate the overview");
  orbit.begin(0,0); orbit.advanceAuto(2,true); assert.equal(orbit.yaw,overviewYaw); assert.equal(orbit.autoMode,"gesture");
  orbit.move(45,10,400,600); orbit.end(); const draggedYaw=orbit.yaw;
  for(let second=0;second<5;second++) orbit.advanceAuto(1,true);
  assert.equal(orbit.yaw,draggedYaw); assert.equal(orbit.pauseRemaining,0);
  orbit.advanceAuto(.5,true); assert.ok(Math.abs(orbit.yaw-draggedYaw-.0325)<1e-12);
  const beforePinch=orbit.yaw; orbit.beginPinch(); for(let second=0;second<8;second++) orbit.advanceAuto(1,true);
  assert.equal(orbit.yaw,beforePinch,"holding a stationary pinch also blocks automatic rotation"); assert.equal(orbit.autoMode,"gesture"); orbit.end(); assert.equal(orbit.pauseRemaining,5);
  orbit.pause(); orbit.advanceAuto(2,false); assert.equal(orbit.pauseRemaining,5,"inactive time does not consume the post-gesture hold");
  orbit.reset(5); assert.equal(orbit.yaw,0); assert.equal(orbit.pitch,0);
  orbit.advanceAuto(2,true); assert.equal(orbit.yaw,0); assert.equal(orbit.pauseRemaining,3,"reset and return first display the authored pose");
});

test("automatic orbit consumes elapsed seconds equally at slow and fast frame rates", () => {
  const fast=new CameraOrbit(), slow=new CameraOrbit(); fast.pause(); slow.pause();
  for(let frame=0;frame<600;frame++) fast.advanceAuto(1/60,true);
  for(let frame=0;frame<10;frame++) slow.advanceAuto(1,true);
  assert.ok(Math.abs(fast.yaw-slow.yaw)<1e-10);
  const yaw=fast.yaw; fast.advanceAuto(NaN,true); assert.equal(fast.yaw,yaw);
});

test("clear skies, broken clouds and rain have distinct bounded visual densities", () => {
  const clear=weatherVisualProfile("clear"), broken=weatherVisualProfile("partly-cloudy"), overcast=weatherVisualProfile("overcast");
  assert.equal(clear.cloudClusters,0); assert.ok(broken.cloudClusters>0); assert.ok(overcast.cloudClusters>broken.cloudClusters); assert.ok(overcast.cloudScale>broken.cloudScale);
  const drizzle=weatherVisualProfile("drizzle"), rain=weatherVisualProfile("rain");
  assert.ok(drizzle.rainRatio>0&&drizzle.rainRatio<rain.rainRatio); assert.ok(drizzle.dropOpacity>=.6); assert.ok(rain.dropWidthPx>=1&&rain.dropWidthPx<1.6,"fine drops remain legible without looking like pellets"); assert.ok(drizzle.rainSpeed<rain.rainSpeed);
  for(const weather of ["clear","partly-cloudy","overcast","fog","drizzle","rain","freezing-rain","snow","storm","hail","dusk"]) {
    const profile=weatherVisualProfile(weather); assert.ok(Object.values(profile).every(Number.isFinite)); assert.ok(profile.cloudClusters<=8&&profile.rainRatio<=1);
  }
});

test("rain keeps readable projected droplet widths at desktop and phone overview distances", () => {
  for(const weather of ["drizzle","rain"]) for(const [height,fov,distance] of [[720,38,50],[844,64,75],[450,44,53]]) {
    const profile=weatherVisualProfile(weather), scale=rainDropScale(profile,distance,fov,height);
    const unitsPerPixel=2*Math.tan(fov*Math.PI/360)*distance/height;
    assert.ok(scale[0]*2/unitsPerPixel>=profile.dropWidthPx-.00001);
    assert.ok(scale[1]>scale[0]&&scale.every(Number.isFinite));
  }
  assert.ok(rainDropScale(weatherVisualProfile("rain"),NaN,NaN,0).every(Number.isFinite));
});

test("lake ripples finish their lifetime, never appear on islands, and age correctly in a one-FPS stream", () => {
  const field=createRainField(5), ripples=createRainImpacts(4);
  for(let index=0;index<5;index++) { field.positions[index*6]=1; field.positions[index*6+1]=.1; field.positions[index*6+2]=1; field.speeds[index]=10; }
  advanceRainImpacts(field,ripples,.05); assert.equal(ripples.count,4);
  const positions=ripples.positions.slice();
  for(let index=0;index<5;index++) field.positions[index*6+1]=.01;
  advanceRainImpacts(field,ripples,.05); assert.equal(ripples.count,4); assert.deepEqual(ripples.positions,positions);
  advanceRainImpacts(field,ripples,1.35,1,{count:0});
  for(let index=0;index<5;index++) field.positions[index*6+1]=.01;
  advanceRainImpacts(field,ripples,.05); assert.equal(ripples.count,8);
  field.positions[0]=20; field.positions[1]=.01; const count=ripples.count;
  advanceRainImpacts(field,ripples,.05,1,{count:1}); assert.equal(ripples.count,count,"an island-side impact does not create a water ring");
  const slow=createRainField(1), aged=createRainImpacts(1); slow.positions[0]=0; slow.positions[1]=9; slow.positions[2]=0; slow.speeds[0]=10;
  advanceRainImpacts(slow,aged,1); assert.ok(Math.abs(aged.ages[0]-.084)<.00001,"a delayed frame ages the ring from the actual water height of -.16m");
  const repeated=createRainField(1), latest=createRainImpacts(1); repeated.positions[0]=0; repeated.positions[1]=.1; repeated.positions[2]=0; repeated.speeds[0]=10;
  advanceRainImpacts(repeated,latest,2); assert.ok(Math.abs(latest.ages[0]-.558)<.00001,"a long frame uses the most recent impact in the falling cycle");
});
