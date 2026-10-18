import type { EnvironmentState } from './environment.mjs';
import type { Weather } from './weather.mjs';
import type { Vec3, WorldEnvironmentManifest } from '../experience-contract';
export function advanceLake<T extends Pick<EnvironmentState, 'waterStorage' | 'outflow' | 'waterLevel' | 'ice'> & {overflowing?: boolean}>(state: T, seconds: number, weather: Weather, melt?: number): T;
export function lakeWaveParameters(wind?: number, ice?: number): { amplitude: number; speed: number };
export function lakeWaveHeight(x: number, z: number, seconds: number, wind?: number, ice?: number): number;
export function lakeSpillway(environment: WorldEnvironmentManifest): { position: Vec3; direction: [number, number]; yaw: number; width: number; length: number; drop: number };
