import type { PavilionId, Vec3, WorldManifest } from "../experience-contract";
export type NavigationGraph = WorldManifest["navigation"];
export type Arrival = { id: PavilionId; token: number };
export function distance(a: Vec3, b: Vec3): number;
export function nearestNode(graph: NavigationGraph, position: Vec3): string;
export function shortestPath(graph: NavigationGraph, start: string, end: string): { nodes: string[]; distance: number };
export class WorldNavigator {
  constructor(graph: NavigationGraph, spawn: Vec3, speed?: number);
  position: Vec3;
  graph: NavigationGraph;
  speed: number;
  heading: number;
  node: string;
  segment: { from: string; to: string } | null;
  destination: PavilionId | null;
  token: number;
  walking: boolean;
  select(id: PavilionId, immediate?: boolean): Arrival | null;
  cancel(): void;
  advance(seconds: number): Arrival | null;
}
export function advanceWorld(navigator: WorldNavigator, seconds: number): Arrival | null;
export class FrameCadence {
  reset(): void;
  sample(seconds: number): { sampled: boolean; elapsed: number };
}
