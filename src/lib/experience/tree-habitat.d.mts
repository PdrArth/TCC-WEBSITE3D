import type * as THREE from 'three';
import type {BirdPerch} from './bird-life.mjs';
export type TreeCrown={object:THREE.Object3D;name:string;island:string;center:[number,number,number];radius:number;height:number;seed:number};
export type TreeHabitat={crowns:TreeCrown[];nest:[number,number,number]|null;perches:BirdPerch[]};
export function createTreeHabitat(world:THREE.Object3D):TreeHabitat;
export function attachTrunkFruit(world:THREE.Object3D):number;
