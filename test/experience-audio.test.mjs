import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { createThunderWav } from "../scripts/audio/generate-thunder.mjs";

const source = await readFile(new URL("../src/lib/experience/audio.ts", import.meta.url), "utf8");
const catalogJSON = await readFile(new URL("../public/experience/audio/audio-manifest.json", import.meta.url), "utf8");
const inlineCatalog = text => text.replace(/import catalog from "[^\"]+";/, `const catalog = ${catalogJSON};`);
const javascript = ts.transpileModule(inlineCatalog(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { ExperienceAudio, AUDIO_CATALOG, shuffledMusicOrder } = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));
const earlySource = await readFile(new URL("../src/lib/experience/early-audio-script.ts", import.meta.url), "utf8");
const earlyJavascript = ts.transpileModule(inlineCatalog(earlySource), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { EARLY_AUDIO_SCRIPT } = await import("data:text/javascript;base64," + Buffer.from(earlyJavascript).toString("base64"));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const spatialFrame=()=>({active:true,listener:[20,12,30],forward:[0,-.3,-1],up:[0,1,0],birds:[[-11,2,9],[14,3,-1]],waterfall:{position:[3,-.8,18],flow:.8}});

// These fakes test graph/lifecycle contracts and meter arithmetic, not audibility.
// Real PCM output must additionally be measured with the browser's AnalyserNode.
function browser(t, options = {}) {
  const calls = [], players = [], contexts = [], nodes = [], buffers = [];
  class Parameter {
    value = 0;
    automation = [];
    setValueAtTime(value, at) { this.value = value; this.automation.push(["set", value, at]); }
    linearRampToValueAtTime(value, at) { this.value = value; this.automation.push(["linear", value, at]); }
    exponentialRampToValueAtTime(value, at) { this.value = value; this.automation.push(["exponential", value, at]); }
    setTargetAtTime(value, at) { this.value = value; this.automation.push(["target", value, at]); }
    cancelScheduledValues(at) { this.automation.push(["cancel", at]); }
  }
  class Node {
    gain = new Parameter();
    frequency = new Parameter();
    connections = [];
    constructor(kind = "node") { this.kind = kind; nodes.push(this); }
    connect(destination) { this.connections.push(destination); }
    disconnect() { this.disconnected = true; this.connections = []; }
    start(when = 0) { this.startedAt = when; calls.push("sound.start"); }
    stop(when) { this.stoppedAt = when ?? "immediate"; calls.push("sound.stop"); if (when === undefined) this.onended?.(); }
  }
  class Context {
    currentTime = 0;
    sampleRate = 48000;
    state = "suspended";
    destination = new Node("destination");
    listener = Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,new Parameter()]));
    listeners = new Map();
    constructor() { if (options.contextError) throw options.contextError; contexts.push(this); calls.push("context.create"); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name); }
    setState(state) { this.state = state; this.listeners.get("statechange")?.(); }
    resume() {
      calls.push("context.resume");
      if (options.resumeError) return Promise.reject(options.resumeError);
      if (options.resumeGate) return options.resumeGate.promise.then(() => this.setState("running"));
      this.setState("running");
      return Promise.resolve();
    }
    suspend() { calls.push("context.suspend"); this.setState("suspended"); return Promise.resolve(); }
    close() { calls.push("context.close"); this.setState("closed"); return Promise.resolve(); }
    createGain() { return new Node("gain"); }
    createPanner() {const node=new Node('panner');for(const axis of ['positionX','positionY','positionZ'])node[axis]=new Parameter();return node;}
    createMediaElementSource(player) { const node = new Node("media-source"); node.player=player; return node; }
    createOscillator() { calls.push("tone.create"); return new Node("oscillator"); }
    createBufferSource() { calls.push("buffer.create"); return new Node("source"); }
    createBiquadFilter() { return new Node("filter"); }
    createAnalyser() {
      const analyser = new Node("analyser");
      analyser.getFloatTimeDomainData = data => {
        calls.push("analyser.sample");
        for (let index = 0; index < data.length; index++) data[index] = (index % 2 ? -1 : 1) * (options.meterAmplitude ?? 0);
      };
      return analyser;
    }
    createBuffer(channels, size, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(size));
      calls.push("pcm.create");
      const buffer = { numberOfChannels: channels, length: size, sampleRate, duration: size / sampleRate, getChannelData: channel => data[channel] };
      buffers.push(buffer);
      return buffer;
    }
    decodeAudioData(bytes) {
      calls.push("decode");
      if (bytes.byteLength === 3) {
        if (options.thunderDecodeError) return Promise.reject(options.thunderDecodeError);
        if (options.thunderDecodeGate) return options.thunderDecodeGate.promise;
        return Promise.resolve(this.createBuffer(1, 148800, 24000));
      }
      return Promise.resolve(options.decodedBuffer ?? this.createBuffer(1, 200, this.sampleRate));
    }
  }
  class Player {
    paused = true;
    playCalls = 0;
    loadCalls = 0;
    _currentTime = 0;
    readyState = 0;
    seekHistory = [];
    duration = 120;
    listeners = new Map();
    constructor(url) { this.src = url; players.push(this); calls.push("music.create"); }
    get currentTime() { return this._currentTime; }
    set currentTime(value) {
      if (options.rejectSeekBeforeMetadata && !this.readyState) throw new DOMException("No metadata", "InvalidStateError");
      this._currentTime = value;
      this.seekHistory.push(value);
    }
    play() {
      this.playCalls++;
      calls.push("music.play");
      if (options.playError) return Promise.reject(options.playError);
      if (options.playGate) return options.playGate.promise.then(() => { this.paused = false; });
      this.paused = false;
      return Promise.resolve();
    }
    pause() { calls.push("music.pause"); this.paused = true; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name); }
    removeAttribute() { this.src = ""; }
    load() {
      this.loadCalls++; calls.push("music.release");
      if (this.src && !options.metadataPending) queueMicrotask(() => {
        if (!this.src) return;
        this.readyState = 1;
        this.listeners.get("loadedmetadata")?.();
      });
    }
  }
  const early = options.early ? {
    element: new Player(AUDIO_CATALOG.playlist[options.earlyIndex ?? 0].url), trackIndex: options.earlyIndex ?? 0, desired: true, silenced: false,
    gesture: true, status: "playing", pending: options.earlyPending?.promise ?? null, owner: null,
    claim(owner) { this.owner = owner; return this.element; },
    release(owner) { if (this.owner === owner) { this.owner = null; this.pending = null; } },
    setEnabled(enabled) { this.desired = enabled; this.silenced = !enabled; if (!enabled) this.element.pause(); },
    rememberTrack(index, time) { this.trackIndex = index; this.element.src = AUDIO_CATALOG.playlist[index].url; this.element.currentTime = time; },
  } : null;
  if (early) { early.element.readyState = 1; early.element.currentTime = 58; early.element.paused = !!options.earlyPending; early.element.volume = .68; }
  const replacements = {
    window: early ? { __tccEntryAudio: early } : undefined,
    Audio: Player, AudioContext: Context, document: { hidden: false },
    fetch: (...args) => {
      calls.push("fetch:" + args[0]);
      if (options.fetch) return options.fetch(...args);
      if (options.thunderReady && args[0] === AUDIO_CATALOG.thunder.url) return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(3) });
      return new Promise(() => {});
    },
  };
  const originals = new Map();
  for (const [key, value] of Object.entries(replacements)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  t.after(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const audio = new ExperienceAudio(options.random ?? (() => .999999));
  t.after(() => audio.dispose());
  return { audio, calls, players, contexts, nodes, buffers, options, early };
}

function earlyBrowser(options = {}) {
  const listeners = new Map(), mediaListeners = new Map();
  const dispatch = (collection, name, event = {}) => { for (const callback of [...(collection.get(name) ?? [])]) callback({ type: name, target: { closest: () => null }, preventDefault() {}, stopImmediatePropagation() {}, ...event }); };
  const listen = collection => (name, callback) => {
    if (!collection.has(name)) collection.set(name, new Set());
    collection.get(name).add(callback);
  };
  const element = {
    src: AUDIO_CATALOG.music.url, paused: true, currentTime: 0, duration: 188.352,
    readyState: options.readyState ?? 1, volume: 1, playCalls: 0, pauseCalls: 0,
    getAttribute(name) { return name === "src" ? this.src : null; },
    addEventListener: listen(mediaListeners),
    removeEventListener(name, callback) { mediaListeners.get(name)?.delete(callback); },
    play() {
      this.playCalls++;
      if (options.error) return Promise.reject(options.error);
      const result = options.gate?.promise ?? Promise.resolve();
      return result.then(() => { this.paused = false; dispatch(mediaListeners, "playing"); });
    },
    pause() { this.pauseCalls++; const wasPlaying = !this.paused; this.paused = true; if (wasPlaying) dispatch(mediaListeners, "pause"); },
  };
  const document = {
    hidden: !!options.hidden, documentElement: { dataset: {} },
    getElementById(id) { return id === "tcc-entry-music" ? element : null; },
    addEventListener: listen(listeners),
  };
  const window = {};
  const math = Object.create(Math); math.random = options.random ?? (() => 0);
  const context = { window, document, performance: { now: () => 25 }, Promise, Math: math };
  runInNewContext(EARLY_AUDIO_SCRIPT, context);
  return { element, document, state: window.__tccEntryAudio, options, runAgain: () => runInNewContext(EARLY_AUDIO_SCRIPT, context),
    emit: (name, event) => dispatch(listeners, name, event), metadata() { element.readyState = 1; dispatch(mediaListeners, "loadedmetadata"); } };
}

test("startup can select each approved track and uses that track's cue before React", async () => {
  for (let index = 0; index < AUDIO_CATALOG.playlist.length; index++) {
    const env = earlyBrowser({ random: () => (index + .5) / AUDIO_CATALOG.playlist.length, readyState: 0 });
    assert.equal(env.state.trackIndex, index);
    assert.equal(env.element.src, AUDIO_CATALOG.playlist[index].url);
    env.metadata(); await flush();
    assert.equal(env.element.currentTime, AUDIO_CATALOG.playlist[index].startAtSeconds);
    assert.equal(env.element.playCalls, 1);
    env.state.rememberTrack((index + 1) % AUDIO_CATALOG.playlist.length, 37);
    assert.equal(env.element.src, AUDIO_CATALOG.playlist[(index + 1) % AUDIO_CATALOG.playlist.length].url);
    assert.equal(env.element.currentTime, 37, "a remount keeps the current song and position");
  }
});

test("the hydrated shuffle includes the adopted song exactly once per cycle and skips without repeating at a boundary", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { audio, early } = browser(t, { early: true, earlyIndex: 4 });
  await audio.enable({ music: true });
  assert.equal(audio.diagnostics().music.title, AUDIO_CATALOG.playlist[4].title);
  assert.equal(early.element.currentTime, 58);
  const heard = [audio.diagnostics().music.title];
  for (let index = 0; index < AUDIO_CATALOG.playlist.length; index++) {
    audio.nextTrack(); await flush(); t.mock.timers.tick(2000); await flush();
    heard.push(audio.diagnostics().music.title);
  }
  assert.equal(new Set(heard.slice(0, 5)).size, 5);
  assert.notEqual(heard[4], heard[5]);
  audio.mute(); audio.nextTrack();
  assert.equal(audio.diagnostics().music.title, heard[5], "skip cannot restart muted music");
});

test("native-only playback also rotates through all five songs when Web Audio is unavailable", async t => {
  const { audio, early } = browser(t, { early: true, earlyIndex: 4, contextError: new Error("No Web Audio") });
  await audio.enable({ music: true });
  const heard = [early.element.src];
  for (let index = 0; index < 4; index++) {
    early.element.listeners.get("ended")({ target: early.element }); await flush();
    heard.push(early.element.src);
    assert.equal(early.element.paused, false);
  }
  assert.equal(new Set(heard).size, 5);
});

test("the static SSR bootstrap starts without React, positions the catalog cue and is idempotent", async () => {
  const { element, state, document, runAgain, metadata } = earlyBrowser({ readyState: 0 });
  assert.equal(element.playCalls, 1, "play must be requested immediately, without waiting for metadata or React");
  assert.equal(element.currentTime, 0);
  metadata();
  assert.equal(element.currentTime, AUDIO_CATALOG.music.startAtSeconds);
  assert.equal(element.volume, AUDIO_CATALOG.music.volume);
  await flush();
  assert.equal(state.status, "playing");
  assert.equal(document.documentElement.dataset.entryAudioBootMs, "25");
  assert.equal(document.documentElement.dataset.entryAudioFirstPlayMs, "25");
  element.currentTime = 60;
  runAgain(); metadata();
  assert.equal(element.playCalls, 1);
  assert.equal(element.currentTime, 60, "re-evaluating the script must not reset the cue");
});

test("the early bootstrap reports blocked autoplay and retries only an eligible gesture", async () => {
  const env = earlyBrowser({ error: new DOMException("Gesture required", "NotAllowedError") });
  await flush();
  assert.equal(env.state.status, "blocked");
  assert.equal(env.document.documentElement.dataset.entryAudioStatus, "blocked");
  env.options.error = null;
  env.emit("keydown", { key: "Escape" });
  env.emit("pointerdown", { target: { closest: selector => selector === "[data-audio-control]" } });
  assert.equal(env.element.playCalls, 1);
  env.emit("keydown", { key: "Enter" }); await flush();
  assert.equal(env.state.status, "playing");
  assert.equal(env.state.gesture, true);
  assert.equal(env.element.playCalls, 2);
});

test("the early sound button activates a blocked track and then silences active playback", async () => {
  const env = earlyBrowser({ error: new DOMException("Gesture required", "NotAllowedError") }); await flush();
  const button = { closest: selector => selector === "[data-entry-audio-toggle]" };
  env.options.error = null;
  let prevented = false, consumed = false;
  env.emit("click", { target: button, preventDefault() { prevented = true; }, stopImmediatePropagation() { consumed = true; } }); await flush();
  assert.equal(env.element.playCalls, 2);
  assert.equal(env.state.status, "playing");
  assert.equal(env.state.silenced, false);
  assert.equal(prevented && consumed, true, "an early button click cannot also be replayed as a hydrated toggle");
  env.emit("click", { target: button });
  assert.equal(env.state.silenced, true);
  assert.equal(env.element.paused, true);
});

test("pre-hydration silence, entry intent and hidden tabs survive late play promises", async () => {
  const gate = deferred();
  const env = earlyBrowser({ gate });
  env.emit("click", { target: { closest: selector => selector === ".island-enter" } });
  assert.equal(env.state.entryRequested, true);
  assert.equal(env.document.documentElement.dataset.entryRequested, "true");
  env.emit("click", { target: { closest: selector => selector === "[data-entry-audio-toggle]" } });
  assert.equal(env.state.silenced, true);
  gate.resolve(); await flush();
  assert.equal(env.element.paused, true);
  env.emit("pointerdown");
  assert.equal(env.element.playCalls, 1);
  env.document.hidden = true; env.emit("visibilitychange");
  env.document.hidden = false; env.emit("visibilitychange");
  assert.equal(env.element.playCalls, 1, "visibility cannot override a visitor's silence choice");
  assert.equal(env.state.status, "off");
});

test("hidden early playback is paused, visibility resumes it, and claim stops bootstrap gestures", async () => {
  const env = earlyBrowser(); await flush();
  env.element.currentTime = 64;
  env.document.hidden = true; env.emit("visibilitychange");
  assert.equal(env.element.paused, true);
  env.document.hidden = false; env.emit("visibilitychange"); await flush();
  assert.equal(env.element.currentTime, 64);
  assert.equal(env.element.playCalls, 2);
  const owner = {};
  assert.equal(env.state.claim(owner), env.element);
  env.emit("click", { target: { closest: selector => selector === "[data-entry-audio-toggle]" } });
  assert.equal(env.state.silenced, false, "hydrated controls belong to the engine, not both listeners");
  env.state.release(owner);
  env.emit("pointerdown");
  assert.equal(env.element.playCalls, 2, "cleanup never re-arms the independent bootstrap");
});

test("the engine adopts running SSR music without creating, seeking, replaying or graph-binding it", async t => {
  const { audio, players, early, nodes } = browser(t, { early: true });
  await audio.enable({ music: true });
  assert.equal(players.length, 1);
  assert.equal(players[0], early.element);
  assert.equal(players[0].playCalls, 0);
  assert.equal(players[0].loadCalls, 0);
  assert.deepEqual(players[0].seekHistory, [58]);
  assert.equal(players[0].volume, .68);
  assert.equal(nodes.some(node => node.kind === "media-source"), false);
  assert.equal(audio.diagnostics().music.status, "playing");
  assert.equal(audio.diagnostics().music.metered, false);
});

test("cleanup, remount and silence preserve one SSR element and pending owners cannot interfere", async t => {
  const gate = deferred();
  const { audio, early, players } = browser(t, { early: true, earlyPending: gate });
  await audio.enable({ music: true });
  const second = new ExperienceAudio();
  t.after(() => second.dispose());
  await second.enable({ music: true });
  early.element.paused = false;
  audio.dispose();
  gate.resolve(); await flush();
  assert.equal(early.element.paused, false, "a stale owner's cleanup/promise cannot pause the new owner");
  assert.equal(early.element.playCalls, 0);
  assert.equal(early.element.currentTime, 58);
  second.mute();
  assert.equal(early.silenced, true);
  second.dispose();
  assert.equal(early.silenced, true);
  const third = new ExperienceAudio(); t.after(() => third.dispose());
  assert.equal(early.silenced, true, "constructing an engine does not revoke an earlier silence choice");
  assert.equal(players.length, 1);
  await third.enable({ music: true });
  assert.equal(early.silenced, false);
  assert.equal(early.element.currentTime, 58);
  assert.equal(players.length, 1);
});

test("an already playing native track survives an unavailable Web Audio context", async t => {
  const { audio, early } = browser(t, { early: true, resumeError: new DOMException("Needs gesture", "NotAllowedError") });
  let effectiveOutput = false;
  audio.onStateChange = enabled => { effectiveOutput = enabled; };
  await audio.enable({ music: true });
  assert.equal(early.element.paused, false);
  assert.equal(early.element.playCalls, 0);
  assert.equal(audio.diagnostics().music.status, "playing");
  assert.equal(audio.diagnostics().status, "interrupted");
  assert.match(audio.diagnostics().lastError, /Needs gesture/);
  assert.equal(effectiveOutput, true);
  audio.visibility(true);
  assert.equal(early.element.paused, true);
  audio.mute();
  assert.equal(early.silenced, true);
});

test("StrictMode cleanup discards the cancelled early play promise before the next engine adopts", async t => {
  const gate = deferred();
  const { audio, early, players } = browser(t, { early: true, earlyPending: gate });
  await audio.enable({ music: true });
  audio.dispose();
  assert.equal(early.pending, null);
  const next = new ExperienceAudio(); t.after(() => next.dispose());
  await next.enable({ music: true });
  gate.reject(new DOMException("Interrupted by pause", "AbortError")); await flush();
  assert.equal(early.element.paused, false);
  assert.equal(early.element.playCalls, 1);
  assert.equal(early.element.currentTime, 58);
  assert.equal(players.length, 1);
  assert.equal(next.diagnostics().music.status, "playing");
  assert.equal(next.diagnostics().music.error, null);
});

test("native music survives context construction failure and the resume deadline", async t => {
  await t.test("construction", async t => {
    const { audio, early } = browser(t, { early: true, contextError: new Error("No Web Audio") });
    await audio.enable({ music: true });
    assert.equal(early.element.paused, false);
    assert.equal(audio.diagnostics().music.status, "playing");
    assert.match(audio.diagnostics().lastError, /No Web Audio/);
    audio.visibility(true);
    assert.equal(early.element.paused, true);
    audio.visibility(false); await flush();
    assert.equal(early.element.paused, false);
    assert.equal(audio.diagnostics().music.status, "playing");
    early.element.currentTime = 120; early.element.paused = true;
    early.element.listeners.get("ended")({ target: early.element }); await flush();
    assert.equal(early.element.currentTime, 0, "native-only fallback begins the next track when it ends");
    assert.notEqual(early.element.src, AUDIO_CATALOG.music.url);
    assert.equal(early.element.paused, false);
    assert.equal(audio.diagnostics().music.status, "playing");
  });
  await t.test("deadline", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const gate = deferred();
    const { audio, early } = browser(t, { early: true, resumeGate: gate });
    const activation = audio.enable({ music: true });
    t.mock.timers.tick(4000); await activation;
    assert.equal(early.element.paused, false);
    assert.equal(audio.diagnostics().music.status, "playing");
    audio.mute(); gate.resolve(); await flush();
    assert.equal(early.element.paused, true);
    assert.equal(audio.diagnostics().desired, false);
  });
});

test("a native entry retry reuses its player after a blocked pending play", async t => {
  const gate = deferred();
  const { audio, early, players } = browser(t, { early: true, earlyPending: gate });
  await audio.enable({ music: true });
  gate.reject(new DOMException("Blocked", "NotAllowedError")); await flush();
  assert.equal(audio.diagnostics().music.status, "error");
  early.pending = null;
  await audio.enable({ music: true });
  assert.equal(players.length, 1);
  assert.equal(early.element.currentTime, 58);
  assert.equal(early.element.loadCalls, 0);
  assert.equal(early.element.playCalls, 1);
  assert.equal(audio.diagnostics().music.status, "playing");
});

test("the first native-to-graph crossfade and remount preserve volume, source and current position", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { audio, players, early } = browser(t, { early: true });
  await audio.enable({ music: true });
  early.element.currentTime = 118;
  early.element.listeners.get("timeupdate")(); await flush();
  assert.equal(players.length, 2);
  assert.equal(early.element.volume, .68, "handoff into a crossfade does not cut the old player immediately");
  t.mock.timers.tick(1000);
  assert.ok(early.element.volume > 0 && early.element.volume < .68);
  players[1].currentTime = 9;
  audio.dispose();
  assert.equal(early.element.currentTime, 9);
  assert.equal(early.element.src, AUDIO_CATALOG.playlist[early.trackIndex].url);
  const remount = new ExperienceAudio(); t.after(() => remount.dispose());
  await remount.enable({ music: true });
  t.mock.timers.tick(4000); await flush();
  assert.equal(early.element.currentTime, 9);
  assert.equal(early.element.volume, .68);
  assert.equal(early.element.paused, false);
  assert.equal(players.length, 2, "remount does not construct another MP3 player");
});

test("reading attenuation ramps native music and never raises a retiring track", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { audio, early } = browser(t, { early: true });
  await audio.enable({ music: true });
  audio.setVolumes(.26, .1, .06, .8);
  assert.equal(early.element.volume, .68);
  t.mock.timers.tick(400);
  assert.ok(early.element.volume > .26 && early.element.volume < .68);
  t.mock.timers.tick(500);
  assert.equal(early.element.volume, .26);
  early.element.currentTime = 118;
  early.element.listeners.get("timeupdate")(); await flush();
  t.mock.timers.tick(400);
  const outgoingVolume = early.element.volume;
  audio.setVolumes(.68, .1, .06, .8);
  t.mock.timers.tick(400);
  assert.ok(early.element.volume < outgoingVolume, "leaving reading must not revive the outgoing track");
  audio.mute();
  const mutedVolume = early.element.volume;
  t.mock.timers.tick(1000);
  assert.equal(early.element.volume, mutedVolume);
  assert.equal(early.element.paused, true);
});

test("only music data preloads before consent; ambience starts with an immediate cue", async t => {
  const { audio, calls, players, nodes } = browser(t);
  assert.deepEqual(calls, ["music.create", "music.release"]);
  assert.equal(players[0].preload, "auto");
  assert.equal(players[0].playCalls, 0);
  const started = audio.enable();
  assert.ok(calls.includes("context.resume"), "resume is requested in the gesture before awaiting");
  assert.equal(audio.enabled, false);
  await started;
  assert.equal(audio.enabled, true);
  assert.equal(players.length, 1, "the entry player only preloads in ambience-only mode");
  assert.equal(players[0].paused, true);
  assert.equal(players[0].playCalls, 0);
  assert.equal(calls.filter(call => call === "tone.create").length, 2, "confirmation cue requires no downloaded asset");
  assert.equal(audio.diagnostics().activeAmbience, 1, "clear weather has wind immediately");
  const analyser = nodes.find(node => node.kind === "analyser");
  const buses = nodes.filter(node => node.kind === "gain").slice(0, 2);
  assert.deepEqual(buses.map(bus => bus.connections), [[analyser], [analyser]]);
  assert.equal(buses[0].gain.value, .55);
  assert.equal(buses[1].gain.value, .36);
  assert.ok(!calls.some(call => call.endsWith(".mp3")));
  audio.play("selection");
  assert.equal(calls.filter(call => call === "tone.create").length, 3, "click works while downloads never resolve");
});

test("a gesture starts the documented catalog, and an ending restarts music without native looping", async t => {
  const { audio, calls, players } = browser(t);
  await audio.enable({ music: true });
  assert.equal(players.length, 1);
  assert.ok(AUDIO_CATALOG.playlist.some(track => track.url === players[0].src));
  assert.ok(!players[0].src.includes("solace"));
  assert.equal(players[0].loop, false);
  assert.ok(!calls.includes("decode"));
  players[0].listeners.get("ended")();
  await flush();
  assert.equal(players.length, 2);
  if (AUDIO_CATALOG.playlist.length > 1) assert.notEqual(players[0].src, players[1].src);
  else assert.equal(players[0].src, players[1].src);
  assert.equal(players[1].paused, false);
  audio.mute();
  players[1].listeners.get("ended")();
  assert.equal(players[1].paused, true);
});

test("rain produces a continuous loop and activation cue without scheduling birds", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio, calls, players } = browser(t);
  audio.setWeather("rain");
  assert.equal(calls.includes("context.create"), false);
  assert.equal(calls.includes("music.play"), false);
  await audio.enable({ music: false });
  assert.equal(players.length, 1);
  assert.equal(players[0].playCalls, 0);
  assert.equal(audio.diagnostics().activeAmbience, 1);
  t.mock.timers.tick(2000);
  assert.equal(calls.filter(call => call === "tone.create").length, 2);
  audio.setWeather("storm");
  assert.equal(audio.diagnostics().activeAmbience, 2);
});

test("mute cancels a pending start immediately and late browser promises cannot restore consent", async t => {
  const resumeGate = deferred(), playGate = deferred();
  const { audio, players, contexts } = browser(t, { resumeGate, playGate });
  const started = audio.enable({ music: true });
  const rejected = assert.rejects(started, { name: "AbortError" });
  audio.mute();
  await rejected;
  resumeGate.resolve();
  playGate.resolve();
  await flush();
  assert.equal(audio.enabled, false);
  assert.equal(audio.diagnostics().desired, false);
  assert.equal(players[0].paused, true);
  assert.equal(contexts[0].state, "suspended");
});

test("a failed activation reports its real error and can be retried in a fresh gesture", async t => {
  const { audio, options } = browser(t, { resumeError: new DOMException("Gesture required", "NotAllowedError") });
  await assert.rejects(audio.enable(), { name: "NotAllowedError" });
  assert.equal(audio.enabled, false);
  assert.equal(audio.lastError, "Gesture required");
  options.resumeError = null;
  await audio.enable();
  assert.equal(audio.enabled, true);
  assert.equal(audio.lastError, null);
});

test("duplicate enable requests reuse the pending start", async t => {
  const resumeGate = deferred();
  const { audio, calls, contexts } = browser(t, { resumeGate });
  const first = audio.enable();
  const second = audio.enable();
  assert.equal(first, second);
  assert.equal(contexts.length, 1);
  assert.equal(calls.filter(call => call === "context.resume").length, 1);
  resumeGate.resolve();
  await first;
});

test("hiding during activation preserves consent, delays the cue and resumes on return", async t => {
  const resumeGate = deferred();
  const { audio, contexts, calls, options } = browser(t, { resumeGate });
  const first = audio.enable();
  audio.visibility(true);
  resumeGate.resolve();
  await first;
  assert.equal(audio.enabled, true);
  assert.equal(audio.diagnostics().status, "paused");
  assert.equal(contexts[0].state, "suspended");
  assert.equal(calls.filter(call => call === "tone.create").length, 0);
  options.resumeGate = null;
  audio.visibility(false);
  await flush();
  assert.equal(audio.diagnostics().status, "running");
  assert.equal(calls.filter(call => call === "tone.create").length, 2);
});

test("a hidden-visible race while resume is pending starts output only in the latest visible state", async t => {
  const resumeGate = deferred();
  const { audio, contexts } = browser(t, { resumeGate });
  const start = audio.enable();
  audio.visibility(true);
  audio.visibility(false);
  resumeGate.resolve();
  await start;
  assert.equal(audio.diagnostics().status, "running");
  assert.equal(contexts[0].state, "running");
  assert.equal(audio.diagnostics().activeAmbience, 1);
});

test("visible browser interruptions update the UI and retain consent for automatic restoration", async t => {
  const { audio, contexts } = browser(t);
  const changes = [];
  audio.onStateChange = (enabled, error) => changes.push({ enabled, error });
  await audio.enable();
  contexts[0].setState("interrupted");
  assert.equal(audio.enabled, false);
  assert.equal(audio.diagnostics().desired, true);
  assert.equal(audio.diagnostics().status, "interrupted");
  assert.equal(audio.diagnostics().activeAmbience, 0);
  assert.match(changes.at(-1).error, /interrompida/);
  contexts[0].setState("running");
  assert.equal(audio.enabled, true);
  assert.equal(audio.lastError, null);
  assert.equal(changes.at(-1).enabled, true);
  assert.equal(audio.diagnostics().activeAmbience, 1);
});

test("failed visibility recovery does not silently revoke consent", async t => {
  const { audio, options } = browser(t);
  await audio.enable();
  audio.visibility(true);
  options.resumeError = new DOMException("Gesture required", "NotAllowedError");
  audio.visibility(false);
  await flush();
  assert.equal(audio.enabled, false);
  assert.equal(audio.diagnostics().desired, true);
  assert.equal(audio.lastError, "Gesture required");
  options.resumeError = null;
  await audio.enable();
  assert.equal(audio.enabled, true);
});

test("a late aborted visibility recovery cannot silence a newer successful activation", async t => {
  const { audio, options, contexts } = browser(t);
  await audio.enable();
  audio.visibility(true);
  const oldResume = deferred();
  options.resumeGate = oldResume;
  audio.visibility(false);
  audio.visibility(true);
  audio.mute();
  options.resumeGate = null;
  audio.visibility(false);
  await audio.enable();
  oldResume.resolve();
  await flush();
  assert.equal(audio.enabled, true);
  assert.equal(contexts[0].state, "running");
});

test("a stalled activation times out honestly and can never resurrect itself", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const resumeGate = deferred();
  const { audio, contexts } = browser(t, { resumeGate });
  const rejected = assert.rejects(audio.enable(), /não iniciou/);
  t.mock.timers.tick(4000);
  await rejected;
  assert.equal(audio.diagnostics().status, "error");
  resumeGate.resolve();
  await flush();
  assert.equal(contexts[0].state, "suspended");
  assert.equal(audio.enabled, false);
});

test("volume controls keep independent parallel buses and zero can silence the whole environment", async t => {
  const { audio } = browser(t);
  await audio.enable();
  audio.setVolumes(0, .55, .36);
  assert.deepEqual(audio.diagnostics().gains, { effects: .55, ambience: .36, music: 0 });
  audio.setVolumes(0, 0);
  assert.deepEqual(audio.diagnostics().gains, { effects: 0, ambience: 0, music: 0 });
  audio.setVolumes(0, Infinity, -1);
  assert.deepEqual(audio.diagnostics().gains, { effects: 0, ambience: 0, music: 0 });
  audio.setVolumes(0, 2, .8);
  assert.deepEqual(audio.diagnostics().gains, { effects: 1, ambience: .8, music: 0 });
});

test("storm and WMO hail thunder are rate-limited and use their own ambience-controlled bus", async t => {
  const { audio, contexts } = browser(t, { thunderReady: true });
  audio.setWeather("rain");
  await audio.enable();
  await flush();
  assert.equal(audio.diagnostics().activeAmbience, 1);
  audio.thunder();
  assert.equal(audio.diagnostics().activeAmbience, 1);
  audio.setWeather("storm");
  audio.thunder();
  assert.equal(audio.diagnostics().activeAmbience, 3);
  audio.thunder();
  assert.equal(audio.diagnostics().activeAmbience, 3);
  contexts[0].currentTime = 2.89;
  audio.thunder();
  assert.equal(audio.diagnostics().activeAmbience, 3);
  contexts[0].currentTime = 3;
  audio.thunder();
  assert.equal(audio.diagnostics().activeAmbience, 4);
  audio.setWeather("hail");
  contexts[0].currentTime = 20;
  audio.thunder();
  assert.equal(audio.diagnostics().activeAmbience, 3, "hail retains wind, precipitation and thunder");
  audio.setVolumes(0, .55, 0);
  contexts[0].currentTime = 40;
  audio.thunder();
  assert.equal(audio.diagnostics().activeAmbience, 2, "zero ambience cancels the active thunder voice");
});

test("rain's real generated samples retain broadband energy and a bounded RMS before browser filtering", async t => {
  const { audio, buffers } = browser(t);
  audio.setWeather("rain");
  await audio.enable();
  const data = buffers[0].getChannelData(0);
  let squares = 0, differenceSquares = 0, peak = 0;
  for (let index = 0; index < data.length; index++) {
    squares += data[index] ** 2;
    peak = Math.max(peak, Math.abs(data[index]));
    if (index) differenceSquares += (data[index] - data[index - 1]) ** 2;
  }
  assert.ok(Math.sqrt(squares / data.length) > .31 && Math.sqrt(squares / data.length) < .33);
  assert.ok(Math.sqrt(differenceSquares / data.length) > .4, "smoothed noise cannot replace rain's high-frequency detail");
  assert.ok(peak <= .95);
  assert.equal(Math.abs(data[0]), 0);
  assert.equal(Math.abs(data.at(-1)), 0);
});

test("silent decoded interface samples retain the immediate synth fallback", async t => {
  const manifest = { music: { url: "/unused.mp3" }, selection: { url: "/click.ogg", volume: .08 }, arrival: { url: "/arrival.ogg", volume: .08 } };
  const { audio, calls } = browser(t, { fetch: url => Promise.resolve(url.endsWith(".json")
    ? { ok: true, json: () => Promise.resolve(manifest) }
    : { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) }) });
  await audio.enable();
  await flush();
  assert.ok(calls.includes("decode"));
  const before = calls.filter(call => call === "tone.create").length;
  audio.play("selection");
  assert.equal(calls.filter(call => call === "tone.create").length, before + 1);
});

test("running contexts and active voices alone do not constitute measured output", async t => {
  const { audio, options } = browser(t);
  await audio.enable();
  let diagnostics = audio.diagnostics();
  assert.equal(diagnostics.contextState, "running");
  assert.ok(diagnostics.activeEffects > 0);
  assert.equal(diagnostics.peak, 0);
  assert.equal(diagnostics.signalDetected, false);
  options.meterAmplitude = .125;
  diagnostics = audio.diagnostics();
  assert.equal(diagnostics.peak, .125);
  assert.equal(diagnostics.rms, .125);
  assert.equal(diagnostics.signalDetected, true, "this unit assertion only verifies arithmetic on simulated analyser samples");
});

test("testSound samples across the cue and records measured silence without claiming audibility", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio } = browser(t);
  const result = audio.testSound();
  await flush();
  for (let index = 0; index < 8; index++) { t.mock.timers.tick(65); await flush(); }
  const reading = await result;
  assert.deepEqual(reading.lastTest, { rms: 0, peak: 0, samples: 8, signalDetected: false });
  assert.equal(reading.recentEvents.at(-1).detail, "no-signal-detected");
});

test("testSound records the strongest analyser reading instead of only the quiet tail", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio, options } = browser(t, { meterAmplitude: .1 });
  const result = audio.playTest();
  await flush();
  t.mock.timers.tick(65);
  options.meterAmplitude = 0;
  for (let index = 0; index < 7; index++) { t.mock.timers.tick(65); await flush(); }
  const reading = await result;
  assert.ok(reading.lastTest.rms > .099);
  assert.ok(reading.lastTest.peak > .099);
  assert.equal(reading.lastTest.signalDetected, true);
  assert.equal(reading.signalDetected, false, "instantaneous tail and the sampled test window are different");
});

test("mute cancels an in-progress output test and zero volume gives an actionable error", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio } = browser(t);
  const running = audio.playTest();
  const rejected = assert.rejects(running, { name: "AbortError" });
  await flush();
  audio.mute();
  await rejected;
  audio.setVolumes(0, 0);
  await assert.rejects(audio.testSound(), /volume.*zero/);
  assert.equal(audio.diagnostics().lastTest, null);
});

test("dispose cancels startup, disconnects nodes, clears voices and unregisters lifecycle handlers", async t => {
  const resumeGate = deferred();
  const { audio, contexts, nodes } = browser(t, { resumeGate });
  const rejected = assert.rejects(audio.enable(), { name: "AbortError" });
  audio.dispose();
  await rejected;
  assert.equal(contexts[0].state, "closed");
  assert.equal(contexts[0].listeners.size, 0);
  assert.equal(audio.diagnostics().status, "disposed");
  assert.equal(audio.diagnostics().activeEffects, 0);
  assert.equal(audio.diagnostics().activeAmbience, 0);
  assert.ok(nodes.filter(node => node.kind !== "destination").every(node => node.disconnected));
  await assert.rejects(audio.enable(), { name: "AbortError" });
});

test("a failed music file has an independent error while ambience and consent continue", async t => {
  const { audio, players } = browser(t);
  const changes = [];
  audio.onStateChange = (enabled, error) => changes.push({ enabled, error });
  await audio.enable({ music: true });
  players[0].listeners.get("error")();
  assert.equal(audio.enabled, true);
  assert.equal(players[0].paused, true);
  assert.equal(audio.diagnostics().music.status, "error");
  assert.match(audio.diagnostics().music.error, /música não pôde/);
  assert.equal(audio.diagnostics().activeAmbience, 1);
  assert.equal(changes.at(-1).error, null);
});

test("requesting ambience-only mode pauses a previously opted-in legacy music player", async t => {
  const { audio, players } = browser(t);
  await audio.enable({ music: true });
  assert.equal(players[0].paused, false);
  await audio.enable({ music: false });
  assert.equal(players[0].paused, true);
  assert.equal(audio.diagnostics().gains.music, 0);
});

test("a closed context can be replaced by fresh consent without retaining old graph connections", async t => {
  const { audio, contexts } = browser(t);
  await audio.enable();
  contexts[0].setState("closed");
  assert.equal(audio.enabled, false);
  await audio.enable();
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0].listeners.size, 0);
  assert.equal(audio.diagnostics().status, "running");
});


test("shuffle exhausts three tracks and does not repeat across playlist boundaries", () => {
  const first = shuffledMusicOrder(3, -1, () => .3);
  assert.equal(new Set(first).size, 3);
  const second = shuffledMusicOrder(3, first.at(-1), () => .3);
  assert.notEqual(second[0], first.at(-1));
  assert.deepEqual(shuffledMusicOrder(1, 0, () => .3), [0]);
});

test("music is metered on its own parallel bus without multiplying effects or native volume", async t => {
  const { audio, players, nodes, options } = browser(t, { meterAmplitude: .125 });
  audio.setVolumes(.28, .10, .06);
  await audio.enable({ music: true });
  const source = nodes.find(node => node.kind === "media-source");
  assert.equal(players[0].volume, 1);
  const fade = source.connections[0], bus = fade.connections[0], meter = bus.connections[0];
  assert.equal(bus.gain.value, .28);
  assert.equal(meter.kind, "analyser");
  assert.notEqual(meter, nodes.find(node => node.kind === "analyser"));
  assert.equal(meter.connections[0], nodes.find(node => node.kind === "analyser"));
  const stats = audio.diagnostics();
  assert.equal(stats.music.status, "playing");
  assert.equal(stats.music.peak, .125);
  assert.equal(stats.music.rms, .125);
  assert.equal(stats.music.signalDetected, true);
  assert.equal(stats.music.metered, true);
  options.meterAmplitude = 0;
  assert.equal(audio.diagnostics().music.signalDetected, false);
});

test("the last two seconds overlap tracks, fade independently and release the outgoing player", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio, players, nodes, contexts } = browser(t);
  await audio.enable({ music: true });
  contexts[0].currentTime = 118;
  players[0].currentTime = 118;
  players[0].listeners.get("timeupdate")();
  await flush();
  assert.equal(players.length, 2);
  assert.ok(players.every(player => !player.paused));
  const sources = nodes.filter(node => node.kind === "media-source");
  const outgoing = sources[0].connections[0], incoming = sources[1].connections[0];
  assert.deepEqual(outgoing.gain.automation.at(-1), ["linear", 0, 120]);
  assert.deepEqual(incoming.gain.automation.at(-1), ["linear", 1, 120]);
  t.mock.timers.tick(2000);
  assert.equal(players[0].paused, true);
  assert.equal(players[0].src, "");
  assert.equal(players[1].paused, false);
  assert.equal(sources[0].disconnected, true);
});

test("music rejection cannot hide a working ambient output and a fresh gesture retries it", async t => {
  const { audio, options, players } = browser(t, { playError: new Error("File blocked") });
  await audio.enable({ music: true });
  await flush();
  assert.equal(audio.diagnostics().status, "running");
  assert.equal(audio.diagnostics().music.status, "error");
  assert.equal(audio.diagnostics().music.error, "File blocked");
  assert.equal(audio.diagnostics().desired, true);
  options.playError = null;
  await audio.enable({ music: true });
  assert.equal(players.length, 2);
  assert.equal(audio.diagnostics().music.status, "playing");
});

test("a stale media promise cannot pause the same player after a newer successful gesture", async t => {
  const gate = deferred();
  const { audio, options, players } = browser(t, { playGate: gate });
  await audio.enable({ music: true });
  audio.mute();
  options.playGate = null;
  await audio.enable({ music: true });
  gate.resolve();
  await flush();
  assert.equal(players[0].paused, false);
  assert.equal(audio.diagnostics().music.status, "playing");
});

test("night and severe precipitation cancel licensed bird scheduling, even without stopping music", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio, calls } = browser(t);
  await audio.enable({ music: true });
  audio.setEnvironment("clear", "night");
  const before = calls.length;
  t.mock.timers.tick(60000);
  assert.equal(calls.length, before);
  assert.equal(audio.diagnostics().music.status, "playing");
  for (const weather of ["rain", "snow", "hail", "freezing-rain"]) {
    audio.setEnvironment(weather, "day");
    const count = calls.filter(call => call === "buffer.create").length;
    t.mock.timers.tick(60000);
    assert.equal(calls.filter(call => call === "buffer.create").length, count);
  }
});


test("the shipped manifest matches the synchronous gesture catalog and every track has a resource", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/experience/audio/audio-manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest, AUDIO_CATALOG);
  for (const track of [...AUDIO_CATALOG.playlist, ...AUDIO_CATALOG.birds]) {
    let bytes;
    try {
      bytes=await readFile(new URL("../public"+track.url, import.meta.url));
      assert.ok(bytes.length > 1000);
    } catch(error) {
      if(error.code !== 'ENOENT')throw error;
      assert.equal(track.url,manifest.music.url);
      const {default:config}=await import('../next.config.ts');
      const {backendUrl}=await import('../src/lib/deployment-backend.mjs');
      assert.equal((await config.rewrites()).find(rule=>rule.source===track.url)?.destination,backendUrl(track.url).href);
    }
    assert.ok(track.source.startsWith("https://"));
    if(track.assetSource) {
      assert.ok(["https://genshin.hoyoverse.com", "https://www.youtube.com"].includes(new URL(track.assetSource).origin));
      assert.ok(track.licenseSource.startsWith("https://"));
      assert.ok(track.attribution.includes("COGNOSPHERE"));
      assert.match(track.sha256,/^[a-f0-9]{64}$/);
      if(bytes)assert.equal(createHash("sha256").update(bytes).digest("hex"), track.sha256);
    } else assert.ok(["CC BY 4.0", "CC0 1.0"].includes(track.license));
    if(track.url.endsWith(".ogg")) assert.equal(bytes.subarray(0,4).toString(),"OggS");
  }
});

test("the stronger music default is applied once and remains independent of quiet ambience", async t => {
  const { audio, nodes, players } = browser(t);
  audio.setVolumes(AUDIO_CATALOG.music.volume, .1, .06);
  await audio.enable({ music: true });
  assert.equal(audio.diagnostics().gains.music, .68);
  assert.equal(audio.diagnostics().gains.ambience, .06);
  const entryGain = nodes.find(node => node.kind === "media-source").connections[0];
  assert.equal(entryGain.connections[0].gain.value, .68);
  assert.equal(players[0].volume, 1, "the native player must not multiply the stronger bus gain");
  audio.setVolumes(.68, .1, 0);
  assert.equal(audio.diagnostics().gains.music, .68);
  assert.equal(audio.diagnostics().thunder.gain, 0);
});

test("decoding keeps only the newest fresh strike and never releases a burst of old thunder", async t => {
  const gate = deferred();
  const { audio, contexts } = browser(t, { fetch: url => url === AUDIO_CATALOG.thunder.url ? gate.promise : new Promise(() => {}) });
  audio.setWeather("storm"); await audio.enable();
  for (const time of [0, 3, 6]) {
    contexts[0].currentTime = time;
    audio.thunder();
    assert.equal(audio.diagnostics().thunder.pending, 1);
  }
  contexts[0].currentTime = 6.4;
  gate.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(3) }); await flush();
  assert.equal(audio.diagnostics().thunder.pending, 0);
  assert.equal(audio.diagnostics().thunder.played, 1);
  assert.equal(audio.diagnostics().thunder.active, 1);
});

test("a stalled music player reports its own timeout and a late play cannot restore it", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gate=deferred();
  const { audio, players }=browser(t,{playGate:gate});
  await audio.enable({music:true});
  assert.equal(audio.diagnostics().status,"running");
  assert.equal(audio.diagnostics().music.status,"loading");
  t.mock.timers.tick(4000);
  assert.equal(audio.diagnostics().music.status,"loading", "music buffering does not use the four-second context deadline");
  t.mock.timers.tick(26000);
  assert.equal(audio.diagnostics().music.status,"error");
  assert.equal(audio.diagnostics().status,"running");
  gate.resolve(); await flush();
  assert.equal(players[0].paused,true);
  assert.equal(audio.diagnostics().music.status,"error");
});


test("the next track preloads silently and an eight-second network delay cannot kill the playlist", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio, players, nodes, options } = browser(t);
  await audio.enable({ music: true });
  const old = players[0], oldTitle = audio.diagnostics().music.title;
  old.currentTime = 60;
  old.listeners.get("timeupdate")();
  const prepared = players[1], preparedUrl = prepared.src;
  assert.equal(prepared.preload, "auto");
  assert.equal(prepared.loadCalls, 1);
  assert.equal(prepared.playCalls, 0, "preloading must not start audio");
  assert.equal(prepared.paused, true);
  assert.equal(nodes.filter(node => node.kind === "media-source").length, 1, "prepared media has no audible graph yet");
  assert.equal(audio.diagnostics().music.status, "playing");
  assert.equal(audio.diagnostics().music.title, oldTitle);
  const gate = deferred(); options.playGate = gate;
  old.currentTime = 118;
  old.listeners.get("timeupdate")();
  assert.equal(players.length, 2, "the transition reuses prepared media instead of restarting its download");
  assert.equal(prepared.src, preparedUrl);
  assert.equal(prepared.loadCalls, 1);
  t.mock.timers.tick(4000); await flush();
  assert.equal(audio.diagnostics().music.status, "loading");
  assert.equal(audio.diagnostics().music.error, null);
  assert.equal(audio.diagnostics().status, "running");
  old.currentTime = 120;
  old.listeners.get("ended")({ target: old });
  t.mock.timers.tick(4000); gate.resolve(); await flush();
  assert.equal(audio.diagnostics().music.status, "playing");
  assert.equal(audio.diagnostics().music.error, null);
  assert.equal(prepared.paused, false);
  prepared.currentTime = 1;
  assert.equal(audio.diagnostics().music.currentTime, 1);
  t.mock.timers.tick(2000);
  assert.equal(old.src, "");
  options.playGate = null;
  prepared.currentTime = 60;
  prepared.listeners.get("timeupdate")();
  assert.equal(players.length, 3, "the playlist can prepare another song after delayed playback succeeds");
  assert.equal(players[2].playCalls, 0);
});

test("hidden, mute and disposal cancel prepared media without losing its reserved shuffle position", async t => {
  const { audio, players, calls } = browser(t);
  await audio.enable({ music: true });
  players[0].currentTime = 60;
  players[0].listeners.get("timeupdate")();
  const queuedUrl = players[1].src;
  audio.visibility(true);
  assert.equal(players[1].src, "");
  assert.equal(players[1].playCalls, 0);
  audio.visibility(false); await flush();
  players[0].listeners.get("timeupdate")();
  assert.equal(players[2].src, queuedUrl, "an unplayed reservation returns to the front of the shuffle");
  audio.mute();
  assert.equal(players[2].src, "");
  const plays = calls.filter(call => call === "music.play").length;
  audio.visibility(false); await flush();
  assert.equal(calls.filter(call => call === "music.play").length, plays);
  await audio.enable({ music: true });
  players[0].listeners.get("timeupdate")();
  assert.equal(players[3].src, queuedUrl);
  audio.dispose();
  assert.ok(players.every(player => player.paused));
  assert.equal(players[3].src, "");
});

test("muting during a delayed prepared transition cancels its timer and late play promise", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio, players, options } = browser(t);
  await audio.enable({ music: true });
  players[0].currentTime = 60;
  players[0].listeners.get("timeupdate")();
  const gate = deferred(); options.playGate = gate;
  players[0].currentTime = 118;
  players[0].listeners.get("timeupdate")();
  audio.mute();
  t.mock.timers.tick(30000);
  gate.resolve(); await flush();
  assert.equal(players[1].paused, true);
  assert.equal(audio.diagnostics().music.status, "off");
  assert.equal(audio.diagnostics().music.error, null);
  assert.equal(audio.diagnostics().desired, false);
});

test("a real prepared-media error remains independent from functioning ambient audio", async t => {
  const { audio, players, options } = browser(t);
  await audio.enable({ music: true });
  players[0].currentTime = 60;
  players[0].listeners.get("timeupdate")();
  options.playError = new DOMException("Unsupported media", "NotSupportedError");
  players[0].currentTime = 118;
  players[0].listeners.get("timeupdate")();
  await flush();
  assert.equal(audio.diagnostics().music.status, "error");
  assert.equal(audio.diagnostics().music.error, "Unsupported media");
  assert.equal(audio.diagnostics().status, "running");
  assert.equal(audio.diagnostics().activeAmbience, 1);
});

test("a track transition can start after the context deadline without earlier progress events", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { audio, players, options } = browser(t);
  await audio.enable({ music: true });
  const gate = deferred(); options.playGate = gate;
  players[0].currentTime = 118;
  players[0].listeners.get("timeupdate")();
  t.mock.timers.tick(8000);
  gate.resolve(); await flush();
  assert.equal(audio.diagnostics().music.status, "playing");
  assert.equal(audio.diagnostics().music.error, null);
  assert.equal(players[1].paused, false);
});

test("an error received during preload is preserved when that player becomes current", async t => {
  const { audio, players } = browser(t);
  await audio.enable({ music: true });
  players[0].currentTime = 60;
  players[0].listeners.get("timeupdate")();
  players[1].error = { code: 2, message: "Network failure during preload" };
  players[0].currentTime = 118;
  players[0].listeners.get("timeupdate")();
  await flush();
  assert.equal(players[1].playCalls, 0);
  assert.equal(audio.diagnostics().music.status, "error");
  assert.match(audio.diagnostics().music.error, /música não pôde ser carregada/);
  assert.equal(audio.diagnostics().status, "running");
});

test("the entry cue is positioned on metadata before a gesture without allocating or playing audio", async t => {
  const { calls, players, contexts } = browser(t, { rejectSeekBeforeMetadata: true });
  assert.equal(players.length, 1);
  assert.equal(players[0].playCalls, 0);
  assert.equal(players[0].currentTime, 0);
  await flush();
  assert.equal(players[0].currentTime, AUDIO_CATALOG.playlist[0].startAtSeconds);
  assert.deepEqual(players[0].seekHistory, [45.65]);
  assert.equal(players[0].listeners.has("loadedmetadata"), false);
  assert.equal(contexts.length, 0);
  assert.equal(calls.includes("music.play"), false);
});

test("entry uses a 150ms fade and neither weather, tab recovery nor mute replay reset its position", async t => {
  const { audio, players, nodes } = browser(t);
  await audio.enable({ music: true });
  const player = players[0];
  const fade = nodes.find(node => node.kind === "media-source").connections[0];
  assert.deepEqual(fade.gain.automation.at(-1), ["linear", 1, .15]);
  assert.equal(player.currentTime, 45.65);
  player.currentTime = 72;
  const seeks = player.seekHistory.length;
  audio.setEnvironment("storm", "dusk");
  assert.equal(player.currentTime, 72);
  assert.equal(player.playCalls, 1);
  audio.visibility(true);
  audio.visibility(false);
  await flush();
  assert.equal(player.currentTime, 72);
  audio.mute();
  await audio.enable({ music: true });
  assert.equal(players.length, 1);
  assert.equal(player.currentTime, 72);
  assert.equal(player.seekHistory.length, seeks);
  player.currentTime = 118;
  player.listeners.get("timeupdate")();
  await flush();
  assert.equal(players[1].currentTime, 0, "the cue only applies to session entry, not the loop");
  assert.deepEqual(nodes.filter(node => node.kind === "media-source")[1].connections[0].gain.automation.at(-1), ["linear", 1, 2]);
});

test("a rejected first music gesture retries with the next track's own cue, while late metadata after disposal does nothing", async t => {
  const { audio, players, options } = browser(t, { playError: new DOMException("Blocked", "NotAllowedError") });
  await audio.enable({ music: true });
  await flush();
  assert.equal(audio.diagnostics().music.status, "error");
  options.playError = null;
  await audio.enable({ music: true });
  const retryTrack = AUDIO_CATALOG.playlist.find(track => track.url === players[1].src);
  assert.equal(players[1].currentTime, retryTrack.startAtSeconds);
  assert.deepEqual(players[1].seekHistory, retryTrack.startAtSeconds > 0 ? [retryTrack.startAtSeconds] : []);
  audio.dispose();
  assert.ok(players.every(player => !player.listeners.has("loadedmetadata")));
});

test("the entry seek tolerates delayed metadata and mute cancels the delayed playback", async t => {
  const gate = deferred();
  const { audio, players } = browser(t, { metadataPending: true, playGate: gate, rejectSeekBeforeMetadata: true });
  await audio.enable({ music: true });
  assert.equal(players[0].currentTime, 0);
  players[0].readyState = 1;
  players[0].listeners.get("loadedmetadata")();
  assert.equal(players[0].currentTime, 45.65);
  audio.mute();
  gate.resolve();
  await flush();
  assert.equal(players[0].paused, true);
  assert.equal(audio.diagnostics().music.status, "off");
});

test("the own thunder WAV is deterministic, compact PCM and retains its attack and quiet tail", async () => {
  const bytes = await readFile(new URL("../public" + AUDIO_CATALOG.thunder.url, import.meta.url));
  assert.equal(bytes.length, 297644);
  assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString(), "WAVE");
  assert.equal(bytes.readUInt16LE(20), 1);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt32LE(24), 24000);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), AUDIO_CATALOG.thunder.sha256);
  assert.ok(bytes.equals(createThunderWav()), "the generator must reproduce the shipped resource without FFmpeg");
  const samples = Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32767);
  const rms = (a, b) => Math.sqrt(samples.slice(a * 24000, b * 24000).reduce((sum, x) => sum + x * x, 0) / ((b - a) * 24000));
  assert.ok(rms(0, 1) > rms(5, 6) * 3);
  assert.ok(rms(0, 6) > .17 && rms(0, 6) < .22);
  assert.ok(samples.every(x => Number.isFinite(x) && Math.abs(x) <= .9501));
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 0);
});

test("activation prepares thunder once in the background and a strike never generates or decodes PCM", async t => {
  const { audio, calls, contexts, buffers, nodes } = browser(t, { thunderReady: true });
  audio.setVolumes(.28, .1, .06);
  audio.setEnvironment("storm", "day");
  assert.equal(calls.some(x => x.startsWith("fetch:")), false);
  const activation = audio.enable({ music: true });
  assert.equal(calls.filter(x => x === "fetch:" + AUDIO_CATALOG.thunder.url).length, 1);
  await activation; await flush();
  assert.equal(audio.diagnostics().thunder.status, "ready");
  assert.ok(Number.isFinite(audio.diagnostics().thunder.preparationMs));
  const samples = buffers.length, decodes = calls.filter(x => x === "decode").length;
  const random = t.mock.method(Math, "random", () => { throw new Error("No synthesis at strike time"); });
  for (const time of [0, 3, 6, 9.5, 16.5]) { contexts[0].currentTime = time; audio.thunder(); }
  random.mock.restore();
  assert.equal(buffers.length, samples);
  assert.equal(calls.filter(x => x === "decode").length, decodes);
  assert.equal(audio.diagnostics().thunder.played, 5, "every strike at the fastest jittered cadence receives a voice");
  assert.equal(audio.diagnostics().thunder.active, 2, "voices cannot accumulate even if an ended event is delayed");
  const source = nodes.filter(n => n.kind === "source").at(-1);
  const highpass = source.connections[0], lowpass = highpass.connections[0], gain = lowpass.connections[0], bus = gain.connections[0];
  assert.equal(highpass.frequency.value, 28);
  assert.equal(lowpass.type, "lowpass");
  assert.ok(Math.abs(bus.gain.value - .18) < 1e-12);
  assert.deepEqual(audio.diagnostics().gains, { effects: .1, ambience: .06, music: .28 });
  audio.setVolumes(.28, 0, .8);
  assert.equal(audio.diagnostics().thunder.gain, .6);
  assert.equal(bus.connections[0].kind, "analyser", "thunder is parallel to the continuous ambience");
  audio.setVolumes(.28, 0, 0);
  assert.equal(audio.diagnostics().thunder.active, 0);
  assert.equal(audio.diagnostics().thunder.gain, 0);
  assert.equal(source.stoppedAt, "immediate");
  audio.mute(); await audio.enable({ music: true });
  assert.equal(calls.filter(x => x === "fetch:" + AUDIO_CATALOG.thunder.url).length, 1);
});

test("a queued strike plays once after preparation and subsequent strikes reuse the decoded buffer", async t => {
  const gate = deferred();
  const { audio, contexts, calls } = browser(t, { fetch: url => url === AUDIO_CATALOG.thunder.url ? gate.promise : new Promise(() => {}) });
  audio.setWeather("storm"); await audio.enable();
  audio.thunder(); audio.thunder();
  assert.equal(audio.diagnostics().thunder.pending, 1);
  assert.equal(audio.diagnostics().thunder.played, 0);
  contexts[0].currentTime = .4;
  gate.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(3) }); await flush();
  assert.equal(audio.diagnostics().thunder.pending, 0);
  assert.equal(audio.diagnostics().thunder.played, 1);
  contexts[0].currentTime = 9; audio.thunder();
  assert.equal(audio.diagnostics().thunder.played, 2);
  assert.equal(calls.filter(x => x === "decode").length, 1);
});

test("pending thunder cannot return after mute, hiding, a front change, zero ambience or disposal", async t => {
  for (const action of ["mute", "hide", "weather", "zero", "dispose"]) await t.test(action, async t => {
    const gate = deferred();
    const { audio } = browser(t, { fetch: url => url === AUDIO_CATALOG.thunder.url ? gate.promise : new Promise(() => {}) });
    audio.setWeather("storm"); await audio.enable(); audio.thunder();
    assert.equal(audio.diagnostics().thunder.pending, 1);
    if (action === "hide") audio.visibility(true);
    else if (action === "weather") audio.setWeather("clear");
    else if (action === "zero") audio.setVolumes(.28, .1, 0);
    else audio[action]();
    gate.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(3) }); await flush();
    assert.equal(audio.diagnostics().thunder.pending, 0);
    assert.equal(audio.diagnostics().thunder.active, 0);
    assert.equal(audio.diagnostics().thunder.played, 0);
    if (action === "hide") { audio.visibility(false); await flush(); }
    else if (action === "mute") await audio.enable();
    else if (action === "weather") audio.setWeather("storm");
    else if (action === "zero") audio.setVolumes(.28, .1, .06);
    assert.equal(audio.diagnostics().thunder.played, 0, "restoration cannot resurrect the cancelled strike");
  });
});

test("active thunder is stopped by mute, tab hiding and leaving storm weather", async t => {
  for (const action of ["mute", "hide", "weather"]) await t.test(action, async t => {
    const { audio } = browser(t, { thunderReady: true });
    audio.setWeather("storm"); await audio.enable(); await flush(); audio.thunder();
    assert.equal(audio.diagnostics().thunder.active, 1);
    if (action === "hide") audio.visibility(true);
    else if (action === "weather") audio.setWeather("clear");
    else audio.mute();
    assert.equal(audio.diagnostics().thunder.active, 0);
  });
});

test("failed thunder preparation is independent and never retries on subsequent storms or gestures", async t => {
  const { audio, calls, contexts } = browser(t, { fetch: url => url === AUDIO_CATALOG.thunder.url ? Promise.resolve({ ok: false }) : new Promise(() => {}) });
  audio.setWeather("storm"); await audio.enable({ music: true }); await flush();
  assert.equal(audio.diagnostics().thunder.status, "error");
  assert.match(audio.diagnostics().thunder.error, /arquivo/);
  for (const time of [0, 9, 20]) { contexts[0].currentTime = time; audio.thunder(); }
  audio.setWeather("clear"); audio.setWeather("storm");
  audio.mute(); await audio.enable({ music: true });
  assert.equal(calls.filter(x => x === "fetch:" + AUDIO_CATALOG.thunder.url).length, 1);
  assert.equal(audio.diagnostics().status, "running");
  assert.equal(audio.diagnostics().music.status, "playing");
});

test("a thunder timeout releases pending events and late network data cannot play it", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gate = deferred();
  const { audio, calls } = browser(t, { fetch: url => url === AUDIO_CATALOG.thunder.url ? gate.promise : new Promise(() => {}) });
  audio.setWeather("storm"); await audio.enable(); audio.thunder();
  t.mock.timers.tick(15000); await flush();
  assert.equal(audio.diagnostics().thunder.status, "error");
  assert.equal(audio.diagnostics().thunder.pending, 0);
  gate.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(3) }); await flush();
  assert.equal(audio.diagnostics().thunder.played, 0);
  assert.equal(calls.includes("decode"), false);
  assert.equal(audio.diagnostics().status, "running");
});

test("decode errors fail softly and a queued event older than 750ms is discarded", async t => {
  await t.test("decoder", async t => {
    const { audio } = browser(t, { thunderReady: true, thunderDecodeError: new Error("Invalid WAV") });
    await audio.enable(); await flush();
    assert.equal(audio.diagnostics().thunder.status, "error");
    assert.equal(audio.diagnostics().thunder.error, "Invalid WAV");
    assert.equal(audio.diagnostics().status, "running");
  });
  await t.test("expired", async t => {
    const gate = deferred();
    const { audio, contexts } = browser(t, { fetch: url => url === AUDIO_CATALOG.thunder.url ? gate.promise : new Promise(() => {}) });
    audio.setWeather("storm"); await audio.enable(); audio.thunder();
    contexts[0].currentTime = .751;
    gate.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(3) }); await flush();
    assert.equal(audio.diagnostics().thunder.status, "ready");
    assert.equal(audio.diagnostics().thunder.played, 0);
    contexts[0].currentTime = 3;
    audio.thunder();
    assert.equal(audio.diagnostics().thunder.played, 1);
  });
});

test("an old decoder cannot overwrite a fresh context's prepared thunder", async t => {
  const gate = deferred();
  const { audio, contexts, options, nodes } = browser(t, { thunderReady: true, thunderDecodeGate: gate });
  audio.setWeather("storm"); await audio.enable(); await flush(); audio.thunder();
  const oldBuffer = contexts[0].createBuffer(1, 148800, 24000);
  contexts[0].setState("closed");
  options.thunderDecodeGate = null;
  await audio.enable(); await flush(); audio.thunder();
  assert.equal(audio.diagnostics().thunder.status, "ready");
  assert.equal(audio.diagnostics().thunder.played, 1);
  gate.resolve(oldBuffer); await flush();
  assert.equal(audio.diagnostics().thunder.status, "ready");
  assert.equal(audio.diagnostics().thunder.played, 1);
  assert.notEqual(nodes.filter(n => n.kind === "source").at(-1).buffer, oldBuffer);
});

test("a synchronous thunder fetch failure cannot abort normal audio activation", async t => {
  const { audio } = browser(t, { fetch: url => {
    if (url === AUDIO_CATALOG.thunder.url) throw new Error("Fetch unavailable");
    return new Promise(() => {});
  } });
  await audio.enable({ music: true });
  assert.equal(audio.diagnostics().thunder.status, "error");
  assert.equal(audio.diagnostics().status, "running");
  assert.equal(audio.diagnostics().music.status, "playing");
});

test("closing a context during decoding permits one fresh preparation on explicit reactivation", async t => {
  const gate = deferred();
  const { audio, contexts, options } = browser(t, { thunderReady: true, thunderDecodeGate: gate });
  await audio.enable(); await flush();
  const oldBuffer = contexts[0].createBuffer(1, 148800, 24000);
  contexts[0].setState("closed");
  gate.resolve(oldBuffer); await flush();
  assert.equal(audio.diagnostics().thunder.status, "idle");
  options.thunderDecodeGate = null;
  await audio.enable(); await flush();
  assert.equal(audio.diagnostics().thunder.status, "ready");
});

test('spatial ambience shares one gesture-owned context and follows camera position and orientation',async t=>{
  const {audio,contexts,nodes}=browser(t),frame=spatialFrame();
  audio.setSpatialScene(frame);assert.equal(contexts.length,0,'scene updates never unlock audio');
  await audio.enable({music:true});audio.setSpatialScene(frame);
  assert.equal(contexts.length,1);assert.ok(audio.diagnostics().spatial.waterfall);
  const panner=nodes.find(node=>node.kind==='panner');assert.equal(panner.panningModel,'HRTF');assert.equal(panner.distanceModel,'inverse');assert.ok(panner.rolloffFactor>0);
  assert.deepEqual([panner.positionX.value,panner.positionY.value,panner.positionZ.value],frame.waterfall.position);
  frame.listener=[-15,8,4];frame.forward=[1,0,0];audio.setSpatialScene(frame);
  assert.equal(contexts[0].listener.positionX.value,-15);assert.equal(contexts[0].listener.forwardX.value,1);
  assert.equal(panner.positionX.value,3,'turning the camera moves the listener, not the waterfall');
  for(const source of nodes.filter(node=>node.kind==='media-source'))assert.notEqual(source.connections[0]?.kind,'panner','music keeps its original stereo graph');
});

test('spatial fishing and water touches are short, bounded and cleared by mute or page visibility',async t=>{
  const {audio,contexts,nodes}=browser(t),frame=spatialFrame();audio.setSpatialScene(frame);await audio.enable({music:true});audio.setSpatialScene(frame);
  audio.playSpatial('fishing',[-5,-.16,4]);audio.playSpatial('water-touch',[2,-.16,-3]);
  assert.equal(audio.diagnostics().spatial.events,1,'a simultaneous duplicate event is throttled');
  const event=nodes.filter(node=>node.kind==='source'&&node.stoppedAt>0).at(-1);assert.ok(event.stoppedAt-event.startedAt<.3);
  contexts[0].currentTime=1;audio.playSpatial('water-touch',[2,-.16,-3]);assert.equal(audio.diagnostics().spatial.events,2);
  audio.visibility(true);assert.equal(audio.diagnostics().spatial.voices,0);assert.equal(audio.diagnostics().spatial.waterfall,false);
  const count=nodes.length;audio.playSpatial('fishing',[0,0,0]);audio.setSpatialScene(frame);assert.equal(nodes.length,count,'a hidden page cannot start voices');
  audio.visibility(false);await flush();audio.setSpatialScene(frame);assert.ok(audio.diagnostics().spatial.waterfall);
  frame.waterfall.flow=0;audio.setSpatialScene(frame);assert.equal(audio.diagnostics().spatial.waterfall,false,'flow ending releases the loop');
  audio.mute();assert.equal(audio.diagnostics().spatial.voices,0);audio.setSpatialScene(frame);assert.equal(audio.diagnostics().spatial.waterfall,false);
});

test('bird calls follow their actual moving emitters and are released when severe weather starts',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {audio,nodes}=browser(t,{fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})}),frame=spatialFrame();frame.waterfall.flow=0;audio.setSpatialScene(frame);await audio.enable({music:true});await flush();audio.setSpatialScene(frame);
  t.mock.timers.tick(10000);await flush();
  const panner=nodes.find(node=>node.kind==='panner');assert.ok(panner,'a decoded bird call has a positioned emitter');
  frame.birds=[[30,6,-12],[30,6,-12]];audio.setSpatialScene(frame);
  assert.equal(panner.positionX.value,30);assert.equal(panner.positionZ.value,-12);
  audio.setEnvironment('storm','day');assert.equal(audio.diagnostics().spatial.voices,0);
});
