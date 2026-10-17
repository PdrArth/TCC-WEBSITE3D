"use client";

import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CloudLightning, CloudRain, Cloud, ExternalLink, Maximize, Minimize, Play, Settings2, Info, Sun, Sunset, Volume2, VolumeX, X, Minus, Plus, RotateCcw } from "lucide-react";
import { pavilionIds, islandNames as names, islandDescriptions as descriptions, type PavilionId, type WorldManifest } from "@/lib/experience-contract";
import type { PublicUpdate } from "@/lib/update-types";
import { WorldNavigator, type Arrival } from "@/lib/experience/navigation.mjs";
import { ExperienceAudio, type AudioDiagnostics } from "@/lib/experience/audio";
import { weatherKinds, weatherNames } from "@/lib/experience/weather.mjs";
import { resolveReadingHash, readingHref } from "@/lib/reading-navigation.mjs";
import { useScenicWeather } from "./use-scenic-weather";
import { getSeason, seasonInfo, seasonRegion } from "@/lib/experience/seasons.mjs";
import type { IslandSceneProps, LabelPositions, ScenePerformance } from "./scene";
import WorldMap from "./world-map";
import "../research-content/content.css";
import "./island.css";
import "../research-content/reading-v10.css";
import "../research-content/pavilion-v10.css";
import "../research-content/pavilion-v13.css";
import "../research-content/pavilion-v14.css";
import "./environment-v14.css";

// Start the world download as soon as this client module is evaluated, before
// hydration. The notebook is a separate chunk, fetched only when it is needed.
let sceneModule: Promise<typeof import("./scene")> | undefined;
const loadScene = () => sceneModule ??= import("./scene").catch(error => { sceneModule = undefined; throw error; });
if (typeof window !== "undefined") void loadScene().catch(() => {});
let contentModule: Promise<typeof import("@/components/research-content")> | undefined;
const loadContent = () => contentModule ??= import("@/components/research-content").catch(error => { contentModule = undefined; throw error; });
function DeferredResearch({ children }: { children: (module: typeof import("@/components/research-content")) => ReactNode }) {
  const [module, setModule] = useState<typeof import("@/components/research-content") | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadContent().then(value => { if (active) setModule(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);
  if (module) return children(module);
  if (failed) return <div role="alert"><p>Não foi possível carregar a leitura.</p><button onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Tentar novamente</button> <a href="/tcc-pedro-arthur.pdf" target="_blank" rel="noreferrer">Abrir o PDF</a></div>;
  return <p role="status">Abrindo a pesquisa…</p>;
}

const motionSubscribe = (callback: () => void) => { const query = window.matchMedia("(prefers-reduced-motion: reduce)"); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
const motionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const visibilitySubscribe = (callback: () => void) => { document.addEventListener("visibilitychange", callback); return () => document.removeEventListener("visibilitychange", callback); };
const visibilitySnapshot = () => !document.hidden;
const fallbackLabels: LabelPositions = Object.fromEntries(pavilionIds.map((id, index) => [id, { x: index < 3 ? 25 + index * 25 : index < 6 ? 23 + (index - 3) * 27 : 50, y: index < 3 ? 28 : index < 6 ? 53 : 77, visible: true }])) as LabelPositions;

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function trapFocus(event: KeyboardEvent, node: HTMLElement) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex="0"]')).filter(item => item.getClientRects().length > 0);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first) { event.preventDefault(); node.focus(); return; }
  if (!node.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export default function IslandExperience({showSettings=false}:{showSettings?:boolean}) {
  const systemReducedMotion = useSyncExternalStore(motionSubscribe, motionSnapshot, () => false);
  const [motionPreference, setMotionPreference] = useState<"system" | "full" | "reduced">("system");
  const reducedMotion = motionPreference === "system" ? systemReducedMotion : motionPreference === "reduced";
  const visible = useSyncExternalStore(visibilitySubscribe, visibilitySnapshot, () => true);
  const [manifest, setManifest] = useState<WorldManifest | null>(null);
  const [worldNavigator, setWorldNavigator] = useState<WorldNavigator | null>(null);
  const [Scene, setScene] = useState<ComponentType<IslandSceneProps> | null>(null);
  const [sceneState, setSceneState] = useState<"loading" | "ready" | "fallback">("loading");
  const [sceneHasMounted, setSceneHasMounted] = useState(false);
  const [quality, setQuality] = useState<"high" | "low">("low");
  const [qualityPreference, setQualityPreference] = useState<"auto" | "high" | "low">("auto");
  const [performance, setPerformance] = useState<ScenePerformance | null>(null);
  const labels = useRef<LabelPositions>(fallbackLabels);
  const [destination, setDestination] = useState<PavilionId | null>(null);
  const [pavilion, setPavilion] = useState<PavilionId | null>(null);
  const [selectedIsland, setSelectedIsland] = useState<PavilionId | null>(null);
  const [reading, setReading] = useState(false);
  const [readingAnchor, setReadingAnchor] = useState("pesquisa");
  const [readingTheme, setReadingTheme] = useState<PavilionId | "fontes">("pesquisa");
  const [resetEpoch, setResetEpoch] = useState(0);
  const [updates, setUpdates] = useState<PublicUpdate[]>([]);
  const [newsState, setNewsState] = useState<"loading" | "ready" | "error">("loading");
  const [audioState, setAudioState] = useState<"off" | "loading" | "on" | "error">("off");
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [musicVolume, setMusicVolume] = useState(.68);
  const [effectsVolume, setEffectsVolume] = useState(.10);
  const [ambienceVolume, setAmbienceVolume] = useState(.06);
  const [audioDiagnostics, setAudioDiagnostics] = useState<AudioDiagnostics | null>(null);
  const [zoom, setZoom] = useState(1);
  const [soundTest, setSoundTest] = useState("");
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [labelWidths, setLabelWidths] = useState<Record<PavilionId, number>>(Object.fromEntries(pavilionIds.map(id => [id, 150])) as Record<PavilionId, number>);
  const [posterAspect, setPosterAspect] = useState(4 / 3);
  const [started, setStarted] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const environment = useScenicWeather(visible && !reading);
  const { weather, phase, season, setSeason, timeOfDay } = environment;
  const [fullscreen, setFullscreen] = useState(false);
  const [screenNotice, setScreenNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const reader = useRef<HTMLElement>(null);
  const audioRequest = useRef(0);
  const nav = useRef<WorldNavigator | null>(null);
  const audio = useRef<ExperienceAudio | null>(null);
  const panel = useRef<HTMLElement>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const readerHeading = useRef<HTMLHeadingElement>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const lastArrival = useRef(-1);
  const stage = useRef<HTMLDivElement>(null);
  const readingActive = useRef(false);
  const retryController = useRef<AbortController | null>(null);
  const soundSilenced = useRef(false);
  const soundGesture = useRef(false);

  const rememberMotion = (value: "system" | "full" | "reduced") => {
    setMotionPreference(value);
    try { localStorage.setItem("tcc-motion", value); } catch { /* Storage is optional. */ }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const preference = localStorage.getItem("tcc-motion");
        if (preference === "full" || preference === "reduced" || preference === "system") setMotionPreference(preference);
      } catch { /* The device preference remains available. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const entryAudio = window.__tccEntryAudio;
    soundSilenced.current = entryAudio?.silenced ?? false;
    soundGesture.current = entryAudio?.gesture ?? false;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setAudioInitialized(true);
      if (entryAudio?.entryRequested) {
        setStarted(true);
        requestAnimationFrame(() => returnButton.current?.focus({ preventScroll:true }));
      }
    });
    audio.current = new ExperienceAudio();
    audio.current.setVolumes(.68, .10, .06);
    const engine = audio.current;
    audio.current.onStateChange = (enabled, error) => {
      if (!controller.signal.aborted) setAudioState(error && soundGesture.current ? "error" : enabled ? "on" : "off");
    };
    // Fast Refresh may keep React state while replacing the audio engine.
    // Never leave an "on" control attached to a fresh, unallocated context.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      const state = engine.diagnostics();
      engine.onStateChange?.(state.enabled || state.music.status === "playing", null);
    });
    if (root.current) root.current.dataset.runtimeBootMs = window.performance.now().toFixed(1);
    const manifestTask = fetch("/experience/world/manifest-v20.json", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("World unavailable");
      const data = await response.json() as WorldManifest;
      if (![1, 2, 3].includes(data.schemaVersion) || !data.assets?.world || !data.navigation?.nodes || pavilionIds.some(id => !data.pavilions[id])) throw new Error("Invalid world manifest");
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      nav.current = new WorldNavigator(data.navigation, data.spawn, data.avatar?.speed ?? 2.2);
      setWorldNavigator(nav.current);
      setManifest(data);
      if (root.current) root.current.dataset.manifestReadyMs = window.performance.now().toFixed(1);
    });
    const sceneTask = loadScene().then(sceneModule => {
      if (root.current && !controller.signal.aborted) root.current.dataset.sceneModuleReadyMs = window.performance.now().toFixed(1);
      return sceneModule;
    });
    Promise.all([manifestTask, sceneTask]).then(([, sceneModule]) => {
      if (!controller.signal.aborted) setScene(() => sceneModule.default);
    }).catch(error => { if (error.name !== "AbortError" && !controller.signal.aborted) setSceneState("fallback"); });
    fetch("/api/updates", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Updates unavailable");
      const result = await response.json() as { updates: PublicUpdate[] };
      if (!Array.isArray(result.updates)) throw new Error("Invalid updates response");
      setUpdates(result.updates);
      setNewsState("ready");
    }).catch(error => { if (error.name !== "AbortError") setNewsState("error"); });
    // Autoplay is attempted honestly. If blocked, the first real gesture retries.
    if (!soundSilenced.current) void engine.enable({ music: true }).catch(() => { if (!controller.signal.aborted && !soundGesture.current) setAudioState("off"); });
    const unlock = (event: Event) => {
      if (soundSilenced.current || (event.target as HTMLElement)?.closest("[data-audio-control]")) return;
      if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
      const hadGesture = soundGesture.current;
      soundGesture.current = true;
      const state = engine.diagnostics();
      if (state.music.status === "playing" && !state.music.metered) return;
      if (state.status === "starting" && hadGesture) return;
      if (!state.enabled || state.music.status === "error") {
        audioRequest.current++;
        // Cancel a suspended automatic attempt so resume() runs in this gesture.
        engine.mute();
        setAudioState("loading");
        void engine.enable({ music: true }).catch(() => {});
      }
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => { document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock); controller.abort(); retryController.current?.abort(); nav.current?.cancel(); engine.dispose(); };
  }, []);

  useEffect(() => {
    if (audioState !== "on") {
      if (root.current) { root.current.dataset.audioSignal = "false"; root.current.dataset.audioRms = "0"; root.current.dataset.audioPeak = "0"; root.current.dataset.musicSignal = "false"; root.current.dataset.musicRms = "0"; root.current.dataset.musicPeak = "0"; }
      return;
    }
    const timer = window.setInterval(() => {
      const stats = audio.current?.diagnostics();
      if (!stats || !root.current) return;
      root.current.dataset.audioContext = stats.contextState;
      root.current.dataset.audioRms = String(stats.rms);
      root.current.dataset.audioPeak = String(stats.peak);
      root.current.dataset.audioSignal = String(stats.signalDetected);
      root.current.dataset.musicRms = String(stats.music.rms);
      root.current.dataset.musicPeak = String(stats.music.peak);
      root.current.dataset.musicTime = String(stats.music.currentTime);
      root.current.dataset.musicSignal = String(stats.music.signalDetected);
      root.current.dataset.audioEvents = JSON.stringify(stats.recentEvents.slice(-6));
      root.current.dataset.thunderStatus = stats.thunder.status;
      root.current.dataset.thunderGain = String(stats.thunder.gain);
      root.current.dataset.thunderPlayed = String(stats.thunder.played);
      root.current.dataset.thunderPreparationMs = String(stats.thunder.preparationMs);
      setAudioDiagnostics(previous => previous?.music.status===stats.music.status&&previous?.music.title===stats.music.title&&previous?.music.error===stats.music.error ? previous : stats);
    }, 500);
    return () => window.clearInterval(timer);
  }, [audioState]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>("[data-pavilion]"));
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      setStageSize({ width: bounds.width, height: bounds.height });
      if (bounds.width > 0) setLabelWidths(Object.fromEntries(buttons.map(button => [button.dataset.pavilion, button.getBoundingClientRect().width])) as Record<PavilionId, number>);
    });
    observer.observe(element);
    buttons.forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [reading, started]);

  const closeContent = useCallback(() => {
    setPavilion(null);
    setCreditsOpen(false);
    setMapOpen(false);
    setReading(false);
    readingActive.current = false;
    setDestination(null);
    nav.current?.cancel();
    if (resolveReadingHash(window.location.hash)) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    requestAnimationFrame(() => (lastTrigger.current?.isConnected ? lastTrigger.current : returnButton.current ?? document.querySelector<HTMLElement>(".island-enter, .island-brand"))?.focus({ preventScroll: true }));
  }, []);

  const openReading = useCallback((anchor = "#caderno/pesquisa", trigger?: HTMLElement) => {
    void loadContent().catch(() => {});
    if (trigger) {
      lastTrigger.current = trigger;
      const theme = resolveReadingHash(anchor);
      if (theme) {
        try { sessionStorage.setItem(`tcc-reading-scroll-v8:${theme}`, "0"); } catch { /* Optional reading state. */ }
      }
    }
    nav.current?.cancel();
    setDestination(null);
    setPavilion(null);
    setCreditsOpen(false);
    setMapOpen(false);
    const theme = resolveReadingHash(anchor) ?? (pavilionIds.includes(anchor as PavilionId) ? anchor as PavilionId : "pesquisa");
    setReadingAnchor(theme);
    setReadingTheme(theme);
    if (theme !== "fontes") setSelectedIsland(theme);
    setReading(true);
    readingActive.current = true;
  }, []);

  useEffect(() => {
    const readHash = () => {
      let hash = window.location.hash.slice(1);
      try { hash = decodeURIComponent(hash); } catch {}
      if (resolveReadingHash(hash)) openReading(`#${hash}`);
      else if (readingActive.current) closeContent();
    };
    // Hash-based legacy links enter the DOM reading view directly.
    const initial = window.setTimeout(readHash, 0);
    window.addEventListener("hashchange", readHash);
    window.addEventListener("popstate", readHash);
    return () => { window.clearTimeout(initial); window.removeEventListener("hashchange", readHash); window.removeEventListener("popstate", readHash); };
  }, [openReading, closeContent]);

  useEffect(() => {
    if (pavilion || creditsOpen || mapOpen) { panel.current?.scrollTo(0, 0); panelHeading.current?.focus({ preventScroll: true }); }
  }, [pavilion, creditsOpen, mapOpen]);

  useEffect(() => {
    audio.current?.visibility(!visible);
  }, [visible]);
  useEffect(() => { audio.current?.setVolumes(musicVolume, effectsVolume, ambienceVolume); }, [musicVolume, effectsVolume, ambienceVolume]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeContent(); }
      else if ((pavilion || creditsOpen || mapOpen) && panel.current) trapFocus(event, panel.current);
      else if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName)) return;
      else if (event.key.toLowerCase() === "m" && started && !reading && !pavilion && !creditsOpen) { event.preventDefault(); lastTrigger.current = document.activeElement as HTMLElement; setMapOpen(value => !value); }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [pavilion, creditsOpen, reading, destination, closeContent, mapOpen, started]);

  useEffect(() => { audio.current?.setEnvironment(weather, phase); }, [weather, phase]);
  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const arrived = useCallback((arrival: Arrival) => {
    if (arrival.token !== nav.current?.token || arrival.token === lastArrival.current) return;
    lastArrival.current = arrival.token;
    setDestination(null);
    setPavilion(arrival.id);
    audio.current?.play("arrival");
  }, []);

  const playSelection = useCallback(() => audio.current?.play("selection"), []);
  const playThunder = useCallback(() => audio.current?.thunder(), []);
  const projectLabels = useCallback((positions:LabelPositions) => {
    labels.current=positions;
    const bounds=stage.current?.getBoundingClientRect();
    if(!bounds?.width)return;
    for(const button of stage.current!.querySelectorAll<HTMLButtonElement>("[data-pavilion]")){
      const id=button.dataset.pavilion as PavilionId,p=positions[id];
      const edge=(button.offsetWidth/2+8)/bounds.width*100;
      button.style.left=`${Math.min(100-edge,Math.max(edge,p.x))}%`;
      button.style.top=`${Math.min(93,Math.max(7,p.y))}%`;
      button.style.visibility=p.visible?"visible":"hidden";
    }
  },[]);

  const choose = useCallback((id: PavilionId, trigger?: HTMLElement) => {
    void loadContent().catch(() => {});
    lastTrigger.current = trigger&&!trigger.closest(".island-panel") ? trigger : document.querySelector<HTMLElement>(`[data-pavilion="${id}"]`);
    setCreditsOpen(false);
    setMapOpen(false);
    setStarted(true);
    setPavilion(id);
    setSelectedIsland(id);
    audio.current?.play("selection");
    nav.current?.cancel();
    nav.current?.select(id, true);
    setDestination(null);
  }, []);

  const ready = useCallback(() => {
    setSceneHasMounted(true);
    setSceneState("ready");
    if(root.current&&!root.current.dataset.firstSceneReadyMs)root.current.dataset.firstSceneReadyMs=window.performance.now().toFixed(1);
    const resource = window.performance.getEntriesByName(new URL("/experience/world/archipelago-v19-low.glb", window.location.href).href).at(-1) as PerformanceResourceTiming | undefined;
    if (root.current && resource) {
      root.current.dataset.worldDownloadStartMs = resource.startTime.toFixed(1);
      root.current.dataset.worldDownloadEndMs = resource.responseEnd.toFixed(1);
    }
    if(root.current){
      const navigation=window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
      root.current.dataset.htmlResponseMs=(navigation?.responseEnd??0).toFixed(1);
      // Local diagnostics only: resource timings make network delays distinguishable
      // from CPU/GPU preparation. No visitor information is sent anywhere.
      const scripts=(window.performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(entry=>/\.js(?:\?|$)/.test(entry.name));
      root.current.dataset.slowStartupScripts=JSON.stringify(scripts.toSorted((a,b)=>b.duration-a.duration).slice(0,5).map(entry=>({name:entry.name.split("/").pop(),ms:Math.round(entry.duration),end:Math.round(entry.responseEnd)})));
    }
  }, []);
  const failed = useCallback(() => {
    const pending = nav.current?.destination;
    nav.current?.cancel();
    setSceneState("fallback");
    setDestination(null);
    if (pending) { setPavilion(pending); audio.current?.play("arrival"); }
  }, []);
  const recordPerformance = useCallback((stats: ScenePerformance) => { setPerformance(stats); if (qualityPreference === "auto") setQuality(stats.quality); }, [qualityPreference]);

  const retryScene = async () => {
    closeContent();
    retryController.current?.abort();
    const controller = new AbortController();
    retryController.current = controller;
    setSceneState("loading");
    setQuality("low");
    try {
      if (!manifest) {
        const response = await fetch("/experience/world/manifest-v20.json", { signal: controller.signal });
        if (!response.ok) throw new Error("World unavailable");
        const data = await response.json() as WorldManifest;
        if (![1, 2, 3].includes(data.schemaVersion) || !data.navigation?.nodes || !data.assets?.world) throw new Error("Invalid world manifest");
        const navigator = new WorldNavigator(data.navigation, data.spawn, data.avatar?.speed ?? 2.2);
        nav.current = navigator;
        setWorldNavigator(navigator);
        setManifest(data);
      }
      const sceneModule = await loadScene();
      if (!controller.signal.aborted) setScene(() => sceneModule.default);
    } catch (error) { if (!controller.signal.aborted && (error as Error).name !== "AbortError") failed(); }
  };

  const toggleAudio = async () => {
    soundGesture.current = true;
    if (audioState === "on" || audioState === "loading") { soundSilenced.current = true; audioRequest.current++; audio.current?.mute(); setAudioState("off"); return; }
    if (!audio.current) return;
    soundSilenced.current = false;
    const request = ++audioRequest.current;
    if (audio.current.diagnostics().status === "starting") audio.current.mute();
    setAudioState("loading");
    try { await audio.current.enable({ music: true }); if (request !== audioRequest.current) return; setAudioState("on"); }
    catch { if (request === audioRequest.current) setAudioState("error"); }
  };

  const start = () => {
    if (!soundSilenced.current && !audio.current?.diagnostics().desired && audioState !== "on" && audioState !== "loading") void toggleAudio();
    setStarted(true);
    if (motionPreference === "system") rememberMotion("full");
    setResetEpoch(value => value + 1);
    requestAnimationFrame(() => returnButton.current?.focus({ preventScroll: true }));
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setScreenNotice("A ilha já ocupa a janela. A tela cheia não está disponível neste navegador.");
    } catch { setScreenNotice("A tela cheia não está disponível neste navegador. A ilha continua ocupando a janela."); }
  };
  const openMap = (trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    nav.current?.cancel(); setDestination(null); setPavilion(null); setCreditsOpen(false); setMapOpen(true);
    audio.current?.play("selection");
  };

  const openCredits = (trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    nav.current?.cancel();
    setDestination(null);
    setPavilion(null);
    setMapOpen(false);
    setCreditsOpen(true);
  };

  const anchors = (event: React.MouseEvent<HTMLElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = link.hash.slice(1);
    if (resolveReadingHash(anchor)) {
      event.preventDefault();
      window.history.pushState(null, "", link.hash);
      openReading(anchor, link);
    }
  };

  const poster = manifest?.assets.poster ?? "/experience/world/poster-v17.webp";
  const fitPoint = (point: [number, number]) => {
    const { width, height } = stageSize;
    if (!width || !height) return { x: point[0] * 100, y: point[1] * 100, visible: true };
    const imageWidth = Math.min(width, height * posterAspect);
    const imageHeight = Math.min(height, width / posterAspect);
    return { x: ((width - imageWidth) / 2 + imageWidth * point[0]) / width * 100, y: ((height - imageHeight) / 2 + imageHeight * point[1]) / height * 100, visible: true };
  };
  const currentLabels = sceneState === "ready" ? labels.current : manifest ? Object.fromEntries(pavilionIds.map(id => [id, fitPoint(manifest.pavilions[id].posterPoint)])) as LabelPositions : fallbackLabels;
  const labelLeft = (id: PavilionId) => {
    const edge = stageSize.width ? (labelWidths[id] / 2 + 8) / stageSize.width * 100 : 7;
    return Math.min(100 - edge, Math.max(edge, currentLabels[id].x));
  };

  const modalOpen = !!pavilion || creditsOpen || mapOpen;
  const chapterIndex = pavilion ? pavilionIds.indexOf(pavilion) : -1;
  const nextChapter = chapterIndex >= 0 && chapterIndex < pavilionIds.length - 1 ? pavilionIds[chapterIndex + 1] : null;
  const testSound = async () => {
    if (!audio.current) return;
    setSoundTest("Reproduzindo…");
    try {
      const result = await audio.current.playTest();
      if (root.current) root.current.dataset.audioTest = JSON.stringify(result.lastTest);
      setSoundTest(result.lastTest?.signalDetected ? "Teste reproduzido. Você ouviu dois toques?" : "Não foi detectado sinal. Tente ativar o som novamente.");
    } catch (error) {
      setSoundTest(error instanceof DOMException && error.name === "AbortError" ? "Teste cancelado." : error instanceof Error ? error.message : "O som não iniciou. Tente novamente.");
    }
  };
  const WeatherIcon = weather === "clear" ? Sun : weather === "rain" || weather === "drizzle" ? CloudRain : weather === "storm" || weather === "hail" ? CloudLightning : weather === "dusk" ? Sunset : Cloud;
  const audioLabel = !audioInitialized ? "Ativar ou silenciar som" : audioState === "on" ? "Silenciar som" : audioState === "loading" ? "Cancelar carregamento do som" : "Ativar som";
  const audioControl = <button className="island-inline-audio" data-audio-control data-entry-audio-toggle onClick={toggleAudio} aria-label={audioLabel}><span className="island-audio-playing-icon"><Volume2 size={17} aria-hidden="true" /></span><span className="island-audio-muted-icon"><VolumeX size={17} aria-hidden="true" /></span></button>;
  const musicStatus = audioState === "on" ? audioDiagnostics?.music : undefined;
  return <div ref={root} className={`island-experience${started ? " is-started" : " is-intro"}${reading ? " is-reading" : ""}`} onClick={anchors} data-experience-version="20" data-scene-state={sceneState} data-navigation-state={destination ? "transition" : "idle"} data-world-active={visible && !reading} data-panel-open={modalOpen} data-motion={reducedMotion ? "reduced" : "full"} data-weather={weather} data-season={season} data-phase={phase} data-time-of-day={timeOfDay.toFixed(3)} data-weather-mode={environment.mode} data-opening-weather={environment.opening?.weather ?? "pending"} data-opening-coordination={environment.opening?.coordination ?? "pending"} data-opening-position={environment.opening?.position ?? "pending"} data-options-open={creditsOpen} data-audio={audioState} data-audio-initialized={audioInitialized} data-music={musicStatus?.status ?? "off"} data-music-title={musicStatus?.title ?? ""} data-music-time={musicStatus?.currentTime ?? 0} data-quality={quality} data-zoom={zoom} data-fps={performance?.fps ?? "pending"} data-frame-ms={performance?.frameMs?.toFixed(2)} data-p95-ms={performance?.p95Ms?.toFixed(2)} data-heap-mb={performance?.heapMB} data-gpu-geometries={performance?.geometries} data-gpu-textures={performance?.textures} data-draw-calls={performance?.drawCalls ?? "pending"} data-triangles={performance?.triangles ?? "pending"}>
    <a className="island-skip" href={readingHref("pesquisa")}>Ir para a leitura</a>
    <header className="island-header" inert={modalOpen}>
      <button className="island-brand" onClick={closeContent}>DO CÓDIGO<br /><span>À SUPERVISÃO</span></button>
      <nav aria-label="Acessos à pesquisa">{audioControl}{<button className="island-header-options" onClick={event => openCredits(event.currentTarget)} aria-label={showSettings?"Opções e créditos":"Créditos"}>{showSettings?<Settings2 size={18} aria-hidden="true" />:<Info size={18} aria-hidden="true" />}</button>}{!reading && <a href={readingHref("pesquisa")}><BookOpen size={15} aria-hidden="true" />Ler a pesquisa</a>}<a href="/tcc-pedro-arthur.pdf" target="_blank" rel="noreferrer">PDF<ExternalLink size={13} aria-hidden="true" /></a></nav>
    </header>
    <main className={`island-landing${modalOpen ? " has-panel" : ""}`} hidden={reading} inert={modalOpen} aria-label="Explore a pesquisa">
      <div ref={stage} className="island-stage" aria-label="Sete ilhas da pesquisa" data-animation={reducedMotion ? "reduced" : "full"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`island-poster${sceneState === "ready" ? " is-hidden" : ""}`} src={poster} alt="Sete jardins conectados por pontes: a pesquisa, ferramentas, produtividade, validação, especificação, profissão e perspectivas." fetchPriority="high" onLoad={event => { const image = event.currentTarget; if (image.naturalHeight) setPosterAspect(image.naturalWidth / image.naturalHeight); }} />
        {Scene && manifest && sceneState !== "fallback" && worldNavigator && (!reading || sceneHasMounted) && <div className="island-canvas" aria-hidden="true"><SceneBoundary onFail={failed}><Scene manifest={manifest} navigator={worldNavigator} active={visible && !reading} reducedMotion={reducedMotion} panelOpen={!!pavilion || mapOpen} interactionBlocked={modalOpen || !started} autoQuality={qualityPreference === "auto"} pavilionId={pavilion} resetEpoch={resetEpoch} quality={quality} weather={weather} season={season} phase={phase} clock={environment.timeRef} zoom={zoom} onZoom={setZoom} intro={!started} onInteract={playSelection} onThunder={playThunder} onReady={ready} onFail={failed} onArrive={arrived} onSelect={choose} onProject={projectLabels} onPerformance={recordPerformance} /></SceneBoundary></div>}
        <nav className="island-pavilions" aria-label="Ambientes da pesquisa">{pavilionIds.map(id => <button key={id} data-pavilion={id} className={`island-label${selectedIsland === id ? " is-selected" : ""}`} style={{ left: `${labelLeft(id)}%`, top: `${Math.min(93, Math.max(7, currentLabels[id].y))}%` }} aria-label={`${names[id]}: ${descriptions[id]}`} aria-current={selectedIsland === id ? "true" : undefined} onClick={event => choose(id, event.currentTarget)}><span aria-hidden="true">{pavilionIds.indexOf(id) + 1}</span><strong>{names[id]}</strong></button>)}</nav>
      </div>
      {!started && <section className="island-introduction" aria-labelledby="welcome-title">
        <p className="island-eyebrow"><span /> UMA PESQUISA PARA EXPLORAR</p>
        <h1 id="welcome-title">Se a IA escreve código,<br /><em>o que cabe a nós?</em></h1>
        <p className="island-welcome-copy">Sou Pedro Arthur. No meu TCC, investiguei como a inteligência artificial muda o trabalho de quem desenvolve software.</p>
        <p className="island-welcome-detail">Sete ilhas contam essa investigação, da pergunta inicial às conclusões.</p>
        <div className="island-start-actions"><button className="island-enter" onClick={start}><Play size={17} fill="currentColor" aria-hidden="true" />Explorar as ilhas<ArrowRight size={18} aria-hidden="true" /></button><a className="island-read-start" href={readingHref("pesquisa")}><BookOpen size={17} aria-hidden="true" />Ler a pesquisa</a></div>
        <p className="island-loading-note" role="status">{sceneState === "loading" ? "Preparando o jardim… você já pode entrar." : "Um jardim para explorar. Uma pesquisa para compreender."}</p>
      </section>}
      {started && <>
        <div className="island-world-caption"><span>ILHAS DA PESQUISA</span><button className="island-season-status" onClick={event => openCredits(event.currentTarget)} aria-label={`Ambiente: ${seasonInfo[season].name}, ${weatherNames[weather]}. Abrir créditos`}><WeatherIcon size={15} aria-hidden="true" /><span>{seasonInfo[season].name} · {weatherNames[weather]}</span></button><small><time>{environment.clock}</time> · Horário do jardim</small></div>
        <div className="island-zoom" aria-label="Zoom do jardim"><button aria-label="Aproximar o jardim" onClick={() => setZoom(value => Math.min(manifest?.cameraBounds?.maxZoom ?? 2, value + .15))} disabled={zoom >= (manifest?.cameraBounds?.maxZoom ?? 2)}><Plus size={17} aria-hidden="true" /></button><button aria-label="Afastar o jardim" onClick={() => setZoom(value => Math.max(manifest?.cameraBounds?.minZoom ?? .8, value - .15))} disabled={zoom <= (manifest?.cameraBounds?.minZoom ?? .8)}><Minus size={17} aria-hidden="true" /></button><button aria-label="Restaurar enquadramento" onClick={() => { setZoom(1); setResetEpoch(value => value + 1); }}><RotateCcw size={15} aria-hidden="true" /></button></div>
        <div className="island-map-preview"><button ref={returnButton} className="island-map-launch" aria-label="Abrir mapa da pesquisa" onClick={event => openMap(event.currentTarget)}><span>Mapa · 7 ilhas<kbd>M</kbd></span><WorldMap selected={selectedIsland} onSelect={choose} /></button></div>
        <p className="island-status" role="status" aria-live="polite">{sceneState === "fallback" ? "Modo leve · os resumos e a leitura continuam disponíveis." : sceneState === "loading" ? "Preparando as ilhas. Os resumos já estão disponíveis." : selectedIsland ? `Ilha ${pavilionIds.indexOf(selectedIsland) + 1} · ${names[selectedIsland]}` : "Arraste para girar · role para aproximar · escolha uma ilha"}</p>
      </>}
    </main>
    {reading && <main ref={reader} className="island-reading" data-reader-layout="v10" inert={modalOpen} aria-label="Caderno da pesquisa"><div className="island-reading-inner">
      <div className="island-reading-toolbar"><button onClick={() => { setStarted(true); closeContent(); }}><ArrowLeft size={16} aria-hidden="true" />Voltar às ilhas</button><span>{readingTheme === "fontes" ? "Método e fontes" : `Tema ${pavilionIds.indexOf(readingTheme) + 1} de 7 — ${names[readingTheme]}`}</span><a href="/tcc-pedro-arthur.pdf" target="_blank" rel="noreferrer">PDF<ExternalLink size={14} aria-hidden="true" /></a></div>
      <h1 className="island-visually-hidden" ref={readerHeading} tabIndex={-1}>Caderno — Do código à supervisão</h1>
      <DeferredResearch>{({ ResearchReading }) => <ResearchReading initialSection={readingAnchor} updates={updates} newsState={newsState} onThemeChange={theme => { setReadingTheme(theme); if (theme !== "fontes") setSelectedIsland(theme); }} />}</DeferredResearch>
    </div></main>}
    {modalOpen && <div className={`island-dialog-backdrop${creditsOpen ? " island-dialog-backdrop--options" : pavilion ? " island-dialog-backdrop--station" : ""}`} data-panel-layout={pavilion?"v14":undefined} onPointerDown={event => { if (event.target === event.currentTarget) closeContent(); }}>
      <aside ref={panel} className={`island-panel${mapOpen ? " island-panel--map" : ""}${pavilion ? " island-panel--station" : ""}${creditsOpen ? " island-panel--options" : ""}`} data-pavilion-panel={pavilion ?? ""} data-panel-layout={pavilion ? "v14" : undefined} role="dialog" aria-modal="true" aria-labelledby="island-panel-title" tabIndex={-1}>
        <div className="island-panel-bar"><span>{creditsOpen ? "" : mapOpen ? "SETE ILHAS, UMA PESQUISA" : `${String(pavilionIds.indexOf(pavilion!) + 1).padStart(2, "0")} / 07 · ${names[pavilion!].toUpperCase()}`}</span><div className="island-panel-controls">{!creditsOpen && !pavilion && audioControl}<button onClick={closeContent} aria-label="Fechar e voltar às ilhas"><kbd>ESC</kbd><X size={22} aria-hidden="true" /></button></div></div>
        <h2 id="island-panel-title" ref={panelHeading} tabIndex={-1}>{creditsOpen ? (showSettings?"Opções e créditos":"Créditos") : mapOpen ? "Escolha uma ilha" : names[pavilion!]}</h2>
        {mapOpen && <><p className="island-panel-deck">Siga as pontes de 1 a 7 ou escolha um tema para começar.</p><WorldMap selected={selectedIsland} onSelect={id => choose(id)} expanded /><p className="island-map-note">Cada ilha traz uma síntese do TCC e o acesso ao capítulo correspondente.</p></>}
        {pavilion && <>
          <DeferredResearch>{({ PavilionContent }) => <PavilionContent key={pavilion} pavilionId={pavilion} updates={updates} newsState={newsState} onInteract={playSelection} />}</DeferredResearch>
          <nav className="island-chapter-navigation" aria-label="Sequência da pesquisa">
            <a className="rc-summary-read" href={readingHref(pavilion)}><BookOpen size={24} aria-hidden="true" />Ler este tema no caderno</a>
            {nextChapter ? <button className="island-next-chapter" onClick={event => choose(nextChapter, event.currentTarget)}>Próxima ilha · {names[nextChapter]}<ArrowRight size={21} aria-hidden="true" /></button> : <button className="island-next-chapter" onClick={closeContent}>Voltar ao jardim<ArrowRight size={21} aria-hidden="true" /></button>}
          </nav>
        </>}
        {creditsOpen && <div className="island-credits">
          {showSettings && <><section aria-labelledby="weather-settings-title"><h3 id="weather-settings-title">Clima do jardim</h3><p>Uma paisagem imaginária: o céu muda aleatoriamente e o dia passa devagar. Você também pode escolher o clima.</p><div className="island-weather-choices">{weatherKinds.filter(value => value !== "dusk").map(value => <button key={value} aria-pressed={weather === value && environment.mode === "manual"} onClick={() => environment.manualWeather(value)}>{weatherNames[value]}</button>)}</div><button className="island-preference-reset" onClick={environment.automatic} aria-pressed={environment.mode === "automatic"}>Clima aleatório automático</button><h3>Hora do jardim · {environment.clock}</h3><p>Um dia completo dura cerca de 12 minutos. O relógio continua independente do clima.</p><div className="island-weather-choices">{([{label:"Amanhecer",hour:6.3},{label:"Dia",hour:13},{label:"Entardecer",hour:17.5},{label:"Noite",hour:21.5}]).map(value => <button key={value.label} onClick={() => environment.setTime(value.hour)}>{value.label}</button>)}</div></section>
          <div className="island-preferences"><h3>Estação · {seasonInfo[season].name}</h3><p className="island-weather-explanation">O jardim é inspirado em {seasonRegion}. Folhagem e flores interpretam cada estação. Neve e granizo são efeitos ilustrativos deste mundo, sem representar uma previsão do tempo.</p><div className="island-weather-choices">{(["spring","summer","autumn","winter"] as const).map(value => <button key={value} aria-pressed={season === value} onClick={() => setSeason(value)}>{seasonInfo[value].name}</button>)}</div><button className="island-preference-reset" onClick={() => setSeason(getSeason())}>Usar a estação atual</button>
            <h3>Movimento e imagem</h3><button className="island-preference-button" aria-pressed={!reducedMotion} onClick={() => rememberMotion(reducedMotion ? "full" : "reduced")}>Animações do jardim</button>{motionPreference !== "system" && <button className="island-preference-reset" onClick={() => rememberMotion("system")}>Usar preferência do dispositivo</button>}
            {sceneState === "fallback" && <button className="island-preference-button" onClick={retryScene}>Tentar abrir o jardim em 3D</button>}<button className="island-preference-button" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}{fullscreen ? " Sair da tela cheia" : " Tela cheia"}</button>
            <div className="island-weather-choices">{(["auto","high","low"] as const).map(value => <button key={value} aria-pressed={qualityPreference === value} onClick={() => { setQualityPreference(value); setQuality(value === "high" ? "high" : "low"); }}>{value === "auto" ? "Qualidade automática" : value === "high" ? "Detalhada" : "Leve"}</button>)}</div>
            <h3>Música e sons</h3><p>Uma trilha instrumental de Genshin acompanha o jardim. Chuva, vento, aves e cliques têm volumes independentes.</p><button className="island-preference-button" data-audio-control onClick={toggleAudio}>{audioLabel}</button><button className="island-preference-button" data-audio-control onClick={testSound}>Testar som</button>
            <p className="island-sound-result" role="status">{audioState === "on" && musicStatus?.status === "playing" ? `Tocando: ${musicStatus.title}` : audioState === "on" && musicStatus?.status === "loading" ? "Carregando a música…" : audioState === "on" && musicStatus?.error ? musicStatus.error : soundTest}</p>
            <div className="island-volume-controls">{[{id:"music",label:"Música",value:musicVolume,set:setMusicVolume},{id:"ambience",label:"Chuva, vento e aves",value:ambienceVolume,set:setAmbienceVolume},{id:"effects",label:"Cliques e chegada",value:effectsVolume,set:setEffectsVolume}].map(item => <div key={item.id}><label htmlFor={`island-${item.id}-volume`}>{item.label}<output>{Math.round(item.value*100)}%</output></label><input id={`island-${item.id}-volume`} aria-label={`Volume de ${item.label.toLowerCase()}`} type="range" min="0" max="100" step="1" value={Math.round(item.value*100)} onChange={event => item.set(Number(event.currentTarget.value)/100)} /></div>)}</div>
          </div>
          </>}
          <h3>Créditos musicais</h3><p>Trilha instrumental de <a href="https://genshin.hoyoverse.com/en/home" target="_blank" rel="noreferrer">Genshin Impact — site oficial</a>, HOYO-MiX / COGNOSPHERE. Uso neste projeto pessoal e não comercial conforme a <a href="https://www.hoyolab.com/article/143107" target="_blank" rel="noreferrer">FAQ oficial</a>, consultada em 12/10/2026. © All rights reserved by COGNOSPHERE. Other properties belong to their respective owners.</p><p>Esta pesquisa é independente e não possui vínculo ou aprovação da HoYoverse. A trilha é revogável pelos titulares. Não foi extraída do YouTube nem modificada; volume e fades são aplicados durante a reprodução.</p>
          <h3>Som e materiais</h3><p>Efeitos: <a href="https://kenney.nl/assets/interface-sounds" target="_blank" rel="noreferrer">Interface Sounds — Kenney</a>, CC0. Aves: <a href="https://freesound.org/people/JohnsonBrandEditing/sounds/434024/" target="_blank" rel="noreferrer">Bird, Robin Isolated — JohnsonBrandEditing</a>, CC0, em quatro trechos com fades. <a href="/experience/audio/audio-manifest.json" target="_blank" rel="noreferrer">Fontes e licenças dos recursos sonoros</a>.</p>
          <p>Texturas: <a href="https://polyhaven.com/a/white_plaster_02" target="_blank" rel="noreferrer">White Plaster 02 — Rob Tuytel</a>, <a href="https://polyhaven.com/a/oak_veneer_01" target="_blank" rel="noreferrer">Oak Veneer 01 — Jenelle van Heerden</a> e <a href="https://polyhaven.com/a/stone_tiles_02" target="_blank" rel="noreferrer">Stone Tiles 02 — Charlotte Baglioni</a>, sob <a href="https://polyhaven.com/license" target="_blank" rel="noreferrer">CC0</a>.</p><p><a href="/revisao">Área do autor<ExternalLink size={13} aria-hidden="true" /></a></p>
        </div>}
      </aside>
    </div>}
    {(audioState === "error" || screenNotice) && <div className="island-toast" role="status">{audioState === "error" ? "O som não iniciou. Tente novamente pelo controle de som." : screenNotice}<button aria-label="Fechar aviso" onClick={() => { setScreenNotice(""); if (audioState === "error") setAudioState("off"); }}><X size={14} /></button></div>}
  </div>;
}
