import catalog from "../../../public/experience/audio/audio-manifest.json";

/** Shared handoff only. The bootstrap never allocates Web Audio or another player. */
export type EntryAudioBootstrap = {
  element: HTMLAudioElement;
  trackIndex: number;
  desired: boolean;
  silenced: boolean;
  gesture: boolean;
  entryRequested: boolean;
  status: "loading" | "playing" | "blocked" | "paused" | "off" | "error";
  error: string | null;
  pending: Promise<void> | null;
  owner: object | null;
  startedAtMs: number | null;
  claim(owner: object): HTMLAudioElement;
  release(owner: object): void;
  setEnabled(enabled: boolean): void;
  rememberTrack(index: number, time: number): void;
};

declare global {
  interface Window { __tccEntryAudio?: EntryAudioBootstrap }
}

// Trusted static source, inserted immediately after the server-rendered audio.
// Both startup and the hydrated player read the same locally hosted catalog.
export const EARLY_AUDIO_SCRIPT = String.raw`(() => {
  if (window.__tccEntryAudio) return;
  const element = document.getElementById("tcc-entry-music");
  if (!element) return;
  const tracks = ${JSON.stringify(catalog.playlist.map(({ url, volume, startAtSeconds }) => ({ url, volume, startAtSeconds })))};
  const trackIndex = Math.min(tracks.length - 1, Math.floor(Math.random() * tracks.length));
  const track = tracks[trackIndex];
  let cue = track.startAtSeconds || 0;
  element.src = track.url;
  element.preload = "auto";
  let positioned = false, claimedOnce = false, epoch = 0;
  const publish = () => { document.documentElement.dataset.entryAudioStatus = state.status; document.documentElement.dataset.entryAudioTrack = String(state.trackIndex); };
  const state = window.__tccEntryAudio = {
    element, trackIndex, desired: true, silenced: false, gesture: false, entryRequested: false,
    status: "loading", error: null, pending: null, owner: null, startedAtMs: null,
    claim(owner) { epoch++; claimedOnce = true; this.owner = owner; return element; },
    release(owner) { if (this.owner === owner) { this.owner = null; this.pending = null; epoch++; } },
    rememberTrack(index, time) {
      if (!tracks[index]) return;
      this.trackIndex = index; cue = Math.max(0, time); positioned = false;
      element.addEventListener("loadedmetadata", position);
      if (element.getAttribute("src") !== tracks[index].url) element.src = tracks[index].url;
      position(); publish();
    },
    setEnabled(enabled) {
      this.desired = enabled; this.silenced = !enabled;
      if (!enabled) { epoch++; this.pending = null; element.pause(); this.status = "off"; publish(); }
      else if (!claimedOnce) attempt();
    }
  };
  element.volume = track.volume;
  const position = () => {
    if (positioned || element.readyState < 1) return;
    try {
      element.currentTime = Math.min(cue, Number.isFinite(element.duration) && element.duration > 0 ? Math.max(0, element.duration - 2) : cue);
      positioned = true;
      element.removeEventListener("loadedmetadata", position);
    } catch { /* Metadata may not be seekable yet; leave the listener installed. */ }
  };
  element.addEventListener("loadedmetadata", position);
  position();
  function attempt() {
    if (claimedOnce || !state.desired || document.hidden || state.pending || !element.paused) return;
    const token = ++epoch;
    state.status = "loading"; state.error = null; publish();
    let result;
    try { result = element.play(); } catch (error) { result = Promise.reject(error); }
    const pending = Promise.resolve(result);
    void pending.then(() => {
      if (token !== epoch) {
        if (!state.desired || document.hidden || !state.owner && claimedOnce) element.pause();
        return;
      }
      if (!state.desired || document.hidden) { element.pause(); return; }
      state.status = "playing";
      if (state.startedAtMs === null) state.startedAtMs = performance.now();
      document.documentElement.dataset.entryAudioFirstPlayMs = String(state.startedAtMs);
      publish();
    }, error => {
      if (token !== epoch || claimedOnce) return;
      state.status = error && error.name === "NotAllowedError" ? "blocked" : "error";
      state.error = error && error.message ? error.message : "A música não pôde ser iniciada.";
      publish();
    }).finally(() => { if (state.pending === pending) state.pending = null; });
    state.pending = pending;
  }
  const gesture = event => {
    if (claimedOnce || event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    const toggle = event.target && event.target.closest && event.target.closest("[data-entry-audio-toggle]");
    if (toggle) return; // The actual click below owns this button until hydration.
    if (state.silenced || event.target && event.target.closest && event.target.closest("[data-audio-control]")) return;
    state.gesture = true;
    // A pending automatic play may be blocked. Retry synchronously in this gesture.
    if (state.pending && element.paused) { epoch++; state.pending = null; }
    attempt();
  };
  document.addEventListener("pointerdown", gesture, true);
  document.addEventListener("keydown", gesture, true);
  document.addEventListener("click", event => {
    if (claimedOnce) return;
    if (event.target && event.target.closest && event.target.closest("[data-entry-audio-toggle]")) {
      state.gesture = true; state.setEnabled(state.silenced || state.status === "blocked" || state.status === "error");
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (!claimedOnce && event.target && event.target.closest && event.target.closest(".island-enter")) {
      state.entryRequested = true; document.documentElement.dataset.entryRequested = "true";
    }
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (claimedOnce) return;
    if (document.hidden) { epoch++; element.pause(); state.pending = null; state.status = state.desired ? "paused" : "off"; publish(); }
    else attempt();
  });
  element.addEventListener("playing", () => {
    if (!state.desired || document.hidden) { element.pause(); return; }
    state.status = "playing"; state.error = null; publish();
    if (state.startedAtMs === null) {
      state.startedAtMs = performance.now();
      document.documentElement.dataset.entryAudioFirstPlayMs = String(state.startedAtMs);
    }
  });
  element.addEventListener("pause", () => { state.status = state.desired ? "paused" : "off"; publish(); });
  element.addEventListener("error", () => {
    state.status = "error"; state.error = element.error && element.error.message || "A música não pôde ser carregada."; publish();
  });
  publish();
  document.documentElement.dataset.entryAudioBootMs = String(performance.now());
  attempt();
})();`;
