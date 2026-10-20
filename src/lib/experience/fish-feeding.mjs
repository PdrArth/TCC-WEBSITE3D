import {fishSegmentIsClear,writeFishPose} from '../../components/island-experience/scene-motion.mjs';

const TAU=Math.PI*2;
const turn=(current,target,dt)=>current+Math.atan2(Math.sin(target-current),Math.cos(target-current))*(1-Math.exp(-7*dt));
function clearCircle(x,z,radius,environment){
  for(let i=0;i<16;i++){
    const a=i*TAU/16,b=(i+1)*TAU/16;
    if(!fishSegmentIsClear([x+Math.cos(a)*radius,z+Math.sin(a)*radius],[x+Math.cos(b)*radius,z+Math.sin(b)*radius],environment,.56))return false;
  }
  return true;
}
export function createFeedSpot(){return {sequence:0,born:-Infinity,x:0,z:0,radius:0,eaters:0};}
export function requestFishFood(spot,point,time,environment,ice=0){
  if(!point?.every(Number.isFinite)||!Number.isFinite(time)||ice>.35||time-spot.born<3||!fishSegmentIsClear([point[0],point[2]],[point[0],point[2]],environment,.6))return false;
  const radius=[.65,.45].find(r=>clearCircle(point[0],point[2],r,environment));
  if(!radius)return false;
  Object.assign(spot,{sequence:spot.sequence+1,born:time,x:point[0],z:point[2],radius,eaters:0});return true;
}
export function createFeedingFish(count){return {sequence:0,lastTime:NaN,sample:{x:0,y:0,z:0,heading:0,tail:0},fish:Array.from({length:count},()=>({mode:'route',offset:0,heading:NaN,x:0,z:0,anchorX:0,anchorZ:0,anchorTime:0,centerX:0,centerZ:0,radius:0,angle:0,entryAngle:0,born:0}))};}
function orbitPoint(fish){fish.x=fish.centerX+Math.cos(fish.angle)*fish.radius;fish.z=fish.centerZ+Math.sin(fish.angle)*fish.radius;}
function swimTo(fish,x,z,dt,speed){
  const dx=x-fish.x,dz=z-fish.z,distance=Math.hypot(dx,dz),step=Math.min(distance,speed*dt);
  if(distance>1e-8){fish.x+=dx/distance*step;fish.z+=dz/distance*step;fish.heading=turn(fish.heading,Math.atan2(dx,dz),dt);}
  return distance<=step+1e-7;
}
/** Depart and return on the same checked segment; route clocks resume at the departure point. */
export function advanceFeedingFish(state,spot,time,routes,environment,ice=0){
  const dt=Number.isFinite(state.lastTime)?Math.min(.1,Math.max(0,time-state.lastTime)):0;state.lastTime=time;
  if(state.sequence!==spot.sequence){
    state.sequence=spot.sequence;const candidates=[];
    state.fish.forEach((fish,index)=>{
      if(fish.mode!=='route')return;
      const pose=writeFishPose(state.sample,index,time-fish.offset,routes),distance=Math.hypot(pose.x-spot.x,pose.z-spot.z);
      if(distance>10)return;
      const radius=spot.radius*(.7+(index%3)*.12),angle=Math.atan2(pose.z-spot.z,pose.x-spot.x),x=spot.x+Math.cos(angle)*radius,z=spot.z+Math.sin(angle)*radius;
      if(clearCircle(spot.x,spot.z,radius,environment)&&fishSegmentIsClear([pose.x,pose.z],[x,z],environment,.56))candidates.push({index,distance,x:pose.x,z:pose.z,heading:pose.heading,angle,radius});
    });
    for(const candidate of candidates.sort((a,b)=>a.distance-b.distance).slice(0,state.fish.length>24?8:6)){
      const fish=state.fish[candidate.index];Object.assign(fish,{mode:'approach',x:candidate.x,z:candidate.z,heading:candidate.heading,anchorX:candidate.x,anchorZ:candidate.z,anchorTime:time-fish.offset,centerX:spot.x,centerZ:spot.z,radius:candidate.radius,angle:candidate.angle,entryAngle:candidate.angle,born:spot.born});
    }
  }
  let eaters=0;
  state.fish.forEach((fish,index)=>{
    if(fish.mode==='route'){
      const pose=writeFishPose(state.sample,index,time-fish.offset,routes);fish.heading=Number.isFinite(fish.heading)?turn(fish.heading,pose.heading,dt):pose.heading;return;
    }
    const direction=index%2?1:-1,speed=1.25+(index%4)*.12,angular=.85+(index%3)*.11;
    const expired=time-fish.born>=9||ice>.35||fish.born!==spot.born;
    if(expired&&fish.mode==='approach')fish.mode='return';
    if(expired&&fish.mode==='feeding')fish.mode='exit-orbit';
    if(fish.mode==='approach'){
      if(swimTo(fish,fish.centerX+Math.cos(fish.entryAngle)*fish.radius,fish.centerZ+Math.sin(fish.entryAngle)*fish.radius,dt,speed))fish.mode='feeding';
    }else if(fish.mode==='feeding'||fish.mode==='exit-orbit'){
      const remaining=((fish.entryAngle-fish.angle)*direction%TAU+TAU)%TAU,step=fish.mode==='exit-orbit'?Math.min(remaining,dt*angular):dt*angular;
      fish.angle+=step*direction;orbitPoint(fish);fish.heading=turn(fish.heading,Math.atan2(-Math.sin(fish.angle)*direction,Math.cos(fish.angle)*direction),dt);
      if(fish.mode==='exit-orbit'&&remaining<=step+1e-7)fish.mode='return';
    }else if(fish.mode==='return'&&swimTo(fish,fish.anchorX,fish.anchorZ,dt,speed)){
      fish.offset=time-fish.anchorTime;fish.mode='route';
    }
    if(fish.mode==='feeding'&&fish.born===spot.born)eaters++;
  });
  spot.eaters=eaters;return state;
}
export function writeFeedingFishPose(pose,index,time,routes,state){
  const fish=state.fish[index];writeFishPose(pose,index,time-(fish?.offset??0),routes);
  if(fish&&fish.mode!=='route'){pose.x=fish.x;pose.z=fish.z;pose.tail=Math.sin(time*(6+index%3*.45)+index)*.38;}
  if(fish&&Number.isFinite(fish.heading))pose.heading=fish.heading;
  return pose;
}
export function foodCrumbPose(index,time,spot){
  const age=time-spot.born,life=9,angle=index*2.39996,radius=.10+(index%4)*.12;
  return {visible:age>=0&&age<life,x:spot.x+Math.cos(angle)*radius,z:spot.z+Math.sin(angle)*radius,scale:age>=0&&age<life?Math.min(1,age*5,life-age)*(.023+(index%3)*.006):0};
}
