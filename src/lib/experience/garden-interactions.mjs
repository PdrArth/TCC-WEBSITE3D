import {surfaceAt} from './environment.mjs';

/** A fixed pool keeps repeated taps from creating unbounded objects or timers. */
export function createWaterTouches(count=8){return {sequence:0,cursor:0,lastAt:-Infinity,rings:Array.from({length:count},()=>({x:0,z:0,born:-Infinity,radius:0}))};}
export function addWaterTouch(state,point,time,environment,ice=0){
  if(!point?.every(Number.isFinite)||!Number.isFinite(time)||time-state.lastAt<.18||ice>.35||surfaceAt(point[0],point[2],environment).kind!=='water')return false;
  let radius=0;
  for(const candidate of [.28,.52,.78,1.05]){
    let clear=true;
    for(let i=0;i<12;i++){const angle=i*Math.PI/6;if(surfaceAt(point[0]+Math.cos(angle)*candidate,point[2]+Math.sin(angle)*candidate,environment).kind!=='water'){clear=false;break;}}
    if(!clear)break;radius=candidate;
  }
  if(!radius)return false;
  Object.assign(state.rings[state.cursor],{x:point[0],z:point[2],born:time,radius});
  state.cursor=(state.cursor+1)%state.rings.length;state.lastAt=time;state.sequence++;return true;
}
export function touchRipple(ring,time,echo=0){
  const age=time-ring.born-echo*.20,life=1.65,t=age/life;
  return {visible:t>=0&&t<1,radius:Math.max(0,ring.radius*(.12+.88*t)),opacity:t>=0&&t<1?Math.min(1,t/.10)*(1-t)**1.4*(.66-echo*.12):0};
}
export function createGreeting(){return {age:10,elapsed:0,lastAt:-Infinity,armed:true,requested:false,count:0};}
export function requestGreeting(state){state.requested=true;}
export function advanceGreeting(state,seconds,{available,distance,heading=0,cameraHeading=0}){
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0));state.elapsed+=dt;state.age+=dt;
  if(distance>14)state.armed=true;
  const approaching=state.armed&&distance<9&&state.elapsed-state.lastAt>25;
  if(available&&(state.requested&&state.elapsed-state.lastAt>4||approaching)){
    state.age=0;state.lastAt=state.elapsed;state.armed=false;state.count++;
  }
  state.requested=false;
  const envelope=available?Math.min(1,state.age/.28,Math.max(0,(2.8-state.age)/.5)):0;
  const turn=Math.atan2(Math.sin(cameraHeading-heading),Math.cos(cameraHeading-heading));
  return {wave:Math.max(0,envelope),sway:Math.sin(state.age*10)*.17,look:Math.max(-.65,Math.min(.65,turn))*Math.max(0,envelope)};
}
