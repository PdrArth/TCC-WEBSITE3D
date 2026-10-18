import * as THREE from "three";

/** Prepare day/night variants without changing lights or parenting in the live graph. */
function idle(callback, wait = 32) {
  let cancelIdle = () => {};
  const timer = setTimeout(() => {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(callback, { timeout: 500 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else callback();
  }, wait);
  return () => { clearTimeout(timer); cancelIdle(); };
}

/** Let the revealed world paint twice, then leave its entry animation a grace period. */
function afterOpening(callback) {
  const requestFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame : fn => setTimeout(fn, 16);
  const cancelFrame = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : clearTimeout;
  let frame = 0, timer = 0;
  frame = requestFrame(() => {
    frame = requestFrame(() => { timer = setTimeout(callback, 1200); });
  });
  return () => { cancelFrame(frame); clearTimeout(timer); };
}

export function prepareEffectMaterials(renderer, scene, camera, world, onProgress, schedule = idle, options = {}) {
  const primary = new Set(); world.traverse(object => primary.add(object));
  const lighting = [false,true].map(night => {
    const target = new THREE.Scene();
    target.fog = scene.fog; target.environment = scene.environment;
    target.environmentRotation.copy(scene.environmentRotation); target.environmentIntensity = scene.environmentIntensity;
    scene.traverse(object => {
      if (!object.isLight || !object.layers.test(camera.layers)) return;
      const optionalNight = object.name === "night_beacon_spot" || object.name === "night_pavilion_light";
      if (optionalNight && !night || !optionalNight && !object.visible) return;
      for (let parent=object.parent;parent;parent=parent.parent) if (!parent.visible) return;
      const clone=object.clone();clone.visible=true;target.add(clone);
    });
    return target;
  });
  const effects=[],worldObjects=[];
  scene.traverse(object => {
    if (object.isMesh || object.isLine || object.isPoints) (primary.has(object)?worldObjects:effects).push(object);
  });
  const queue = [...effects,...worldObjects].flatMap(object=>lighting.map(target=>({object,target})));
  const total = queue.length;
  let done = 0, cancelled = false, cancelPending = () => {}, cancelStart = () => {};
  onProgress({ done, total, state: total ? "preparing" : "ready" });
  const canPrepare = () => (typeof document === "undefined" || !document.hidden) && (options.canPrepare?.() ?? true);
  const next = (wait = 32) => {
    if (cancelled || !queue.length) return;
    cancelPending = schedule(async () => {
      if (cancelled) return;
      // Keep the item queued while reading, hidden, or otherwise inactive.
      if (!canPrepare()) { next(250); return; }
      const {object,target} = queue.shift();
      try { await renderer.compileAsync(object, camera, target); } catch { /* Optional preparation cannot prevent reading. */ }
      if (cancelled) return;
      done++;
      onProgress({ done, total, state: done === total ? "ready" : "preparing" });
      next();
    }, wait);
  };
  if (total) cancelStart = (options.scheduleStart ?? afterOpening)(next);
  return () => { cancelled = true; cancelStart(); cancelPending(); queue.length = 0; lighting.forEach(target=>target.clear()); };
}

/** Inter-frame intervals, including >250 ms stalls; inactive demand gaps are ignored. */
export class FrameStalls {
  constructor() { this.armed = false; this.count = 0; this.maximum = 0; this.events = []; }
  sample(seconds, context, enabled) {
    if (!enabled || !Number.isFinite(seconds) || seconds < 0) { this.armed = false; return; }
    if (!this.armed) { this.armed = true; return; }
    const ms = seconds * 1000;
    this.maximum = Math.max(this.maximum, ms);
    if (ms < 50) return;
    this.count++;
    this.events.push({ ms: Math.round(ms * 10) / 10, context });
    if (this.events.length > 8) this.events.shift();
  }
}
