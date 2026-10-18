"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { pavilionIds, type PavilionId, type WorldManifest } from "@/lib/experience-contract";
import { FrameCadence, WorldNavigator, type Arrival } from "@/lib/experience/navigation.mjs";
import { getSeason, type Season } from "@/lib/experience/seasons.mjs";
import type { WeatherPhase } from "@/lib/experience/weather.mjs";
import Atmosphere, { type Weather } from "./atmosphere";
import Scenery from "./scenery";
import NightLighting from "./night-lighting";
import IslandLife from "./island-life";
import { applyOpeningView, clearOpeningView, openingFrame } from "./opening-layout.mjs";
import { createEnvironmentManifest, createEnvironmentState, advanceEnvironment } from "@/lib/experience/environment.mjs";
import { optimizeWorld, selectedBatchPavilion } from "./optimize-world.mjs";
import { FrameStalls, prepareEffectMaterials, type PreparationProgress } from "./render-preparation.mjs";
import { CameraOrbit, environmentSeconds, orbitPosition, clampZoom, easeCamera, fieldOfView, mayAdaptQuality, overviewDistanceScale, restingPose, wheelZoom } from "./scene-motion.mjs";

export type LabelPositions = Record<PavilionId, { x: number; y: number; visible: boolean }>;
export type ScenePerformance = { fps: number; drawCalls: number; triangles: number; quality: "high" | "low"; frameMs?: number; p95Ms?: number; geometries?: number; textures?: number; heapMB?: number; fallback?: boolean };
export type IslandSceneProps = {
  manifest: WorldManifest;
  navigator: WorldNavigator;
  active: boolean;
  reducedMotion: boolean;
  panelOpen: boolean;
  interactionBlocked?: boolean;
  autoQuality?: boolean;
  pavilionId: PavilionId | null;
  resetEpoch: number;
  quality: "high" | "low";
  weather?: Weather;
  phase?: WeatherPhase;
  timeOfDay?: number;
  clock?: MutableRefObject<number>;
  windSpeed?: number;
  precipitation?: number;
  snowfall?: number;
  zoom?: number;
  onZoom?: (zoom: number) => void;
  season?: Season;
  intro?: boolean;
  onPosition?: (position: [number, number, number]) => void;
  onInteract?: () => void;
  onThunder?: () => void;
  onReady: () => void;
  onFail: () => void;
  onArrive: (arrival: Arrival) => void;
  onSelect: (id: PavilionId) => void;
  onProject: (positions: LabelPositions) => void;
  onPerformance: (performance: ScenePerformance) => void;
};

function disposeScene(scene: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const list = mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : [];
    for (const material of list) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

function manifestEnvironment(manifest:WorldManifest){return manifest.environment??createEnvironmentManifest();}

function LiveWorld({ world, ...props }: IslandSceneProps & { world: GLTF }) {
  const { camera, gl, invalidate, size, get, setSize } = useThree();
  const pulse = useRef<THREE.Mesh>(null);
  const pulseLight = useRef<THREE.PointLight>(null);
  const pulseState = useRef({ elapsed: 2, position: new THREE.Vector3() });
  const counters = useRef({ elapsed: 0, frames: 0, projection: 0, position: 0, slowSamples: 0, verySlowSamples: 0, ambient: 0, wind: .008, totalFrames: 0, lastReport: 0, lastDelta: 0, lastFrameMs: 0, motionDelta: 0 });
  const cadence = useRef(new FrameCadence());
  const transitionCadence = useRef(new FrameCadence());
  const previousPositions = useRef<LabelPositions | null>(null);
  const previousAvatarPosition = useRef<[number, number, number] | null>(null);
  const projectionNeeded = useRef(true);
  const cameraSettling = useRef(false);
  const autoOrbitState = useRef("initial");
  const zoomRef = useRef(props.zoom ?? 1);
  const previousZoom = useRef(props.zoom ?? 1);
  const orbit = useRef(new CameraOrbit());
  const previousIntro = useRef(!!props.intro);
  const previousPavilion = useRef(props.pavilionId);
  const returningOverview = useRef(false);
  const lastReset = useRef(props.resetEpoch);
  const previousAdaptivePolicy = useRef<boolean | null>(null);
  const stalls = useRef(new FrameStalls());
  const preparation = useRef<PreparationProgress>({done:0,total:0,state:"preparing"});
  const renderReady = useRef(false);
  const desiredFrameLoop = useRef<"never" | "demand" | "always">("never");
  const adaptation = useRef({good:0,age:0,lastQuality:props.quality,upgradeBlocked:false,frameTimes:[] as number[]});
  const environment = useMemo(()=>manifestEnvironment(props.manifest),[props.manifest]);
  const environmentState = useRef(createEnvironmentState(props.weather??"clear",props.season??"spring",props.clock?.current??props.timeOfDay??13));
  const clockSample = useRef({hour:props.clock?.current??props.timeOfDay??13,at:0});
  const points = useMemo(() => pavilionIds.map(id => ({ id, point: new THREE.Vector3(...props.manifest.pavilions[id].focus) })), [props.manifest]);
  const ambient = useMemo(() => {
    const objects: THREE.Object3D[] = [];
    const names = new Set(props.manifest.ambientNodes ?? []);
    world.scene.traverse(object => { if (!/^ambient_(leaves|flowers)_/.test(object.name) && (names.has(object.name) || object.name.startsWith("cypress_"))) objects.push(object); });
    return objects.map(object => ({ object, y: object.rotation.y, z: object.rotation.z, reaction: 0 }));
  }, [world, props.manifest]);
  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(...props.manifest.initialCamera.target), [props.manifest]);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const projectPoint = useMemo(() => new THREE.Vector3(), []);
  const { navigator: navigation, onFail, onReady, onSelect, manifest, active, panelOpen, reducedMotion, intro, onInteract, onZoom, interactionBlocked } = props;
  const animateWorld = active && !panelOpen;
  const stallContext = useMemo(()=>`${props.weather??"clear"}/${props.phase??"day"}/${props.pavilionId??"overview"}`,[props.weather,props.phase,props.pavilionId]);
  const autoOrbitPause = !active ? "inactive" : reducedMotion ? "reduced" : props.pavilionId || panelOpen ? "detail" : interactionBlocked && !intro ? "blocked" : null;
  useEffect(() => { const next=clampZoom(props.zoom ?? zoomRef.current, manifest.cameraBounds); if(next!==previousZoom.current) orbit.current.pause(); previousZoom.current=next; zoomRef.current=next; projectionNeeded.current = true; invalidate(); }, [props.zoom,manifest.cameraBounds,invalidate]);
  const season = props.season ?? getSeason();
  const strikeTargets = (manifest as WorldManifest & { weatherScenery?: { lightningTargets?: [number,number,number][] } }).weatherScenery?.lightningTargets;
  const restingCamera = useMemo(() => restingPose(manifest, props.pavilionId, !!props.intro), [manifest, props.pavilionId, props.intro]);
  const reportRuntime = useCallback(() => {
    const state = get();
    const attributes = {
      "data-world-frames": String(counters.current.totalFrames),
      "data-world-delta": counters.current.lastDelta.toFixed(6),
      "data-world-motion-delta": counters.current.motionDelta.toFixed(6),
      "data-world-avatar-animation": "none",
      "data-world-avatar-animation-time": "0",
      "data-world-navigation": "direct",
      "data-world-season": season,
      "data-world-last-frame-ms": String(Math.round(counters.current.lastFrameMs)),
      "data-world-clock-running": String(state.clock.running),
      "data-world-clock-auto-start": String(state.clock.autoStart),
      "data-world-frameloop": state.frameloop,
      "data-world-root-active": String(state.internal.active),
      "data-world-active": String(active),
      "data-world-panel-open": String(panelOpen),
      "data-world-reduced-motion": String(reducedMotion),
      "data-world-weather": props.weather ?? "clear",
      "data-world-intro": String(!!props.intro),
      "data-world-has-focus": String(document.hasFocus()),
      "data-world-document-visible": String(document.visibilityState === "visible"),
      "data-world-slow-samples": String(counters.current.slowSamples),
      "data-world-very-slow-samples": String(counters.current.verySlowSamples),
      "data-world-camera-position": camera.position.toArray().map(value => value.toFixed(3)).join(","),
      "data-world-camera-settling": String(cameraSettling.current),
      "data-world-zoom": zoomRef.current.toFixed(3),
      "data-world-camera-yaw": orbit.current.yaw.toFixed(4),
      "data-world-camera-pitch": orbit.current.pitch.toFixed(4),
      "data-world-auto-orbit": autoOrbitPause??autoOrbitState.current,
      "data-world-auto-orbit-pause": orbit.current.pauseRemaining.toFixed(3),
      "data-world-environment-clock": counters.current.ambient.toFixed(3),
      "data-world-environment-rate": reducedMotion ? "calm-20hz" : "full",
      "data-world-time-of-day": String(environmentState.current.hour),
      "data-world-model-load-ms": String(world.scene.userData.loadMs??0),
      "data-world-optimization-ms": String(world.scene.userData.optimizationMs??0),
      "data-world-prepared-asset": String(!!world.scene.userData.runtimePrepared),
      "data-world-batch-primitives": String(world.scene.userData.optimization?.primitives??0),
      "data-world-original-primitives": String(world.scene.userData.optimization?.originalPrimitives??0),
      "data-world-position": navigation.position.map(value => value.toFixed(3)).join(","),
      "data-world-long-frame-count": String(stalls.current.count),
      "data-world-worst-frame-ms": stalls.current.maximum.toFixed(1),
      "data-world-long-frame-events": JSON.stringify(stalls.current.events),
      "data-world-programs": String(gl.info.programs?.length??0),
      "data-world-effects-preparation": preparation.current.state,
      "data-world-effects-prepared": `${preparation.current.done}/${preparation.current.total}`,
    };
    for (const [key, value] of Object.entries(attributes)) gl.domElement.setAttribute(key, value);
  }, [get, gl, active, panelOpen, reducedMotion, navigation, props.weather, props.intro, camera, season, autoOrbitPause,world]);

  useEffect(() => { clockSample.current={hour:props.clock?.current??props.timeOfDay??13,at:performance.now()}; },[active,props.clock,props.timeOfDay]);
  useEffect(()=>{
    const reset=()=>{stalls.current.armed=false;};
    document.addEventListener("visibilitychange",reset);
    return()=>document.removeEventListener("visibilitychange",reset);
  },[]);
  useFrame((_,delta)=>{
    const sample=clockSample.current,now=performance.now(),hour=props.clock?.current??props.timeOfDay??13;
    if(sample.hour!==hour||!sample.at){sample.hour=hour;sample.at=now;}
    const interpolated=props.clock&&animateWorld?(hour+Math.min(1,(now-sample.at)/1000)*24/720)%24:hour;
    advanceEnvironment(environmentState.current,animateWorld?delta*(reducedMotion?.45:1):0,props.weather??"clear",season,interpolated);
  },-100);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); navigation.cancel(); onFail(); };
    canvas.addEventListener("webglcontextlost", lost);
    let cancelled=false, cancelPreparation=()=>{}, revealFrame=0;
    // Do not start the visible animation while the GPU is still compiling its
    // first programs. Include the resident and current effects, then reveal only
    // after the first draw has uploaded their geometry and textures.
    const compileStarted = performance.now();
    void gl.compileAsync(get().scene,camera).catch(()=>{}).then(()=>{
      if(cancelled)return;
      canvas.dataset.worldPrimaryCompileMs=(performance.now()-compileStarted).toFixed(1);
      renderReady.current=true;
      get().setFrameloop(desiredFrameLoop.current);
      invalidate();
      revealFrame=requestAnimationFrame(()=>{
        if(cancelled)return;
        invalidate();
        revealFrame=requestAnimationFrame(()=>{if(!cancelled)onReady();});
      });
      cancelPreparation=prepareEffectMaterials(gl,get().scene,camera,world.scene,progress=>{preparation.current=progress;},undefined,{canPrepare:()=>{const page=gl.domElement.closest(".island-experience");return document.visibilityState==="visible"&&!!page?.classList.contains("is-started")&&page.getAttribute("data-world-active")!=="false";}});
    });
    return () => {cancelled=true;renderReady.current=false;cancelAnimationFrame(revealFrame);cancelPreparation();canvas.removeEventListener("webglcontextlost", lost);};
  }, [gl, navigation, onFail, onReady,get,camera,invalidate,world,props.quality]);

  useLayoutEffect(() => {
    stalls.current.armed = false;
    cadence.current.reset();
    transitionCadence.current.reset();
    counters.current.elapsed = 0;
    counters.current.frames = 0;
    counters.current.slowSamples = 0;
    counters.current.verySlowSamples = 0;
    projectionNeeded.current = true;
    previousPositions.current = null;
    previousAvatarPosition.current = null;
    desiredFrameLoop.current = !active ? "never" : reducedMotion || panelOpen ? "demand" : "always";
    const desiredLoop = renderReady.current ? desiredFrameLoop.current : "never";
    const current = get();
    if (current.frameloop !== desiredLoop || active && !current.clock.running) current.setFrameloop(desiredLoop);
    if (!active) return;
    const perspective=camera as THREE.PerspectiveCamera;
    if(intro)applyOpeningView(perspective,size.width,size.height);
    else if(panelOpen&&props.pavilionId&&size.width>1000)perspective.setViewOffset(size.width,size.height,Math.min(size.width*.6,840)/2,0,size.width,size.height);
    else clearOpeningView(perspective,size.width,size.height);
    invalidate();
    // Re-measure once the reading DOM has given the canvas its viewport back.
    // The following frame runs after R3F has applied its frameloop and viewport.
    let followup = 0;
    const frame = requestAnimationFrame(() => {
      const bounds = gl.domElement.parentElement?.getBoundingClientRect();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const current = get().size;
        if (Math.abs(current.width - bounds.width) > 1 || Math.abs(current.height - bounds.height) > 1) setSize(bounds.width, bounds.height, bounds.top, bounds.left);
      }
      camera.updateMatrixWorld(true);
      projectionNeeded.current = true;
      invalidate();
      followup = requestAnimationFrame(() => { projectionNeeded.current = true; invalidate(); });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(followup); };
  }, [active, reducedMotion, panelOpen, props.pavilionId, props.resetEpoch, intro, size.width, size.height, gl, get, setSize, camera, invalidate]);
  useEffect(() => { reportRuntime(); }, [reportRuntime]);
  useEffect(() => { projectionNeeded.current = true; invalidate(); }, [props.zoom, invalidate]);
  useEffect(() => {
    if (lastReset.current === props.resetEpoch) return;
    lastReset.current = props.resetEpoch; orbit.current.reset(5); zoomRef.current = 1; onZoom?.(1); projectionNeeded.current = true; invalidate();
  }, [props.resetEpoch,onZoom,invalidate]);
  useEffect(() => { if(previousIntro.current !== !!intro) orbit.current.pause(); previousIntro.current=!!intro; },[intro]);
  useLayoutEffect(()=>{
    if(previousPavilion.current&&!props.pavilionId){returningOverview.current=true;orbit.current.pause(2);projectionNeeded.current=false;}
    previousPavilion.current=props.pavilionId;
  },[props.pavilionId]);
  useEffect(() => {
    if (!active || panelOpen || !reducedMotion) return;
    const timer = window.setInterval(() => { if (!document.hidden) invalidate(); }, 50);
    return () => window.clearInterval(timer);
  }, [active,panelOpen,reducedMotion,invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    const controller=orbit.current;
    const allowed = () => active && !panelOpen && !interactionBlocked;
    const change = (value: number) => { controller.pause(); zoomRef.current = clampZoom(value, manifest.cameraBounds); onZoom?.(zoomRef.current); projectionNeeded.current = true; invalidate(); };
    const wheel = (event: WheelEvent) => {
      if (!allowed() || !onZoom || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); change(wheelZoom(zoomRef.current,event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?size.height:1),manifest.cameraBounds));
    };
    const pointers = new Map<number,{x:number;y:number}>();
    let pinch: { distance:number; zoom:number } | null = null;
    const pairDistance = () => { const pair=[...pointers.values()]; return pair.length===2?Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y):0; };
    const down=(event:PointerEvent)=> {
      if(!allowed() || event.button!==0) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); canvas.setPointerCapture?.(event.pointerId);
      if(pointers.size===1) controller.begin(event.clientX,event.clientY);
      else { controller.beginPinch(); pinch={distance:pairDistance(),zoom:zoomRef.current}; }
    };
    const move=(event:PointerEvent)=> {
      if(!allowed() || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===2 && pinch && onZoom) { event.preventDefault(); change(pinch.zoom*pairDistance()/Math.max(1,pinch.distance)); return; }
      if(controller.move(event.clientX,event.clientY,size.width,size.height)) { event.preventDefault(); projectionNeeded.current=true; canvas.style.setProperty("cursor","grabbing"); invalidate(); }
    };
    const up=(event:PointerEvent)=> {
      if(!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId); controller.end(); pinch=null; canvas.style.removeProperty("cursor");
      if(canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if(pointers.size===1) { const remaining=[...pointers.values()][0]; const suppressed=controller.suppressClick; controller.begin(remaining.x,remaining.y); controller.suppressClick=suppressed; }
      else if(pointers.size===2) { controller.beginPinch(); pinch={distance:pairDistance(),zoom:zoomRef.current}; }
    };
    const click=(event:MouseEvent)=> { if(controller.consumeClick()) { event.preventDefault(); event.stopImmediatePropagation(); } };
    const previousTouchAction=canvas.style.touchAction; canvas.style.setProperty("touch-action","none");
    canvas.addEventListener("wheel",wheel,{passive:false}); canvas.addEventListener("pointerdown",down); canvas.addEventListener("pointermove",move,{passive:false}); canvas.addEventListener("pointerup",up); canvas.addEventListener("pointercancel",up); canvas.addEventListener("click",click,true);
    return()=> { pointers.clear(); controller.end(); canvas.style.setProperty("touch-action",previousTouchAction); canvas.removeEventListener("wheel",wheel); canvas.removeEventListener("pointerdown",down); canvas.removeEventListener("pointermove",move); canvas.removeEventListener("pointerup",up); canvas.removeEventListener("pointercancel",up); canvas.removeEventListener("click",click,true); };
  }, [gl,active,panelOpen,interactionBlocked,onZoom,manifest.cameraBounds,size.width,size.height,invalidate]);
  useEffect(() => () => { gl.domElement.style.cursor = ""; }, [gl]);

  useFrame((_, delta) => {
    const stats = counters.current;
    stats.totalFrames += 1;
    stats.lastDelta = delta;
    const now = performance.now();
    stats.lastFrameMs = now;
    const sample = animateWorld ? cadence.current.sample(delta) : { sampled: false, elapsed: 0 };
    const dt = environmentSeconds(sample.elapsed,reducedMotion);
    stats.motionDelta = dt;
    if (animateWorld) {
      stats.ambient += dt;
    }
    const transition = transitionCadence.current.sample(delta);
    const transitionDt = Math.min(2, transition.elapsed || 1 / 60);
    const effectDt = transitionDt;
    cameraPosition.set(...restingCamera.position);
    desiredTarget.set(...restingCamera.target);
    orbit.current.advanceAuto(dt,!autoOrbitPause&&!returningOverview.current);
    autoOrbitState.current=autoOrbitPause??orbit.current.autoMode;
    const framing=intro?openingFrame(size.width,size.height):size;
    if (!props.pavilionId) {
      const position=orbitPosition(restingCamera.position,restingCamera.target,orbit.current.yaw,orbit.current.pitch,zoomRef.current/overviewDistanceScale(restingCamera.fov,framing.width,framing.height)); cameraPosition.set(...position);
    }
    const unsettled = easeCamera(camera, cameraTarget, cameraPosition, desiredTarget, fieldOfView(restingCamera.fov, framing.width, framing.height, !!props.pavilionId), transitionDt, reducedMotion, props.intro ? 2.8 : 7);
    if (unsettled && active) invalidate();
    if (!unsettled && cameraSettling.current) projectionNeeded.current = true;
    if(!unsettled&&returningOverview.current){returningOverview.current=false;projectionNeeded.current=true;}
    cameraSettling.current = unsettled;
    const desiredWind = Math.min(.08,props.windSpeed !== undefined ? .008 + Math.max(0,props.windSpeed)*.0015 : props.weather === "storm" ? .075 : props.weather === "rain" ? .038 : .022);
    stats.wind += (desiredWind - stats.wind) * (reducedMotion ? 1 : 1 - Math.exp(-1.6 * effectDt));
    ambient.forEach(node => {
      if (animateWorld) node.reaction = Math.max(0, node.reaction - effectDt * 1.1);
      const impulse = reducedMotion ? 0 : Math.sin((1 - node.reaction) * 16) * node.reaction * .18;
      node.object.rotation.y = node.y + Math.sin(stats.ambient * .7 + node.object.id) * stats.wind * .8 * (reducedMotion ? .35 : 1);
      node.object.rotation.z = node.z + Math.sin(stats.ambient * .9 + node.object.id) * stats.wind * (reducedMotion ? .35 : 1) + impulse;
    });
    if (pulse.current && pulseLight.current) {
      if (animateWorld) pulseState.current.elapsed = Math.min(2, pulseState.current.elapsed + effectDt);
      const strength = reducedMotion ? 0 : Math.max(0, 1 - pulseState.current.elapsed / 1.1);
      pulse.current.visible = strength > 0;
      pulse.current.position.copy(pulseState.current.position);
      pulse.current.scale.setScalar(1 + (1 - strength) * 1.5);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = strength * .7;
      pulseLight.current.position.copy(pulseState.current.position).y += .6;
      pulseLight.current.intensity = strength * 3.5;
    }
    stats.position += delta;
    if (props.onPosition && (!previousAvatarPosition.current || stats.position > .1)) {
      stats.position = 0;
      const previous = previousAvatarPosition.current;
      if (!previous || props.navigator.position.some((value, axis) => Math.abs(value - previous[axis]) > .002)) {
        const position: [number, number, number] = [...props.navigator.position];
        previousAvatarPosition.current = position;
        props.onPosition(position);
      }
    }
    stats.projection += delta;
    // Keep the last settled overview anchors during a camera visit and return.
    // Otherwise labels chase the detail camera and move underneath quick clicks.
    const publishOverview = !panelOpen && !props.pavilionId && !props.intro&&!returningOverview.current;
    if (publishOverview && size.width > 0 && size.height > 0 && (projectionNeeded.current || stats.projection > .08 || reducedMotion)) {
      projectionNeeded.current = false;
      stats.projection = 0;
      const positions = {} as LabelPositions;
      for (const { id, point } of points) {
        projectPoint.copy(point).project(camera);
        positions[id] = { x: (projectPoint.x * .5 + .5) * 100, y: (-projectPoint.y * .5 + .5) * 100, visible: projectPoint.z >= -1 && projectPoint.z < 1 && Math.abs(projectPoint.x) < 1.12 && Math.abs(projectPoint.y) < 1.08 };
      }
      const previous = previousPositions.current;
      if (!previous || pavilionIds.some(id => Math.abs(positions[id].x - previous[id].x) > .04 || Math.abs(positions[id].y - previous[id].y) > .04 || positions[id].visible !== previous[id].visible)) {
        previousPositions.current = positions;
        props.onProject(positions);
      }
    }
    const adaptationAllowed = props.autoQuality !== false && stats.ambient > 4 && mayAdaptQuality(active, panelOpen, reducedMotion, document.visibilityState === "visible", document.hasFocus(), delta);
    const strike=get().scene.userData.lastWeatherStrike;
    const context=strike&&performance.now()-strike.at<1000?`${stallContext}/lightning-${strike.index}`:stallContext;
    stalls.current.sample(delta,context,active&&!reducedMotion&&document.visibilityState==="visible"&&(!panelOpen||cameraSettling.current));
    const qualityState=adaptation.current;
    if(qualityState.lastQuality!==props.quality){
      if(props.quality==="low"&&qualityState.lastQuality==="high"&&props.autoQuality!==false)qualityState.upgradeBlocked=true;
      qualityState.lastQuality=props.quality;qualityState.age=0;qualityState.good=0;qualityState.frameTimes=[];
    }
    if(adaptationAllowed)qualityState.age+=Math.min(.25,delta);
    const policyChanged = previousAdaptivePolicy.current !== adaptationAllowed;
    if (policyChanged) {
      stats.elapsed = 0;
      stats.frames = 0;
      stats.slowSamples = 0;
      stats.verySlowSamples = 0;
      previousAdaptivePolicy.current = adaptationAllowed;
    }
    if (!adaptationAllowed) { stats.slowSamples = 0; stats.verySlowSamples = 0; }
    if (animateWorld && sample.sampled && !policyChanged) {
      stats.elapsed += sample.elapsed;
      stats.frames += 1;
      if(sample.elapsed<=.25)qualityState.frameTimes.push(sample.elapsed*1000);
      if (stats.elapsed > 2) {
        const fps = Math.round(stats.frames / stats.elapsed);
        stats.slowSamples = adaptationAllowed && fps < 28 ? stats.slowSamples + 1 : 0;
        stats.verySlowSamples = adaptationAllowed && props.quality === "low" && fps < 12 ? stats.verySlowSamples + 1 : 0;
        const times=qualityState.frameTimes.toSorted((a,b)=>a-b),p95=times[Math.floor((times.length-1)*.95)]??0;
        qualityState.good=adaptationAllowed&&fps>=58&&p95<24?qualityState.good+1:0;
        let next=props.quality;
        if(adaptationAllowed&&props.quality==="high"&&stats.slowSamples>=2)next="low";
        // Auto keeps the light model stable. Detailed geometry is a manual choice.
        const memory=(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory;
        props.onPerformance({ fps, frameMs:stats.elapsed*1000/stats.frames,p95Ms:p95,drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,heapMB:memory?Math.round(memory.usedJSHeapSize/1048576):undefined, quality: next });
        qualityState.frameTimes=[];
        stats.elapsed = 0;
        stats.frames = 0;
      }
    } else if (!animateWorld) {
      stats.elapsed = 0;
      stats.frames = 0;
      stats.slowSamples = 0;
      stats.verySlowSamples = 0;
    }
    if (now - stats.lastReport >= 200) { stats.lastReport = now; reportRuntime(); }
  });

  const selectMesh = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!active || props.interactionBlocked || panelOpen || intro || orbit.current.suppressClick || orbit.current.dragging) return;
    let object: THREE.Object3D | null = event.object;
    const batchId=selectedBatchPavilion(event.object,event.faceIndex);
    if(batchId){event.stopPropagation();onSelect(batchId);return;}
    while (object) {
      const found = pavilionIds.find(id => manifest.pavilions[id].hitNode === object!.name || object!.name === `island_${id}_foundation` || object!.name === `island_${id}_groundcover`);
      if (found) {
        event.stopPropagation();
        pulseState.current.elapsed = reducedMotion ? 2 : 0;
        pulseState.current.position.set(...manifest.pavilions[found].entry).y += .035;
        onInteract?.();
        onSelect(found);
        invalidate();
        return;
      }
      const tree = ambient.find(node => node.object === object || object!.name.includes("olive_") && node.object.name === `ambient_canopy_${object!.name.replace(/_wood$/, "")}`);
      if (tree) tree.reaction = reducedMotion ? 0 : 1;
      object = object.parent;
    }
    event.stopPropagation();
    pulseState.current.elapsed = reducedMotion ? 2 : 0;
    pulseState.current.position.copy(event.point).y += .035;
    onInteract?.();
    invalidate();
  }, [active, panelOpen, props.interactionBlocked, intro, onInteract, reducedMotion, manifest, onSelect, ambient, invalidate]);

  return <>
    <Atmosphere weather={props.weather ?? "clear"} phase={props.phase} timeOfDay={props.timeOfDay} environment={environment} environmentState={environmentState} windSpeed={props.windSpeed} precipitation={props.precipitation} snowfall={props.snowfall} birdPerches={manifest.birdPerches} birdShelters={manifest.birdShelters} strikeTargets={strikeTargets} season={season} quality={props.quality} active={active && !panelOpen} moving={animateWorld} reducedMotion={reducedMotion} onInteract={!props.intro && !props.interactionBlocked && !panelOpen ? props.onInteract : undefined} onThunder={props.onThunder} />
    <Scenery world={world.scene} environment={environment} environmentState={environmentState} quality={props.quality} weather={props.weather??"clear"} season={season} moving={animateWorld} windSpeed={props.windSpeed} reducedMotion={reducedMotion} />
    <NightLighting environment={environment} environmentState={environmentState} quality={props.quality} moving={animateWorld} reducedMotion={reducedMotion}/>
    <IslandLife layout={manifest.islandLife} preparedGeometry={manifest.preparedLifeGeometry} environment={environment} environmentState={environmentState} quality={props.quality} moving={animateWorld} reducedMotion={reducedMotion} intro={!!intro}/>
    <primitive object={world.scene} onClick={selectMesh} onPointerOver={(event: ThreeEvent<PointerEvent>) => { if (active && !panelOpen && !intro) { event.stopPropagation(); gl.domElement.style.setProperty("cursor", "pointer"); } }} onPointerOut={() => { gl.domElement.style.removeProperty("cursor"); }} />
    <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => {}}><ringGeometry args={[.24, .31, 32]} /><meshBasicMaterial color="#f2c577" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <pointLight ref={pulseLight} intensity={0} color="#ffcf8e" distance={3.2} decay={2} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.66, 0]} raycast={() => {}}><planeGeometry args={[150, 150]} /><shadowMaterial transparent opacity={.22} /></mesh>
  </>;
}

function IslandScene(props: IslandSceneProps) {
  const [assets, setAssets] = useState<{ world: GLTF } | null>(null);
  const [compiledWorld, setCompiledWorld] = useState<GLTF | null>(null);
  const notifyReady=props.onReady;
  const worldReady = useCallback(() => { if(assets)setCompiledWorld(assets.world);notifyReady(); },[assets,notifyReady]);
  const [initialCamera] = useState(() => {
    const pose = restingPose(props.manifest, null, !!props.intro);
    return { position: pose.position, fov: pose.fov, near: .1, far: 160 };
  });
  const worldUrl = props.quality === "low" ? props.manifest.assets.worldLow : props.manifest.assets.world;
  const ownedScenes = useRef(new Set<THREE.Object3D>());
  const onFail = props.onFail;
  useEffect(() => {
    let cancelled = false;
    let published = false;
    const loaded: { world?: GLTF } = {};
    const scenes = ownedScenes.current;
    const manager = new THREE.LoadingManager();
    const decoder = new DRACOLoader(manager).setDecoderPath("/experience/world/draco/").setWorkerLimit(2);
    const loader = new GLTFLoader(manager).setDRACOLoader(decoder);
    const load = async (kind: "world", url: string) => {
      const started=performance.now();
      const asset = await loader.loadAsync(url);
      if (cancelled) { disposeScene(asset.scene); return; }
      // Let the welcome paint and accept input between decoding and CPU batching.
      await new Promise<void>(resolve=>setTimeout(resolve,0));
      if (cancelled) {disposeScene(asset.scene);return;}
      const optimizationStarted=performance.now();
      if(asset.scene.userData.runtimePrepared?.version===1 && asset.scene.userData.runtimePrepared.quality===props.quality){
        asset.scene.traverse(object=>{
          const mesh=object as THREE.Mesh;
          if(!mesh.isMesh)return;
          mesh.castShadow=!!mesh.userData.runtimeCastShadow;
          mesh.receiveShadow=!!mesh.userData.runtimeReceiveShadow;
        });
      }else optimizeWorld(asset.scene,props.quality);
      asset.scene.userData.optimizationMs=performance.now()-optimizationStarted;
      asset.scene.userData.loadMs=Math.round(performance.now()-started);
      scenes.add(asset.scene);
      loaded[kind] = asset;
    };
    Promise.allSettled([load("world", worldUrl)]).then(results => {
      if (cancelled) return;
      if (results.some(result => result.status === "rejected") || !loaded.world) {
        if (loaded.world) { disposeScene(loaded.world.scene); scenes.delete(loaded.world.scene); }
        loaded.world = undefined;
        onFail();
        return;
      }
      published = true;
      setAssets({ world: loaded.world });
    });
    return () => {
      cancelled = true;
      manager.abort();
      decoder.dispose();
      if (!published) for (const asset of [loaded.world]) if (asset && scenes.has(asset.scene)) { disposeScene(asset.scene); scenes.delete(asset.scene); }
    };
  }, [worldUrl, onFail,props.quality]);

  // Keep the previous world visible until the lower-detail replacement is committed.
  useEffect(() => {
    const scenes = ownedScenes.current;
    return () => {
      if (!assets) return;
      for (const asset of [assets.world]) if (scenes.has(asset.scene)) { disposeScene(asset.scene); scenes.delete(asset.scene); }
    };
  }, [assets]);

  useEffect(() => {
    const scenes = ownedScenes.current;
    return () => { for (const scene of scenes) disposeScene(scene); scenes.clear(); };
  }, []);

  if (!assets) return null;
  return <Canvas camera={initialCamera}
    dpr={props.intro ? [.6,.75] : props.quality === "low" ? [0.8, 1] : [1, 1.35]}
    shadows={{ type: THREE.PCFShadowMap }}
    frameloop={compiledWorld!==assets.world||!props.active ? "never" : props.reducedMotion||props.panelOpen ? "demand" : "always"}
    gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15; }}>
    <LiveWorld {...props} onReady={worldReady} world={assets.world} />
  </Canvas>;
}

export default memo(IslandScene);
