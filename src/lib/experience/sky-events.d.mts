import type { Weather } from './weather.mjs';
export const RAINBOW_SECONDS: number;
export const METEOR_SECONDS: number;
export type SkyEvents = {
  rainSeconds:number; wasWet:boolean; afterRain:number; rainbowCooldown:number;
  rainbowAge:number; rainbowOpacity:number; rainbows:number;
  meteorWait:number; meteorAge:number; meteorOpacity:number;
  meteorStart:[number,number]; meteorEnd:[number,number]; meteors:number;
};
export function createSkyEvents(random?:()=>number):SkyEvents;
export function advanceSkyEvents(state:SkyEvents,seconds:number,context:{weather:Weather;hour:number;active?:boolean;reducedMotion?:boolean},random?:()=>number):SkyEvents;
