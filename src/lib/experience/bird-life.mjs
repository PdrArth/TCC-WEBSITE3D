const clamp=v=>Math.max(0,Math.min(1,v));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const point=pose=>[pose.x,pose.y,pose.z];
const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export function createBirdState(index,perches,shelters,sheltered=false){
  const origin=(sheltered?shelters:perches)[index%(sheltered?shelters:perches).length].position;
  return {index,pose:{x:origin[0],y:origin[1],z:origin[2],heading:index*.8,bank:0,flap:.16,fold:.84,mode:0},
    clock:0,rest:0,wait:.8+index*.53,perch:index%perches.length,cycle:0,sheltered,requested:sheltered,reaction:0,flight:null,shoulder:false,companionCooldown:0};
}

function curve(from,to,index,low=false){
  const dx=to[0]-from[0],dz=to[2]-from[2],length=Math.hypot(dx,dz)||1,side=(index%2?1:-1)*Math.min(4,length*.18);
  const peak=low?Math.max(from[1],to[1])+.24:Math.max(7.5,from[1]+2,to[1]+2);
  return {from:[...from],to:[...to],a:[from[0]+dx*.24-dz/length*side,peak,from[2]+dz*.24+dx/length*side],
    b:[to[0]-dx*.22-dz/length*side*.6,peak,to[2]-dz*.22+dx/length*side*.6],duration:low?Math.max(1.4,length/1.6):Math.max(5.5,Math.min(18,length/3.4+3)),time:0};
}
function launch(state,target,kind){
  const from=point(state.pose),segments=[];
  if(state.sheltered) { const gate=[from[0],from[1]+.45,12.6];segments.push(curve(from,gate,state.index,true));from.splice(0,3,...gate); }
  if(kind==='shelter'){
    const gate=[target[0],target[1]+.45,12.6];segments.push(curve(from,gate,state.index));segments.push(curve(gate,target,state.index,true));
  } else if(kind==='shoulder') {
    const gate=[target[0],target[1]+.65,target[2]+2.2];segments.push(curve(from,gate,state.index));segments.push(curve(gate,target,state.index,true));
  } else segments.push(curve(from,target,state.index));
  state.flight={segments,index:0,kind};state.shoulder=false;state.sheltered=false;state.rest=0;state.cycle++;
}

/** Every change starts at the current pose; the bird flies its own curved approach to cover. */
export function advanceBird(state,seconds,mayFly,perches,shelters,companion=null,startled=0){
  const dt=Math.max(0,Math.min(.1,Number.isFinite(seconds)?seconds:0));if(!dt)return state.pose;
  const p=state.pose;state.clock+=dt;state.companionCooldown=Math.max(0,state.companionCooldown-dt);
  const shelter=!mayFly;
  if(shelter!==state.requested){state.requested=shelter;state.reaction=.35+(state.index%6)*.22;}
  if(state.reaction>0){state.reaction=Math.max(0,state.reaction-dt);if(state.reaction===0){
    if(shelter)launch(state,shelters[state.index%shelters.length].position,'shelter');
    else {state.perch=(state.perch+3+state.index)%perches.length;launch(state,perches[state.perch].position,'perch');}
  }}
  if(state.shoulder&&(!companion?.available||shelter)){
    state.companionCooldown=45;
    launch(state,shelter?shelters[state.index%shelters.length].position:perches[state.perch].position,shelter?'shelter':'perch');
  }
  if(state.flight?.kind==='shoulder'&&!companion?.available){state.companionCooldown=35;launch(state,perches[state.perch].position,'perch');}
  if(state.flight){
    const flight=state.flight,segment=flight.segments[flight.index],before=point(p);
    segment.time=Math.min(segment.duration,segment.time+dt);
    const raw=segment.time/segment.duration,t=raw*raw*(3-2*raw),s=1-t;
    const coords=segment.from.map((v,i)=>s*s*s*v+3*s*s*t*segment.a[i]+3*s*t*t*segment.b[i]+t*t*t*segment.to[i]);
    [p.x,p.y,p.z]=coords;
    const dx=p.x-before[0],dz=p.z-before[2],desired=Math.hypot(dx,dz)>.000001?Math.atan2(dx,dz):p.heading;
    const turn=angle(p.heading,desired);p.heading+=turn*(1-Math.exp(-7*dt));p.bank+=(-Math.max(-.32,Math.min(.32,turn))*(Math.sin(Math.PI*raw)) - p.bank)*(1-Math.exp(-5*dt));
    p.mode=raw<.15?1:raw>.78?4:Math.sin(state.clock*.8+state.index)>.25?3:2;
    p.fold=.84*(1-clamp(raw/.10))+.84*clamp((raw-.90)/.10);
    p.flap=p.mode===3?.10:Math.sin(state.clock*(11+state.index*.19))*.58;
    if(segment.time===segment.duration){
      if(++flight.index>=flight.segments.length){state.sheltered=flight.kind==='shelter';state.shoulder=flight.kind==='shoulder';state.flight=null;state.rest=0;state.wait=3+state.index%4*1.1;}
    }
  }else{
    state.rest+=dt;p.mode=0;p.fold=.84;p.flap=.16;p.bank*=Math.exp(-7*dt);
    if(state.shoulder&&companion?.available){[p.x,p.y,p.z]=companion.position;p.heading+=angle(p.heading,companion.heading)*(1-Math.exp(-4*dt));}
    else if(mayFly&&state.reaction===0){
      if(state.index===0&&companion?.available&&state.companionCooldown===0){launch(state,companion.position,'shoulder');state.companionCooldown=50;}
      else if(state.rest>=state.wait||startled>.5){state.perch=(state.perch+Math.floor(perches.length/2)+1+state.index%3)%perches.length;launch(state,perches[state.perch].position,'perch');}
    }
  }
  return p;
}
