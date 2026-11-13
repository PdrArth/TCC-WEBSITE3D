export type NestState = { eggs:number; reveal:number; visit:number; cooldown:number; laidThisVisit:boolean };
export function createNestState():NestState;
export function advanceNest(state:NestState,seconds:number,occupied:boolean):NestState;
