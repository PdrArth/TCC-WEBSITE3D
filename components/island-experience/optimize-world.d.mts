import type * as THREE from "three";
import type { PavilionId } from "@/lib/experience-contract";
export function optimizeWorld(scene:THREE.Object3D,quality?:"low"|"high"):{originalPrimitives:number;primitives:number;triangles:number;batches:number;quality:"low"|"high"};
export function selectedBatchPavilion(object:THREE.Object3D,faceIndex?:number|null):PavilionId|null;
