import type {Vec3} from '../experience-contract';
export type ScenicActors={birds:Vec3[]};
export type ScenicAudioFrame={active:boolean;listener:Vec3;forward:Vec3;up:Vec3;birds:Vec3[];waterfall:{position:Vec3;flow:number}};
export type ScenicSound='water-touch'|'fishing';
