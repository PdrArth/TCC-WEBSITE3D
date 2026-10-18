"use client";
import { pavilionIds, islandNames, islandDescriptions, type PavilionId } from "@/lib/experience-contract";
import "./world-map.css";
export interface WorldMapProps { selected: PavilionId | null; onSelect: (id: PavilionId) => void; expanded?: boolean; visited?: PavilionId[]; }
const miniPositions = [[25, 111], [21, 69], [39, 29], [84, 16], [129, 29], [147, 69], [143, 111]];
const colors = ["#b29c76", "#7eaa95", "#a5b7b7", "#879aaf", "#c89575", "#a7aa7d", "#b9ae91"];
/** Compact schematic inside the launcher; numbered chapters in the expanded map. */
export default function WorldMap({ selected, onSelect, expanded = false, visited = [] }: WorldMapProps) {
  if (!expanded) return <svg className="wm-mini" viewBox="0 0 168 133" aria-hidden="true"><path d="M25 111L21 69L39 29L84 16L129 29L147 69L143 111Q84 139 25 111" fill="none" stroke="#a4ad9c" strokeWidth="3" />{pavilionIds.map((id, index) => <g key={id} transform={`translate(${miniPositions[index][0]} ${miniPositions[index][1]})`}><ellipse cy="4" rx="16" ry="11" fill="#263a3522" /><ellipse rx="16" ry="11" fill={colors[index]} stroke={selected === id ? "#284d40" : "#fcfaf2"} strokeWidth="2" /><text textAnchor="middle" dy="4" fill="#263a35" fontSize="11" fontWeight="600">{index + 1}</text></g>)}</svg>;
  const visual = (id: PavilionId) => <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/experience/world/thumb-v8-${id}.webp`} alt="" loading="lazy" onError={event => { const image = event.currentTarget; if (!image.src.endsWith("/world/poster-v8.webp")) image.src = "/experience/world/poster-v8.webp"; }} />
    <span className="wm-copy"><small>ILHA {String(pavilionIds.indexOf(id) + 1).padStart(2, "0")}</small><strong>{islandNames[id]}</strong><span>{islandDescriptions[id]}</span><span className="wm-visit-state">{selected === id ? "Você está aqui" : visited.includes(id) ? "Visitada" : "Por explorar"}</span></span>
  </>;
  return <div className={`wm-map ${expanded ? "wm-expanded" : "wm-mini"}`} aria-hidden={expanded ? undefined : true}>
    {pavilionIds.map((id, index) => <button key={id} className={`wm-island wm-${id}${selected === id ? " is-selected" : ""}`} onClick={() => onSelect(id)} aria-label={`Ilha ${index + 1}: ${islandNames[id]}`} aria-current={selected === id ? "step" : undefined} aria-pressed={selected === id} data-visited={visited.includes(id)}>{visual(id)}</button>)}
  </div>;
}
