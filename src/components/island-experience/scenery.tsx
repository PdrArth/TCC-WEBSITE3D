"use client";

/* eslint-disable react-hooks/immutability -- Three.js materials and GPU uniforms are mutable render-loop resources. */

import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldEnvironmentManifest } from "@/lib/experience-contract";
import { advanceEnvironment, createEnvironmentManifest, createEnvironmentState, type EnvironmentState } from "@/lib/experience/environment.mjs";
import { FrameCadence } from "@/lib/experience/navigation.mjs";
import { seasonInfo, vegetationDensity, vegetationGroup, type Season, type VegetationGroup } from "@/lib/experience/seasons.mjs";
import type { Weather } from "@/lib/experience/weather.mjs";
import { createFishRoutes, createFishSchools, faunaCount, environmentSeconds, writeFishPose } from "./scene-motion.mjs";
import { lakeSpillway, lakeWaveParameters } from "@/lib/experience/lake-dynamics.mjs";
import {createFeedingFish,advanceFeedingFish,writeFeedingFishPose,type FeedSpot} from '@/lib/experience/fish-feeding.mjs';

type SceneryProps = {
  world: THREE.Object3D;
  season: Season;
  reducedMotion: boolean;
  moving?: boolean;
  windSpeed?: number;
  weather?: Weather;
  environment?: WorldEnvironmentManifest;
  environmentState?: MutableRefObject<EnvironmentState>;
  quality?: "low" | "high";
  feedSpot?:MutableRefObject<FeedSpot>;
};
type ColorKind = "dark" | "sage" | "light" | "deep" | "dry" | "ground";
type MaterialRecord = {
  material: THREE.MeshStandardMaterial;
  base: THREE.Color;
  target: THREE.Color;
  kind: ColorKind | null;
  group: VegetationGroup;
  nodeName: string;
  flower: boolean;
  water: boolean;
  density: { value: number };
};
type GardenBinding = {
  records: MaterialRecord[];
  pivots: { object: THREE.Object3D; rotation: THREE.Euler; flower: boolean }[];
  anchors: { x: number; z: number; top: number; island: string }[];
  groundHeight: number;
  restore: () => void;
};
const noRaycast = () => {};

function colorKind(name: string): ColorKind | null {
  if (/Garden olive dark|Palm leaf/.test(name)) return "dark";
  if (/Garden sage|v9 leaf young/.test(name)) return "sage";
  if (/Garden olive light|Banana leaf/.test(name)) return "light";
  if (/Garden leaf deep|v9 leaf glossy/.test(name)) return "deep";
  if (/Garden dry tip|Grass reed/.test(name)) return "dry";
  if (/Garden topsoil|v9 forest soil/.test(name)) return "ground";
  return null;
}

function foliageOwner(object: THREE.Object3D) {
  let node: THREE.Object3D | null = object;
  let owner: THREE.Object3D | null = null;
  while (node) {
    if (/^ambient_(leaves|flowers)_/.test(node.name)) owner = node;
    node = node.parent;
  }
  return owner;
}

/** Connected laminae receive one seed, so thinning removes whole leaves. */
function addLeafSeeds(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute("seasonalSeed")) return false;
  const prepared=geometry.getAttribute("_seasonal_seed");
  if(prepared){geometry.setAttribute("seasonalSeed",prepared);return false;}
  const position = geometry.getAttribute("position");
  const count = position.count;
  const parents = new Uint32Array(count);
  for (let i = 0; i < count; i++) parents[i] = i;
  const find = (i: number): number => {
    let root = i;
    while (parents[root] !== root) root = parents[root];
    while (parents[i] !== i) { const next = parents[i]; parents[i] = root; i = next; }
    return root;
  };
  const union = (a: number, b: number) => { const x = find(a), y = find(b); if (x !== y) parents[y] = x; };
  const indices = geometry.getIndex();
  if (indices) {
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i); union(a, indices.getX(i + 1)); union(a, indices.getX(i + 2));
    }
  } else {
    // Unindexed fallback joins shared corners without depending on export order.
    const corners = new Map<string, number>();
    for (let i = 0; i < count; i++) {
      const key = `${Math.round(position.getX(i) * 10000)},${Math.round(position.getY(i) * 10000)},${Math.round(position.getZ(i) * 10000)}`;
      const previous = corners.get(key);
      if (previous === undefined) corners.set(key, i); else union(previous, i);
    }
    for (let i = 0; i + 2 < count; i += 3) { union(i, i + 1); union(i, i + 2); }
  }
  const values = new Float32Array(count);
  const seeds = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const root = find(i);
    let seed = seeds.get(root);
    if (seed === undefined) { seed = ((Math.sin(root * 127.1 + 19.19) * 43758.5453) % 1 + 1) % 1; seeds.set(root, seed); }
    values[i] = seed;
  }
  geometry.setAttribute("seasonalSeed", new THREE.BufferAttribute(values, 1));
  return true;
}

function createUniforms(environment: WorldEnvironmentManifest) {
  const outlet = lakeSpillway(environment);
  const lightPositions = environment.lights.map(light => new THREE.Vector3(...light.position));
  const groundPositions = [...environment.land, ...(environment.decorativeLand ?? [])].slice(0, 8).map(land => new THREE.Vector3(land.center[0], land.center[1], land.radius));
  while (groundPositions.length < 8) groundPositions.push(new THREE.Vector3(1000, 1000, 0));
  for (const bridge of environment.bridges) if(bridge.lighting!==false)lightPositions.push(new THREE.Vector3((bridge.from[0] + bridge.to[0]) / 2, bridge.height + .65, (bridge.from[1] + bridge.to[1]) / 2));
  while (lightPositions.length < 13) lightPositions.push(new THREE.Vector3(1000, 1000, 1000));
  return {
    scenicTime: { value: 0 }, scenicWetness: { value: 0 }, scenicSnow: { value: 0 }, scenicIce: { value: 0 }, scenicNight: { value: 0 },
    scenicWaterHeight: { value: environment.water.height }, scenicWaterScale: { value: 1 }, scenicWind: { value: .2 },
    scenicWaterRise: { value: 0 }, scenicWaveAmplitude: { value: .012 }, scenicWaveSpeed: { value: .76 },
    scenicSpillway: { value: new THREE.Vector4(outlet.position[0], outlet.position[2], ...outlet.direction) },
    scenicWaterCenter: { value: new THREE.Vector2(...environment.water.center) },
    scenicWaterRadii: { value: new THREE.Vector2(...environment.water.radii) },
    scenicLand: { value: groundPositions },
    scenicLights: { value: lightPositions.slice(0, 13) },
  };
}
type ScenicUniforms = ReturnType<typeof createUniforms>;

const worldVaryings = `
varying vec3 vScenicPosition;
// x: upward normal, y: exposed surface, z: warm illumination.
varying vec3 vScenicSurface;
`;
const worldUniforms = `
uniform float scenicTime;
uniform float scenicWetness;
uniform float scenicSnow;
uniform float scenicIce;
uniform float scenicNight;
uniform float scenicWaterHeight;
uniform float scenicWaterScale;
uniform float scenicWind;
uniform float scenicWaterRise;
uniform float scenicWaveAmplitude;
uniform float scenicWaveSpeed;
uniform vec4 scenicSpillway;
uniform vec2 scenicWaterCenter;
uniform vec2 scenicWaterRadii;
uniform vec3 scenicLand[8];
uniform vec3 scenicLights[13];
float scenicGrain(vec3 p) {
  return fract(sin(dot(floor(p * 17.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}
float scenicShore(vec2 p) {
  float outer = smoothstep(.80, .98, length((p - scenicWaterCenter) / scenicWaterRadii));
  float inner = 99.0;
  for (int i = 0; i < 8; i++) inner = min(inner, abs(distance(p, scenicLand[i].xy) - scenicLand[i].z));
  return max(outer, 1.0 - smoothstep(.06, .7, inner));
}
float scenicWave(vec2 p) {
  float t = scenicTime * scenicWaveSpeed;
  return scenicWaveAmplitude * (.6 * sin(p.x * .92 + p.y * .37 - t) + .3 * sin(-p.x * .44 + p.y * 1.19 - t * 1.24) + .1 * sin(p.x * 2.1 + p.y * 1.5 - t * 1.8)) * (1.0 - scenicShore(p) * .75);
}
`;
function installSurfaceShader(material: THREE.MeshStandardMaterial, uniforms: ScenicUniforms, density: { value: number }, foliage: boolean, water: boolean, snowEligible: boolean, beacon: boolean, bank = false) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, { scenicDensity: density });
    shader.vertexShader = worldUniforms + worldVaryings + (foliage ? "attribute float seasonalSeed; varying float vSeasonalSeed;\n" : "") + shader.vertexShader;
    shader.fragmentShader = worldUniforms + worldVaryings + (foliage ? "uniform float scenicDensity; varying float vSeasonalSeed;\n" : "") + shader.fragmentShader;
    if (water) shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
      vec2 wavePoint = (modelMatrix * vec4(position, 1.0)).xz;
      float waveDx = (scenicWave(wavePoint + vec2(.06,0.0)) - scenicWave(wavePoint - vec2(.06,0.0))) / .12;
      float waveDz = (scenicWave(wavePoint + vec2(0.0,.06)) - scenicWave(wavePoint - vec2(0.0,.06))) / .12;
      vec3 waveNormal = normalize(vec3(-waveDx, 1.0, -waveDz));
      objectNormal = normalize(vec3(dot(modelMatrix[0].xyz,waveNormal),dot(modelMatrix[1].xyz,waveNormal),dot(modelMatrix[2].xyz,waveNormal)));
    `);
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      ${water ? `
      vec2 waterPoint = (modelMatrix * vec4(position, 1.0)).xz;
      float frozenEdge = 0.0;
      if (scenicIce > .001) frozenEdge = scenicIce * scenicShore(waterPoint);
      transformed.xz *= scenicWaterScale;
      float wave = scenicWave(waterPoint);
      transformed += normal * (scenicWaterRise + wave * (1.0 - frozenEdge * .88));
      ` : ""}
      ${bank ? `
      vec3 bankPoint = (modelMatrix * vec4(position, 1.0)).xyz;
      vec2 fromOutlet = bankPoint.xz - scenicSpillway.xy;
      float across = dot(fromOutlet, vec2(scenicSpillway.w,-scenicSpillway.z));
      float along = dot(fromOutlet, scenicSpillway.zw);
      float channel = (1.0 - smoothstep(.72,1.28,abs(across))) * smoothstep(-.4,-.02,along) * (1.0 - smoothstep(1.7,2.0,along));
      float lower = max(0.0, bankPoint.y - (scenicWaterHeight + .055)) * channel;
      vec3 bankUp = vec3(modelMatrix[0].y,modelMatrix[1].y,modelMatrix[2].y);
      transformed -= bankUp * lower / max(.001,dot(bankUp,bankUp));
      ` : ""}
      vScenicSurface = vec3(0.0, 1.0, 0.0);
      vScenicPosition = vec3(0.0);
      ${water ? "{" : "if (scenicSnow > .001 || scenicIce > .001 || scenicNight > .001) {"}
        vScenicPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        ${!water ? `
        if (scenicNight > .001) {
          for (int i = 0; i < 13; i++) {
            float pool = max(0.0, 1.0 - length((vScenicPosition - scenicLights[i]) * vec3(1.0, .75, 1.0)) / 3.25);
            vScenicSurface.z += pool * pool;
          }
        }
        if (scenicSnow > .001 || scenicIce > .001) {
          vScenicSurface.x = normalize(mat3(modelMatrix) * objectNormal).y;
          vScenicSurface.y = step(scenicWaterHeight + .045, vScenicPosition.y);
          for (int i = 0; i < 7; i++) {
            float indoor = (1.0 - smoothstep(1.9, 2.35, distance(vScenicPosition.xz, scenicLand[i].xy))) * (1.0 - smoothstep(2.8, 3.35, vScenicPosition.y));
            vScenicSurface.y *= 1.0 - indoor;
          }
          ${snowEligible ? "transformed += normal * scenicSnow * smoothstep(.4, .85, vScenicSurface.x) * vScenicSurface.y * .024;" : ""}
        }
        ` : ""}
      }
      ${foliage ? "vSeasonalSeed = seasonalSeed;" : ""}
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      ${foliage ? "if (vSeasonalSeed > scenicDensity) discard;" : ""}
      ${water ? `
      float frozenEdge = 0.0;
      if (scenicIce > .001) {
        float icePatch = scenicGrain(vScenicPosition);
        frozenEdge = scenicShore(vScenicPosition.xz) * smoothstep(icePatch * .5, .5 + icePatch * .5, scenicIce);
      }
      float shimmer = sin(vScenicPosition.x * 1.5 + vScenicPosition.z * .7 + scenicTime * .6) * sin(vScenicPosition.z * 1.3 - scenicTime * .35);
      diffuseColor.rgb *= .98 + shimmer * .085 * (1.0 - frozenEdge);
      float crest = smoothstep(.18,.72,scenicWave(vScenicPosition.xz)/max(.001,scenicWaveAmplitude));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.80,.92,.88), crest * (.065 + scenicWind * scenicWind * .36) * (1.0-scenicIce));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.63, .77, .79), frozenEdge * .88);
      diffuseColor.a = mix(diffuseColor.a, .9, frozenEdge);
      ` : `
      float scenicSnowCover = 0.0;
      float scenicFrost = 0.0;
      if (scenicSnow > .001 || scenicIce > .001) {
        float scenicPatch = scenicGrain(vScenicPosition);
        float scenicUp = smoothstep(.22, .82, vScenicSurface.x);
        scenicSnowCover = ${snowEligible ? "smoothstep(scenicPatch * .74, .22 + scenicPatch * .74, scenicSnow) * scenicUp * vScenicSurface.y" : "0.0"};
        scenicFrost = scenicIce * smoothstep(-.12, .8, vScenicSurface.x) * vScenicSurface.y * (.34 + scenicPatch * .38);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.49, .67, .71), scenicFrost);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.83, .89, .91), scenicSnowCover * .96);
      }
      if (scenicWetness > .001) diffuseColor.rgb *= 1.0 - scenicWetness * .15;
      `}
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      ${water ? "if (scenicIce > .001) roughnessFactor = mix(roughnessFactor, .32, frozenEdge);" : "if (scenicWetness > .001) roughnessFactor = mix(roughnessFactor, max(.18, roughnessFactor * .47), scenicWetness * .75); if (scenicIce > .001) roughnessFactor = mix(roughnessFactor, .15, scenicFrost * .85); if (scenicSnow > .001) roughnessFactor = mix(roughnessFactor, .93, scenicSnowCover);"}
    `);
    if (!water) shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      if (scenicNight > .001) {
        totalEmissiveRadiance += vec3(1.0, .43, .12) * vScenicSurface.z * scenicNight * .24;
        ${beacon ? "totalEmissiveRadiance += vec3(1.0, .68, .27) * scenicNight * 2.3;" : ""}
      }
    `);
  };
  material.customProgramCacheKey = () => `scenic-v22-water-${foliage ? 1 : 0}-${water ? 1 : 0}-${snowEligible ? 1 : 0}-${beacon ? 1 : 0}-${bank ? 1 : 0}`;
  material.needsUpdate = true;
}

function bindGarden(world: THREE.Object3D, uniforms: ScenicUniforms, season: Season): GardenBinding {
  const records: MaterialRecord[] = [], pivots: GardenBinding["pivots"] = [], anchors: GardenBinding["anchors"] = [];
  const assignments: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; renderOrder: number }[] = [];
  const clones = new Map<string, MaterialRecord>();
  const geometries = new Set<THREE.BufferGeometry>();
  const pivotNames = new Set<string>();
  let groundHeight = .075;
  world.updateMatrixWorld(true);
  world.traverse(object => {
    const owner = foliageOwner(object);
    if (owner && !pivotNames.has(owner.name)) {
      pivotNames.add(owner.name);
      pivots.push({ object: owner, rotation: owner.rotation.clone(), flower: owner.name.startsWith("ambient_flowers_") });
      if (owner.name.startsWith("ambient_leaves_") && vegetationGroup(owner.name) !== "understory" && vegetationGroup(owner.name) !== "evergreen") {
        const bounds = new THREE.Box3().setFromObject(owner);
        const center = new THREE.Vector3(); owner.getWorldPosition(center);
        anchors.push({ x: center.x, z: center.z, top: bounds.max.y, island: owner.name.split("_")[2] });
      }
    }
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const water = /lake_water|water_surface/.test(object.name) || (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(m => m.name === "Shallow lake water");
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (owner && addLeafSeeds(mesh.geometry)) geometries.add(mesh.geometry);
    assignments.push({ mesh, material: mesh.material, renderOrder: mesh.renderOrder });
    const replacement = sourceMaterials.map(raw => {
      const source = raw as THREE.MeshStandardMaterial;
      if (!source.isMeshStandardMaterial) return raw;
      const group = vegetationGroup(owner?.name ?? "");
      const flower = !!owner?.name.startsWith("ambient_flowers_") && /Flower|heliconia|bromelia coral/.test(source.name);
      const leaf = !!owner && (flower || !!colorKind(source.name));
      const key = `${source.uuid}/${leaf ? owner?.name : "static"}/${water}`;
      let record = clones.get(key);
      if (!record) {
        const material = source.clone();
        const density = { value: leaf ? vegetationDensity(season, owner?.name, flower) : 1 };
        record = { material, base: source.color.clone(), target: source.color.clone(), kind: colorKind(source.name), group, nodeName: owner?.name ?? "", flower, water, density };
        const snowEligible = !/Paper|Graphite|Display|Charcoal|Lantern|Beacon/.test(source.name);
        installSurfaceShader(material, uniforms, density, leaf, water, snowEligible, /Lantern glass|Beacon ivory/.test(source.name), /Lake bank (sand|clay)/.test(source.name));
        if (water) {
          material.roughness = .23; material.metalness = .04; material.color.set(seasonInfo[season].waterColor);
          material.transparent = true; material.opacity = .48; material.depthWrite = false;
        }
        records.push(record); clones.set(key, record);
      }
      if (source.name === "Garden topsoil") {
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) groundHeight = Math.max(groundHeight, mesh.geometry.boundingBox.max.clone().applyMatrix4(mesh.matrixWorld).y);
      }
      return record.material;
    });
    mesh.material = Array.isArray(mesh.material) ? replacement : replacement[0];
    if (water) mesh.renderOrder = 1;
  });
  return { records, pivots, anchors, groundHeight,
    restore: () => {
      for (const { mesh, material, renderOrder } of assignments) { mesh.material = material; mesh.renderOrder = renderOrder; }
      for (const { object, rotation } of pivots) object.rotation.copy(rotation);
      for (const geometry of geometries) geometry.deleteAttribute("seasonalSeed");
      for (const record of records) record.material.dispose();
    },
  };
}

function leafGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -.5, -.22, .015, -.18, -.27, 0, .17, 0, .035, .02, .27, 0, .17, .22, .015, -.18, 0, 0, .5], 3));
  geometry.setIndex([0, 1, 3, 1, 2, 3, 2, 6, 3, 6, 4, 3, 4, 5, 3, 5, 0, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

/** Real garden geometry is recolored and shaded; no suspended snow cards. */
export default function Scenery({ world, season, reducedMotion, moving = true, windSpeed = 7, weather = "clear", environment: providedEnvironment, environmentState, quality = "high",feedSpot }: SceneryProps) {
  const { invalidate, gl } = useThree();
  const environment = useMemo(() => providedEnvironment ?? createEnvironmentManifest(), [providedEnvironment]);
  const uniforms = useMemo(() => createUniforms(environment), [environment]);
  const localState = useRef(createEnvironmentState(weather, season, 13));
  const cadence = useRef(new FrameCadence());
  const garden = useRef<GardenBinding | null>(null);
  const fishes = useRef<THREE.InstancedMesh>(null), tails = useRef<THREE.InstancedMesh>(null);
  const fallen = useRef<THREE.InstancedMesh>(null), falling = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const fishPose = useMemo(() => ({ x: 0, y: 0, z: 0, heading: 0, tail: 0 }), []);
  const fishCount = faunaCount("fish",quality);
  const feedingFish=useMemo(()=>createFeedingFish(fishCount),[fishCount]);
  const fishRoutes = useMemo(() => createFishSchools(environment.fishRoutes ?? createFishRoutes(environment,fishCount),fishCount),[environment,fishCount]);
  const fishColors = useMemo(() => fishRoutes.routes.map(route => new THREE.Color(route.color)),[fishRoutes]);
  const metadata = seasonInfo[season];
  const progress = useRef({ leaves: metadata.leafDensity, flowers: metadata.flowerDensity, litter: metadata.litterDensity, falling: metadata.fallingLeaves });
  const colors = useMemo(() => Object.fromEntries(Object.entries(metadata.palette).map(([key, value]) => [key, new THREE.Color(value)])) as Record<string, THREE.Color>, [metadata]);
  const summerColors = useMemo(() => Object.fromEntries(Object.entries(seasonInfo.summer.palette).map(([key, value]) => [key, new THREE.Color(value)])) as Record<string, THREE.Color>, []);
  const waterColor = useMemo(() => new THREE.Color(metadata.waterColor), [metadata]);
  const stormWater = useMemo(() => new THREE.Color("#527e82"), []);
  const leaves = useMemo(() => leafGeometry(), []);
  const tailGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -.23, -.12, 0, -.41, .12, 0, -.41, 0, 0, -.23, 0, .045, -.32, 0, -.045, -.32], 3));
    geometry.computeVertexNormals(); return geometry;
  }, []);
  const litterPerIsland = quality === "low" ? 18 : 36;
  const fallingCount = quality === "low" ? 14 : 30;
  const litterLayout = useMemo(() => environment.land.flatMap((land, island) => Array.from({ length: litterPerIsland }, (_, index) => {
    const seed = index + island * 37;
    const angle = seed * 2.399963;
    const radius = 2.3 + ((seed * 17) % 29) / 29 * Math.min(1.25, land.radius - 2.55);
    return { x: land.center[0] + Math.cos(angle) * radius, z: land.center[1] + Math.sin(angle) * radius, angle, seed: (seed * .618034) % 1, size: .12 + (seed % 5) * .018 };
  })), [environment, litterPerIsland]);
  useLayoutEffect(() => {
    const binding = bindGarden(world, uniforms, season);
    garden.current = binding;
    invalidate();
    return () => { garden.current = null; binding.restore(); };
    // Seasonal targets update uniforms without rebuilding the authored scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, uniforms, invalidate]);
  useLayoutEffect(() => {
    const tones = ["#a58b4d", "#8c8050", "#baa069", "#7c8050"].map(color => new THREE.Color(color));
    for (let i = 0; i < litterLayout.length; i++) fallen.current?.setColorAt(i, tones[i % tones.length]);
    for (let i = 0; i < fallingCount; i++) falling.current?.setColorAt(i, tones[i % tones.length]);
    if (fallen.current?.instanceColor) fallen.current.instanceColor.needsUpdate = true;
    if (falling.current?.instanceColor) falling.current.instanceColor.needsUpdate = true;
  }, [litterLayout, fallingCount]);
  useEffect(() => () => { leaves.dispose(); tailGeometry.dispose(); }, [leaves, tailGeometry]);
  useEffect(() => { cadence.current.reset(); }, [moving]);
  useEffect(() => { invalidate(); }, [season, weather, world, invalidate]);

  useFrame((_, delta) => {
    const dt = moving ? environmentSeconds(cadence.current.sample(delta).elapsed, reducedMotion) : 0;
    if (!environmentState) advanceEnvironment(localState.current, dt, weather, season, 13);
    const state = environmentState?.current ?? localState.current;
    const time = state.elapsed;
    uniforms.scenicTime.value = time; uniforms.scenicWetness.value = state.wetness;
    uniforms.scenicSnow.value = state.snow; uniforms.scenicIce.value = state.ice; uniforms.scenicNight.value = state.night; uniforms.scenicWind.value = state.wind;
    const wave = lakeWaveParameters(state.wind, state.ice);
    uniforms.scenicWaveAmplitude.value = wave.amplitude; uniforms.scenicWaveSpeed.value = wave.speed; uniforms.scenicWaterRise.value = state.waterLevel;
    uniforms.scenicWaterScale.value = 1 - metadata.dryness * (1 - state.wetness) * .011;
    const alpha = 1 - Math.exp(-2.2 * Math.min(.25, Math.max(1 / 120, delta)));
    const targets = { leaves: metadata.leafDensity, flowers: metadata.flowerDensity, litter: metadata.litterDensity, falling: metadata.fallingLeaves };
    let pending = false;
    for (const key of ["leaves", "flowers", "litter", "falling"] as const) {
      progress.current[key] += (targets[key] - progress.current[key]) * alpha;
      pending ||= Math.abs(targets[key] - progress.current[key]) > .002;
    }
    const binding = garden.current;
    if (!binding) return;
    for (const record of binding.records) {
      const { material, kind } = record;
      if (record.water) { record.target.copy(waterColor).lerp(stormWater, state.wetness * .42); material.roughness = .23 + state.wind * .13; }
      else if (record.flower) record.target.copy(record.base).lerp(colors.dry, metadata.dryness * .19);
      else if (kind) {
        record.target.copy(colors[kind]);
        if (kind === "ground") record.target.multiplyScalar(.48);
        else if (record.group === "evergreen") record.target.lerp(summerColors[kind], .76);
      } else record.target.copy(record.base);
      material.color.lerp(record.target, alpha);
      const density = record.nodeName ? vegetationDensity(season, record.nodeName, record.flower) : 1;
      record.density.value += (density - record.density.value) * alpha;
      pending ||= Math.abs(record.density.value - density) > .002 || Math.abs(material.color.r - record.target.r) + Math.abs(material.color.g - record.target.g) + Math.abs(material.color.b - record.target.b) > .002;
    }
    const wind = Math.min(.055, .007 + Math.max(0, windSpeed) * .0014 + state.wind * .018) * (reducedMotion ? .35 : 1);
    for (const { object, rotation, flower } of binding.pivots) {
      const sway = (Math.sin(time * (flower ? 1.15 : .7) + object.id * 1.61) + Math.sin(time * .23 + object.id) * .28) * wind;
      object.rotation.set(rotation.x + sway * .4, rotation.y + sway * .26, rotation.z + sway);
    }
    if (fallen.current) {
      for (let i = 0; i < litterLayout.length; i++) {
        const leaf = litterLayout[i];
        const amount = THREE.MathUtils.clamp((progress.current.litter - leaf.seed) * 8, 0, 1) * (1 - state.snow * .9);
        dummy.position.set(leaf.x, binding.groundHeight + .011, leaf.z);
        dummy.rotation.set(Math.sin(i) * .07, leaf.angle, Math.cos(i) * .07);
        dummy.scale.setScalar(leaf.size * amount); dummy.updateMatrix(); fallen.current.setMatrixAt(i, dummy.matrix);
      }
      fallen.current.instanceMatrix.needsUpdate = true;
    }
    if (falling.current) {
      const anchors = binding.anchors;
      for (let i = 0; i < fallingCount; i++) {
        const anchor = anchors[i % Math.max(1, anchors.length)];
        const phase = (time * (.065 + (i % 5) * .005) + i * .618034) % 1;
        const amount = THREE.MathUtils.clamp((progress.current.falling - ((i * .381966) % 1)) * 5, 0, 1) * (1 - state.snow);
        dummy.position.set((anchor?.x ?? 0) + Math.sin(i * 2.4 + phase * 5) * (.5 + phase * .7) + phase * state.wind * .7, binding.groundHeight + .015 + (1 - phase) * ((anchor?.top ?? 3) - binding.groundHeight), (anchor?.z ?? 0) + Math.cos(i * 1.7 + phase * 4) * .8);
        const land = environment.land.find(island => island.id === anchor?.island);
        if (land) {
          const dx = dummy.position.x - land.center[0], dz = dummy.position.z - land.center[1];
          const distance = Math.hypot(dx, dz), radius = land.radius - .22;
          if (distance > radius) { dummy.position.x = land.center[0] + dx / distance * radius; dummy.position.z = land.center[1] + dz / distance * radius; }
        }
        dummy.rotation.set(phase * 8 + i, phase * 3 + i, Math.sin(phase * 10 + i) * .85);
        dummy.scale.setScalar((.105 + (i % 4) * .016) * amount * Math.min(1, phase * 12));
        dummy.updateMatrix(); falling.current.setMatrixAt(i, dummy.matrix);
      }
      falling.current.instanceMatrix.needsUpdate = true;
    }
    if (fishes.current && tails.current) {
      if(feedSpot)advanceFeedingFish(feedingFish,feedSpot.current,time,fishRoutes,environment,state.ice);
      for (let index = 0; index < fishCount; index++) {
        if(feedSpot)writeFeedingFishPose(fishPose,index,time,fishRoutes,feedingFish);else writeFishPose(fishPose, index, time,fishRoutes);
        fishPose.y += state.waterLevel - Math.max(0, state.wind - .5) * .16;
        const scale = fishRoutes.routes[index]?.scale ?? 1;
        dummy.position.set(fishPose.x, fishPose.y, fishPose.z); dummy.rotation.set(0, fishPose.heading, 0); dummy.scale.set(.105*scale, .046*scale, .235*scale); dummy.updateMatrix(); fishes.current.setMatrixAt(index, dummy.matrix);
        fishes.current.setColorAt(index,fishColors[index]); tails.current.setColorAt(index,fishColors[index]);
        dummy.scale.setScalar(scale); dummy.rotation.set(0, fishPose.heading + fishPose.tail, 0); dummy.updateMatrix(); tails.current.setMatrixAt(index, dummy.matrix);
        if (index === 0) gl.domElement.setAttribute("data-world-fish-position", [fishPose.x, fishPose.y, fishPose.z].map(v => v.toFixed(3)).join(","));
      }
      fishes.current.instanceMatrix.needsUpdate = true; tails.current.instanceMatrix.needsUpdate = true;
      if(fishes.current.instanceColor)fishes.current.instanceColor.needsUpdate = true;
      if(feedSpot){let approaching=0;for(const fish of feedingFish.fish)if(fish.mode==='approach')approaching++;gl.domElement.setAttribute('data-garden-feeding-fish',String(feedSpot.current.eaters));gl.domElement.setAttribute('data-garden-approaching-fish',String(approaching));}
      if(tails.current.instanceColor)tails.current.instanceColor.needsUpdate = true;
    }
    const attributes = {
      "data-world-fish-count": String(fishCount), "data-world-water-time": time.toFixed(3), "data-world-foliage-pivots": String(binding.pivots.length),
      "data-world-leaf-density": progress.current.leaves.toFixed(3), "data-world-flower-density": progress.current.flowers.toFixed(3), "data-world-foliage-color": colors.dark.getHexString(),
      "data-world-litter-density": progress.current.litter.toFixed(3), "data-world-falling-leaves": progress.current.falling.toFixed(3), "data-world-water-scale": uniforms.scenicWaterScale.value.toFixed(4),
      "data-world-wetness": state.wetness.toFixed(3), "data-world-snow-cover": state.snow.toFixed(3), "data-world-ice-cover": state.ice.toFixed(3), "data-world-snow-surface": "authored-world-normals",
      "data-world-wave-amplitude": wave.amplitude.toFixed(4), "data-world-wave-speed": wave.speed.toFixed(3), "data-world-water-rise": state.waterLevel.toFixed(4), "data-world-water-storage": state.waterStorage.toFixed(3),
      "data-world-leaf-ground-height": binding.groundHeight.toFixed(3), "data-world-seasonal-materials": String(binding.records.length),
    };
    for (const [key, value] of Object.entries(attributes)) gl.domElement.setAttribute(key, value);
    if (pending) invalidate();
  });
  return <group name="seasonal_scenery">
    <instancedMesh name="seasonal_ground_leaves" ref={fallen} args={[leaves, undefined, litterLayout.length]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#ffffff" roughness={.92} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh name="seasonal_falling_leaves" ref={falling} args={[leaves, undefined, fallingCount]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#ffffff" roughness={.86} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh name="lake_fish_bodies" ref={fishes} args={[undefined, undefined, fishCount]} frustumCulled={false} raycast={noRaycast}><sphereGeometry args={[1, 9, 6]} /><meshStandardMaterial color="#ffffff" roughness={.52} /></instancedMesh>
    <instancedMesh name="lake_fish_tails" ref={tails} args={[tailGeometry, undefined, fishCount]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#ffffff" roughness={.55} side={THREE.DoubleSide} /></instancedMesh>
  </group>;
}
