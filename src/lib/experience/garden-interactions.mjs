import {surfaceAt} from './environment.mjs';
import {advanceResident,writeResidentPose,residentPauseReason,residentShelterReason} from './island-life.mjs';

/** A fixed pool keeps repeated taps from creating unbounded objects or timers. */
export function createWaterTouches(count=8){return {sequence:0,cursor:0,lastAt:-Infinity,rings:Array.from({length:count},()=>({x:0,z:0,born:-Infinity,radius:0}))};}
export function addWaterTouch(state,point,time,environment,ice=0){
  if(!point?.every(Number.isFinite)||!Number.isFinite(time)||time-state.lastAt<.18||ice>.35||surfaceAt(point[0],point[2],environment).kind!=='water')return false;
  let radius=0;
  for(const candidate of [.32,.60,.95,1.30,1.65]){
    let clear=true;
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;if(surfaceAt(point[0]+Math.cos(angle)*candidate,point[2]+Math.sin(angle)*candidate,environment).kind!=='water'){clear=false;break;}}
    if(!clear)break;radius=candidate;
  }
  if(!radius)return false;
  Object.assign(state.rings[state.cursor],{x:point[0],z:point[2],born:time,radius});
  state.cursor=(state.cursor+1)%state.rings.length;state.lastAt=time;state.sequence++;return true;
}
export function touchRipple(ring,time,echo=0){
  const age=time-ring.born-echo*.24,life=2.4,t=age/life;
  return {visible:t>=0&&t<1,radius:Math.max(0,ring.radius*(.12+.88*t)),opacity:t>=0&&t<1?Math.min(1,t/.08)*(1-t)**1.25*(.94-echo*.12):0};
}
export function createGreeting(){return {age:10,elapsed:0,lastAt:-Infinity,armed:true,requested:false,count:0,welcomePending:true,heading:0,returnHeading:0};}
export function requestGreeting(state){state.requested=true;}
export function advanceGreeting(state,seconds,{available,distance,heading=0,cameraHeading=0,cameraPitch=0}){
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0));state.elapsed+=dt;state.age+=dt;
  if(distance>14)state.armed=true;
  const approaching=state.armed&&distance<9&&state.elapsed-state.lastAt>25;
  const welcome=state.welcomePending&&state.elapsed>=.65;
  if(available&&state.age>=3.6&&(state.requested&&state.elapsed-state.lastAt>4.5||approaching||welcome)){
    state.age=0;state.lastAt=state.elapsed;state.armed=false;state.count++;state.welcomePending=false;state.heading=heading;state.returnHeading=heading;
  }
  state.requested=false;
  if(!available)state.age=10;
  const active=available&&state.age<3.6;
  const target=state.age<3?cameraHeading:state.returnHeading;
  if(active)state.heading+=Math.atan2(Math.sin(target-state.heading),Math.cos(target-state.heading))*(1-Math.exp(-8*dt));
  const envelope=active?Math.max(0,Math.min(1,(state.age-.55)/.28,(3-state.age)/.45)):0;
  const turn=Math.atan2(Math.sin(cameraHeading-state.heading),Math.cos(cameraHeading-state.heading));
  return {active,heading:active?state.heading:heading,still:active?Math.min(1,state.age/.22):0,wave:envelope,sway:Math.sin(state.age*10)*.17,look:Math.max(-.35,Math.min(.35,turn))*envelope,lookPitch:-Math.max(-.25,Math.min(.50,cameraPitch))*envelope};
}

/** A greeting owns only a short stationary pause; weather and bedtime retain priority. */
export function advanceResidentWithGreeting(state,greeting,pose,seconds,context,layout,camera){
  writeResidentPose(pose,state,layout);
  const running=!residentPauseReason(context),free=['walking','observing','returning'].includes(state.phase),available=running&&free&&!context.intro&&!pose.hidden&&!pose.inside&&!pose.sleeping&&!pose.rod&&!pose.watering&&!pose.fruit&&!pose.seated&&!state.shelterReason&&!residentShelterReason(context);
  const gesture=advanceGreeting(greeting,running?seconds:0,{available,heading:state.heading,...camera});
  if(gesture.active)state.heading=gesture.heading;
  else advanceResident(state,seconds,context,layout);
  writeResidentPose(pose,state,layout);
  if(gesture.active){
    for(const limb of ['leftLeg','rightLeg','leftKnee','rightKnee','leftArm','rightArm'])pose[limb]*=1-gesture.still;
    pose.y=state.position[1]+(pose.y-state.position[1])*(1-gesture.still);
  }
  return gesture;
}
