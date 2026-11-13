import type * as THREE from 'three';
import type {BirdPerch} from './bird-life.mjs';
export type TreeCrown={object:THREE.Object3D;name:string;island:string;center:[number,number,number];radius:number;height:number;seed:number};
export type TreeHabitat={crowns:TreeCrown[];nest:[number,number,number]|null;perches:BirdPerch[];anchors:{object:THREE.Object3D;local:THREE.Vector3;perch:BirdPerch}[];nestAnchor:{object:THREE.Object3D;frame:THREE.Matrix4}|null;nestMatrix:THREE.Matrix4;scratch:THREE.Vector3};
export function createTreeHabitat(world:THREE.Object3D):TreeHabitat;
export function updateTreeHabitat(habitat:TreeHabitat):TreeHabitat;
export function attachTrunkFruit(world:THREE.Object3D):number;
