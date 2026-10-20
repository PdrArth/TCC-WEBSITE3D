import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEnvironmentManifest } from '../src/lib/experience/environment.mjs';
import { ISLAND_LIFE_VERSION, advanceResident, bridgeSurfaceSegments, bridgePillars, createIslandLifeLayout, createResidentState, homeLocalPoint, isIslandWalkingPoint, lifeSurfaceSegments, pathLength, planLifeRoute, residentPauseReason, residentReturnRoute, residentShelterReason, sampleLifePath, walkingSurfaceSegments, writeResidentPose } from '../src/lib/experience/island-life.mjs';
const environment=createEnvironmentManifest(),layout=createIslandLifeLayout(environment);
const daytime={weather:'clear',hour:13,moving:true,visible:true};
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);
function tick(state,seconds,context=daytime){for(let left=seconds;left>1e-8;left-=.1)advanceResident(state,Math.min(left,.1),context,layout);}
function until(state,condition,context=daytime,limit=6000){for(let i=0;i<limit&&!condition(state);i++)advanceResident(state,.1,typeof context==='function'?context(state):context,layout);assert.ok(condition(state),`expected state, reached ${state.phase}/${state.activityId} at ${state.elapsed}s`);}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);}
function onFirmGround(p){
 if(Math.hypot(p[0]-layout.islet.center[0],p[2]-layout.islet.center[1])<=layout.islet.radius)return true;
 if(environment.land.some(island=>isIslandWalkingPoint(p,island)))return true;
 // Authored front stairs and furniture approaches now open the formerly excluded terraces.
 if(layout.walkingGraph.edges.filter(e=>e.kind==='furniture').some(edge=>edge.points.slice(1).some((b,i)=>segmentDistance(p,edge.points[i],b)<.025&&p[1]>=.09&&p[1]<=.65)))return true;
 return [...layout.walkingGraph.bridges,{points:layout.connector.points,width:layout.connector.width}].some(b=>b.points.slice(1).some((q,i)=>segmentDistance(p,b.points[i],q)<=b.width/2+.001));
}

test('v20 places a real one-storey home and covered bench on a separate islet, preserving the 49-point closing bridge',async()=>{
 assert.equal(ISLAND_LIFE_VERSION,20);assert.equal(environment.land.length,7);assert.deepEqual(layout.islet,{id:'moradia',center:[0,9],radius:3.1,height:.092});assert.deepEqual(layout.home.footprint,[4,2.8]);assert.ok(layout.home.height<3);
 const old=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v19.json',import.meta.url),'utf8'));
 assert.deepEqual(layout.bridge,old.islandLife.bridge);
 for(const x of[-2,2])for(const z of[-1.4,1.4,2.45]){const p=homeLocalPoint(layout.home,[x,0,z]);assert.ok(Math.hypot(p[0],p[2]-9)<layout.islet.radius);}
 assert.deepEqual(layout.connector.points.at(-1),layout.bridge.points[24]);assert.equal(layout.connector.width,1.03);
 near(layout.home.seated[2],layout.home.porch[2]);assert.ok(layout.home.interiorSeated[2]<layout.home.door[2]);assert.ok(layout.home.window[1]>layout.home.interiorSeated[1]+1);
 assert.equal(bridgeSurfaceSegments(layout).length,48);assert.equal(lifeSurfaceSegments(layout).length,48+layout.connector.points.length-1+layout.landings.length);
 assert.ok(walkingSurfaceSegments(layout).length>180);assert.equal(bridgePillars(layout).length,2);
 for(const landing of layout.landings)assert.ok(pathLength(landing.points)<=.25);
});

test('all garden polylines avoid the real irregular shoreline, terrace walls/furniture, trunks and all five planted beds',()=>{
 assert.equal(layout.walkingGraph.bridges.length,7);
 for(const edge of layout.walkingGraph.edges){assert.ok(onFirmGround(edge.points[0]),edge.id);for(let d=0;d<=edge.length;d+=.025){const p=sampleLifePath(edge.points,d);assert.ok(onFirmGround(p),`${edge.id} ${d} lacks ground`);if(edge.kind==='island'){const island=environment.land.find(i=>i.id===edge.island);assert.ok(isIslandWalkingPoint(p,island),`${edge.id} ${d} enters a garden obstruction`);}}}
 // This graph has no cross-water star routes to pavilion entry coordinates.
 for(const edge of layout.walkingGraph.edges.filter(e=>e.kind==='bridge'))assert.ok(edge.bridge);
});

test('original six bridge routes stay on their actual decks and follow the source arch height',()=>{
 const islands=environment.land;
 for(let i=0;i<6;i++){
 const a=islands[i],b=islands[i+1],dx=b.center[0]-a.center[0],dz=b.center[1]-a.center[1],n=Math.hypot(dx,dz),start=[a.center[0]+dx/n*(a.radius-.1),0,a.center[1]+dz/n*(a.radius-.1)],end=[b.center[0]-dx/n*(b.radius-.1),0,b.center[1]-dz/n*(b.radius-.1)],bridge=layout.walkingGraph.bridges[i];
 for(const p of bridge.points){assert.ok(segmentDistance(p,start,end)<.516);const length=Math.hypot(end[0]-start[0],end[2]-start[2]),t=clamp(((p[0]-start[0])*dx/n+(p[2]-start[2])*dz/n)/length,0,1);near(p[1],.13+.21*Math.sin(Math.PI*t)+.055,.001);}
 }
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
});

test('arc-length interpolation crosses corners, clamps safely and reuses the caller output',()=>{
 const p=[[0,0,0],[3,0,0],[3,0,4]],out=[0,0,0];assert.equal(pathLength(p),7);assert.deepEqual(sampleLifePath(p,4),[3,0,1]);assert.equal(sampleLifePath(p,6,out),out);assert.deepEqual(out,[3,0,3]);assert.deepEqual(sampleLifePath(p,-2),p[0]);assert.deepEqual(sampleLifePath(p,20),p[2]);
});

test('complete daytime routine visits all islands, fishing shores and existing furniture via safe routes',()=>{
 const state=createResidentState(layout),activities=new Set(),bridges=new Set(),phases=new Set(),poses=new Set();let firstFish=Infinity;
 while(state.cycle<1&&state.elapsed<600){const before=[...state.position];advanceResident(state,1/30,daytime,layout);assert.ok(dist(before,state.position)<=layout.resident.walkSpeed/30+.00001);assert.ok(onFirmGround(state.position));phases.add(state.phase);
 if(['watering','gathering','observing','fishing','sitting'].includes(state.phase)){activities.add(state.activityId);if(state.phase==='fishing'){firstFish=Math.min(firstFish,state.elapsed);const pose=writeResidentPose({},state);assert.equal(pose.rod,true);assert.deepEqual(pose.fishingTarget,state.activityTarget);}poses.add(writeResidentPose({},state).rightArm.toFixed(2));}
 if(state.phase==='walking'||state.phase==='walk-home'){let covered=0;for(const step of state.routeSteps){if(state.routeDistance>=covered-.001&&state.routeDistance<=covered+step.length+.001){const edge=layout.walkingGraph.edges.find(e=>e.id===step.edgeId);if(edge.bridge)bridges.add(edge.bridge);break;}covered+=step.length;}}
 }
 assert.equal(state.cycle,1);assert.ok(state.elapsed>=250&&state.elapsed<600,`varied fishing cycle took ${state.elapsed}s`);assert.ok(firstFish<6);assert.equal(activities.size,layout.activityPoints.length);assert.equal(bridges.size,7);assert.ok(state.distanceMoved>130);assert.ok(poses.size>50);assert.ok(phases.has('watering')&&phases.has('gathering')&&phases.has('observing'));assert.deepEqual(state.position,layout.home.seated);assert.equal(state.shelterReason,null);
});

test('fishing varies between visits without repeating a shore or crossing land, and covers every spot in each bag',()=>{
 const sequences=[];
 for(const seed of [1,3]){
  const state=createResidentState(layout,seed),visits=[];let lastPhase='',failures=0;
  while(state.cycle<2&&state.elapsed<1300){
   const before=[...state.position];advanceResident(state,.1,daytime,layout);
   assert.ok(dist(before,state.position)<=layout.resident.walkSpeed*.1+.00001);assert.ok(onFirmGround(state.position));
   if(state.phase==='fishing'&&lastPhase!=='fishing'){
    const activity=layout.activityPoints.find(a=>a.id===state.activityId),pose=writeResidentPose({},state,layout);
    assert.ok(activity&&activity.kind==='fishing');near(dist(state.position,activity.position),0);assert.deepEqual(pose.fishingTarget,activity.target);
    assert.notEqual(state.activityId,visits.at(-1));visits.push(state.activityId);failures+=Number(!state.fishingSuccess);
   }
   lastPhase=state.phase;
  }
  assert.equal(state.cycle,2);assert.equal(visits.length,16);
  for(const start of [0,8])assert.equal(new Set(visits.slice(start,start+8)).size,8);
  assert.ok(failures>0&&failures<16);sequences.push(visits);
 }
 assert.notDeepEqual(sequences[0],sequences[1]);
});

test('weather shelter resumes the selected fishing shore and wait without drawing another destination',()=>{
 const state=createResidentState(layout,3);until(state,s=>s.phase==='fishing'&&s.fishingVisits===2);
 const chosen={id:state.activityId,target:[...state.activityTarget],visits:state.fishingVisits,wait:state.fishingWait,success:state.fishingSuccess};
 until(state,s=>s.phase==='interior',{...daytime,weather:'rain'});until(state,s=>s.phase==='fishing',daytime);
 assert.equal(state.activityId,chosen.id);assert.deepEqual(writeResidentPose({},state,layout).fishingTarget,chosen.target);
 assert.equal(state.fishingVisits,chosen.visits);assert.equal(state.fishingWait,chosen.wait);assert.equal(state.fishingSuccess,chosen.success);
});

test('rain chooses the shortest safe return from every physical edge, in both directions, including the farthest island',()=>{
 let farthest=0;
 for(const edge of layout.walkingGraph.edges)for(const fraction of[.03,.49,.97]){
 const state=createResidentState(layout);Object.assign(state,{phase:'walking',route:edge.points,routeSteps:[{edgeId:edge.id,from:edge.from,to:edge.to,points:edge.points,length:edge.length}],node:edge.from,destination:edge.to,routeDistance:edge.length*fraction,position:sampleLifePath(edge.points,edge.length*fraction)});
 const route=residentReturnRoute(state,layout),a=planLifeRoute(layout,edge.from,'home-door-outside'),b=planLifeRoute(layout,edge.to,'home-door-outside');near(route.length,Math.min(edge.length*fraction+a.length,edge.length*(1-fraction)+b.length));near(dist(route.points[0],state.position),0);farthest=Math.max(farthest,route.length);
 let crossedDoor=false;const wet={...daytime,weather:'storm'};
 until(state,s=>{crossedDoor ||= dist(s.position,layout.home.door)<.1;return s.phase==='interior';},s=>{const previous=[...s.position];advanceResident(s,.05,wet,layout);assert.ok(dist(previous,s.position)<=layout.resident.runSpeed*.05+.0001);assert.ok(onFirmGround(s.position));return wet;});
 assert.equal(state.hidden,false);assert.equal(state.inside,true);assert.equal(crossedDoor,true);near(dist(state.position,layout.home.interiorSeated),0);
 }
 assert.ok(farthest>60,`farthest return was ${farthest}m`);
});

test('every precipitation type interrupts immediately, enters continuously and waits for eight dry seconds',()=>{
 for(const weather of['drizzle','rain','freezing-rain','snow','storm','hail']){
 const state=createResidentState(layout);until(state,s=>s.phase==='gathering');const before=[...state.position];advanceResident(state,1/60,{...daytime,weather},layout);assert.equal(state.phase,'returning');assert.ok(dist(before,state.position)<.04);
 until(state,s=>s.phase==='interior',{...daytime,weather});assert.equal(writeResidentPose({},state).seated,true);assert.equal(state.hidden,false);
 tick(state,7.9,daytime);assert.equal(state.phase,'interior');assert.ok(state.dryTime<8);tick(state,.2,daytime);assert.equal(state.phase,'exiting');assert.ok(dist(state.position,layout.home.interiorSeated)<.1);
 until(state,s=>s.phase==='walking',daytime);assert.equal(state.activityId,'gerar-gathering');assert.equal(state.inside,false);
 }
 assert.equal(residentShelterReason({weather:'drizzle',hour:12}),'weather');assert.equal(residentShelterReason({weather:'clear',precipitation:.01,hour:12}),'weather');
});

test('drizzle allows the covered bench after entering; strong weather keeps the resident visible behind the window',()=>{
 const state=createResidentState(layout);until(state,s=>s.phase==='interior',{...daytime,weather:'drizzle'});until(state,s=>s.phase==='porch',{...daytime,weather:'drizzle'});near(dist(state.position,layout.home.seated),0);tick(state,12,{...daytime,weather:'drizzle'});assert.equal(state.phase,'porch');assert.equal(writeResidentPose({},state).bodyOffsetY,-.18);
 for(const weather of['rain','storm','hail','snow','freezing-rain']){if(state.phase==='porch'){advanceResident(state,.1,{...daytime,weather},layout);assert.equal(state.phase,'returning');}until(state,s=>s.phase==='interior',{...daytime,weather});tick(state,12,{...daytime,weather});assert.equal(state.phase,'interior');assert.equal(state.hidden,false);assert.ok(writeResidentPose({},state).seated);}
});

test('night sends the resident to bed and keeps him lying down until morning',()=>{
 const state=createResidentState(layout);until(state,s=>s.phase==='interior',{...daytime,hour:23});tick(state,90,{...daytime,hour:23});assert.equal(state.phase,'interior');assert.equal(writeResidentPose({},state,layout).sleepBlend,1);
 advanceResident(state,.1,{...daytime,hour:9},layout);const waking=writeResidentPose({},state,layout);assert.ok(waking.sleepBlend>0&&waking.sleepBlend<1);until(state,s=>s.phase==='walking',daytime);assert.equal(state.inside,false);
 const natural=createResidentState(layout);until(natural,s=>s.shelterReason==='night',s=>({...daytime,hour:13+s.elapsed/30}));assert.ok(natural.elapsed>=180&&natural.elapsed<180.2);assert.ok(['returning','porch','interior','entering'].includes(natural.phase));
});

test('hidden, reading, open panel, pause and reduced motion freeze movement, limbs and weather recovery timers',()=>{
 const state=createResidentState(layout);until(state,s=>s.phase==='fishing');const before=structuredClone(state),pose=writeResidentPose({},state,layout);
 for(const gate of[{moving:false},{visible:false},{reducedMotion:true},{panelOpen:true},{reading:true}]){for(let i=0;i<120;i++)advanceResident(state,1,{...daytime,weather:'storm',hour:23,...gate},layout);assert.deepEqual(state,before);assert.deepEqual(writeResidentPose({},state,layout),pose);}
 assert.equal(residentPauseReason({...daytime,intro:true}),null);advanceResident(state,30,daytime,layout);near(state.elapsed-before.elapsed,.1);
 const startup=createResidentState(layout),position=[...startup.position];advanceResident(startup,.1,{...daytime,intro:true},layout);assert.ok(dist(position,startup.position)>.08);assert.equal(layout.resident.height,1.76);
});
