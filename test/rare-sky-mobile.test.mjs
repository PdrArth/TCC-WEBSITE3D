import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkyEvents, advanceSkyEvents } from '../src/lib/experience/sky-events.mjs';
import { createShadowBudget, advanceShadowBudget, mobileViewport } from '../src/lib/experience/render-budget.mjs';
import { CameraOrbit } from '../src/components/island-experience/scene-motion.mjs';
const random = () => .5;
const run = (state, seconds, context, fps=60) => {
  for (let i=0;i<Math.round(seconds*fps);i++) advanceSkyEvents(state,1/fps,context,random);
  return state;
};
const clearDay = {weather:'clear',hour:13}, clearNight = {weather:'clear',hour:23};

test('a rainbow requires a real rain front followed by daylight and sunshine, and fades away', () => {
  const state=createSkyEvents(random);
  run(state,200,clearDay);assert.equal(state.rainbows,0);
  run(state,2,{weather:'rain',hour:13});run(state,10,clearDay);assert.equal(state.rainbows,0,'a quick menu change is not a rain front');
  run(state,7,{weather:'rain',hour:13});run(state,15,{weather:'overcast',hour:13});assert.equal(state.rainbows,0);
  run(state,8,clearDay);assert.equal(state.rainbows,1);assert.ok(state.rainbowOpacity>.45);
  run(state,50,clearDay);assert.equal(state.rainbowOpacity,0);assert.equal(state.rainbows,1);
  run(state,7,{weather:'rain',hour:13});run(state,8,clearDay);assert.equal(state.rainbows,1,'cooldown prevents repeated weather toggles from spamming rainbows');
});

test('night, snow and renewed rain cannot leave a rainbow on the sky', () => {
  for(const ending of [clearNight,{weather:'snow',hour:13},{weather:'fog',hour:13}]) {
    const state=createSkyEvents(random);run(state,8,{weather:'rain',hour:13});run(state,5,ending);
    assert.equal(state.rainbowOpacity,0);
  }
  const state=createSkyEvents(random);run(state,8,{weather:'rain',hour:13});run(state,8,clearDay);
  assert.ok(state.rainbowOpacity>.4);run(state,6,{weather:'storm',hour:13});assert.ok(state.rainbowOpacity<.001);
});

test('shooting stars stay rare, brief, inside the sky and restricted to clear nights', () => {
  const state=createSkyEvents(random);
  run(state,300,clearDay);run(state,150,{weather:'overcast',hour:23});assert.equal(state.meteors,0);
  run(state,48,clearNight);assert.equal(state.meteors,0);
  run(state,1.5,clearNight);assert.equal(state.meteors,1);assert.ok(state.meteorOpacity>.5);
  for(const [x,y] of [state.meteorStart,state.meteorEnd])assert.ok(x>.02&&x<.98&&y>.5&&y<.98);
  run(state,3,clearNight);assert.equal(state.meteorAge,-1);assert.equal(state.meteorOpacity,0);
  run(state,80,clearNight);assert.equal(state.meteors,1,'the second star has a longer interval');
  run(state,60,clearNight);assert.equal(state.meteors,2);
});

test('hidden time never catches up, reduced motion suppresses meteors and low frame rates preserve event timing', () => {
  const state=createSkyEvents(random),before=structuredClone(state);
  run(state,300,{...clearNight,active:false});assert.deepEqual(state,before);
  run(state,300,{...clearNight,reducedMotion:true});assert.equal(state.meteors,0);
  const low=createSkyEvents(random),high=createSkyEvents(random);
  for(const [seconds,context] of [[7,{weather:'rain',hour:13}],[10,clearDay],[60,clearNight]]) {
    run(low,seconds,context,30);run(high,seconds,context,120);
  }
  assert.equal(low.rainbows,high.rainbows);assert.equal(low.meteors,high.meteors);
  assert.ok(Math.abs(low.rainbowOpacity-high.rainbowOpacity)<.002);
});

test('mobile shadows update at fifteen per second across display rates and stay still while the world is paused', () => {
  for(const fps of [30,60,90,120]) {
    const budget=createShadowBudget();let updates=0;
    for(let i=0;i<fps*10;i++)if(advanceShadowBudget(budget,1/fps))updates++;
    assert.ok(updates>=149&&updates<=151,`${fps}Hz produced ${updates} shadow passes`);
    for(let i=0;i<fps;i++)assert.equal(advanceShadowBudget(budget,1/fps,false),false);
    budget.dirty=true;assert.equal(advanceShadowBudget(budget,1/fps,false),true,'an explicit change still renders a fresh shadow');
    assert.equal(advanceShadowBudget(budget,1/fps,false),false);
  }
});

test('phone landscape retains the same mobile render policy as portrait while desktop remains native', () => {
  for(const [width,height] of [[320,640],[360,740],[390,844],[412,915],[844,390],[915,412]])assert.equal(mobileViewport(width,height),true);
  assert.equal(mobileViewport(1280,720),false);assert.equal(mobileViewport(1440,900),false);
  assert.equal(mobileViewport(1200,800,true),true,'a large touch device still uses the mobile budget');
});

test('an interrupted drag or pinch releases the camera and consumes the accidental click, then accepts a new gesture', () => {
  for(const pinch of [false,true]) {
    const orbit=new CameraOrbit();orbit.begin(10,10);
    if(pinch)orbit.beginPinch();else orbit.move(60,90,360,800);
    const yaw=orbit.yaw,pitch=orbit.pitch;orbit.cancel();
    assert.equal(orbit.dragging,false);assert.equal(orbit.move(200,200,360,800),false);
    assert.equal(orbit.yaw,yaw);assert.equal(orbit.pitch,pitch);assert.equal(orbit.consumeClick(),true);assert.equal(orbit.consumeClick(),false);
    orbit.begin(20,20);assert.equal(orbit.suppressClick,false);assert.equal(orbit.move(50,50,360,800),true);orbit.end();assert.equal(orbit.consumeClick(),true);
  }
});
