import type {WorldManifest} from '@/lib/experience-contract';
import {createResidentState} from './island-life.mjs';
import {createGreeting} from './garden-interactions.mjs';
import {createFeedSpot} from './fish-feeding.mjs';
import {createWaterTouches} from './garden-interactions.mjs';
import {createEnvironmentState} from './environment.mjs';
import {createSkyEvents} from './sky-events.mjs';
export function createGardenRuntime(manifest:WorldManifest) {
  return {resident:createResidentState(manifest.islandLife!),greeting:createGreeting(),feedSpot:createFeedSpot(),touches:createWaterTouches(),environment:createEnvironmentState(),sky:createSkyEvents()};
}
export type GardenRuntime=ReturnType<typeof createGardenRuntime>;
