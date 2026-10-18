"use client";

import { weatherKinds, weatherNames, type Weather } from "@/lib/experience/weather.mjs";
import { seasonInfo, type Season } from "@/lib/experience/seasons.mjs";

type Props = {
  weather: Weather; mode: "automatic" | "manual"; hour: number;
  onWeather: (value: Weather) => void; onAutomatic: () => void; onTime: (hour: number) => void;
  season: Season; onSeason: (value: Season) => void; onCurrentSeason: () => void;
  music: number; ambience: number; effects: number;
  onMusic: (value: number) => void; onAmbience: (value: number) => void; onEffects: (value: number) => void;
  readingQuiet: boolean; onReadingQuiet: (value: boolean) => void;
  currentTrack?: string; musicPlaying: boolean; onNextMusic: () => void;
};

export default function EnvironmentControls(props: Props) {
  return <div className="garden-options" data-audio-control>
    <p className="garden-options-intro">Deixe o jardim no seu ritmo.</p>
    <fieldset><legend>Estações</legend><div className="garden-choices">
      {(["spring", "summer", "autumn", "winter"] as const).map(season => <button key={season} aria-pressed={props.season === season} onClick={() => props.onSeason(season)}>{seasonInfo[season].name}</button>)}
      <button onClick={props.onCurrentSeason}>Usar a estação atual</button>
    </div></fieldset>
    <fieldset><legend>Paisagem</legend><div className="garden-choices">
      <button aria-pressed={props.mode === "automatic"} onClick={props.onAutomatic}>Automático</button>
      {weatherKinds.map(weather => <button key={weather} aria-pressed={props.mode === "manual" && props.weather === weather} onClick={() => props.onWeather(weather)}>{weatherNames[weather]}</button>)}
    </div><p>O clima e o horário fazem parte deste jardim imaginário.</p></fieldset>
    <fieldset><legend>Hora do jardim</legend><div className="garden-choices">
      {([{ label: "Manhã", hour: 8 }, { label: "Tarde", hour: 14 }, { label: "Pôr do sol", hour: 17.5 }, { label: "Noite", hour: 21 }] as const).map(item => <button key={item.label} onClick={() => props.onTime(item.hour)}>{item.label}</button>)}
    </div></fieldset>
    <fieldset><legend>Música e natureza</legend>
      <p className="garden-now-playing" aria-live="polite">{props.musicPlaying && props.currentTrack ? `Tocando: ${props.currentTrack}` : "Cinco músicas de Genshin, em ordem aleatória."}</p>
      <div className="garden-choices garden-next-track"><button disabled={!props.musicPlaying || props.music === 0} onClick={props.onNextMusic}>Próxima música</button></div>
      <div className="garden-choices"><button aria-pressed={props.music > 0} onClick={() => props.onMusic(.68)}>Música e ambiente</button><button aria-pressed={props.music === 0} onClick={() => { props.onMusic(0); if (!props.ambience) props.onAmbience(.12); }}>Só natureza</button></div>
      <div className="island-volume-controls">{[
        { id: "music", label: "Música", value: props.music, change: props.onMusic },
        { id: "nature", label: "Chuva, vento e aves", value: props.ambience, change: props.onAmbience },
        { id: "effects", label: "Cliques e chegada", value: props.effects, change: props.onEffects },
      ].map(item => <div key={item.id}><label htmlFor={`garden-${item.id}`}>{item.label}<output>{Math.round(item.value * 100)}%</output></label><input id={`garden-${item.id}`} type="range" min="0" max="100" step="1" value={Math.round(item.value * 100)} onChange={event => item.change(Number(event.target.value) / 100)} /></div>)}</div>
      <label className="garden-check"><input type="checkbox" checked={props.readingQuiet} onChange={event => props.onReadingQuiet(event.target.checked)} />Suavizar a música enquanto leio</label>
    </fieldset>
  </div>;
}
