import type {BirdState,BirdPerch,BirdNestCare} from './bird-life.mjs';
import type {NestState} from './nesting.mjs';
export type BirdFamily={children:{bird:BirdState|null;fledged:boolean;visible:boolean;scale:number;growth:number}[]};
export function createBirdFamily():BirdFamily;
export function birdFamilyCare(nest:NestState,family:BirdFamily,perches:BirdPerch[]):BirdNestCare;
export function advanceBirdFamily(family:BirdFamily,nest:NestState,seconds:number,mayFly:boolean,perches:BirdPerch[],shelters:BirdPerch[]):BirdFamily;
