import catalog from "../../../public/experience/audio/audio-manifest.json";
import type { AudioManifest } from "@/lib/experience-contract";
import type { EntryAudioBootstrap } from "@/lib/experience/early-audio-script";
import type {ScenicAudioFrame,ScenicSound} from './scene-signals';

type SoundName = "selection" | "arrival";
import type { Weather, WeatherPhase } from "@/lib/experience/weather.mjs";
type ActiveSound = { source: AudioScheduledSourceNode; cleanup: () => void };
type AudioEvent = { event: string; time: number; contextState: string; detail?: string };
export type AudioDiagnostics = {
  status: "off" | "starting" | "running" | "paused" | "interrupted" | "error" | "disposed";
  contextState: string;
  enabled: boolean;
  desired: boolean;
  hidden: boolean;
  weather: Weather;
  currentTime: number;
  sampleRate: number;
  gains: { effects: number; ambience: number; music: number };
  activeEffects: number;
  activeAmbience: number;
  rms: number;
  peak: number;
  signalDetected: boolean;
  lastError: string | null;
  lastTest: { rms: number; peak: number; samples: number; signalDetected: boolean } | null;
  recentEvents: AudioEvent[];
  phase: WeatherPhase;
  music: { status: "off" | "loading" | "playing" | "paused" | "error"; title: string | null; currentTime: number; duration: number; error: string | null; rms: number; peak: number; signalDetected: boolean; metered: boolean };
  thunder: { status: "idle" | "loading" | "ready" | "error"; preparationMs: number | null; error: string | null; pending: number; active: number; gain: number; played: number };
  spatial: {voices:number;waterfall:boolean;events:number;listener:number[]|null};

};

/** The gesture sees the complete catalog synchronously; no legacy fallback can race a fetch. */
export const AUDIO_CATALOG = catalog;
const CROSSFADE_SECONDS = 2;
const ENTRY_FADE_SECONDS = .15;
export function shuffledMusicOrder(count: number, previous = -1, random = Math.random): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [order[index], order[other]] = [order[other], order[index]];
  }
  if (order.length > 1 && order[0] === previous) [order[0], order[1]] = [order[1], order[0]];
  return order;
}
const START_TIMEOUT_MS = 4000;
// Media may need network buffering; resuming the audio context does not.
const MUSIC_START_TIMEOUT_MS = 30000;
const MUSIC_PRELOAD_SECONDS = 60;
const SIGNAL_THRESHOLD = .0001;
const THUNDER_PREPARE_TIMEOUT_MS = 15000;
// Scene events are >=3s apart after their 0.28–0.78s acoustic-delay jitter.
const THUNDER_MIN_INTERVAL_SECONDS = 2.9;
const THUNDER_PENDING_SECONDS = .75;
const cancelled = () => new DOMException("Início do áudio cancelado", "AbortError");
const volume = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const outputError = () => new Error("A saída de áudio foi interrompida. Toque em ativar ou testar som para retomar.");

/** Gesture-sensitive start, interruption recovery and independent music/ambient buses. */
export class ExperienceAudio {
  private context: AudioContext | null = null;
  private manifest: AudioManifest = AUDIO_CATALOG;
  private buffers = new Map<string, AudioBuffer>();
  private bufferLoads = new Map<string, Promise<AudioBuffer>>();
  private music: HTMLAudioElement | null = null;
  private musicIndex = -1;
  private musicOrder: number[] = [];
  private musicStatus: AudioDiagnostics["music"]["status"] = "off";
  private musicError: string | null = null;
  private musicBus: GainNode | null = null;
  private musicAnalyser: AnalyserNode | null = null;
  private musicMeter: Float32Array<ArrayBuffer> | null = null;
  private mediaNodes = new Map<HTMLAudioElement, { source: MediaElementAudioSourceNode; gain: GainNode }>();
  private nativeFades = new Map<HTMLAudioElement, ReturnType<typeof setTimeout>>();
  private retiringMusic: HTMLAudioElement | null = null;
  private preparedMusic: { player: HTMLAudioElement; index: number } | null = null;
  private entryMusic: { player: HTMLAudioElement; index: number } | null = null;
  private entryCueConsumed = false;
  private earlyEntry: EntryAudioBootstrap | null = null;
  private disposing = false;
  private entryCueListeners = new Map<HTMLAudioElement, () => void>();
  private crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  private musicStartTimer: ReturnType<typeof setTimeout> | null = null;
  private musicEpoch = 0;
  private transitioning = false;
  private phase: WeatherPhase = "day";
  private birdIndex = -1;
  private currentMusicUrl: string | null = null;
  private musicEnabled = false;
  private effectGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private thunderBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private meterData: Float32Array<ArrayBuffer> | null = null;
  private effects = new Set<ActiveSound>();
  private ambience = new Set<ActiveSound>();
  private spatialFrame: ScenicAudioFrame | null = null;
  private spatialVoices = new Map<PannerNode,{bird:number|null;position:[number,number,number]}>();
  private waterfallVoice: {sound:ActiveSound;gain:GainNode} | null = null;
  private spatialEvents=0;
  private lastSpatialEventAt=-Infinity;
  private birdTimer: ReturnType<typeof setTimeout> | null = null;
  private noiseBuffers = new Map<"rain" | "wind" | "water", AudioBuffer>();
  private thunderSample: AudioBuffer | null = null;
  private thunderStatus: AudioDiagnostics["thunder"]["status"] = "idle";
  private thunderError: string | null = null;
  private thunderPreparationMs: number | null = null;
  private thunderPreparationEpoch = 0;
  private thunderController: AbortController | null = null;
  private thunderTimer: ReturnType<typeof setTimeout> | null = null;
  private thunderEpoch = 0;
  private pendingThunder: { context: AudioContext; epoch: number; at: number }[] = [];
  private thunderVoices = new Set<ActiveSound>();
  private thunderPlayed = 0;
  private controller = new AbortController();
  private startController: AbortController | null = null;
  private recoveryController: AbortController | null = null;
  private disposed = false;
  private desired = false;
  private hidden = false;
  private attempt = 0;
  private visibilityEpoch = 0;
  private starting: Promise<void> | null = null;
  private activating = false;
  private feedbackPending = false;
  private weather: Weather = "clear";
  private lastThunderAt = Number.NEGATIVE_INFINITY;
  private musicVolume = AUDIO_CATALOG.music.volume;
  private effectsVolume = .55;
  private ambienceVolume = .36;
  private events: AudioEvent[] = [];
  private testControllers = new Set<AbortController>();
  private lastTest: AudioDiagnostics["lastTest"] = null;
  enabled = false;
  lastError: string | null = null;
  onStateChange: ((enabled: boolean, error: string | null) => void) | null = null;

  constructor(private random = Math.random) {
    // A download and a metadata seek are silent. Only enable() may request play.
    if (typeof Audio === "undefined") return;
    const early = typeof window !== "undefined" ? window.__tccEntryAudio : null;
    if (early) {
      this.earlyEntry = early;
      const player = early.claim(this);
      const index = early.trackIndex;
      this.musicIndex = index;
      this.musicOrder = shuffledMusicOrder(AUDIO_CATALOG.playlist.length, index, this.random).filter(item => item !== index);
      this.entryMusic = { player, index };
      this.entryCueConsumed = early.status === "playing" || player.currentTime > AUDIO_CATALOG.playlist[index].startAtSeconds;
      this.record("music-entry-adopted", `${player.currentTime.toFixed(2)}s`);
      return;
    }
    const index = this.nextMusicIndex(false);
    const player = this.createMusicPlayer(index, true);
    this.entryMusic = { player, index };
    this.record("music-entry-preloading", AUDIO_CATALOG.playlist[index].title);
  }

  private createMusicPlayer(index: number, entry = false) {
    const track = AUDIO_CATALOG.playlist[index];
    const player = new Audio(track.url);
    player.preload = "auto";
    player.loop = false;
    if (entry && !this.entryCueConsumed && Number.isFinite(track.startAtSeconds) && track.startAtSeconds > 0) {
      const position = () => {
        if (this.disposed || this.entryCueConsumed) {
          player.removeEventListener("loadedmetadata", position);
          this.entryCueListeners.delete(player);
          return;
        }
        const duration = player.duration;
        const cue = Number.isFinite(duration) && duration > 0 ? Math.min(track.startAtSeconds, Math.max(0, duration - CROSSFADE_SECONDS)) : track.startAtSeconds;
        try {
          player.currentTime = cue;
          player.removeEventListener("loadedmetadata", position);
          this.entryCueListeners.delete(player);
          this.record("music-entry-positioned", cue.toFixed(2));
        } catch { /* Some engines require metadata before the initial seek. */ }
      };
      this.entryCueListeners.set(player, position);
      player.addEventListener("loadedmetadata", position);
      // readyState=0 has no seekable media; loadedmetadata runs before playback.
      if (player.readyState >= 1) position();
    }
    player.load();
    return player;
  }

  async credits(): Promise<AudioManifest> {
    if (this.disposed) throw cancelled();
    return this.manifest;
  }

  private buffer(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url);
    if (cached) return Promise.resolve(cached);
    const loading = this.bufferLoads.get(url);
    if (loading) return loading;
    const context = this.context;
    if (!context || this.disposed) return Promise.reject(cancelled());
    const promise = fetch(url, { signal: this.controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Efeito sonoro indisponível");
      const bytes = await response.arrayBuffer();
      if (this.disposed || this.context !== context) throw cancelled();
      const decoded = await context.decodeAudioData(bytes);
      if (this.disposed || this.context !== context || context.state === "closed") throw cancelled();
      this.buffers.set(url, decoded);
      return decoded;
    }).finally(() => { this.bufferLoads.delete(url); });
    this.bufferLoads.set(url, promise);
    return promise;
  }
  private loadEffects() {
    // Downloads never gate the activation cue or synthesized clicks.
    void this.credits().then(manifest => Promise.allSettled([
      this.buffer(manifest.selection.url), this.buffer(manifest.arrival.url), ...AUDIO_CATALOG.birds.map(bird => this.buffer(bird.url)),
    ])).catch(() => {});
  }

  private record(event: string, detail?: string) {
    this.events.push({ event, time: Date.now(), contextState: this.context?.state ?? "unallocated", ...(detail ? { detail } : {}) });
    if (this.events.length > 16) this.events.shift();
  }
  private createContext() {
    if (this.context && this.context.state !== "closed") return;
    if (this.context) this.context.removeEventListener("statechange", this.contextChanged);
    if (this.thunderStatus === "loading") {
      this.thunderPreparationEpoch++;
      this.thunderController?.abort();
      if (this.thunderTimer) clearTimeout(this.thunderTimer);
      this.thunderTimer = null;
      this.thunderStatus = "idle";
    }
    const Context = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) throw new Error("Este navegador não oferece saída de áudio Web Audio.");
    this.context = new Context({ latencyHint: "interactive" });
    this.context.addEventListener("statechange", this.contextChanged);
    this.effectGain?.disconnect();
    this.ambientGain?.disconnect();
    this.analyser?.disconnect();
    this.effectGain = this.context.createGain();
    this.ambientGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.meterData = new Float32Array(this.analyser.fftSize);
    // Parallel buses: ambience is not multiplied by the effects gain a second time.
    this.effectGain.gain.value = this.effectsVolume;
    this.ambientGain.gain.value = this.ambienceVolume;
    this.effectGain.connect(this.analyser);
    this.ambientGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.musicBus?.disconnect();
    this.musicAnalyser?.disconnect();
    this.musicBus = this.context.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicAnalyser = this.context.createAnalyser();
    this.musicAnalyser.fftSize = 2048;
    this.musicAnalyser.smoothingTimeConstant = 0;
    this.musicMeter = new Float32Array(this.musicAnalyser.fftSize);
    this.musicBus.connect(this.musicAnalyser);
    this.musicAnalyser.connect(this.analyser);
    this.thunderBus?.disconnect();
    this.thunderBus = this.context.createGain();
    this.thunderBus.gain.value = this.thunderLevel();
    this.thunderBus.connect(this.analyser);
    // A closed graph cannot reuse media source nodes; recreate its player.
    if (this.mediaNodes.size) {
      for (const [player, graph] of this.mediaNodes) { player.pause(); graph.source.disconnect(); graph.gain.disconnect(); }
      this.mediaNodes.clear(); this.releasePlayer(this.music); this.music = null;
    }
    this.noiseBuffers.clear();
    this.lastThunderAt = Number.NEGATIVE_INFINITY;
    this.record("context-created");
  }
  private nextMusicIndex(commit = true) {
    if (!this.musicOrder.length) this.musicOrder = shuffledMusicOrder(AUDIO_CATALOG.playlist!.length, this.musicIndex, this.random);
    const index = this.musicOrder.shift()!;
    if (commit) this.musicIndex = index;
    return index;
  }
  private prepareNextMusic() {
    if (this.preparedMusic || this.transitioning || !this.musicEnabled || !this.canPlay()) return;
    const index = this.nextMusicIndex(false);
    const player = this.createMusicPlayer(index);
    this.preparedMusic = { player, index };
    // Fetch/decode ahead without play() or a connection to the audible graph.
    this.record("music-preloading", AUDIO_CATALOG.playlist![index].title);
  }
  private attachPlayer(player: HTMLAudioElement) {
    const context = this.context!;
    // MediaElementSource permanently binds an element to one context. Keeping
    // the SSR player native permits cleanup/remount without a second download.
    if (player === this.earlyEntry?.element) player.volume = this.musicVolume;
    // Browsers support this; the optional guard permits lifecycle-only test doubles.
    else if (context.createMediaElementSource && this.musicBus) {
      const source = context.createMediaElementSource(player);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain); gain.connect(this.musicBus);
      this.mediaNodes.set(player, { source, gain });
      player.volume = 1; // Volume is applied once, in the music bus.
    } else player.volume = this.musicVolume;
    player.loop = false; player.preload = "auto";
    player.addEventListener("error", this.musicFailed);
    player.addEventListener("ended", this.musicEnded);
    player.addEventListener("timeupdate", this.musicProgress);
  }
  private prepareMusic() {
    if (!this.musicEnabled) { this.pauseMusic(); this.musicStatus = "off"; return; }
    if (!this.music || this.musicError) {
      const nativeRetry = this.music === this.earlyEntry?.element ? this.music : null;
      this.releasePlayer(this.music);
      const entry = this.entryMusic ?? (nativeRetry ? { player: nativeRetry, index: this.earlyEntry!.trackIndex } : null);
      this.entryMusic = null;
      this.musicIndex = entry?.index ?? this.nextMusicIndex();
      const track = AUDIO_CATALOG.playlist![this.musicIndex];
      this.music = entry?.player ?? this.createMusicPlayer(this.musicIndex, true);
      this.currentMusicUrl = track.url;
      this.attachPlayer(this.music);
    }
    this.musicError = null; this.musicStatus = "loading";
  }
  private fadePlayer(player: HTMLAudioElement, target: number, seconds = CROSSFADE_SECONDS) {
    const gain = this.mediaNodes.get(player)?.gain;
    if (!gain || !this.context) {
      this.cancelNativeFade(player);
      if (player === this.earlyEntry?.element && seconds === CROSSFADE_SECONDS) {
        const start = Date.now(), from = player.volume;
        const tick = () => {
          if (!this.desired || this.disposed || this.isHidden() || this.earlyEntry?.owner !== this) { this.cancelNativeFade(player); return; }
          const progress = Math.min(1, (Date.now() - start) / (seconds * 1000));
          player.volume = from + (target * this.musicVolume - from) * progress;
          if (progress < 1) this.nativeFades.set(player, setTimeout(tick, 30));
          else this.nativeFades.delete(player);
        };
        tick();
      } else player.volume = target * this.musicVolume;
      return;
    }
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(target, now + seconds);
  }
  private releasePlayer(player: HTMLAudioElement | null) {
    if (!player) return;
    this.cancelNativeFade(player);
    const reowned = player === this.earlyEntry?.element && this.earlyEntry.owner !== this;
    if (!reowned) player.pause();
    player.removeEventListener("error", this.musicFailed);
    player.removeEventListener("ended", this.musicEnded);
    player.removeEventListener("timeupdate", this.musicProgress);
    const cueListener = this.entryCueListeners.get(player);
    if (cueListener) player.removeEventListener("loadedmetadata", cueListener);
    this.entryCueListeners.delete(player);
    if (reowned) return;
    if (player !== this.earlyEntry?.element) { player.removeAttribute("src"); player.load(); }
    const graph = this.mediaNodes.get(player);
    graph?.source.disconnect(); graph?.gain.disconnect(); this.mediaNodes.delete(player);
  }
  private pauseMusic() {
    this.musicEpoch++;
    for (const player of this.nativeFades.keys()) this.cancelNativeFade(player);
    if (this.preparedMusic) {
      this.musicOrder.unshift(this.preparedMusic.index);
      this.releasePlayer(this.preparedMusic.player);
      this.preparedMusic = null;
    }
    if (this.musicStartTimer) clearTimeout(this.musicStartTimer);
    this.musicStartTimer = null;
    if (this.crossfadeTimer) clearTimeout(this.crossfadeTimer);
    this.crossfadeTimer = null; this.transitioning = false;
    this.releasePlayer(this.retiringMusic); this.retiringMusic = null;
    if (this.music !== this.earlyEntry?.element || this.earlyEntry.owner === this) this.music?.pause();
    if (this.music && this.context) {
      const gain = this.mediaNodes.get(this.music)?.gain;
      gain?.gain.cancelScheduledValues(this.context.currentTime);
      gain?.gain.setValueAtTime(0, this.context.currentTime);
    }
    if (this.musicEnabled && !this.musicError) this.musicStatus = "paused";
  }
  private cancelNativeFade(player: HTMLAudioElement) {
    const timer = this.nativeFades.get(player);
    if (timer !== undefined) clearTimeout(timer);
    this.nativeFades.delete(player);
  }
  private playMusic(fadeSeconds = ENTRY_FADE_SECONDS): Promise<void> {
    const player = this.music;
    if (!player || !this.musicEnabled) return Promise.resolve();
    const epoch = ++this.musicEpoch;
    this.musicStatus = "loading";
    let output: Promise<void>;
    try {
      output = player === this.earlyEntry?.element
        ? !player.paused ? Promise.resolve() : this.earlyEntry.pending ?? player.play()
        : player.play();
    } catch (error) { output = Promise.reject(error); }
    if (this.musicStartTimer) clearTimeout(this.musicStartTimer);
    this.musicStartTimer = setTimeout(() => {
      if (epoch === this.musicEpoch && this.desired && !this.isHidden() && !this.disposed) this.musicProblem(new Error("A música demorou para iniciar. Toque em ativar som para tentar novamente."));
    }, MUSIC_START_TIMEOUT_MS);
    return output.then(() => {
      if (player === this.earlyEntry?.element && this.earlyEntry.owner !== this) return;
      if (epoch !== this.musicEpoch) { if (player !== this.music || !this.desired || this.disposed || this.isHidden() || this.musicError) player.pause(); return; }
      if (!this.desired || this.disposed || this.isHidden() || !this.musicEnabled) { player.pause(); return; }
      if (this.musicStartTimer) clearTimeout(this.musicStartTimer);
      this.musicStartTimer = null;
      this.musicStatus = "playing"; this.musicError = null;
      if (player === this.earlyEntry?.element) this.earlyEntry.status = "playing";
      this.entryCueConsumed = true;
      this.fadePlayer(player, 1, fadeSeconds);
      this.record("music-playing", AUDIO_CATALOG.playlist![this.musicIndex]?.title);
    }).catch(error => { if (epoch === this.musicEpoch && this.desired && !this.disposed) this.musicProblem(error); });
  }
  private musicProblem(error: unknown) {
    this.musicError = error instanceof Error ? error.message : "A música não pôde ser carregada.";
    this.musicStatus = "error";
    this.pauseMusic();
    this.record("music-error", this.musicError);
    this.onStateChange?.(this.enabled, null);
  }
  private musicProgress = () => {
    const player = this.music;
    if (!player || !Number.isFinite(player.duration) || player.duration <= CROSSFADE_SECONDS) return;
    const remaining = player.duration - player.currentTime;
    if (remaining <= MUSIC_PRELOAD_SECONDS) this.prepareNextMusic();
    if (remaining <= CROSSFADE_SECONDS) this.advanceMusic();
  };
  private advanceMusic() {
    if (this.transitioning || !this.canPlay() || !this.musicEnabled || !this.music) return;
    const old = this.music;
    this.transitioning = true;
    const prepared = this.preparedMusic;
    this.preparedMusic = null;
    this.musicIndex = prepared?.index ?? this.nextMusicIndex();
    const track = AUDIO_CATALOG.playlist![this.musicIndex];
    const next = prepared?.player ?? this.createMusicPlayer(this.musicIndex);
    this.attachPlayer(next); this.music = next; this.currentMusicUrl = track.url;
    this.retiringMusic = old;
    // A preload error can precede attachment of the current-player listeners.
    if (next.error) { this.musicFailed(); return; }
    const epoch = this.musicEpoch;
    void this.playMusic(CROSSFADE_SECONDS).then(() => {
      if (epoch + 1 !== this.musicEpoch || !this.canPlay()) return;
      if (this.musicError) { this.releasePlayer(old); this.retiringMusic = null; this.transitioning = false; return; }
      this.fadePlayer(old, 0);
      this.crossfadeTimer = setTimeout(() => {
        this.releasePlayer(old);
        if (this.retiringMusic === old) this.retiringMusic = null;
        this.crossfadeTimer = null; this.transitioning = false;
      }, CROSSFADE_SECONDS * 1000);
    });
  }

  /** Call from the actual click handler, before any await or network request. */
  enable(options: { music?: boolean } = {}): Promise<void> {
    if (this.disposed) return Promise.reject(cancelled());
    if (this.earlyEntry && this.earlyEntry.owner !== this) return Promise.reject(cancelled());
    if (this.starting && this.desired) return this.starting;
    if (this.enabled && this.context?.state === "running" && !this.isHidden() && !this.musicError && this.musicEnabled === (options.music === true)) return Promise.resolve();
    this.recoveryController?.abort();
    this.recoveryController = null;
    const attempt = ++this.attempt;
    this.desired = true;
    this.earlyEntry?.setEnabled(true);
    this.musicEnabled = options.music === true;
    this.feedbackPending = true;
    this.lastError = null;
    this.lastTest = null;
    this.activating = true;
    const controller = new AbortController();
    this.startController = controller;
    let requests: Promise<unknown>[];
    try {
      this.createContext();
      this.prepareMusic();
      // Activation-sensitive calls occur in this gesture before assets or React.
      requests = this.requestOutput();
      this.prepareThunder();
    } catch (error) { this.activating = false; return this.fail(error) ? Promise.resolve() : Promise.reject(error); }
    this.record("enable-requested");
    const promise = this.waitForOutput(requests, controller.signal).then(() => {
      if (this.disposed || !this.desired || attempt !== this.attempt) throw cancelled();
      if (this.context?.state === "closed" || (!this.isHidden() && this.context?.state !== "running")) throw outputError();
      this.enabled = true;
      this.loadEffects();
      if (this.isHidden()) this.pauseOutput();
      else this.beginOutput();
      this.record("enabled");
      this.onStateChange?.(true, null);
    }).catch(error => {
      if (attempt === this.attempt && !this.disposed && this.desired && this.fail(error)) return;
      throw error;
    }).finally(() => {
      if (this.starting === promise) this.starting = null;
      if (this.startController === controller) this.startController = null;
      if (attempt === this.attempt) this.activating = false;
    });
    this.starting = promise;
    return promise;
  }

  private requestOutput(): Promise<unknown>[] {
    const context = this.context!;
    const resume = context.resume().then(() => {
      // Pending browser promises can finish after mute/dispose or a tab switch.
      if (!this.desired || this.disposed || this.isHidden()) this.suspend(context);
    });
    // Music failure is independent from the Web Audio resume and ambience.
    void this.playMusic();
    return [resume];
  }
  private waitForOutput(requests: Promise<unknown>[], signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (error?: unknown) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(cancelled());
      const timer = setTimeout(() => {
        // Switching to external music pauses output without revoking consent.
        if (this.isHidden()) { this.record("start-paused-hidden"); finish(); }
        else finish(new Error("O navegador não iniciou o áudio. Toque em testar som para tentar novamente."));
      }, START_TIMEOUT_MS);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      void Promise.all(requests).then(() => finish(), error => {
        if (this.isHidden() && error instanceof Error && error.name === "NotAllowedError") finish();
        else finish(error);
      });
    });
  }
  private isHidden() { return this.hidden || (typeof document !== "undefined" && document.hidden); }
  private suspend(context = this.context) {
    if (context && context.state !== "closed") void context.suspend().catch(() => {});
  }
  private pauseOutput() {
    this.pauseMusic();
    this.stopSounds(this.effects);
    this.stopAtmosphere();
    this.suspend();
  }
  private beginOutput() {
    this.startAtmosphere();
    if (this.musicEnabled && this.music?.paused && this.musicStatus === "paused" && !this.musicError) void this.playMusic();
    if (this.feedbackPending && this.effectsVolume > 0) { this.feedbackPending = false; this.playCue(); }
  }
  private contextChanged = () => {
    if (this.disposed || !this.context) return;
    this.record("context-statechange");
    if (!this.desired) {
      if (this.context.state === "running") this.suspend();
      return;
    }
    if (this.activating || this.starting || this.recoveryController || this.isHidden()) return;
    if (this.context.state === "running") {
      this.enabled = true;
      this.lastError = null;
      this.beginOutput();
      this.onStateChange?.(true, null);
    } else this.reportInterruption(outputError());
  };
  private musicFailed = (event?: Event) => {
    if (!this.desired || this.disposed || !this.musicEnabled || event?.target && event.target !== this.music) return;
    this.musicProblem(new Error("A música não pôde ser carregada. O ambiente continua disponível."));
  };
  private musicEnded = (event?: Event) => {
    if (event?.target && event.target !== this.music) return;
    if (!this.canPlay() && this.music === this.earlyEntry?.element && this.earlyEntry.owner === this && this.desired && this.musicEnabled && !this.isHidden() && !this.disposed) {
      this.musicIndex = this.nextMusicIndex();
      this.currentMusicUrl = AUDIO_CATALOG.playlist[this.musicIndex].url;
      this.earlyEntry.rememberTrack(this.musicIndex, 0);
      void this.playMusic();
      return;
    }
    this.advanceMusic();
  };
  nextTrack() {
    if (!this.desired || !this.musicEnabled || this.disposed || this.isHidden() || this.transitioning) return;
    this.musicEnded();
  }
  private retainNativeMusic(error: unknown) {
    const early = this.earlyEntry;
    if (!early || early.owner !== this || !this.desired || !this.musicEnabled || this.isHidden() || early.element.paused) return false;
    if (!this.music) {
      this.music = early.element; this.musicIndex = early.trackIndex;
      this.entryMusic = null; this.currentMusicUrl = AUDIO_CATALOG.playlist[early.trackIndex].url;
      this.attachPlayer(this.music);
    }
    this.enabled = false;
    this.musicStatus = "playing";
    this.lastError = error instanceof Error ? error.message : outputError().message;
    this.stopSounds(this.effects); this.stopAtmosphere();
    if (this.context?.state === "running") this.suspend();
    this.record("native-music-retained", this.lastError);
    this.onStateChange?.(true, null);
    return true;
  }
  private fail(error: unknown) {
    if (this.retainNativeMusic(error)) return true;
    this.desired = false;
    this.enabled = false;
    this.pauseOutput();
    this.lastError = error instanceof Error && error.name !== "AbortError" ? error.message : null;
    this.record("failed", this.lastError ?? "cancelled");
    this.onStateChange?.(false, this.lastError);
    return false;
  }
  private reportInterruption(error: unknown) {
    if (this.retainNativeMusic(error)) return;
    // Preserve consent for automatic restoration or a fresh activation gesture.
    this.enabled = false;
    this.pauseMusic();
    this.stopSounds(this.effects);
    this.stopAtmosphere();
    this.lastError = error instanceof Error ? error.message : outputError().message;
    this.record("output-interrupted", this.lastError);
    this.onStateChange?.(false, this.lastError);
  }

  mute() {
    if (!this.disposing && this.earlyEntry?.owner === this) this.earlyEntry.setEnabled(false);
    this.attempt += 1;
    this.visibilityEpoch += 1;
    this.desired = false;
    this.enabled = false;
    this.startController?.abort();
    this.recoveryController?.abort();
    this.startController = null;
    this.recoveryController = null;
    this.starting = null;
    this.activating = false;
    this.feedbackPending = false;
    this.lastError = null;
    for (const controller of this.testControllers) controller.abort();
    this.testControllers.clear();
    this.pauseOutput();
    this.record("muted");
    this.onStateChange?.(false, null);
  }
  /** Independent buses; an optional transition gently ducks music during reading. */
  setVolumes(music: number, effects: number, ambience = effects * .65, transitionSeconds = 0) {
    for (const player of this.nativeFades.keys()) this.cancelNativeFade(player);
    this.musicVolume = volume(music);
    this.effectsVolume = volume(effects);
    this.ambienceVolume = volume(ambience);
    for (const player of [this.music, this.retiringMusic]) if (player && !this.mediaNodes.has(player) && (player !== this.earlyEntry?.element || this.earlyEntry.owner === this)) {
      const target = player === this.retiringMusic ? 0 : this.musicVolume;
      if (transitionSeconds > 0 && !player.paused) {
        const from = player.volume, started = Date.now();
        const tick = () => {
          if (this.disposed || !this.desired || this.isHidden()) { this.cancelNativeFade(player); return; }
          const t = Math.min(1, (Date.now() - started) / (transitionSeconds * 1000));
          player.volume = from + (target - from) * t;
          if (t < 1) this.nativeFades.set(player, setTimeout(tick, 30)); else this.nativeFades.delete(player);
        };
        tick();
      } else player.volume = target;
    }
    if (this.context && this.context.state !== "closed") {
      for (const [node, value] of [[this.effectGain, this.effectsVolume], [this.ambientGain, this.ambienceVolume], [this.musicBus, this.musicVolume], [this.thunderBus, this.thunderLevel()]] as const) {
        if (!node) continue;
        node.gain.cancelScheduledValues(this.context.currentTime);
        node.gain.setTargetAtTime(value, this.context.currentTime, node === this.musicBus && transitionSeconds > 0 ? transitionSeconds / 3 : .04);
      }
    }
    if (!this.ambienceVolume) this.stopThunder();
    this.record("volumes-changed");
  }
  play(name: SoundName) {
    if (!this.canPlay() || !this.effectGain || !this.effectsVolume) return;
    const item = this.manifest?.[name];
    const buffer = item && this.buffers.get(item.url);
    if (!buffer) { this.playSynth(name); return; }
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      for (const sample of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
    }
    // Effectively silent downloaded samples retain the reliable synth fallback.
    if (peak < .001) { this.playSynth(name); return; }
    const source = this.context!.createBufferSource();
    const gain = this.context!.createGain();
    gain.gain.value = Math.min(4, .55 / peak) * Math.min(1, Math.max(.5, (item.volume ?? .08) / .08));
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.effectGain);
    this.track(source, [gain], this.effects);
    source.start(this.context!.currentTime + .02);
  }
  private canPlay() { return this.enabled && this.desired && !this.isHidden() && this.context?.state === "running" && !this.disposed; }

  private thunderLevel() { return Math.min(.6, this.ambienceVolume * 3); }
  private canThunder() { return this.canPlay() && this.ambienceVolume > 0 && ["storm", "hail"].includes(this.weather); }

  private prepareThunder() {
    const item = this.manifest.thunder, context = this.context;
    if (!item || !context || this.disposed || this.thunderStatus !== "idle") return;
    this.thunderStatus = "loading";
    this.thunderError = null;
    const epoch = ++this.thunderPreparationEpoch;
    const controller = new AbortController();
    this.thunderController = controller;
    const started = performance.now();
    const valid = () => !this.disposed && epoch === this.thunderPreparationEpoch && this.context === context;
    const fail = (error: unknown) => {
      if (!valid() || this.thunderStatus !== "loading") return;
      if (context.state === "closed") { this.thunderStatus = "idle"; this.stopThunder(); return; }
      this.thunderStatus = "error";
      this.thunderError = error instanceof Error ? error.message : "Trovão indisponível";
      this.thunderPreparationMs = Math.round(performance.now() - started);
      this.stopThunder();
      this.record("thunder-preparation-error", this.thunderError);
    };
    const timer = setTimeout(() => {
      fail(new Error("O trovão não ficou pronto no prazo de 15 segundos."));
      controller.abort();
    }, THUNDER_PREPARE_TIMEOUT_MS);
    this.thunderTimer = timer;
    this.record("thunder-preparing");
    let request: Promise<Response>;
    try { request = fetch(item.url, { signal: controller.signal }); }
    catch (error) { fail(error); clearTimeout(timer); this.thunderTimer = null; return; }
    void request.then(async response => {
      if (!response.ok) throw new Error("O arquivo de trovão não pôde ser carregado.");
      const bytes = await response.arrayBuffer();
      if (!valid() || controller.signal.aborted) throw cancelled();
      const decoded = await context.decodeAudioData(bytes);
      if (!valid() || controller.signal.aborted || context.state === "closed") throw cancelled();
      if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) throw new Error("O arquivo de trovão não contém áudio válido.");
      this.thunderSample = decoded;
      this.thunderStatus = "ready";
      this.thunderPreparationMs = Math.round(performance.now() - started);
      this.record("thunder-ready", `${this.thunderPreparationMs}ms`);
      const pending = this.pendingThunder.splice(0);
      for (const request of pending) {
        if (request.epoch !== this.thunderEpoch || request.context !== context || !this.canThunder()) continue;
        if (context.currentTime - request.at > THUNDER_PENDING_SECONDS) { this.record("thunder-expired"); continue; }
        this.playPreparedThunder(decoded);
      }
    }).catch(fail).finally(() => {
      clearTimeout(timer);
      if (this.thunderTimer === timer) this.thunderTimer = null;
      if (this.thunderController === controller) this.thunderController = null;
    });
  }

  /** The scene supplies the acoustic delay. This event never synthesizes PCM. */
  thunder() {
    const context = this.context;
    if (!context || !this.canThunder() || !this.thunderBus) return;
    const now = context.currentTime + .02;
    if (now - this.lastThunderAt < THUNDER_MIN_INTERVAL_SECONDS) return;
    this.lastThunderAt = now;
    if (this.thunderStatus === "ready" && this.thunderSample) this.playPreparedThunder(this.thunderSample);
    else if (this.thunderStatus === "loading") {
      // Never replay a backlog after decoding: only the latest, still-fresh strike.
      this.pendingThunder = [{ context, epoch: this.thunderEpoch, at: context.currentTime }];
      this.record("thunder-pending");
    }
  }

  private playPreparedThunder(buffer: AudioBuffer) {
    const context = this.context;
    if (!context || !this.canThunder() || !this.thunderBus) return;
    // Normal 3s+ strikes overlap only a quiet tail; keep a hard ceiling as well.
    while (this.thunderVoices.size >= 2) {
      const oldest = this.thunderVoices.values().next().value!;
      try { oldest.source.stop(); } catch {}
      oldest.cleanup();
    }
    const now = context.currentTime + .02, duration = buffer.duration;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    highpass.type = "highpass";
    highpass.frequency.value = 28;
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1800, now);
    lowpass.frequency.exponentialRampToValueAtTime(650, now + .18);
    lowpass.frequency.exponentialRampToValueAtTime(135, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume(this.manifest.thunder?.volume ?? .55), now + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(highpass); highpass.connect(lowpass); lowpass.connect(gain); gain.connect(this.thunderBus);
    this.track(source, [highpass, lowpass, gain], this.thunderVoices);
    source.start(now); source.stop(now + duration);
    this.thunderPlayed++;
    this.record("thunder-played", `${this.thunderPlayed}`);
  }

  private stopThunder() {
    this.thunderEpoch++;
    this.lastThunderAt = Number.NEGATIVE_INFINITY;
    const cancelledCount = this.pendingThunder.length;
    this.pendingThunder = [];
    this.stopSounds(this.thunderVoices);
    if (cancelledCount) this.record("thunder-cancelled", String(cancelledCount));
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], collection: Set<ActiveSound>, onEnd?:()=>void) {
    let cleaned = false;
    const sound: ActiveSound = { source, cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      collection.delete(sound);
      source.onended = null;
      source.disconnect();
      nodes.forEach(node => node.disconnect());
      onEnd?.();
    } };
    collection.add(sound);
    source.onended = sound.cleanup;
    return sound;
  }
  private stopSounds(collection: Set<ActiveSound>) {
    for (const sound of [...collection]) {
      try { sound.source.stop(); } catch {}
      sound.cleanup();
    }
  }
  private tone(frequency: number, endFrequency: number, start: number, duration: number, strength: number, ambient = false) {
    const context = this.context;
    const destination = ambient ? this.ambientGain : this.effectGain;
    if (!context || !destination || context.state !== "running") return;
    const source = context.createOscillator();
    const gain = context.createGain();
    source.type = "sine";
    source.frequency.setValueAtTime(frequency, start);
    source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration * .8);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(strength, start + Math.min(.018, duration / 5));
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(gain);
    gain.connect(destination);
    this.track(source, [gain], ambient ? this.ambience : this.effects);
    source.start(start);
    source.stop(start + duration + .02);
  }
  private playSynth(name: SoundName) {
    const now = this.context!.currentTime + .02;
    if (name === "selection") this.tone(740, 520, now, .16, .48);
    else { this.tone(523.25, 523.25, now, .3, .4); this.tone(783.99, 783.99, now + .12, .34, .3); }
  }
  private playCue() {
    if (!this.canPlay() || !this.effectsVolume) return;
    const now = this.context!.currentTime + .025;
    this.tone(660, 740, now, .25, .48);
    this.tone(880, 988, now + .2, .3, .4);
    this.record("confirmation-cue");
  }

  setWeather(weather: Weather) { this.setEnvironment(weather, weather === "dusk" ? "dusk" : this.phase); }
  setEnvironment(weather: Weather, phase: WeatherPhase = "day") {
    if (this.disposed || this.weather === weather && this.phase === phase) return;
    this.weather = weather; this.phase = phase;
    this.record("environment-changed", `${weather}/${phase}`);
    this.stopAtmosphere();
    if (this.canPlay()) this.startAtmosphere();
  }
  /** Shares the existing gesture-owned context; music stays on its stereo bus. */
  setSpatialScene(frame:ScenicAudioFrame){
    if(this.disposed||![frame.listener,frame.forward,frame.up,frame.waterfall.position].every(point=>point.every(Number.isFinite)))return;
    this.spatialFrame=frame;
    const context=this.context;
    if(!this.canPlay()||!context)return;
    const listener=context.listener;
    if(listener){
      if(listener.positionX){
        const values=[...frame.listener,...frame.forward,...frame.up];
        [listener.positionX,listener.positionY,listener.positionZ,listener.forwardX,listener.forwardY,listener.forwardZ,listener.upX,listener.upY,listener.upZ].forEach((parameter,index)=>parameter.setTargetAtTime(values[index],context.currentTime,.08));
      }else{listener.setPosition?.(...frame.listener);listener.setOrientation?.(...frame.forward,...frame.up);}
    }
    for(const [panner,voice] of this.spatialVoices){
      const point=voice.bird===null?voice.position:frame.birds[voice.bird%Math.max(1,frame.birds.length)]??voice.position;
      this.positionSpatial(panner,point);
    }
    this.updateWaterfall();
  }
  private positionSpatial(panner:PannerNode,point:[number,number,number]){
    const now=this.context?.currentTime??0;
    if(panner.positionX)[panner.positionX,panner.positionY,panner.positionZ].forEach((parameter,index)=>parameter.setTargetAtTime(point[index],now,.08));
    else panner.setPosition(...point);
  }
  private spatialNode(point:[number,number,number],bird:number|null=null){
    if(!this.spatialFrame||!this.context?.createPanner)return null;
    const panner=this.context.createPanner();
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=15;panner.maxDistance=120;panner.rolloffFactor=.85;
    this.spatialVoices.set(panner,{bird,position:[...point]});this.positionSpatial(panner,point);return panner;
  }
  private updateWaterfall(){
    const frame=this.spatialFrame,context=this.context;
    const flow=frame?.active?volume(frame.waterfall.flow):0;
    if(!context||!this.ambientGain||!this.canPlay())return;
    if(flow<.004||this.ambienceVolume===0){
      const voice=this.waterfallVoice;this.waterfallVoice=null;
      if(voice){try{voice.sound.source.stop();}catch{}voice.sound.cleanup();}
      return;
    }
    if(!this.waterfallVoice){
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),panner=this.spatialNode(frame!.waterfall.position);
      source.buffer=this.noiseBuffer('rain');source.loop=true;filter.type='lowpass';filter.frequency.value=1800;gain.gain.value=0;
      source.connect(filter);filter.connect(gain);gain.connect(panner??this.ambientGain);panner?.connect(this.ambientGain);
      const sound=this.track(source,[filter,gain,...(panner?[panner]:[])],this.ambience,()=>{if(panner)this.spatialVoices.delete(panner);this.waterfallVoice=null;});
      this.waterfallVoice={sound,gain};source.start(context.currentTime+.01);
    }
    this.waterfallVoice.gain.gain.setTargetAtTime(Math.sqrt(flow)*.65,context.currentTime,.18);
  }
  playSpatial(kind:ScenicSound,point:[number,number,number]){
    const context=this.context;
    if(!this.canPlay()||!context||!this.effectGain||!this.spatialFrame?.active||this.effectsVolume===0||!point.every(Number.isFinite)||context.currentTime-this.lastSpatialEventAt<.14)return;
    this.lastSpatialEventAt=context.currentTime;this.spatialEvents++;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),panner=this.spatialNode(point),now=context.currentTime+.01;
    source.buffer=this.noiseBuffer('water');filter.type='lowpass';filter.frequency.value=kind==='fishing'?1200:2400;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(kind==='fishing'?.65:.40,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.24);
    source.connect(filter);filter.connect(gain);gain.connect(panner??this.effectGain);panner?.connect(this.effectGain);
    this.track(source,[filter,gain,...(panner?[panner]:[])],this.effects,()=>{if(panner)this.spatialVoices.delete(panner);});source.start(now);source.stop(now+.26);this.record('spatial-'+kind);
  }
  private birdsAllowed() { return this.phase !== "night" && !["rain", "storm", "freezing-rain", "snow", "hail"].includes(this.weather); }
  private startAtmosphere() {
    if (!this.canPlay() || !this.context || !this.ambientGain) return;
    this.stopAtmosphere();
    if (["rain", "storm", "drizzle", "freezing-rain", "hail"].includes(this.weather)) {
      this.loopNoise(this.noiseBuffer("rain"), 450, 6500, this.weather === "storm" ? .55 : this.weather === "drizzle" ? .16 : .38);
      if (this.weather === "storm" || this.weather === "hail") this.loopNoise(this.noiseBuffer("wind"), 45, 700, .23);
    } else this.loopNoise(this.noiseBuffer("wind"), 70, 1100, this.phase === "night" ? .09 : .14);
    if (this.birdsAllowed()) this.scheduleBirds(3000 + Math.random() * 6000);
    this.updateWaterfall();
  }
  private noiseBuffer(kind: "rain" | "wind" | "water"): AudioBuffer {
    const context = this.context;
    if (!context) throw cancelled();
    const cached = this.noiseBuffers.get(kind);
    if (cached) return cached;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * (kind==='water'?.35:6)), context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0, squares = 0;
    const edge = Math.max(1, Math.floor(context.sampleRate * .015));
    for (let index = 0; index < data.length; index++) {
      const white = Math.random() * 2 - 1;
      previous = (previous + white * .055) / 1.055;
      // Rain retains detail instead of high-passing heavily smoothed brown noise.
      const sample = kind !== "wind" ? white * .8 + previous * .2 : previous;
      data[index] = sample * Math.min(1, index / edge, (data.length - 1 - index) / edge);
      squares += data[index] * data[index];
    }
    const rms = Math.sqrt(squares / data.length);
    const scale = rms > 0 ? .32 / rms : 0;
    for (let index = 0; index < data.length; index++) data[index] = Math.max(-.95, Math.min(.95, data[index] * scale));
    this.noiseBuffers.set(kind, buffer);
    return buffer;
  }
  private loopNoise(buffer: AudioBuffer, highpassCutoff: number, lowpassCutoff: number, level: number) {
    const context = this.context;
    if (!context || !this.ambientGain) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    highpass.type = "highpass";
    highpass.frequency.value = highpassCutoff;
    lowpass.type = "lowpass";
    lowpass.frequency.value = lowpassCutoff;
    const now = context.currentTime + .02;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + .3);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.ambientGain);
    this.track(source, [highpass, lowpass, gain], this.ambience);
    source.start(now);
  }
  private scheduleBirds(delay: number) {
    this.birdTimer = setTimeout(() => {
      this.birdTimer = null;
      if (!this.canPlay() || !this.birdsAllowed() || !this.context || !this.ambientGain) return;
      const count = AUDIO_CATALOG.birds.length;
      let next = Math.floor(Math.random() * count);
      if (next === this.birdIndex) next = (next + 1) % count;
      this.birdIndex = next;
      const sample = AUDIO_CATALOG.birds[next];
      const buffer = this.buffers.get(sample.url);
      // Only the licensed recording plays. Missing files do not become synthetic birds.
      if (buffer && this.ambienceVolume > 0) {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = buffer;
        gain.gain.value = sample.volume * (this.phase === "dusk" || this.weather === "drizzle" ? .45 : 1);
        const point=this.spatialFrame?.birds[next%Math.max(1,this.spatialFrame.birds.length)];
        const panner=point?this.spatialNode(point,next):null;
        source.connect(gain); gain.connect(panner??this.ambientGain);panner?.connect(this.ambientGain);
        this.track(source, [gain,...(panner?[panner]:[])], this.ambience,()=>{if(panner)this.spatialVoices.delete(panner);}); source.start(this.context.currentTime + .02);
      }
      this.scheduleBirds((this.phase === "dusk" || this.weather === "drizzle" ? 18000 : 10000) + Math.random() * 14000);
    }, delay);
  }
  private stopAtmosphere() {
    this.stopThunder();
    if (this.birdTimer !== null) clearTimeout(this.birdTimer);
    this.birdTimer = null;
    this.stopSounds(this.ambience);
  }

  visibility(hidden: boolean) {
    this.hidden = hidden;
    const epoch = ++this.visibilityEpoch;
    this.record(hidden ? "visibility-hidden" : "visibility-visible");
    this.recoveryController?.abort();
    this.recoveryController = null;
    if (this.disposed) return;
    if (this.isHidden()) { this.pauseOutput(); return; }
    if (!this.desired || this.starting) return;
    if (!this.context) {
      if (this.earlyEntry?.owner === this && this.musicEnabled) void this.playMusic().then(() => {
        if (!this.disposed && this.desired && !this.isHidden() && this.musicStatus === "playing") this.onStateChange?.(true, null);
      });
      return;
    }
    const attempt = this.attempt;
    const controller = new AbortController();
    this.recoveryController = controller;
    let requests: Promise<unknown>[];
    try { requests = this.requestOutput(); }
    catch (error) { this.recoveryController = null; this.reportInterruption(error); return; }
    void this.waitForOutput(requests, controller.signal).then(() => {
      if (attempt !== this.attempt || epoch !== this.visibilityEpoch || !this.desired || this.isHidden() || this.disposed) return;
      if (this.context?.state !== "running") throw outputError();
      this.enabled = true;
      this.lastError = null;
      this.beginOutput();
      this.record("visibility-resumed");
      this.onStateChange?.(true, null);
    }).catch(error => {
      if (attempt === this.attempt && epoch === this.visibilityEpoch && this.desired && !this.isHidden() && !this.disposed && error?.name !== "AbortError") this.reportInterruption(error);
    }).finally(() => { if (this.recoveryController === controller) this.recoveryController = null; });
  }

  /** Actual PCM at the last node before destination; this cannot measure speakers. */
  diagnostics(): AudioDiagnostics {
    let rms = 0, peak = 0;
    if (this.canPlay() && this.analyser && this.meterData) {
      this.analyser.getFloatTimeDomainData(this.meterData);
      let squares = 0;
      for (const value of this.meterData) { squares += value * value; peak = Math.max(peak, Math.abs(value)); }
      rms = Math.sqrt(squares / this.meterData.length);
    }
    const hidden = this.isHidden();
    const contextState = this.context?.state ?? "unallocated";
    const status = this.disposed ? "disposed" : !this.desired ? this.lastError ? "error" : "off" : this.starting ? "starting" : hidden ? "paused" : contextState !== "running" ? "interrupted" : this.enabled ? "running" : "paused";
    let musicRms = 0, musicPeak = 0;
    const metered = !!this.music && this.mediaNodes.has(this.music) && !!this.musicAnalyser && !!this.musicMeter;
    if (metered && this.canPlay() && this.musicStatus === "playing") {
      this.musicAnalyser!.getFloatTimeDomainData(this.musicMeter!);
      let squares = 0;
      for (const value of this.musicMeter!) { squares += value * value; musicPeak = Math.max(musicPeak, Math.abs(value)); }
      musicRms = Math.sqrt(squares / this.musicMeter!.length);
    }
    return {
      music: { status: this.disposed || !this.desired || !this.musicEnabled ? "off" : hidden ? "paused" : this.musicError ? "error" : this.musicStatus, title: AUDIO_CATALOG.playlist![this.musicIndex]?.title ?? null, currentTime: this.music?.currentTime ?? 0, duration: Number.isFinite(this.music?.duration) ? this.music!.duration : 0, error: this.musicError, rms: musicRms, peak: musicPeak, signalDetected: metered && musicPeak > SIGNAL_THRESHOLD, metered },
      thunder: { status: this.thunderStatus, preparationMs: this.thunderPreparationMs, error: this.thunderError, pending: this.pendingThunder.length, active: this.thunderVoices.size, gain: this.thunderBus?.gain.value ?? this.thunderLevel(), played: this.thunderPlayed },
      phase: this.phase,
      spatial:{voices:this.spatialVoices.size,waterfall:!!this.waterfallVoice,events:this.spatialEvents,listener:this.spatialFrame?[...this.spatialFrame.listener]:null},
      status, contextState, enabled: this.enabled, desired: this.desired, hidden, weather: this.weather,
      currentTime: this.context?.currentTime ?? 0, sampleRate: this.context?.sampleRate ?? 0,
      gains: { effects: this.effectGain?.gain.value ?? this.effectsVolume, ambience: this.ambientGain?.gain.value ?? this.ambienceVolume, music: this.musicEnabled ? this.musicVolume : 0 },
      activeEffects: this.effects.size, activeAmbience: this.ambience.size + this.thunderVoices.size, rms, peak,
      signalDetected: this.canPlay() && peak > SIGNAL_THRESHOLD,
      lastError: this.lastError, lastTest: this.lastTest ? { ...this.lastTest } : null,
      recentEvents: this.events.map(event => ({ ...event })),
    };
  }

  /** A fresh gesture can retry output; measure across the complete audible cue. */
  async playTest(): Promise<AudioDiagnostics> {
    const alreadyRunning = this.canPlay();
    await this.enable({ music: this.musicEnabled });
    if (!this.canPlay()) throw outputError();
    if (!this.effectsVolume) throw new Error("O volume dos efeitos está em zero. Aumente o volume para testar som.");
    if (alreadyRunning) this.playCue();
    const controller = new AbortController();
    this.testControllers.add(controller);
    try {
      const result = await new Promise<NonNullable<AudioDiagnostics["lastTest"]>>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        let rms = 0, peak = 0, samples = 0;
        const cleanup = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", abort); };
        const abort = () => { cleanup(); reject(cancelled()); };
        const sample = () => {
          if (!this.canPlay()) { cleanup(); reject(outputError()); return; }
          const reading = this.diagnostics();
          rms = Math.max(rms, reading.rms);
          peak = Math.max(peak, reading.peak);
          samples += 1;
          if (samples < 8) timer = setTimeout(sample, 65);
          else { cleanup(); resolve({ rms, peak, samples, signalDetected: peak > SIGNAL_THRESHOLD }); }
        };
        controller.signal.addEventListener("abort", abort, { once: true });
        timer = setTimeout(sample, 65);
      });
      this.lastTest = result;
      this.record("output-tested", result.signalDetected ? "signal-detected" : "no-signal-detected");
      return this.diagnostics();
    } finally { this.testControllers.delete(controller); }
  }
  testSound() { return this.playTest(); }

  dispose() {
    if (this.disposed) return;
    this.disposing = true;
    // If cleanup follows a normal playlist transition, preserve its position in
    // the reusable SSR element as well. The next mount cannot reuse closed graph nodes.
    if (this.earlyEntry?.owner === this && this.music && this.music !== this.earlyEntry.element) {
      this.earlyEntry.rememberTrack(this.musicIndex, this.music.currentTime);
    }
    // A component cleanup is not a visitor's decision to silence the page.
    this.mute();
    this.disposed = true;
    this.onStateChange = null;
    this.controller.abort();
    this.thunderPreparationEpoch++;
    this.thunderController?.abort();
    if (this.thunderTimer) clearTimeout(this.thunderTimer);
    this.thunderTimer = null;
    this.releasePlayer(this.music); this.music = null;
    this.releasePlayer(this.entryMusic?.player ?? null); this.entryMusic = null;
    this.releasePlayer(this.retiringMusic); this.retiringMusic = null;
    this.musicBus?.disconnect(); this.musicAnalyser?.disconnect();
    this.effectGain?.disconnect();
    this.ambientGain?.disconnect();
    this.thunderBus?.disconnect();
    this.analyser?.disconnect();
    if (this.context) {
      this.context.removeEventListener("statechange", this.contextChanged);
      if (this.context.state !== "closed") void this.context.close().catch(() => {});
    }
    this.buffers.clear();
    this.bufferLoads.clear();
    this.noiseBuffers.clear();
    this.thunderSample = null;
    this.record("disposed");
    this.earlyEntry?.release(this);
  }
}
