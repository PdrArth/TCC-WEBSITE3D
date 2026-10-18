import type { BirdPose } from '../../components/island-experience/scene-motion.mjs';
export type BirdPerch={position:[number,number,number];island:string};
export type BirdCompanion={available:boolean;position:[number,number,number];heading:number};
export type BirdState={index:number;pose:BirdPose & {fold:number;mode:number};clock:number;rest:number;wait:number;perch:number;cycle:number;sheltered:boolean;requested:boolean;reaction:number;flight:{segments:{from:number[];to:number[];a:number[];b:number[];duration:number;time:number}[];index:number;kind:string}|null;shoulder:boolean;companionCooldown:number};
export function createBirdState(index:number,perches:BirdPerch[],shelters:BirdPerch[],sheltered?:boolean):BirdState;
export function advanceBird(state:BirdState,seconds:number,mayFly:boolean,perches:BirdPerch[],shelters:BirdPerch[],companion?:BirdCompanion|null,startled?:number):BirdPose & {fold:number;mode:number};
