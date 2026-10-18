import IslandExperience from "@/components/island-experience";
import { EARLY_AUDIO_SCRIPT } from "@/lib/experience/early-audio-script";
export default function ResearchWorld({showSettings=false}:{showSettings?:boolean}) { return <>
  <audio id="tcc-entry-music" preload="auto" src="/experience/audio/genshin-official-theme.mp3" hidden aria-hidden="true" />
  <script dangerouslySetInnerHTML={{__html:EARLY_AUDIO_SCRIPT}} />
  <link rel="preload" href="/experience/world/archipelago-v19-low.glb" as="fetch" crossOrigin="anonymous" fetchPriority="high" />
  <link rel="preload" href="/experience/world/manifest-v20.json" as="fetch" crossOrigin="anonymous" />
  <link rel="preload" href="/experience/world/draco/draco_wasm_wrapper.js" as="fetch" crossOrigin="anonymous" />
  <link rel="preload" href="/experience/world/draco/draco_decoder.wasm" as="fetch" crossOrigin="anonymous" />
  <IslandExperience showSettings={showSettings}/>
</>; }
