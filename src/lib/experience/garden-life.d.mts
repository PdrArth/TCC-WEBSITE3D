import type { WorldEnvironmentManifest } from "../experience-contract";
import type {Season} from './seasons.mjs';
import type {Weather} from './weather.mjs';
export type FlowerBed = { x:number;y:number;z:number;island:string;seed:number;color:string;height:number };
export function flowerBeds(environment:WorldEnvironmentManifest,quality?:"high"|"low"):FlowerBed[];
export function butterflyPose(index:number,seconds:number,bed:FlowerBed):{x:number;y:number;z:number;heading:number;flap:number};
export function fireflyPresence(season:Season,weather:Weather,night?:number,wind?:number):number;
export function fireflyPose(index:number,seconds:number,bed:FlowerBed):{x:number;y:number;z:number;glow:number};
