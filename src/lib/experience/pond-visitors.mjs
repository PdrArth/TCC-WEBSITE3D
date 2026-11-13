import { fishSegmentIsClear } from '../../components/island-experience/scene-motion.mjs';
import { surfaceAt } from './environment.mjs';
import { isIslandWalkingPoint } from './island-life.mjs';
import { createNestState, advanceNest, nestNeedsBrooding, youngAppearance, NEST_CAPACITY } from './nesting.mjs';
import {lakeWaveHeight} from './lake-dynamics.mjs';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, length) => length > 0 ? (value % length + length) % length : 0;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const turn = (current, target, dt) => current + Math.atan2(Math.sin(target-current), Math.cos(target-current)) * (1-Math.exp(-dt*5));

function pointSegmentDistance(point, a, b) {
  const dx=b[0]-a[0], dz=b[1]-a[1], length=dx*dx+dz*dz;
  const t=length ? clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dz)/length,0,1) : 0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz);
}
function segmentsDistance(a,b,c,d) {
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  if(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}

/** Raised decks still block floating animals, even where fish can pass beneath. */
export function duckSegmentIsClear(a,b,environment,clearance=.70) {
  if(!fishSegmentIsClear(a,b,environment,clearance))return false;
  return environment.bridges.every(bridge=>segmentsDistance(a,b,bridge.from,bridge.to)>=bridge.width+clearance);
}

function preparedLoop(points) {
  const cumulative=[0];
  for(let i=0;i<points.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(points[(i+1)%points.length][0]-points[i][0],points[(i+1)%points.length][1]-points[i][1]));
  const headings=points.map((_,i)=>{
    const previous=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    return Math.atan2(next[0]-previous[0],next[1]-previous[1]);
  });
  return {points,cumulative,headings,length:cumulative.at(-1)};
}
function sampleLoop(route,distance,output) {
  const d=wrap(distance,route.length);let low=0,high=route.points.length-1;
  while(low<high){const middle=(low+high)>>1;if(route.cumulative[middle+1]<=d)low=middle+1;else high=middle;}
  const a=route.points[low],b=route.points[(low+1)%route.points.length],t=(d-route.cumulative[low])/Math.max(.00001,route.cumulative[low+1]-route.cumulative[low]);
  output.x=a[0]+(b[0]-a[0])*t;output.z=a[1]+(b[1]-a[1])*t;
  const first=route.headings[low],last=route.headings[(low+1)%route.points.length];
  output.heading=first+Math.atan2(Math.sin(last-first),Math.cos(last-first))*t;
  return output;
}

/** Same scalloped shoreline as the authored islands, rather than their bounding circles. */
export function islandBankRadius(island,x,z,environment) {
  const a=Math.atan2(island.center[1]-z,x-island.center[0]),index=environment.land.indexOf(island);
  return island.radius*(1+.035*Math.sin(a*3+index*.4)+.023*Math.cos(a*7-index*.7));
}

/** Height of the 80-triangle topsoil fan in build_world_v8.py (also retained in v9). */
export function islandGroundHeight(island,x,z,environment) {
  const dx=x-island.center[0],dz=island.center[1]-z;
  const sector=Math.floor(wrap(Math.atan2(dz,dx),TAU)/TAU*80),a=sector*TAU/80,b=(sector+1)*TAU/80;
  const radius=angle=>islandBankRadius(island,island.center[0]+Math.cos(angle),island.center[1]-Math.sin(angle),environment);
  const ra=radius(a),rb=radius(b),ax=Math.cos(a)*ra,az=Math.sin(a)*ra,bx=Math.cos(b)*rb,bz=Math.sin(b)*rb;
  const determinant=ax*bz-az*bx,wa=(dx*bz-dz*bx)/determinant,wb=(ax*dz-az*dx)/determinant;
  return .055+.02*(Math.sin(a*5)*wa+Math.sin(b*5)*wb)/Math.max(1,wa+wb);
}

export function turtleGroundIsClear(point,island,environment,clearance=.32) {
  for(const [dx,dz] of [[0,0],...Array.from({length:12},(_,i)=>[Math.cos(i*TAU/12)*clearance,Math.sin(i*TAU/12)*clearance])]) {
    const surface=surfaceAt(point[0]+dx,point[1]+dz,environment);
    if(surface.kind!=='land'||Math.abs(surface.height-island.height)>.025)return false;
    if(!isIslandWalkingPoint([point[0]+dx,island.height,point[1]+dz],island))return false;
  }
  return true;
}

/** Check water, bridge clearance and the actual walkable strip on both sides of the landing. */
export function pondRoutePointIsClear(point,island,environment,clearance=.40) {
  const openWater={...environment,land:environment.land.filter(item=>item!==island)};
  if(!duckSegmentIsClear(point,point,openWater,clearance))return false;
  const dx=point[0]-island.center[0],dz=point[1]-island.center[1],radius=Math.hypot(dx,dz);
  if(radius>island.radius+.7)return true;
  for(let i=0;i<12;i++) {
    const x=point[0]+Math.cos(i*TAU/12)*clearance,z=point[1]+Math.sin(i*TAU/12)*clearance;
    const r=Math.hypot(x-island.center[0],z-island.center[1]);
    const shore=Math.min(island.radius-.08,islandBankRadius(island,x,z,environment)-.04);
    // Project only the over-water part of a footprint onto its landing corridor.
    const scale=Math.min(1,shore/r);
    if(!isIslandWalkingPoint([island.center[0]+(x-island.center[0])*scale,island.height,island.center[1]+(z-island.center[1])*scale],island))return false;
  }
  return true;
}

function amphibiousRoute(environment,island,offset,clearance,occupied,{span=.15,inset=.87,reach=1.97}={}) {
  const facing=Math.atan2(environment.water.center[1]-island.center[1],environment.water.center[0]-island.center[0]);
  for(const adjustment of [0,.24,-.24,.48,-.48,.72,-.72,...Array.from({length:48},(_,i)=>i*TAU/48)]) {
    const angle=facing+offset+adjustment;
    const points=Array.from({length:128},(_,i)=>{
      const t=i*TAU/128,a=angle+Math.sin(t)*span;
      const radius=island.radius+(reach-inset)/2+Math.cos(t)*(reach+inset)/2;
      return [island.center[0]+Math.cos(a)*radius,island.center[1]+Math.sin(a)*radius];
    });
    const shorePoint=points[64];
    if(occupied.some(point=>Math.hypot(point[0]-shorePoint[0],point[1]-shorePoint[1])<1.35))continue;
    if(!turtleGroundIsClear(shorePoint,island,environment,clearance))continue;
    if(!points.every(point=>pondRoutePointIsClear(point,island,environment,clearance)))continue;
    const openWater={...environment,land:environment.land.filter(item=>item!==island)};
    if(!points.every((point,i)=>duckSegmentIsClear(point,points[(i+1)%points.length],openWater,clearance)))continue;
    const loop=preparedLoop(points);
    occupied.push(shorePoint);
    return {...loop,kind:'amphibious',island:island.id,land:island,homeDistance:loop.cumulative[64],height:islandGroundHeight(island,...shorePoint,environment)};
  }
  return null;
}

export function createPondVisitors(environment,quality='low') {
  const occupied=[],ducks=[],turtles=[],crabs=[];
  const add=(routes,islandIndex,offset,clearance,options)=>{
    const route=amphibiousRoute(environment,environment.land[islandIndex],offset,clearance,occupied,options);
    if(route)routes.push({...route,...options});
  };
  // Different shores, directions, speeds and start phases prevent a single-file flock.
  for(const [index,island] of [0,6,1,5].slice(0,quality==='high'?4:3).entries()) {
    add(ducks,island,-.12,.40,{speed:.49+index*.055,direction:index%2?-1:1,phase:.08+index*.217,scale:index>1?.94:1.15,restDuration:6+index*.6,nest:index===0});
  }
  for(const [index,island] of [0,6].entries())add(turtles,island,.6,.30,{speed:.23+index*.035,direction:index?-1:1,phase:index?.12:.49,scale:index?.76:.72,restDuration:2.4+index*.8});
  for(const [index,island] of [0,6].entries())add(crabs,island,-.65,.36,{span:.085,inset:.60,reach:1.25,speed:.31+index*.035,direction:index?-1:1,phase:index?.57:.15,scale:.94,restDuration:1.6+index*.5});
  return {ducks,turtles,crabs,waterHeight:environment.water.height,environment};
}

function visitorState(route,sideways=false) {
  const distance=route.phase*route.length,sample=sampleLoop(route,distance,{});
  return {distance,heading:sample.heading+(route.direction<0?Math.PI:0)-(sideways?Math.PI/2:0),rest:0,visits:0,mode:'moving',tuck:0};
}
export function createPondVisitorState(prepared) {
  const parent=prepared.ducks.find(route=>route.nest);
  return {elapsed:0,ducks:prepared.ducks.map(route=>visitorState(route)),turtles:prepared.turtles.map(route=>visitorState(route)),crabs:prepared.crabs.map(route=>visitorState(route,true)),nest:createNestState(),ducklings:Array.from({length:NEST_CAPACITY},()=>({distance:parent?.homeDistance??0,heading:0,rest:0,visits:0,mode:'nestling',tuck:0}))};
}

/** Weather changes posture and pace; rain/wind never stop the whole pond. */
export function pondVisitorsNeedShelter(context) {
  const hour=((Number.isFinite(context.hour)?context.hour:13)%24+24)%24;
  return (context.ice??0)>.55||hour<6||hour>=20.5;
}

function shoreBlend(route,point,prepared) {
  const radius=Math.hypot(point.x-route.land.center[0],point.z-route.land.center[1]);
  const bank=islandBankRadius(route.land,point.x,point.z,prepared.environment);
  return smooth((bank+.15-radius)/.53);
}

function advanceVisitor(visitor,route,dt,context,prepared,kind) {
  let left=dt;
  const frozen=(context.ice??0)>.55,quiet=pondVisitorsNeedShelter(context);
  const weatherSpeed=frozen?.62:quiet?.78:context.weather==='storm'?.9:1;
  // Consume the exact residual time at stops, independent of render frame rate.
  while(left>1e-9) {
    if(visitor.rest>0) { const held=Math.min(left,visitor.rest);visitor.rest-=held;left-=held;if(left<=1e-9)break; }
    const speed=route.speed*weatherSpeed*(.94+.08*Math.sin(visitor.visits*1.7+route.phase*8));
    let remaining=wrap((route.homeDistance-visitor.distance)*route.direction,route.length);
    if(remaining<1e-8)remaining=route.length;
    const travel=Math.min(remaining,speed*left);
    visitor.distance=wrap(visitor.distance+route.direction*travel,route.length);
    left-=travel/speed;
    if(remaining<=travel+1e-8) {visitor.rest=route.restDuration;visitor.visits++;}
  }
  const sample=sampleLoop(route,visitor.distance,{}),land=shoreBlend(route,sample,prepared);
  visitor.heading=turn(visitor.heading,sample.heading+(route.direction<0?Math.PI:0)+(kind==='crab'?-Math.PI/2:0),dt);
  visitor.mode=visitor.rest>0?(route.nest?'nesting':'resting'):land>.94?(kind==='duck'?'walking':'crawling'):kind==='crab'?'wading':'swimming';
  const tuck=(visitor.rest>0?.45:quiet?.15:context.weather==='storm'?.08:0);
  visitor.tuck+=(tuck-visitor.tuck)*(1-Math.exp(-dt*2));
}

export function advancePondVisitors(state,seconds,context,prepared) {
  if(context.active===false||context.moving===false||context.paused===true)return state;
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0));if(!dt)return state;
  state.elapsed+=dt;
  const parentIndex=prepared.ducks.findIndex(route=>route.nest),parent=state.ducks[parentIndex],route=prepared.ducks[parentIndex];
  if(parent?.mode==='nesting'&&state.nest.eggs+state.nest.young>0&&nestNeedsBrooding(state.nest,8))parent.rest=Math.max(parent.rest,dt+.1);
  for(const [species,kind] of [['ducks','duck'],['turtles','turtle'],['crabs','crab']])state[species].forEach((visitor,index)=>advanceVisitor(visitor,prepared[species][index],dt,context,prepared,kind));
  advanceNest(state.nest,dt,state.ducks.some((duck,index)=>prepared.ducks[index].nest&&duck.mode==='nesting'));
  if(parent&&route)state.ducklings.forEach((child,index)=>{
    const appearance=youngAppearance(state.nest.slots[index]);
    if(!appearance.visible)return;
    if(appearance.age<8){child.heading=parent.heading;child.mode='nestling';return;}
    const target=wrap(parent.distance-route.direction*(.50+index*.42),route.length);
    const remaining=wrap(target-child.distance+route.length/2,route.length)-route.length/2;
    const step=Math.sign(remaining)*Math.min(Math.abs(remaining),(.57+appearance.growth*.08)*dt);
    child.distance=wrap(child.distance+step,route.length);
    const pose=sampleLoop(route,child.distance,{});
    if(Math.abs(step)>1e-6)child.heading=turn(child.heading,pose.heading+(step<0?Math.PI:0),dt);
    child.rest=Math.abs(remaining)<.04?1:0;child.mode=shoreBlend(route,pose,prepared)>.94?'walking':'swimming';
  });
  return state;
}

function writeVisitorPose(output,index,state,prepared,context,kind,override) {
  const species=kind==='duck'?'ducks':kind==='turtle'?'turtles':'crabs',route=prepared[species][index],visitor=state[species][index];
  if(!route||!visitor){output.visible=false;return output;}
  const live=override?.visitor??visitor,scale=override?.scale??route.scale;
  sampleLoop(route,live.distance,output);
  const land=shoreBlend(route,output,prepared),time=state.elapsed,quiet=context.moving===false||context.paused===true;
  const water=prepared.waterHeight+(context.waterLevel??0)+lakeWaveHeight(output.x,output.z,context.time??time,context.wind??.2,context.ice??0);
  const ground=islandGroundHeight(route.land,output.x,output.z,prepared.environment);
  const footHeight=(kind==='duck'?.12:kind==='turtle'?.075:.12)*scale;
  const floating=kind==='duck'?-.16*scale:kind==='turtle'?-.018:-.08;
  output.y=water+(ground-water)*land+floating*(1-land)+footHeight*land;
  output.heading=live.heading;output.roll=quiet?0:Math.sin(time*(land>.9?5:1.5)+index)*(.055*land+.018*(1-land))*(live.rest>0?.1:1);
  output.tuck=live.tuck;output.gait=quiet?0:Math.sin(time*(kind==='crab'?10:kind==='duck'?6:3.8)+index*2.1)*(live.rest>0?.025:.35);
  output.land=land;output.walk=smooth((land-.65)/.35);output.growth=override?.growth??1;output.scale=scale;output.mode=live.mode;output.visible=true;return output;
}
export function writeDuckPose(output,index,state,prepared,context={}) {return writeVisitorPose(output,index,state,prepared,context,'duck');}
export function writeTurtlePose(output,index,state,prepared,context={}) {return writeVisitorPose(output,index,state,prepared,context,'turtle');}
export function writeCrabPose(output,index,state,prepared,context={}) {return writeVisitorPose(output,index,state,prepared,context,'crab');}

export function writeDucklingPose(output,index,state,prepared,context={}) {
  const appearance=youngAppearance(state.nest.slots[index]),parentIndex=prepared.ducks.findIndex(route=>route.nest);
  if(!appearance.visible||parentIndex<0){output.visible=false;output.scale=0;return output;}
  writeVisitorPose(output,parentIndex,state,prepared,context,'duck',{visitor:state.ducklings[index],scale:(.29+appearance.growth*.70)*appearance.reveal,growth:appearance.growth});
  const nestOffset=1-smooth((appearance.age-8)/6);
  output.x+=(index===0?-.11:.11)*nestOffset;output.z+=.05*nestOffset;
  output.y+=.025*nestOffset;return output;
}
