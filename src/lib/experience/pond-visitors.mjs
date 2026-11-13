import { fishSegmentIsClear } from '../../components/island-experience/scene-motion.mjs';
import { surfaceAt } from './environment.mjs';
import { isIslandWalkingPoint } from './island-life.mjs';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, length) => length > 0 ? (value % length + length) % length : 0;
const turn = (current, target, dt) => current + Math.atan2(Math.sin(target-current), Math.cos(target-current)) * (1-Math.exp(-dt*5));
const badWeather = new Set(['storm','hail','snow','freezing-rain']);

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

/** Ducks float above the lake: a raised pedestrian deck is still an obstacle. */
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
function bankDistance(point,environment) {
  const islands=[...environment.land,...(environment.decorativeLand??[])];
  let distance=Math.min(...islands.map(island=>Math.hypot(point[0]-island.center[0],point[1]-island.center[1])-island.radius));
  const shoreline=environment.water.shoreline;
  for(let i=0;i<shoreline.length;i++)distance=Math.min(distance,pointSegmentDistance(point,shoreline[i],shoreline[(i+1)%shoreline.length]));
  return distance;
}

function duckRoutes(environment,count) {
  const [cx,cz]=environment.water.center;
  const centers=[[-4,1.5],[4,-1.4],[-3.4,-4],[3.1,3.0],[-5.4,4.3],[5.4,-4.8],[0,-5.5],[0,1.2]];
  const candidates=[];
  for(const [offsetX,offsetZ] of centers) {
    for(const [rx,rz] of [[1.75,1.15],[1.30,.92],[.95,.70]]) {
      const points=Array.from({length:64},(_,i)=>[cx+offsetX+Math.cos(i*TAU/64)*rx,cz+offsetZ+Math.sin(i*TAU/64)*rz]);
      if(points.every((point,index)=>duckSegmentIsClear(point,points[(index+1)%points.length],environment))) {
        const route=preparedLoop(points);
        const home=points.reduce((best,point,index)=>bankDistance(point,environment)<bankDistance(points[best],environment)?index:best,0);
        candidates.push({...route,homeDistance:route.cumulative[home]});
        break;
      }
    }
  }
  return candidates.slice(0,count).map((route,index)=>({...route,speed:.46+index*.075,direction:index%2?-1:1,phase:wrap(.137+index*.381966,1),scale:index>1?.94:1.20}));
}

/** Body clearance is checked as well as the foot point, so no shell hangs over the bank. */
export function turtleGroundIsClear(point,island,environment,clearance=.52) {
  if(!isIslandWalkingPoint([point[0],island.height,point[1]],island))return false;
  for(const [dx,dz] of [[0,0],...Array.from({length:12},(_,i)=>[Math.cos(i*TAU/12)*clearance,Math.sin(i*TAU/12)*clearance])]) {
    const surface=surfaceAt(point[0]+dx,point[1]+dz,environment);
    if(surface.kind!=='land'||Math.abs(surface.height-island.height)>.025)return false;
    if(Math.hypot(point[0]+dx-island.center[0],point[1]+dz-island.center[1])>island.radius-.055)return false;
    if(!isIslandWalkingPoint([point[0]+dx,island.height,point[1]+dz],island))return false;
  }
  return true;
}
function turtleRoutes(environment,count) {
  const order=[0,6,1,5,2,4,3],routes=[];
  for(const index of order) {
    const island=environment.land[index];if(!island)continue;
    const facing=Math.atan2(environment.water.center[1]-island.center[1],environment.water.center[0]-island.center[0]);
    let chosen=null;
    for(const offset of [0,.22,-.22,.42,-.42,.65,-.65,.9,-.9,1.2,-1.2,...Array.from({length:64},(_,i)=>i*TAU/64)]) {
      const angle=facing+offset,radius=island.radius-.58;
      const a=[island.center[0]+Math.cos(angle)*radius,island.center[1]+Math.sin(angle)*radius];
      const endAngle=angle+(routes.length%2?-.23:.23),b=[island.center[0]+Math.cos(endAngle)*radius,island.center[1]+Math.sin(endAngle)*radius];
      if(Array.from({length:25},(_,i)=>[a[0]+(b[0]-a[0])*i/24,a[1]+(b[1]-a[1])*i/24]).every(point=>turtleGroundIsClear(point,island,environment))) {
        chosen={kind:'land',island:island.id,points:[a,b],height:island.height,length:Math.hypot(b[0]-a[0],b[1]-a[1]),heading:Math.atan2(b[0]-a[0],b[1]-a[1]),speed:.12+routes.length*.015,restDuration:5+routes.length*2,scale:1.08};break;
      }
    }
    if(chosen)routes.push(chosen);
    if(routes.length===count)break;
  }
  return routes;
}

function swimmingTurtleRoute(environment) {
  const island=environment.land[6]??environment.land[0];
  const facing=Math.atan2(environment.water.center[1]-island.center[1],environment.water.center[0]-island.center[0]);
  for(const offset of [0,-.3,.3,-.55,.55]) {
    const angle=facing+offset,cx=island.center[0]+Math.cos(angle)*(island.radius+1.85),cz=island.center[1]+Math.sin(angle)*(island.radius+1.85);
    const points=Array.from({length:64},(_,i)=>[cx+Math.cos(i*TAU/64)*.9,cz+Math.sin(i*TAU/64)*.7]);
    if(!points.every((point,index)=>duckSegmentIsClear(point,points[(index+1)%points.length],environment,.75)))continue;
    const loop=preparedLoop(points),home=points.reduce((best,p,index)=>bankDistance(p,environment)<bankDistance(points[best],environment)?index:best,0);
    return {...loop,kind:'water',island:island.id,height:environment.water.height,heading:loop.headings[0],homeDistance:loop.cumulative[home],speed:.27,restDuration:5,scale:1.18};
  }
  return null;
}

/** Small lateral patrols stay on actual walkable shoreline, clear of beds and bridges. */
function crabRoutes(environment,turtles) {
  const routes=[];
  for(const index of [0,6]) {
    const island=environment.land[index];if(!island)continue;
    const facing=Math.atan2(environment.water.center[1]-island.center[1],environment.water.center[0]-island.center[0]);
    for(const offset of [-.50,.50,-.75,.75,0,1,-1,...Array.from({length:64},(_,i)=>i*TAU/64)]) {
      const angle=facing+offset,radius=island.radius-.60;
      const a=[island.center[0]+Math.cos(angle)*radius,island.center[1]+Math.sin(angle)*radius];
      const endAngle=angle+.19,b=[island.center[0]+Math.cos(endAngle)*radius,island.center[1]+Math.sin(endAngle)*radius];
      if(turtles.some(route=>route.kind==='land'&&segmentsDistance(a,b,route.points[0],route.points[1])<1.2))continue;
      if(!Array.from({length:25},(_,i)=>[a[0]+(b[0]-a[0])*i/24,a[1]+(b[1]-a[1])*i/24]).every(point=>turtleGroundIsClear(point,island,environment,.52)))continue;
      routes.push({kind:'land',island:island.id,points:[a,b],height:island.height,length:Math.hypot(b[0]-a[0],b[1]-a[1]),heading:Math.atan2(b[0]-a[0],b[1]-a[1])-Math.PI/2,speed:.22+routes.length*.045,restDuration:2.1+routes.length*.6,scale:1.08});break;
    }
  }
  return routes;
}

export function createPondVisitors(environment,quality='low') {
  const swimmer=swimmingTurtleRoute(environment),turtles=turtleRoutes(environment,swimmer?1:2);
  if(swimmer)turtles.push(swimmer);
  return {ducks:duckRoutes(environment,quality==='high'?4:3),turtles,crabs:crabRoutes(environment,turtles),waterHeight:environment.water.height};
}
export function createPondVisitorState(prepared) {
  const sample={x:0,z:0,heading:0};
  return {elapsed:0,ducks:prepared.ducks.map(route=>{
    const distance=route.phase*route.length;sampleLoop(route,distance,sample);
    return {distance,heading:sample.heading+(route.direction<0?Math.PI:0),mode:'swimming',tuck:0};
  }),turtles:prepared.turtles.map(route=>({distance:0,direction:1,heading:route.heading,rest:0,mode:route.kind==='water'?'swimming':'crawling',tuck:0})),
  crabs:prepared.crabs.map((route,index)=>({distance:route.length*(index?.7:.15),direction:index?-1:1,heading:route.heading,rest:0,mode:'crawling',tuck:0}))};
}
export function pondVisitorsNeedShelter(context) {
  const hour=((Number.isFinite(context.hour)?context.hour:13)%24+24)%24;
  return badWeather.has(context.weather)||(context.ice??0)>.20||(context.wind??0)>.78||hour<6||hour>=20.5;
}

/** Only visible, running simulation time advances the finite visitor state. */
export function advancePondVisitors(state,seconds,context,prepared) {
  if(context.active===false||context.moving===false||context.paused===true)return state;
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0));if(!dt)return state;
  const shelter=pondVisitorsNeedShelter(context);state.elapsed+=dt;
  const sample={x:0,z:0,heading:0};
  state.ducks.forEach((duck,index)=>{
    const route=prepared.ducks[index];let step=route.direction*route.speed*dt;
    if(shelter) {
      const remaining=wrap(route.homeDistance-duck.distance+route.length/2,route.length)-route.length/2;
      step=Math.sign(remaining)*Math.min(Math.abs(remaining),route.speed*1.22*dt);
      duck.mode=Math.abs(remaining)<=Math.abs(step)+1e-7?'resting':'sheltering';
    } else duck.mode='swimming';
    duck.distance=wrap(duck.distance+step,route.length);
    sampleLoop(route,duck.distance,sample);
    if(Math.abs(step)>1e-7)duck.heading=turn(duck.heading,sample.heading+(step<0?Math.PI:0),dt);
    duck.tuck+=(Number(duck.mode==='resting')*.86-duck.tuck)*(1-Math.exp(-dt*2));
  });
  state.turtles.forEach((turtle,index)=>{
    const route=prepared.turtles[index];let elapsed=dt,movement=0;
    if(route.kind==='water') {
      const remaining=wrap(route.homeDistance-turtle.distance+route.length/2,route.length)-route.length/2;
      const step=shelter?Math.sign(remaining)*Math.min(Math.abs(remaining),route.speed*dt):route.speed*dt;
      turtle.distance=wrap(turtle.distance+step,route.length);sampleLoop(route,turtle.distance,sample);
      turtle.mode=shelter?(Math.abs(remaining)<=Math.abs(step)+1e-7?'resting':'sheltering'):'swimming';
      if(Math.abs(step)>1e-7)turtle.heading=turn(turtle.heading,sample.heading+(step<0?Math.PI:0),dt);
      turtle.tuck+=((shelter?.7:.03)-turtle.tuck)*(1-Math.exp(-dt*1.7));
      return;
    }
    if(shelter) {
      movement=-Math.min(turtle.distance,route.speed*1.3*dt);turtle.distance+=movement;
      turtle.mode=turtle.distance>.00001?'sheltering':'resting';
    } else {
      if(turtle.rest>0){const held=Math.min(turtle.rest,elapsed);turtle.rest-=held;elapsed-=held;}
      if(elapsed>0) {
        const remaining=turtle.direction>0?route.length-turtle.distance:turtle.distance;
        const travel=Math.min(remaining,route.speed*elapsed);movement=turtle.direction*travel;turtle.distance+=movement;
        turtle.mode='crawling';
        if(remaining<=travel+1e-8){turtle.direction*=-1;turtle.rest=route.restDuration-Math.max(0,elapsed-travel/route.speed);turtle.mode='resting';}
      } else turtle.mode='resting';
    }
    if(Math.abs(movement)>1e-7)turtle.heading=turn(turtle.heading,route.heading+(movement<0?Math.PI:0),dt);
    turtle.tuck+=((shelter?.92:.07)-turtle.tuck)*(1-Math.exp(-dt*1.7));
  });
  state.crabs.forEach((crab,index)=>{
    const route=prepared.crabs[index];let elapsed=dt;
    if(shelter) {
      crab.distance=Math.max(0,crab.distance-route.speed*dt);crab.mode=crab.distance>.00001?'sheltering':'resting';
    } else {
      if(crab.rest>0){const held=Math.min(crab.rest,elapsed);crab.rest-=held;elapsed-=held;}
      if(elapsed>0) {
        const remaining=crab.direction>0?route.length-crab.distance:crab.distance,travel=Math.min(remaining,route.speed*elapsed);
        crab.distance+=crab.direction*travel;crab.mode='crawling';
        if(remaining<=travel+1e-8){crab.direction*=-1;crab.rest=route.restDuration-Math.max(0,elapsed-travel/route.speed);crab.mode='resting';}
      } else crab.mode='resting';
    }
    crab.tuck+=((shelter?.7:0)-crab.tuck)*(1-Math.exp(-dt*2));
  });
  return state;
}

export function writeDuckPose(output,index,state,prepared,context={}) {
  const route=prepared.ducks[index],duck=state.ducks[index];if(!route||!duck){output.visible=false;return output;}
  sampleLoop(route,duck.distance,output);
  const quiet=context.moving===false||context.paused===true,time=state.elapsed;
  output.y=prepared.waterHeight+(context.waterLevel??0)-.025+Math.sin(time*1.7+index*1.9)*.013*(1-duck.tuck);
  output.heading=duck.heading;output.roll=quiet?0:Math.sin(time*2.1+index)*.025;
  output.tuck=duck.tuck;output.gait=quiet?0:Math.sin(time*6+index*2.1)*(duck.mode==='resting'?.05:.35);
  output.scale=route.scale;output.mode=duck.mode;output.visible=true;return output;
}
export function writeTurtlePose(output,index,state,prepared,context={}) {
  const route=prepared.turtles[index],turtle=state.turtles[index];if(!route||!turtle){output.visible=false;return output;}
  if(route.kind==='water') {
    sampleLoop(route,turtle.distance,output);output.y=prepared.waterHeight+(context.waterLevel??0)-.015+Math.sin(state.elapsed*1.4+index)*.009;
  } else {
    const t=clamp(turtle.distance/route.length,0,1),a=route.points[0],b=route.points[1];
    output.x=a[0]+(b[0]-a[0])*t;output.z=a[1]+(b[1]-a[1])*t;output.y=route.height+.085;
  }
  output.heading=turtle.heading;output.roll=0;output.tuck=turtle.tuck+Math.sin(state.elapsed*1.3+index)*.025*(1-turtle.tuck);
  output.gait=turtle.mode==='resting'?0:Math.sin(state.elapsed*(route.kind==='water'?2.5:3.8)+index*2.4)*.38;
  output.scale=route.scale;output.mode=turtle.mode;output.visible=true;return output;
}

export function writeCrabPose(output,index,state,prepared) {
  const route=prepared.crabs[index],crab=state.crabs[index];if(!route||!crab){output.visible=false;return output;}
  const t=clamp(crab.distance/route.length,0,1),a=route.points[0],b=route.points[1];
  output.x=a[0]+(b[0]-a[0])*t;output.z=a[1]+(b[1]-a[1])*t;output.y=route.height+.12;
  output.heading=crab.heading;output.roll=0;output.tuck=crab.tuck;
  output.gait=Math.sin(state.elapsed*10+index*2.1)*(crab.mode==='resting'?.035:.22);
  output.scale=route.scale;output.mode=crab.mode;output.visible=true;return output;
}
