/** Deterministic life on seven physical islands; coordinates are glTF metres. */
import { surfaceAt } from './environment.mjs';
export const ISLAND_LIFE_VERSION = 20;
export const RESIDENT_SCALE = 1.4;
export const RESIDENT_HEIGHT = 1.76;
const IDS = ['pesquisa','gerar','comparar','validar','especificar','evoluir','perspectivas'];
const WET = new Set(['drizzle','rain','storm','hail','freezing-rain','snow']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
const copy=p=>[...p];
export function homeLocalPoint(home,local,output=[0,0,0]) {
 const c=Math.cos(home.yaw),s=Math.sin(home.yaw);
 output[0]=home.position[0]+local[0]*c+local[2]*s; output[1]=home.position[1]+local[1]; output[2]=home.position[2]-local[0]*s+local[2]*c; return output;
}
export function residentBed(home) {
 return { center:homeLocalPoint(home,[-.95,home.floorHeight+.36,.02]), foot:homeLocalPoint(home,[-.95,home.floorHeight+.58,1.04]), width:1.12,length:2.16,yaw:home.yaw };
}
/** A bite, reel and brief reveal within each existing fishing stop. */
export function fishingMoment(seconds) {
 const t=Math.max(0,seconds),ease=v=>{const x=clamp(v,0,1);return x*x*(3-2*x);};
 const lift=ease((t-3.1)/1.65),release=ease((t-6.65)/.9);
 return {bite:t>=2.55&&t<3.1,lift:lift*(1-release),caught:t>=3.1&&t<7.55,show:t>=4.75&&t<6.65};
}
export function pathLength(points) { let length=0; for(let i=1;i<points.length;i++)length+=distance(points[i-1],points[i]); return length; }
export function sampleLifePath(points,metres,output=[0,0,0]) {
 if(!points.length)return output;
 let remaining=Math.max(0,Number.isFinite(metres)?metres:0);
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b);if(remaining<=length&&length>0){const t=remaining/length;for(let axis=0;axis<3;axis++)output[axis]=a[axis]+(b[axis]-a[axis])*t;return output;}remaining-=length;}
 for(let axis=0;axis<3;axis++)output[axis]=points.at(-1)[axis]; return output;
}
function pathTail(points,metres){const output=[sampleLifePath(points,metres)];let covered=0;for(let i=1;i<points.length;i++){covered+=distance(points[i-1],points[i]);if(covered>metres+1e-7)output.push(copy(points[i]));}return output;}
const visitedReverse=(points,metres)=>pathTail([...points].reverse(),Math.max(0,pathLength(points)-metres));
const feet=points=>points.map(([x,y,z])=>[x,y+.055,z]);
/** Obstructions from build_world_v8.py; furniture and walls remain inside terraces. */
function islandObstructions(id){return {terrace:['comparar','validar'].includes(id)?{halfWidth:2.40,halfDepth:2.10}:{radius:2.61},beds:[[-3.10,.55,.62,1.07],[3.04,-.90,.57,1.20],[-.18,-3.40,1.65,.38],[-2.43,2.57,.63,.43],[2.39,2.65,.64,.39]],trunks:[[-2.99,-1.58,.36],[3.00,-1.62,.36]]};}
function fishingSpot(island,environment){
 const [x,z]=island.center,angle=Math.atan2(environment.water.center[0]-x,environment.water.center[1]-z);
 for(const offset of [0,.3,-.3,.6,-.6,.9,-.9,1.2,-1.2,1.5,-1.5,1.8,-1.8,Math.PI]){
   const a=angle+offset,position=[x+Math.sin(a)*(island.radius-.35),island.height+.012,z+Math.cos(a)*(island.radius-.35)],target=[x+Math.sin(a)*(island.radius+1.20),environment.water.height+.02,z+Math.cos(a)*(island.radius+1.20)];
   if(isIslandWalkingPoint(position,island)&&surfaceAt(target[0],target[2],environment).kind==='water')return {position,target};
 }
 throw new Error(`No water-facing fishing shore on ${island.id}`);
}
export function isIslandWalkingPoint(point,island,obstructions=islandObstructions(island.id)){
 const x=point[0]-island.center[0],z=point[2]-island.center[1],terrace=obstructions.terrace;
 const a=Math.atan2(-z,x),index=IDS.indexOf(island.id),shore=island.radius*(1+.035*Math.sin(a*3+index*.4)+.023*Math.cos(a*7-index*.7));
 if(Math.hypot(x,z)>Math.min(island.radius-.055,shore-.015))return false;
 if(terrace.radius?Math.hypot(x,z)<terrace.radius:Math.abs(x)<terrace.halfWidth&&Math.abs(z)<terrace.halfDepth)return false;
 for(const[bx,bz,rx,rz]of obstructions.beds)if(((x-bx)/(rx+.075))**2+((z-bz)/(rz+.075))**2<1)return false;
 for(const[tx,tz,radius]of obstructions.trunks)if(Math.hypot(x-tx,z-tz)<radius)return false;
 return true;
}
function clearSegment(a,b,island,obstructions){
 const ax=a[0]-island.center[0],az=a[2]-island.center[1],bx=b[0]-island.center[0],bz=b[2]-island.center[1];
 const ellipseHit=(cx,cz,rx,rz)=>{const x=(ax-cx)/rx,z=(az-cz)/rz,dx=(bx-ax)/rx,dz=(bz-az)/rz,t=clamp(-(x*dx+z*dz)/(dx*dx+dz*dz||1),0,1);return(x+t*dx)**2+(z+t*dz)**2<1-1e-10;};
 const terrace=obstructions.terrace;
 if(terrace.radius){if(ellipseHit(0,0,terrace.radius,terrace.radius))return false;}
 else{let low=0,high=1;for(const[p,d,r]of[[ax,bx-ax,terrace.halfWidth],[az,bz-az,terrace.halfDepth]]){if(Math.abs(d)<1e-12){if(Math.abs(p)>=r){low=2;break;}}else{const t1=(-r-p)/d,t2=(r-p)/d;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}}if(low<high-1e-9)return false;}
 for(const[x,z,rx,rz]of obstructions.beds)if(ellipseHit(x,z,rx+.075,rz+.075))return false;
 for(const[x,z,r]of obstructions.trunks)if(ellipseHit(x,z,r,r))return false;
 const count=Math.max(1,Math.ceil(distance(a,b)/.025));for(let i=0;i<=count;i++){const t=i/count;if(!isIslandWalkingPoint([a[0]+(b[0]-a[0])*t,a[1],a[2]+(b[2]-a[2])*t],island,obstructions))return false;}return true;
}
/** Temporary lattice is reduced to safe exterior polylines; no avatar star edges. */
function islandCorridor(island,from,to,obstructions){
 if(clearSegment(from,to,island,obstructions))return[copy(from),copy(to)];
 const step=.08,cells=new Map(),limit=Math.ceil(island.radius/step);
 for(let ix=-limit;ix<=limit;ix++)for(let iz=-limit;iz<=limit;iz++){const point=[island.center[0]+ix*step,island.height+.012,island.center[1]+iz*step];if(isIslandWalkingPoint(point,island,obstructions))cells.set(`${ix},${iz}`,{point,ix,iz});}
 const entries=[...cells.values()],attach=point=>entries.filter(c=>distance(c.point,point)<.55&&clearSegment(point,c.point,island,obstructions));
 const starts=attach(from),ends=new Set(attach(to)),costs=new Map(),previous=new Map(),open=[];
 for(const c of starts){costs.set(c,distance(from,c.point));open.push(c);}
 let found;
 while(open.length){let best=0;for(let i=1;i<open.length;i++)if(costs.get(open[i])+distance(open[i].point,to)<costs.get(open[best])+distance(open[best].point,to))best=i;const current=open.splice(best,1)[0];if(ends.has(current)){found=current;break;}
 for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const next=cells.get(`${current.ix+dx},${current.iz+dz}`);if(!next||!clearSegment(current.point,next.point,island,obstructions))continue;const cost=costs.get(current)+distance(current.point,next.point);if(cost>=(costs.get(next)??Infinity)-1e-9)continue;costs.set(next,cost);previous.set(next,current);if(!open.includes(next))open.push(next);}}
 if(!found)throw new Error(`No safe garden corridor on ${island.id}: ${from} -> ${to}`);
 const dense=[copy(to)];for(let c=found;c;c=previous.get(c))dense.push(c.point);dense.push(copy(from));dense.reverse();
 const output=[dense[0]];for(let i=0;i<dense.length-1;){let next=dense.length-1;while(next>i+1&&!clearSegment(dense[i],dense[next],island,obstructions))next--;output.push(dense[next]);i=next;}return output;
}
export function createIslandLifeLayout(environment){
 const islands=IDS.map(id=>environment.land.find(land=>land.id===id));if(islands.some(island=>!island))throw new Error('Island life requires all seven existing islands.');
 const research=islands[0],prospects=islands[6];
 const home={position:[0,.092,8.55],yaw:0,footprint:[4,2.8],porchDepth:1.05,porchWidth:3.8,floorHeight:.16,wallHeight:2.18,roofRise:.50,height:2.84,seatHeight:.46};
 const hp=(x,z,y=home.floorHeight+.012)=>homeLocalPoint(home,[x,y,z]);
 Object.assign(home,{porch:hp(.65,2.03),door:hp(.65,1.4),doorOutside:hp(.65,1.72),interior:hp(.65,.70),seated:hp(-.95,2.03),interiorSeated:hp(-.95,.68),window:hp(-.95,1.4,home.floorHeight+1.35),workPoint:hp(-.95,3.4,home.floorHeight+1.0)});
 home.bench={position:copy(home.seated),width:1.2,seatHeight:home.seatHeight};
 const islet={id:'moradia',center:[0,9],radius:3.1,height:.092};
 // Exact retained 49-point v18/v19 closing bridge, with points at plank centres.
 const start=[prospects.center[0]-2.55,prospects.height+.055,prospects.center[1]+2.40],end=[research.center[0]+2.55,research.height+.055,research.center[1]+2.40],ca=[start[0]-.7,start[2]+5.7],cb=[end[0]+.7,end[2]+5.7];
 const points=Array.from({length:49},(_,i)=>{const t=i/48,s=1-t;return[s**3*start[0]+3*s*s*t*ca[0]+3*s*t*t*cb[0]+t**3*end[0],start[1]*s+end[1]*t+.21*Math.sin(Math.PI*t),s**3*start[2]+3*s*s*t*ca[1]+3*s*t*t*cb[1]+t**3*end[2]];});
 const bridge={from:'perspectivas',to:'pesquisa',node:'bridge_perspectivas_pesquisa_v18',width:1.03,points};
 const connector={points:[[0,.049,11.6],[0,.105,12.2],[0,.225,13.8],copy(points[24])],width:1.03};
 const walkingGraph={nodes:{},edges:[],bridges:[],obstacles:{}},landings=[];
 const addNode=(id,position,meta={})=>{walkingGraph.nodes[id]={position:copy(position),...meta};return id;};
 const addEdge=(id,from,to,route,meta={})=>{const edge={id,from,to,points:route.map(copy),length:pathLength(route),...meta};walkingGraph.edges.push(edge);return edge;};
 addNode('home-entry',feet(connector.points)[0]);addNode('home-porch',home.porch);addNode('home-door-outside',home.doorOutside);addNode('home-door',home.door);addNode('home-interior',home.interior);addNode('home-seat',home.seated);addNode('home-interior-seat',home.interiorSeated);
 addEdge('home-steps','home-entry','home-porch',[walkingGraph.nodes['home-entry'].position,hp(.65,2.85,.012),hp(.65,2.57,.09),hp(.65,2.35),home.porch],{kind:'home'});
 addEdge('home-porch-door','home-porch','home-door-outside',[home.porch,home.doorOutside],{kind:'home'});
 addEdge('home-threshold','home-door-outside','home-door',[home.doorOutside,home.door],{kind:'door'});
 addEdge('home-inside','home-door','home-interior',[home.door,home.interior],{kind:'door'});
 addEdge('home-bench','home-porch','home-seat',[home.porch,home.seated],{kind:'home'});
 addEdge('home-window-seat','home-interior','home-interior-seat',[home.interior,home.interiorSeated],{kind:'home'});
 const ports=Object.fromEntries(IDS.map(id=>[id,[]]));
 for(let i=0;i<6;i++){
 const a=islands[i],b=islands[i+1],dx=b.center[0]-a.center[0],dz=b.center[1]-a.center[1],norm=Math.hypot(dx,dz),from=[a.center[0]+dx/norm*(a.radius-.10),.185,a.center[1]+dz/norm*(a.radius-.10)],to=[b.center[0]-dx/norm*(b.radius-.10),.185,b.center[1]-dz/norm*(b.radius-.10)];
 const side=[-dz/norm,dx/norm],landingFor=(point,island)=>{
 for(const inset of[0,.12,.24])for(const offset of[0,.16,-.16,.32,-.32,.42,-.42]){const r=Math.hypot(point[0]-island.center[0],point[2]-island.center[1]),p=[point[0]+side[0]*offset+(island.center[0]-point[0])/r*inset,point[1],point[2]+side[1]*offset+(island.center[1]-point[2])/r*inset];if(isIslandWalkingPoint(p,island))return{point:p,offset,inset};}throw new Error(`Blocked bridge landfall ${island.id}`);};
 const la=landingFor(from,a),lb=landingFor(to,b),bridgeId=`${a.id}-${b.id}`,deck=Array.from({length:25},(_,j)=>{const t=j/24,offset=la.offset*Math.max(0,1-t*4)+lb.offset*Math.max(0,t*4-3);return[from[0]+(to[0]-from[0])*t+side[0]*offset,.185+.21*Math.sin(Math.PI*t),from[2]+(to[2]-from[2])*t+side[1]*offset];});
 if(la.inset)landings.push({points:[la.point,deck[0]].map(([x,y,z])=>[x,y-.055,z]),width:1.03});if(lb.inset)landings.push({points:[deck.at(-1),lb.point].map(([x,y,z])=>[x,y-.055,z]),width:1.03});
 const route=[...(la.inset?[la.point]:[]),...deck,...(lb.inset?[lb.point]:[])],na=addNode(`${bridgeId}:a`,route[0],{island:a.id}),nb=addNode(`${bridgeId}:b`,route.at(-1),{island:b.id});
 ports[a.id].push(na);ports[b.id].push(nb);addEdge(bridgeId,na,nb,route,{kind:'bridge',bridge:bridgeId});walkingGraph.bridges.push({id:bridgeId,from:a.id,to:b.id,points:route,width:1.03});
 }
 // End planks overlap flower beds; exposed landfalls at points 2/46 avoid them.
 const closingFeet=feet(points),closingA=addNode('closing:a',closingFeet[2],{island:prospects.id}),closingB=addNode('closing:b',closingFeet[46],{island:research.id}),junction=addNode('closing:middle',closingFeet[24]);
 ports[prospects.id].push(closingA);ports[research.id].push(closingB);
 addEdge('closing-east',closingA,junction,closingFeet.slice(2,25),{kind:'bridge',bridge:'perspectivas-pesquisa'});addEdge('closing-west',junction,closingB,closingFeet.slice(24,47),{kind:'bridge',bridge:'perspectivas-pesquisa'});
 walkingGraph.bridges.push({id:'perspectivas-pesquisa',from:prospects.id,to:research.id,points:closingFeet,width:bridge.width});
 addEdge('home-connector','home-entry',junction,feet(connector.points),{kind:'connector'});
 const activityPoints=[],kinds=['watering','gathering','observing','watering','observing','gathering','fishing'];
 islands.forEach((island,i)=>{
 const local=kinds[i]==='gathering'?[2.25,-2.00]:kinds[i]==='watering'?[-1.45,2.82]:kinds[i]==='fishing'?[0,3.80]:[0,3.42],position=[island.center[0]+local[0],island.height+.012,island.center[1]+local[1]];
 const target=kinds[i]==='watering'?[island.center[0]-2.43,island.height+.35,island.center[1]+2.57]:kinds[i]==='gathering'?[island.center[0]+2.99,island.height+1.05,island.center[1]-1.62]:[island.center[0],kinds[i]==='fishing'?environment.water.height+.02:.8,island.center[1]+6.0];
 if(kinds[i]==='fishing'){const spot=fishingSpot(island,environment);position.splice(0,3,...spot.position);target.splice(0,3,...spot.target);}
 const id=`${island.id}-${kinds[i]}`,node=addNode(id,position,{island:island.id});activityPoints.push({id,node,island:island.id,kind:kinds[i],position,target,duration:kinds[i]==='fishing'?8:5.5});
 const obstructions=islandObstructions(island.id);walkingGraph.obstacles[island.id]=obstructions;
 const terminals=[...ports[island.id],node];for(let a=0;a<terminals.length;a++)for(let b=a+1;b<terminals.length;b++){const from=walkingGraph.nodes[terminals[a]].position,to=walkingGraph.nodes[terminals[b]].position;addEdge(`${island.id}-garden-${a}-${b}`,terminals[a],terminals[b],islandCorridor(island,from,to,obstructions),{kind:'island',island:island.id});}
 });
 activityPoints.unshift({id:'bridge-fishing',node:junction,bridge:'perspectivas-pesquisa',kind:'fishing',position:copy(closingFeet[24]),target:[2.15,environment.water.height+.02,14.3],duration:8});
 const fishing=activityPoints.find(a=>a.kind==='fishing'),garden=activityPoints.find(a=>a.kind==='watering'),tree={position:[research.center[0]+2.99,research.height,research.center[1]-1.62],standing:[research.center[0]+2.25,research.height+.012,research.center[1]-2],fruit:[research.center[0]+2.99,research.height+1.05,research.center[1]-1.62],existingNode:'island_pesquisa_jabuticabeira_wood'};
 // Existing furniture: the research/review stools and the lighthouse reading bench.
 const seats={pesquisa:{x:-.74,z:1.20,height:1.2265,heading:Math.PI},validar:{x:-.53,z:1.18,height:1.2265,heading:Math.PI},perspectivas:{x:1.53,z:.80,height:1.079,heading:0}};
 const expanded=[];
 for(const activity of activityPoints){
   expanded.push(activity);if(!activity.island)continue;
   const island=islands.find(item=>item.id===activity.island),[cx,cz]=island.center,obstructions=walkingGraph.obstacles[island.id];
   if(activity.kind!=='fishing'){
     const {position,target}=fishingSpot(island,environment),node=addNode(`${island.id}-fishing`,position,{island:island.id});
     addEdge(`${island.id}-fish-path`,activity.node,node,islandCorridor(island,activity.position,position,obstructions),{kind:'island',island:island.id});
     expanded.push({id:node,node,island:island.id,kind:'fishing',position,target,duration:8});
   }
   const seat=seats[island.id];if(seat){
     const entry=[cx,island.height+.012,cz+3.42],entryNode=addNode(`${island.id}-seat-entry`,entry,{island:island.id});
     addEdge(`${island.id}-seat-garden`,activity.node,entryNode,islandCorridor(island,activity.position,entry,obstructions),{kind:'island',island:island.id});
     const position=[cx+seat.x,.641,cz+seat.z],node=addNode(`${island.id}-seat`,position,{island:island.id});
     const route=[entry,[cx,.11,cz+2.9],[cx,.208,cz+2.53],[cx,.40,cz+2.31],[cx,.596,cz+2.09],[cx,.641,cz+1.78],[cx+seat.x,.641,cz+1.60],position];
     addEdge(`${island.id}-seat-stairs`,entryNode,node,route,{kind:'furniture',island:island.id});
     expanded.push({id:node,node,island:island.id,kind:'sitting',position,target:[position[0]+Math.sin(seat.heading),position[1]+.8,position[2]+Math.cos(seat.heading)],seatHeight:seat.height,duration:16});
   }
 }
 activityPoints.splice(0,activityPoints.length,...expanded);
 const layout={version:ISLAND_LIFE_VERSION,island:'moradia',islet,home,connector,landings,resident:{scale:RESIDENT_SCALE,height:RESIDENT_HEIGHT,initialPathDistance:1.5,walkSpeed:1.15,runSpeed:2.15,dryDelay:8},fishing:{position:fishing.position,target:fishing.target},garden:{position:garden.target,standing:garden.position,target:garden.target},tree,bridge,walkingGraph,activityPoints,paths:{toFish:[],toTree:[],toHome:[]}};
 layout.paths.toFish=planLifeRoute(layout,'home-porch',fishing.node).points;layout.paths.toTree=planLifeRoute(layout,fishing.node,activityPoints.findLast(a=>a.kind==='gathering').node).points;layout.paths.toHome=planLifeRoute(layout,activityPoints.findLast(a=>a.kind==='gathering').node,'home-porch').points;return layout;
}
function surfaceSegments(points,width){return points.slice(1).map((p,i)=>({from:[points[i][0],points[i][2]],to:[p[0],p[2]],width:width/2,height:(points[i][1]+p[1])/2+.055}));}
export function bridgeSurfaceSegments(layout){return surfaceSegments(layout.bridge.points,layout.bridge.width);}
export function lifeSurfaceSegments(layout){return[...bridgeSurfaceSegments(layout),...surfaceSegments(layout.connector.points,layout.connector.width),...layout.landings.flatMap(l=>surfaceSegments(l.points,l.width))];}
export function walkingSurfaceSegments(layout){return[...layout.walkingGraph.bridges.flatMap(b=>surfaceSegments(b.points.map(([x,y,z])=>[x,y-.055,z]),b.width)),...surfaceSegments(layout.connector.points,layout.connector.width)];}
export function bridgePillars(layout){return[.28,.72].map(t=>{const p=sampleLifePath(layout.connector.points,pathLength(layout.connector.points)*t);return{position:[p[0],-.62,p[2]],radius:.09};});}
/** Dijkstra on physical edge polylines, in either direction. */
export function planLifeRoute(layout,from,to){
 const graph=layout.walkingGraph,costs=new Map([[from,0]]),previous=new Map(),open=new Set([from]);
 while(open.size){let current;for(const key of open)if(current===undefined||costs.get(key)<costs.get(current))current=key;open.delete(current);if(current===to)break;
 for(const edge of graph.edges){const next=edge.from===current?edge.to:edge.to===current?edge.from:null;if(!next)continue;const cost=costs.get(current)+edge.length;if(cost>=(costs.get(next)??Infinity)-1e-9)continue;costs.set(next,cost);previous.set(next,{edge,from:current,to:next});open.add(next);}}
 if(!graph.nodes[from]||!graph.nodes[to]||!costs.has(to))throw new Error(`No pedestrian route ${from} -> ${to}`);
 const steps=[];for(let key=to;key!==from;){const s=previous.get(key);steps.push({edgeId:s.edge.id,from:s.from,to:s.to,points:(s.edge.from===s.from?s.edge.points:[...s.edge.points].reverse()).map(copy),length:s.edge.length});key=s.from;}steps.reverse();
 const points=[copy(graph.nodes[from].position)];for(const step of steps)points.push(...step.points.slice(1).map(copy));return{points,steps,length:costs.get(to),destination:to};
}
/** Exact occupied edge is retained; never project through water to a graph node. */
export function residentReturnRoute(state,layout,destination='home-door-outside'){
 if(!state.routeSteps.length||state.routeDistance>=pathLength(state.route)-1e-7)return planLifeRoute(layout,state.node,destination);
 let covered=0;for(const step of state.routeSteps){if(covered+step.length>=state.routeDistance-1e-7){const local=clamp(state.routeDistance-covered,0,step.length),before=visitedReverse(step.points,local),after=pathTail(step.points,local),ra=planLifeRoute(layout,step.from,destination),rb=planLifeRoute(layout,step.to,destination),forward=pathLength(after)+rb.length<=pathLength(before)+ra.length,partial=forward?after:before,next=forward?rb:ra;return{points:partial.concat(next.points.slice(1)),steps:[{edgeId:step.edgeId,from:forward?step.from:step.to,to:forward?step.to:step.from,points:partial,length:pathLength(partial)},...next.steps],length:pathLength(partial)+next.length,destination};}covered+=step.length;}
 return planLifeRoute(layout,state.node,destination);
}
export function residentShelterReason(context){if(WET.has(context.weather)||(context.precipitation??0)>0)return'weather';const hour=((context.hour??13)%24+24)%24;return hour<6||hour>=19||(context.night??0)>=.7?'night':null;}
export function residentPauseReason(context){return context.visible===false?'hidden':context.moving===false||context.panelOpen||context.reading?'paused':context.reducedMotion?'reduced-motion':null;}
function assignRoute(state,route,phase='walking'){state.phase=phase;state.phaseTime=0;state.routeDistance=0;state.route=route.points;state.routeSteps=route.steps;state.destination=route.destination;}
function beginActivity(state,layout){const activity=layout.activityPoints[state.activityIndex];state.activityId=activity.id;state.activityTarget=activity.target;assignRoute(state,planLifeRoute(layout,state.node,activity.node));}
function stationary(state,phase){state.phase=phase;state.phaseTime=0;state.routeSteps=[];state.route=[copy(state.position)];state.routeDistance=0;}
export function createResidentState(layout){
 const state={phase:'walking',phaseTime:0,elapsed:0,cycle:0,distanceMoved:0,routeDistance:0,route:[],routeSteps:[],destination:'',node:'home-porch',position:copy(layout.home.porch),heading:0,gait:.8,gesture:0,hidden:false,shelterReason:null,nightRest:false,sleepBlend:0,activityIndex:0,activityId:layout.activityPoints[0].id,dryTime:8,weatherTime:0,doorOpen:0,inside:false,resumeActivityIndex:0};
 beginActivity(state,layout);state.routeDistance=Math.min(layout.resident.initialPathDistance,pathLength(state.route));sampleLifePath(state.route,state.routeDistance,state.position);const ahead=sampleLifePath(state.route,state.routeDistance+.15);state.heading=Math.atan2(ahead[0]-state.position[0],ahead[2]-state.position[2]);return state;
}
function headingToward(state,target,dt){const dx=target[0]-state.position[0],dz=target[2]-state.position[2];if(Math.hypot(dx,dz)<.0001)return;const desired=Math.atan2(dx,dz),turn=Math.atan2(Math.sin(desired-state.heading),Math.cos(desired-state.heading));state.heading+=turn*(1-Math.exp(-8*dt));}
function isMovingPhase(phase){return['walking','returning','entering','exiting','to-porch','walk-home'].includes(phase);}
export function advanceResident(state,seconds,context,layout){
 if(residentPauseReason(context))return state;const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.1);if(!dt)return state;
 const hour=((context.hour??13)%24+24)%24;state.nightRest=hour<6||hour>=19||(context.night??0)>=.7;
 state.sleepBlend=clamp((state.sleepBlend??0)+(state.phase==='interior'&&state.nightRest?1:-1)*dt/.95,0,1);
 const wet=WET.has(context.weather)||(context.precipitation??0)>0,reason=residentShelterReason(context);state.dryTime=wet?0:Math.min(layout.resident.dryDelay,state.dryTime+dt);state.weatherTime=wet?state.weatherTime+dt:0;state.shelterReason=wet||state.dryTime<layout.resident.dryDelay?'weather':reason;const needsShelter=state.shelterReason!==null;
 if(needsShelter&&!['returning','entering','interior','to-porch','porch'].includes(state.phase)&&!(state.phase==='exiting'&&(context.weather==='drizzle'||state.shelterReason==='night'))){state.resumeActivityIndex=state.activityIndex;assignRoute(state,residentReturnRoute(state,layout),'returning');}
 if((state.nightRest||wet&&context.weather!=='drizzle')&&state.phase==='porch')assignRoute(state,planLifeRoute(layout,state.node,'home-door-outside'),'returning');
 state.elapsed+=dt;state.phaseTime+=dt;
 if(isMovingPhase(state.phase)){
 const length=pathLength(state.route),previous=state.routeDistance,speed=state.phase==='returning'&&state.shelterReason==='weather'?layout.resident.runSpeed:state.phase==='entering'||state.phase==='exiting'?.85:layout.resident.walkSpeed;
 state.routeDistance=Math.min(length,state.routeDistance+dt*speed);state.distanceMoved+=state.routeDistance-previous;state.gait+=(state.routeDistance-previous)*8.3;sampleLifePath(state.route,state.routeDistance,state.position);if(state.phase==='entering'||state.phase==='exiting')state.inside=state.position[2]<layout.home.door[2]-.01;headingToward(state,sampleLifePath(state.route,Math.min(length,state.routeDistance+.18)),dt);state.doorOpen=['entering','exiting'].includes(state.phase)?Math.min(1,state.phaseTime*5):Math.max(0,state.doorOpen-dt*3);
 if(state.routeDistance>=length-1e-7){state.node=state.destination;
 if(state.phase==='returning')assignRoute(state,planLifeRoute(layout,state.node,'home-interior-seat'),'entering');
 else if(state.phase==='entering'){state.inside=true;stationary(state,'interior');}
 else if(state.phase==='exiting'){state.inside=false;if(needsShelter)stationary(state,'porch');else{state.activityIndex=state.resumeActivityIndex;beginActivity(state,layout);}}
 else if(state.phase==='to-porch')stationary(state,'porch');
 else if(state.phase==='walk-home'){state.cycle++;stationary(state,'porch');}
 else stationary(state,layout.activityPoints[state.activityIndex].kind);}
 }else if(state.phase==='interior'){
 state.doorOpen=Math.max(0,state.doorOpen-dt*3);headingToward(state,layout.home.window,dt);
 if(!state.nightRest&&state.sleepBlend===0&&(!needsShelter||context.weather==='drizzle'&&state.phaseTime>=5))assignRoute(state,planLifeRoute(layout,state.node,'home-seat'),'exiting');
 }else if(state.phase==='porch'){
 headingToward(state,layout.home.workPoint,dt);state.doorOpen=Math.max(0,state.doorOpen-dt*3);if(state.shelterReason==='night'&&state.phaseTime>=12)assignRoute(state,planLifeRoute(layout,state.node,'home-door-outside'),'returning');else if(!needsShelter&&state.phaseTime>=4){state.activityIndex=state.resumeActivityIndex;beginActivity(state,layout);}
 }else{const activity=layout.activityPoints[state.activityIndex];headingToward(state,activity.target,dt);if(state.phaseTime>=activity.duration){state.activityIndex++;if(state.activityIndex>=layout.activityPoints.length){state.activityIndex=0;state.resumeActivityIndex=0;assignRoute(state,planLifeRoute(layout,state.node,'home-seat'),'walk-home');}else beginActivity(state,layout);}}
 state.gesture=Math.sin(state.phaseTime*(state.phase==='fishing'?1.55:2.3));return state;
}
/** Angles are radians; bodyOffsetY is world metres and target vectors are shared. */
export function writeResidentPose(output,state,layout){
 const sleeping=state.phase==='interior'&&(state.nightRest||state.sleepBlend>0);
 const walking=isMovingPhase(state.phase),stride=walking?Math.sin(state.gait):0,fishing=state.phase==='fishing',gathering=state.phase==='gathering',watering=state.phase==='watering',seated=state.phase==='sitting'||state.phase==='porch'||state.phase==='interior'&&!sleeping;
 output.x=state.position[0];output.y=state.position[1]+(walking?Math.abs(Math.sin(state.gait*2))*.014:0);output.z=state.position[2];output.heading=state.heading;
 output.leftLeg=seated?-1.12:stride*.40;output.rightLeg=seated?-1.12:-stride*.40;output.leftKnee=seated?1.12:Math.max(0,-stride)*.38;output.rightKnee=seated?1.12:Math.max(0,stride)*.38;
 output.leftArm=fishing?-1.05+state.gesture*.16:seated?-.28:-stride*.36;output.rightArm=fishing?-1.15+state.gesture*.22:gathering?-1.20-Math.sin(state.phaseTime*1.1)*.72:watering?-.78+state.gesture*.05:seated?-.30:stride*.36;
 output.leftElbow=fishing?-.38:seated?-.9:-.10;output.rightElbow=fishing?-.48:gathering?-.55:watering?-.6:seated?-.85:-.10;output.lean=gathering?-.08:watering?-.10:fishing?-.035:0;
 output.rod=fishing;output.fruit=gathering&&state.phaseTime>1.25;output.hidden=state.hidden;output.rodTilt=fishing?state.gesture*.09:0;output.seated=seated;output.bodyOffsetY=seated?-.18:0;output.watering=watering;output.wateringTilt=watering?.48+state.gesture*.06:0;output.doorOpen=state.doorOpen;output.inside=state.inside;output.entering=state.phase==='entering'||state.phase==='exiting';
 const moment=fishing?fishingMoment(state.phaseTime):null;
 output.catchLift=moment?.lift??0;output.caughtFish=moment?.caught??false;output.fishingBite=moment?.bite??false;
 if(fishing){output.rightArm-=output.catchLift*.72;output.leftArm-=output.catchLift*.35;output.lean-=output.catchLift*.06;}
 const easing=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
 output.sleepBlend=easing(state.sleepBlend??0);
 output.sleeping=output.sleepBlend>.001;
 if(output.sleeping){const home=layout?.home,c=Math.cos(home?.yaw??0),s=Math.sin(home?.yaw??0),blend=output.sleepBlend;
 const x=home?home.position[0]-.95*c+1.04*s:state.position[0],z=home?home.position[2]+.95*s+1.04*c:state.position[2]+.36,y=home?home.position[1]+home.floorHeight+.58:state.position[1]+.568;
 output.x+=(x-output.x)*blend;output.y+=(y-output.y)*blend;output.z+=(z-output.z)*blend;output.heading=(home?.yaw??0);output.bodyOffsetY*=1-blend;
 output.leftLeg*=1-blend;output.rightLeg*=1-blend;output.leftKnee*=1-blend;output.rightKnee*=1-blend;output.leftArm=output.rightArm=-.12;output.leftElbow=output.rightElbow=-.08;}
 const activity=layout?.activityPoints[state.activityIndex];
 if(state.phase==='sitting'){
   const blend=easing(Math.min(state.phaseTime,(activity?.duration??16)-state.phaseTime)/.75);
   output.bodyOffsetY=((activity?.seatHeight??state.position[1]+.56)-state.position[1]-.52*RESIDENT_SCALE)*blend;
   output.leftLeg*=blend;output.rightLeg*=blend;output.leftKnee*=blend;output.rightKnee*=blend;
 }
 output.activityTarget=activity?.target??state.activityTarget??null;output.fishingTarget=fishing?output.activityTarget:null;return output;
}




