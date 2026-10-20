export type ResolutionLimits={min:number;max:number};
export type RenderBudget={value:number;elapsed:number;frames:number;slow:number;fast:number};
export function resolutionLimits(width:number,height:number,quality?:'high'|'low',mobile?:boolean,intro?:boolean):ResolutionLimits;
export function createRenderBudget(value?:number):RenderBudget;
export function advanceRenderBudget(state:RenderBudget,seconds:number,limits:ResolutionLimits,eligible?:boolean):number;
