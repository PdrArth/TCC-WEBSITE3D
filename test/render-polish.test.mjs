import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { writeRainImpactPose, writeCloudAnchor, ThunderClock } from "../components/island-experience/scene-motion.mjs";
import { FrameStalls, prepareEffectMaterials } from "../components/island-experience/render-preparation.mjs";

const immediateStart = callback => { callback(); return () => {}; };

test("expired splash caps have zero width as well as height, with the ring fading independently",()=>{
  const pose={};
  writeRainImpactPose(pose,.15);assert.ok(pose.sprayY>.99&&pose.sprayXZ>0&&pose.ring>0);
  for(const age of [.3,.5,1.34]){writeRainImpactPose(pose,age);assert.equal(pose.sprayY,0);assert.equal(pose.sprayXZ,0);assert.ok(pose.ring>0);}
  for(const age of [-1,1.35,10,1000,NaN]){writeRainImpactPose(pose,age);assert.deepEqual(pose,{ring:0,opacity:0,sprayY:0,sprayXZ:0,lift:0});}
});

test("cloud anchors occupy the upper sky, drift, and retain separate partial coverage",()=>{
  const pose={};let seen=0;
  for(let cluster=0;cluster<8;cluster++)for(let lobe=0;lobe<4;lobe++){
    writeCloudAnchor(pose,cluster,lobe,0,4);assert.ok(pose.y>.70&&pose.y<.94);
    if(cluster>=4)assert.equal(pose.width,0);
    if(pose.width&&Math.abs(pose.x)<1)seen++;
  }
  assert.ok(seen>0);writeCloudAnchor(pose,0,0,0,4);const before=pose.x;writeCloudAnchor(pose,0,0,5,4);assert.notEqual(pose.x,before);
});

test("storm clock preserves the initial cue and bounded denser subsequent strikes",()=>{
  for(const random of [()=>0,()=>1,()=>.42]){
    const clock=new ThunderClock(random);assert.ok(clock.remaining>=2&&clock.remaining<=4);
    clock.reset(random);assert.ok(clock.remaining>=3.5&&clock.remaining<=7);
  }
});

test("each storm strike decays once and cannot repeat a flash during its minimum gap",()=>{
  const clock=new ThunderClock(()=>0);clock.remaining=.001;
  assert.equal(clock.advance(.01,true,()=>0),true);assert.equal(clock.glow,1);
  let previous=clock.glow;
  for(let frame=0;frame<34;frame++){
    assert.equal(clock.advance(.1,true,()=>0),false);
    assert.ok(clock.glow<=previous,"one strike has no secondary rapid flash");previous=clock.glow;
  }
  assert.equal(clock.glow,0);clock.advance(1,false);assert.equal(clock.glow,0);assert.equal(clock.takeThunder(),false);
});

test("frame diagnostics retain long stalls and ignore inactive demand gaps",()=>{
  const recorder=new FrameStalls();
  recorder.sample(2,"resume",true);assert.equal(recorder.count,0);
  recorder.sample(.4,"storm/first-lightning",true);assert.equal(recorder.count,1);assert.equal(recorder.maximum,400);
  recorder.sample(5,"reader",false);recorder.sample(5,"resume",true);assert.equal(recorder.count,1);
  for(let i=0;i<20;i++)recorder.sample(.06,`weather-${i}`,true);
  assert.equal(recorder.events.length,8);assert.equal(recorder.count,21);assert.equal(recorder.events.at(-1).context,"weather-19");
});

test("optional preparation runs sequentially and cancellation preserves the graph",async()=>{
  const scene=new THREE.Scene(),world=new THREE.Group(),primary=new THREE.Mesh(),effect1=new THREE.Mesh(),effect2=new THREE.Points();
  world.add(primary);scene.add(world,effect1,effect2);effect1.visible=false;
  const pending=[],calls=[],progress=[];
  const stop=prepareEffectMaterials({compileAsync:async(object,camera,target)=>{calls.push({object,target});}},scene,new THREE.PerspectiveCamera(),world,p=>progress.push(p),callback=>{pending.push(callback);return()=>{const i=pending.indexOf(callback);if(i>=0)pending.splice(i,1);};},{scheduleStart:immediateStart});
  assert.equal(calls.length,0);assert.equal(pending.length,1);
  await pending.shift()();assert.equal(calls[0].object,effect1);assert.notEqual(calls[0].target,scene);assert.equal(progress.at(-1).done,1);
  stop();assert.equal(pending.length,0);assert.equal(effect1.parent,scene);assert.equal(primary.parent,world);assert.equal(effect1.visible,false);
});

test("lighting preparation includes hidden night lights only in its night target",async()=>{
  const scene=new THREE.Scene(),world=new THREE.Group(),mesh=new THREE.Mesh(),sun=new THREE.DirectionalLight(),night=new THREE.PointLight();
  sun.castShadow=true;night.name="night_pavilion_light";night.visible=false;world.add(mesh);scene.add(world,sun,night);
  const jobs=[],targets=[];
  const stop=prepareEffectMaterials({compileAsync:async(_,__,target)=>{targets.push(target);}},scene,new THREE.PerspectiveCamera(),world,()=>{},callback=>{jobs.push(callback);return()=>{};},{scheduleStart:immediateStart});
  while(jobs.length)await jobs.shift()();
  assert.equal(targets.length,2);assert.equal(targets[0].children.length,1);assert.equal(targets[1].children.length,2);
  assert.equal(targets[1].children.find(light=>light.name===night.name).visible,true);
  assert.equal(targets[0].children[0].castShadow,true);assert.equal(night.visible,false);assert.equal(mesh.parent,world);stop();
});

test("optional preparation waits for two paints and 1200 ms, and its opening wait can be cancelled",async t=>{
  const frames=new Map(),timers=new Map(),jobs=[],calls=[];let serial=0;
  const savedFrame=Object.getOwnPropertyDescriptor(globalThis,"requestAnimationFrame"),savedCancel=Object.getOwnPropertyDescriptor(globalThis,"cancelAnimationFrame");
  Object.defineProperty(globalThis,"requestAnimationFrame",{configurable:true,value:callback=>{const id=++serial;frames.set(id,callback);return id;}});
  Object.defineProperty(globalThis,"cancelAnimationFrame",{configurable:true,value:id=>frames.delete(id)});
  t.after(()=>{
    if(savedFrame)Object.defineProperty(globalThis,"requestAnimationFrame",savedFrame);else delete globalThis.requestAnimationFrame;
    if(savedCancel)Object.defineProperty(globalThis,"cancelAnimationFrame",savedCancel);else delete globalThis.cancelAnimationFrame;
  });
  t.mock.method(globalThis,"setTimeout",(callback,ms)=>{const id=++serial;timers.set(id,{callback,ms});return id;});
  t.mock.method(globalThis,"clearTimeout",id=>timers.delete(id));
  const paint=()=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback();};
  const scene=new THREE.Scene(),world=new THREE.Group();world.add(new THREE.Mesh());scene.add(world);
  const prepare=()=>prepareEffectMaterials({compileAsync:async()=>calls.push("compile")},scene,new THREE.PerspectiveCamera(),world,()=>{},callback=>{jobs.push(callback);return()=>{};});
  const stop=prepare();assert.equal(frames.size,1);assert.equal(timers.size,0);assert.equal(jobs.length,0);
  paint();assert.equal(frames.size,1);assert.equal(timers.size,0);assert.equal(jobs.length,0);
  paint();assert.equal(frames.size,0);assert.equal(timers.size,1);assert.equal(jobs.length,0);
  const [timerId,timer]=timers.entries().next().value;assert.equal(timer.ms,1200);timers.delete(timerId);timer.callback();
  assert.equal(jobs.length,1);assert.equal(calls.length,0);await jobs.shift()();assert.equal(calls.length,1);stop();jobs.length=0;
  const cancelBeforePaint=prepare();cancelBeforePaint();assert.equal(frames.size,0);assert.equal(timers.size,0);assert.equal(jobs.length,0);
  const cancelDuringGrace=prepare();paint();paint();assert.equal(timers.size,1);cancelDuringGrace();assert.equal(timers.size,0);assert.equal(jobs.length,0);
});

test("optional preparation pauses while hidden or inactive without losing variants or overlapping compilations",async t=>{
  const savedDocument=Object.getOwnPropertyDescriptor(globalThis,"document"),visibility={hidden:false};
  Object.defineProperty(globalThis,"document",{configurable:true,value:visibility});
  t.after(()=>{if(savedDocument)Object.defineProperty(globalThis,"document",savedDocument);else delete globalThis.document;});
  const scene=new THREE.Scene(),world=new THREE.Group();world.add(new THREE.Mesh());scene.add(world,new THREE.Points());
  const jobs=[],calls=[],progress=[];let active=false,finish;
  const stop=prepareEffectMaterials({compileAsync:object=>{calls.push(object);return new Promise(resolve=>{finish=resolve;});}},scene,new THREE.PerspectiveCamera(),world,p=>progress.push(p),(callback,wait)=>{jobs.push({callback,wait});return()=>{jobs.length=0;};},{scheduleStart:immediateStart,canPrepare:()=>active});
  await jobs.shift().callback();assert.equal(calls.length,0);assert.equal(progress.at(-1).done,0);assert.equal(jobs[0].wait,250);
  active=true;visibility.hidden=true;await jobs.shift().callback();assert.equal(calls.length,0,"the default visibility guard still applies when canPrepare allows work");
  visibility.hidden=false;const running=jobs.shift().callback();assert.equal(calls.length,1);assert.equal(jobs.length,0,"next variant waits for the in-flight compile");
  active=false;finish();await running;assert.equal(progress.at(-1).done,1);await jobs.shift().callback();assert.equal(calls.length,1);
  active=true;
  while(jobs.length){const running=jobs.shift().callback();finish();await running;}
  assert.equal(calls.length,4,"both lighting variants of every object remain covered");assert.equal(progress.at(-1).state,"ready");stop();
});
