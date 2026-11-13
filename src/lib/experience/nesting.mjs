/** A single bounded brood per nest. Scenic times are intentionally shorter than real life. */
export const NEST_CAPACITY = 2;
export const INCUBATION_SECONDS = 32;
export const HATCH_SECONDS = 4;
export const GROWTH_SECONDS = 180;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function createNestState() {
  return {
    elapsed:0, eggs:0, young:0, phase:'empty', occupied:false, visit:0, laying:0,
    slots:Array.from({length:NEST_CAPACITY},()=>({laid:false,reveal:0,incubation:0,hatch:0,age:0})),
  };
}

/** Incubation stops without an adult. Hatched chicks keep growing; there is no second brood. */
export function advanceNest(state, seconds, occupied) {
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0));
  if(!dt)return state;
  state.elapsed+=dt;state.occupied=!!occupied;
  state.visit=occupied?state.visit+dt:0;
  if(occupied)state.laying+=dt;
  for(let index=0;index<state.slots.length;index++){
    const slot=state.slots[index];
    if(!slot.laid&&state.laying>=3+index*9){
      slot.laid=true;continue;
    }
    if(!slot.laid)continue;
    slot.reveal=clamp(slot.reveal+dt/1.2);
    if(slot.hatch>=1){slot.age+=dt;continue;}
    if(occupied){
      slot.incubation=Math.min(INCUBATION_SECONDS,slot.incubation+dt);
      if(slot.incubation>=INCUBATION_SECONDS)slot.hatch=clamp(slot.hatch+dt/HATCH_SECONDS);
    }
  }
  state.eggs=state.slots.filter(slot=>slot.laid&&slot.hatch<1).length;
  state.young=state.slots.filter(slot=>slot.hatch>=1).length;
  state.phase=state.slots.some(slot=>slot.hatch>0&&slot.hatch<1)?'hatching':
    state.eggs?'incubating':state.young===NEST_CAPACITY?
      state.slots.every(slot=>slot.age>=GROWTH_SECONDS)?'settled':'raising':'empty';
  return state;
}

export function nestNeedsBrooding(state, fledgingAge=60) {
  return !!state && (state.young<NEST_CAPACITY || state.slots.some(slot=>slot.age<fledgingAge));
}

export function youngAppearance(slot) {
  if(!slot?.laid)return {visible:false,reveal:0,growth:0,age:0};
  const reveal=smooth((slot.hatch-.45)/.55);
  return {visible:reveal>0,reveal,growth:smooth(slot.age/GROWTH_SECONDS),age:slot.age};
}
