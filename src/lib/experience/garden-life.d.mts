import type { WorldEnvironmentManifest } from "../experience-contract";
export type FlowerBed = { x:number;y:number;z:number;island:string;seed:number;color:string;height:number };
export function flowerBeds(environment:WorldEnvironmentManifest,quality?:"high"|"low"):FlowerBed[];
export function butterflyPose(index:number,seconds:number,bed:FlowerBed):{x:number;y:number;z:number;heading:number;flap:number};
