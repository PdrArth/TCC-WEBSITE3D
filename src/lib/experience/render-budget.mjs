/** Adjust only pixel cost; every season, weather effect and simulation stays active. */
export function resolutionLimits(width,height,quality='low',mobile=false,intro=false){
  const ceiling=intro?.75:quality==='high'?1.35:1;
  const pixels=Math.max(1,width*height),budget=mobile?720000:2300000;
  const max=Math.max(.65,Math.min(ceiling,Math.sqrt(budget/pixels)));
  return {min:Math.min(max,mobile?.65:.75),max};
}
export function createRenderBudget(value=1){return {value,elapsed:0,frames:0,slow:0,fast:0};}
export function advanceRenderBudget(state,seconds,limits,eligible=true){
  state.value=Math.min(limits.max,Math.max(limits.min,state.value));
  if(!eligible||!Number.isFinite(seconds)||seconds<=0||seconds>.2){state.elapsed=0;state.frames=0;state.slow=0;state.fast=0;return state.value;}
  state.elapsed+=seconds;state.frames++;
  if(state.elapsed<2.5)return state.value;
  const fps=state.frames/state.elapsed;
  state.slow=fps<29?state.slow+1:0;state.fast=fps>54?state.fast+1:0;
  if(state.slow>=2){state.value=Math.max(limits.min,state.value-.1);state.slow=0;state.fast=0;}
  else if(state.fast>=6){state.value=Math.min(limits.max,state.value+.05);state.fast=0;}
  state.elapsed=0;state.frames=0;return state.value;
}
