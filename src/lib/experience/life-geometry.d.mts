import type * as THREE from "three";
import type { Vec3 } from "../experience-contract";
import type { IslandLifeLayout } from "./island-life.mjs";

export const LIFE_GEOMETRY_SCHEMA_VERSION: 1;
export const LIFE_GEOMETRY_VERSION: 20;
export type StaticKind = "oak" | "rail" | "plaster" | "roof" | "window" | "stone" | "snow" | "grass" | "foliage";
export type LifeGeometryBatch = { kind: StaticKind; geometry: THREE.BufferGeometry };
export type PreparedLifeAttribute = { arrayType: "Float32Array" | "Uint16Array" | "Uint32Array"; itemSize: number; count: number; normalized: boolean; data: string };
export type PreparedLifeGeometry = {
  schemaVersion: 1;
  version: 20;
  signature: string;
  batches: {
    kind: StaticKind;
    attributes: Record<"position" | "normal" | "uv" | "color", PreparedLifeAttribute>;
    index: PreparedLifeAttribute;
    bounds: { sphere: { center: Vec3; radius: number } };
  }[];
};

export function lifeGeometrySignature(layout: IslandLifeLayout): string;
export function createLifeGeometry(layout: IslandLifeLayout): LifeGeometryBatch[];
/** Creates the publication payload and releases its temporary generated meshes. */
export function prepareLifeGeometry(layout: IslandLifeLayout): PreparedLifeGeometry;
/** Null means absent, invalid, or a layout/recipe mismatch; caller may generate. */
export function restoreLifeGeometry(prepared: PreparedLifeGeometry | null | undefined, layout: IslandLifeLayout): LifeGeometryBatch[] | null;
export function segment(a: Vec3, b: Vec3, radius: number, sides?: number): THREE.BufferGeometry;
export function tintGeometry(geometry: THREE.BufferGeometry, tint?: number): THREE.BufferGeometry;
export function mergePieces(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry;
export function createCaughtFishGeometry(): THREE.BufferGeometry;
