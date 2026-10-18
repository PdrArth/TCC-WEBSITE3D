import type { PerspectiveCamera } from "three";
export type OpeningFrame = {left:number;top:number;width:number;height:number};
export function openingFrame(width:number,height:number):OpeningFrame;
export function applyOpeningView(camera:PerspectiveCamera,width:number,height:number):OpeningFrame;
export function clearOpeningView(camera:PerspectiveCamera,width:number,height:number):void;
