import type * as THREE from "three";
export type PreparationProgress = { done:number;total:number;state:"preparing"|"ready" };
export function prepareEffectMaterials(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,world:THREE.Object3D,onProgress:(progress:PreparationProgress)=>void,schedule?:(callback:()=>void)=>()=>void,options?:{canPrepare?:()=>boolean;scheduleStart?:(callback:()=>void)=>()=>void}):()=>void;
export class FrameStalls {
  armed:boolean;count:number;maximum:number;events:{ms:number;context:string}[];
  sample(seconds:number,context:string,enabled:boolean):void;
}
