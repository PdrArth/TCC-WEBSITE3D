/** Shared scenic state and collision surfaces, authored in glTF metres. */
export function createEnvironmentManifest() {
  const centers = [["pesquisa",-11,9],["gerar",-14,-1],["comparar",-10,-11],["validar",0,-14],["especificar",10,-11],["evoluir",14,-1],["perspectivas",11,9]];
  const shoreline = Array.from({length:140},(_,i)=>{
    const a=Math.PI*2*i/140;
    const factor=1+.035*Math.sin(a*3+.7)+.024*Math.cos(a*7-.7)+.016*Math.sin(a*11);
    return [Math.cos(a)*20*factor,-2-Math.sin(a)*19.3*factor];
  });
  return {
    water:{height:-.16,center:[0,-2],radii:[20,19.3],shoreline},
    land:centers.map(([id,x,z])=>({id,center:[x,z],radius:id==="pesquisa"||id==="perspectivas"?4.22:4.08,height:.092})),
    bridges:centers.slice(1).map((c,i)=>({from:[centers[i][1],centers[i][2]],to:[c[1],c[2]],width:.78,height:.43})),
    vegetation:{evergreen:["palm","banana","cypress","jabuticaba","fern","monstera"],deciduous:["ipe","quaresmeira","pitanga"]},
    lights:centers.map(([pavilion,x,z])=>({pavilion,position:[x,2.35,z+.7]})),
    lighthouse:{position:[11.2,4.929,8.64],direction:[0,0,1]},
  };
}

export function insidePolygon(x,z,polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function segmentDistance(x,z,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/length)):0;
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
const defaultManifest=createEnvironmentManifest();
export function surfaceAt(x,z,manifest=defaultManifest){
  for(const roof of manifest.roofs??[]){
    const dx=x-roof.center[0],dz=z-roof.center[1],c=Math.cos(roof.yaw),s=Math.sin(roof.yaw);
    const lx=dx*c-dz*s,lz=dx*s+dz*c;
    if(Math.abs(lx)<=roof.halfExtents[0]&&Math.abs(lz)<=roof.halfExtents[1])return {kind:"land",height:roof.height+roof.ridgeRise*(1-Math.abs(lx)/roof.halfExtents[0])};
  }
  for(const land of manifest.land)if(Math.hypot(x-land.center[0],z-land.center[1])<=land.radius)return {kind:"land",height:land.height};
  for(const land of manifest.decorativeLand??[])if(Math.hypot(x-land.center[0],z-land.center[1])<=land.radius)return {kind:"land",height:land.height};
  for(const bridge of manifest.bridges)if(segmentDistance(x,z,bridge.from,bridge.to)<bridge.width)return {kind:"land",height:bridge.height};
  if(insidePolygon(x,z,manifest.water.shoreline))return {kind:"water",height:manifest.water.height};
  return {kind:"outside",height:-1};
}

export function createEnvironmentState(weather="clear",season="spring",hour=13){
  return {weather,season,hour,elapsed:0,wetness:0,snow:0,ice:0,wind:.2,night:0};
}
export function advanceEnvironment(state,seconds,weather,season,hour){
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0));
  state.weather=weather;state.season=season;state.hour=hour;state.elapsed+=dt;
  const wet=["drizzle","rain","freezing-rain","storm","hail"].includes(weather);
  state.wetness=Math.max(0,Math.min(1,state.wetness+(wet?.24:-.045)*dt));
  state.snow=Math.max(0,Math.min(1,state.snow+(weather==="snow"?.075:weather==="freezing-rain"?-.012:-.035)*dt));
  state.ice=Math.max(0,Math.min(1,state.ice+(["freezing-rain","snow"].includes(weather)?.052:-.025)*dt));
  const wind=weather==="storm"||weather==="hail"?1:weather==="rain"?.6:.22;
  state.wind+=(wind-state.wind)*(1-Math.exp(-dt));
  const h=((hour%24)+24)%24;
  const night=h<5.5||h>=20?1:h<7.5?1-(h-5.5)/2:h>17?(h-17)/3:0;
  state.night+=(night-state.night)*(1-Math.exp(-2*dt));
  return state;
}
