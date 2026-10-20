import type { Vec3, PavilionId, WorldEnvironmentManifest } from '../experience-contract';
import type { Weather } from './weather.mjs';
export const ISLAND_LIFE_VERSION: 20;
export const RESIDENT_SCALE: 1.4;
export const RESIDENT_HEIGHT: 1.76;
export type ResidentPhase = 'walking' | 'watering' | 'gathering' | 'observing' | 'fishing' | 'walk-home' | 'returning' | 'entering' | 'interior' | 'exiting' | 'to-porch' | 'porch' | 'sitting';
export type LifeObstructions = { terrace: { radius?: number; halfWidth?: number; halfDepth?: number }; beds: number[][]; trunks: number[][] };
export type WalkingNode = { position: Vec3; island?: PavilionId };
export type WalkingEdge = { id: string; from: string; to: string; points: Vec3[]; length: number; kind: 'island' | 'bridge' | 'connector' | 'home' | 'door' | 'furniture'; island?: PavilionId; bridge?: string };
export type LifeRouteStep = { edgeId: string; from: string; to: string; points: Vec3[]; length: number };
export type LifeRoute = { points: Vec3[]; steps: LifeRouteStep[]; length: number; destination: string };
export type LifeActivity = { id: string; node: string; kind: 'watering' | 'gathering' | 'observing' | 'fishing' | 'sitting'; seatHeight?: number; island?: PavilionId; bridge?: string; position: Vec3; target: Vec3; duration: number };
export type IslandLifeLayout = {
 version: 20; island: 'moradia';
 islet: { id: 'moradia'; center: [number, number]; radius: number; height: number };
 connector: { points: Vec3[]; width: number };
 landings: { points: Vec3[]; width: number }[];
 home: { position: Vec3; yaw: number; footprint: [number, number]; porch: Vec3; height: number; porchDepth: number; porchWidth: number; floorHeight: number; wallHeight: number; roofRise: number; workPoint: Vec3; door: Vec3; doorOutside: Vec3; interior: Vec3; seated: Vec3; interiorSeated: Vec3; window: Vec3; seatHeight: number; bench: { position: Vec3; width: number; seatHeight: number } };
 resident: { scale: number; height: number; initialPathDistance: number; walkSpeed: number; runSpeed: number; dryDelay: number };
 fishing: { position: Vec3; target: Vec3 };
 garden: { position: Vec3; standing: Vec3; target: Vec3 };
 tree: { position: Vec3; standing: Vec3; fruit: Vec3; existingNode: string };
 paths: { toFish: Vec3[]; toTree: Vec3[]; toHome: Vec3[] };
 bridge: { from: 'perspectivas'; to: 'pesquisa'; node: string; width: number; points: Vec3[] };
 walkingGraph: { nodes: Record<string, WalkingNode>; edges: WalkingEdge[]; bridges: { id: string; from: PavilionId; to: PavilionId; points: Vec3[]; width: number }[]; obstacles: Record<string, LifeObstructions> };
 activityPoints: LifeActivity[];
};
export type ResidentContext = { moving?: boolean; visible?: boolean; reducedMotion?: boolean; intro?: boolean; panelOpen?: boolean; reading?: boolean; weather?: Weather; precipitation?: number; hour?: number; night?: number };
export type ResidentState = {
 phase: ResidentPhase; phaseTime: number; elapsed: number; cycle: number; distanceMoved: number;
 routeDistance: number; route: Vec3[]; routeSteps: LifeRouteStep[]; destination: string; node: string;
 position: Vec3; heading: number; gait: number; gesture: number; hidden: boolean;
 shelterReason: 'weather' | 'night' | null; nightRest: boolean; sleepBlend: number; activityIndex: number; activityId: string; activityTarget: Vec3;
 dryTime: number; weatherTime: number; doorOpen: number; inside: boolean; resumeActivityIndex: number;
 fishingSeed:number; fishingBag:string[]; lastFishing:string|null; fishingVisits:number; fishingWait:number; fishingSuccess:boolean;
};
export type ResidentPose = {
 x: number; y: number; z: number; heading: number; leftLeg: number; rightLeg: number;
 leftArm: number; rightArm: number; leftElbow: number; rightElbow: number; lean: number;
 rod: boolean; fruit: boolean; hidden: boolean; rodTilt: number; seated: boolean;
 catchLift: number; caughtFish: boolean; fishingBite: boolean; sleeping: boolean; sleepBlend: number;
 leftKnee: number; rightKnee: number; bodyOffsetY: number; watering: boolean; wateringTilt: number;
 doorOpen: number; inside: boolean; entering: boolean; activityTarget: Vec3 | null; fishingTarget: Vec3 | null;
};
export function residentBed(home: IslandLifeLayout['home']): { center: Vec3; foot: Vec3; width: number; length: number; yaw: number };
export function fishingMoment(seconds: number,options?:{wait?:number;success?:boolean}): { bite: boolean; lift: number; caught: boolean; show: boolean };
export function createIslandLifeLayout(environment: WorldEnvironmentManifest): IslandLifeLayout;
export function homeLocalPoint(home: Pick<IslandLifeLayout['home'], 'position' | 'yaw'>, local: Vec3, output?: Vec3): Vec3;
export function bridgeSurfaceSegments(layout: IslandLifeLayout): WorldEnvironmentManifest['bridges'];
/** New rendered bridges only: retained closing bridge plus home connector. */
export function lifeSurfaceSegments(layout: IslandLifeLayout): WorldEnvironmentManifest['bridges'];
/** All seven physical pedestrian bridges plus the home connector. */
export function walkingSurfaceSegments(layout: IslandLifeLayout): WorldEnvironmentManifest['bridges'];
export function bridgePillars(layout: IslandLifeLayout): { position: Vec3; radius: number }[];
export function pathLength(points: Vec3[]): number;
export function sampleLifePath(points: Vec3[], metres: number, output?: Vec3): Vec3;
export function isIslandWalkingPoint(point: Vec3, island: WorldEnvironmentManifest['land'][number], obstructions?: LifeObstructions): boolean;
export function planLifeRoute(layout: IslandLifeLayout, from: string, to: string): LifeRoute;
export function residentReturnRoute(state: ResidentState, layout: IslandLifeLayout, destination?: string): LifeRoute;
export function residentShelterReason(context: ResidentContext): 'weather' | 'night' | null;
export function residentPauseReason(context: ResidentContext): 'hidden' | 'paused' | 'reduced-motion' | null;
export function createResidentState(layout: IslandLifeLayout,seed?:number): ResidentState;
/** dt is bounded to 100 ms; pause consumes neither movement nor dry/weather time. */
export function advanceResident(state: ResidentState, seconds: number, context: ResidentContext, layout: IslandLifeLayout): ResidentState;
export function writeResidentPose<T extends Partial<ResidentPose>>(output: T, state: ResidentState, layout?: IslandLifeLayout): T & ResidentPose;

