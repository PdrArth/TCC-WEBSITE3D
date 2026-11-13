import {createBirdState,advanceBird} from './bird-life.mjs';
import {NEST_CAPACITY,nestNeedsBrooding,youngAppearance} from './nesting.mjs';

export function createBirdFamily(){
  return {children:Array.from({length:NEST_CAPACITY},()=>({bird:null,fledged:false,visible:false,scale:0,growth:0}))};
}

export function birdFamilyCare(nest,family,perches){
  return {nestIndex:perches.findIndex(perch=>perch.nest),protect:nestNeedsBrooding(nest,60)||family.children.some(child=>!child.fledged)};
}

/** Small nestlings practise their wings before their first flight, only in flyable weather. */
export function advanceBirdFamily(family,nest,seconds,mayFly,perches,shelters){
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0)),nestIndex=perches.findIndex(perch=>perch.nest);
  if(nestIndex<0)return family;
  const anchor=perches[nestIndex].position;
  family.children.forEach((child,index)=>{
    const appearance=youngAppearance(nest.slots[index]);
    child.visible=appearance.visible;child.growth=appearance.growth;child.scale=(.42+appearance.growth*.98)*appearance.reveal;
    if(!child.visible)return;
    if(!child.bird){
      child.bird=createBirdState(20+index,perches,shelters);
      child.bird.perch=nestIndex;child.bird.wait=0;child.bird.rest=0;
      Object.assign(child.bird.pose,{x:anchor[0]+(index?1:-1)*.10,y:anchor[1]-.025,z:anchor[2]+.06,heading:index?.65:-.65});
    }
    if(!child.fledged&&appearance.age>=60&&mayFly)child.fledged=true;
    if(child.fledged)advanceBird(child.bird,dt,mayFly,perches,shelters);
    else{
      child.bird.clock+=dt;
      const pose=child.bird.pose,clock=child.bird.clock;
      pose.x=anchor[0]+(index?1:-1)*.10;pose.y=anchor[1]-.025;pose.z=anchor[2]+.06;
      pose.look=Math.sin(clock*1.3+index)*.13;pose.breath=Math.sin(clock*3)*.015;
      pose.peck=Math.sin(clock*1.1+index)*.06;pose.flap=.08+Math.sin(clock*4)*.14*Math.min(1,appearance.age/60);pose.fold=.65;pose.mode=0;
    }
  });
  return family;
}
