import type { WorldEnvironmentManifest } from "../experience-contract";
import type { Weather } from "./weather.mjs";
import type { Season } from "./seasons.mjs";
export type EnvironmentState = {weather:Weather;season:Season;hour:number;elapsed:number;wetness:number;snow:number;ice:number;wind:number;night:number};
export function createEnvironmentManifest():WorldEnvironmentManifest;
export function insidePolygon(x:number,z:number,polygon:[number,number][]):boolean;
export function surfaceAt(x:number,z:number,manifest?:WorldEnvironmentManifest):{kind:"land"|"water"|"outside";height:number};
export function createEnvironmentState(weather?:Weather,season?:Season,hour?:number):EnvironmentState;
export function advanceEnvironment(state:EnvironmentState,seconds:number,weather:Weather,season:Season,hour:number):EnvironmentState;
