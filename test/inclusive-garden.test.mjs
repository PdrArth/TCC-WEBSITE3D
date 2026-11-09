import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAccessibility,resolveAccessibility,accessibilityDefaults,accessiblePalettes,contrastRatio} from '../src/lib/experience/accessibility.mjs';
import {parseDiscoveries,recordDiscovery,discoveryCatalog} from '../src/lib/experience/discoveries.mjs';
import {createResidentState,requestResidentActivity,advanceResident,pathLength,residentShelterReason} from '../src/lib/experience/island-life.mjs';
import {createGreeting,requestGreeting,advanceResidentWithGreeting} from '../src/lib/experience/garden-interactions.mjs';
const world=JSON.parse(await readFile(new URL('../public/experience/world/manifest-v20.json',import.meta.url),'utf8')),layout=world.islandLife;
const context={weather:'clear',hour:13,moving:true,visible:true};

test('accessibility preferences reject corrupt storage, unknown fields and unsafe values while preserving valid choices',()=>{
  for(const input of [null,undefined,'{',[],42,{motion:'fast',textSize:999,captions:'yes'}])assert.deepEqual(parseAccessibility(input),{...accessibilityDefaults});
  const parsed=parseAccessibility(JSON.stringify({motion:'paused',palette:'monochrome',contrast:'dark',textView:true,spacing:true,textSize:'larger',unknown:'ignored'}));
  assert.equal(parsed.motion,'paused');assert.equal(parsed.palette,'monochrome');assert.equal(parsed.textView,true);assert.equal(parsed.spacing,true);assert.equal('unknown' in parsed,false);
  assert.equal(Object.getPrototypeOf(parsed),Object.prototype);
});

test('system motion/contrast are respected and flashes remain off until explicitly requested in a safe motion state',()=>{
  const system=resolveAccessibility({...accessibilityDefaults},{reducedMotion:true,moreContrast:true});
  assert.equal(system.reducedMotion,true);assert.equal(system.theme,'high');assert.equal(system.allowFlashes,false);
  assert.equal(resolveAccessibility({...accessibilityDefaults,flashes:true}).allowFlashes,true);
  assert.equal(resolveAccessibility({...accessibilityDefaults,flashes:true,motion:'paused'}).allowFlashes,false);
  assert.equal(resolveAccessibility({...accessibilityDefaults,flashes:true,motion:'reduced'}).allowFlashes,false);
  assert.equal(resolveAccessibility({...accessibilityDefaults,flashes:true},{reducedMotion:true}).allowFlashes,false);
});

test('all map palettes keep small numbered labels above the text contrast threshold',()=>{
  for(const[name,colors]of Object.entries(accessiblePalettes)){
    assert.equal(colors.length,7);
    for(const color of colors)assert.ok(contrastRatio('#142d20',color)>=4.5,`${name} ${color} contrast is ${contrastRatio('#142d20',color)}`);
  }
  assert.ok(contrastRatio('#496443','#f3eee3')>=4.5,'the introductory accent remains readable at night');
  for(const [ink,paper]of [['#213c2e','#fcfaf4'],['#071e16','#ffffff'],['#f7faef','#10221d']])assert.ok(contrastRatio(ink,paper)>=7);
});

test('discoveries are finite, idempotent and restore safely without inserting forged or malformed records',()=>{
  const initial={},date='2026-11-09T12:00:00.000Z';
  const one=recordDiscovery(initial,'ducks',date);assert.notEqual(one,initial);assert.deepEqual(initial,{});
  assert.equal(recordDiscovery(one,'ducks',date),one);assert.equal(recordDiscovery(one,'unknown',date),one);assert.equal(recordDiscovery(one,'fish','not-a-date'),one);
  const restored=parseDiscoveries(JSON.stringify({version:1,entries:{...one,invalid:date,turtles:42,fish:'not-a-date'}}));assert.deepEqual(restored,one);
  assert.deepEqual(parseDiscoveries('{'),{});assert.deepEqual(parseDiscoveries({version:2,entries:one}),{});
  let all={};for(let i=0;i<100;i++)for(const item of discoveryCatalog)all=recordDiscovery(all,item.id,date);
  assert.equal(Object.keys(all).length,discoveryCatalog.length);
});

test('manual destinations reroute from an occupied edge without snapping and reach the chosen seat or shore',()=>{
  for(const kind of ['sitting','fishing']){
    const state=createResidentState(layout,7);for(let i=0;i<23;i++)advanceResident(state,.1,context,layout);
    const target=layout.activityPoints.filter(point=>point.kind===kind).at(-1),before=[...state.position];
    const result=requestResidentActivity(state,target.id,layout,context);assert.equal(result.accepted,true);assert.deepEqual(state.position,before);assert.equal(state.activityId,target.id);
    for(let i=0;i<6000&&state.phase==='walking';i++){
      const previous=[...state.position];advanceResident(state,.1,context,layout);
      assert.ok(Math.hypot(...state.position.map((v,j)=>v-previous[j]))<=layout.resident.walkSpeed*.1+.0001,'a new command cannot teleport across the lake');
    }
    assert.equal(state.phase,kind);assert.equal(state.node,target.node);assert.ok(Math.hypot(...state.position.map((v,j)=>v-target.position[j]))<.0001);
    assert.equal(pathLength(state.route),0,'the arrived activity is stationary');
  }
});

test('manual choices preserve weather, bedtime and pause priorities without changing a rejected state',()=>{
  for(const blocked of [{...context,weather:'storm'},{...context,hour:23},{...context,moving:false},{...context,visible:false}]){
    const state=createResidentState(layout,3),before=structuredClone(state),id=layout.activityPoints.find(point=>point.kind==='fishing').id;
    assert.equal(requestResidentActivity(state,id,layout,blocked).accepted,false);assert.deepEqual(state,before);
  }
  const state=createResidentState(layout);assert.equal(requestResidentActivity(state,'missing',layout,context).reason,'unknown');
});

test('a manual activity finishes a weather return safely under reduced motion before visiting the chosen shore',()=>{
  const state=createResidentState(layout,31),target=layout.activityPoints.filter(point=>point.kind==='fishing').at(-1),reduced={...context,reducedMotion:true};
  for(let i=0;i<20;i++)advanceResident(state,.1,{...context,weather:'storm'},layout);
  const before=[...state.position],route=structuredClone(state.route);
  const result=requestResidentActivity(state,target.id,layout,reduced);
  assert.equal(result.accepted,true);assert.equal(result.waiting,true);assert.deepEqual(state.position,before);assert.deepEqual(state.route,route);
  for(let i=0;i<10000&&state.phase!=='fishing';i++){
    const previous=[...state.position];advanceResident(state,.1,reduced,layout);
    assert.ok(Math.hypot(...state.position.map((v,j)=>v-previous[j]))<=Math.max(layout.resident.walkSpeed,layout.resident.runSpeed)*.1+.0001);
  }
  assert.equal(state.phase,'fishing');assert.equal(state.activityId,target.id);assert.equal(state.node,target.node);assert.equal(state.inside,false);
});

test('an explicitly requested activity works with reduced motion and comes to rest instead of restarting an automatic walk',()=>{
  const state=createResidentState(layout,13),target=layout.activityPoints.find(point=>point.kind==='sitting'),reduced={...context,reducedMotion:true};
  assert.equal(requestResidentActivity(state,target.id,layout,reduced).accepted,true);
  for(let i=0;i<10000&&state.manualActive;i++)advanceResident(state,.1,reduced,layout);
  assert.equal(state.manualActive,false);assert.equal(state.phase,'observing');
  const position=[...state.position],elapsed=state.elapsed;for(let i=0;i<100;i++)advanceResident(state,.1,reduced,layout);
  assert.deepEqual(state.position,position);assert.equal(state.elapsed,elapsed);
});

test('an explicit greeting is available with reduced motion but cannot bypass weather or sleep',()=>{
  const state=createResidentState(layout,19),greeting=createGreeting(),pose={},reduced={...context,reducedMotion:true};
  greeting.welcomePending=false;requestGreeting(greeting);
  const result=advanceResidentWithGreeting(state,greeting,pose,.1,reduced,layout,{distance:40,cameraHeading:1});assert.equal(result.active,true);
  assert.equal(residentShelterReason({...context,hour:23}),'night');
  const storm=advanceResidentWithGreeting(state,greeting,pose,.1,{...reduced,weather:'storm'},layout,{distance:40,cameraHeading:1});assert.equal(storm.active,false);
});
