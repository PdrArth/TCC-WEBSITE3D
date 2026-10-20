"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createLifeGeometry, createCaughtFishGeometry, restoreLifeGeometry, segment, tintGeometry, mergePieces, type StaticKind, type PreparedLifeGeometry } from "@/lib/experience/life-geometry.mjs";
import type { Vec3, WorldEnvironmentManifest } from "@/lib/experience-contract";
import type { BirdCompanion } from "@/lib/experience/bird-life.mjs";
import {createGreeting,requestGreeting,advanceResidentWithGreeting,type GreetingPose} from '@/lib/experience/garden-interactions.mjs';
import type {ScenicSound} from '@/lib/experience/scene-signals';
import { createEnvironmentManifest, type EnvironmentState } from "@/lib/experience/environment.mjs";
import {
  createIslandLifeLayout, createResidentState, homeLocalPoint, pathLength, residentPauseReason,
  writeResidentPose, type IslandLifeLayout, type ResidentContext, type ResidentPose,
} from "@/lib/experience/island-life.mjs";

/** Nine static material batches and six rounded resident instance batches.
 * Door and utensils have real pivots. No new lights, shadows, event targets,
 * external assets or React state in the render loop. */
export type IslandLifeProps = {
  onSpatialSound?: (kind:ScenicSound,point:Vec3)=>void;
  interactionBlocked?:boolean;
  companion?: MutableRefObject<BirdCompanion>;
  environment?: WorldEnvironmentManifest;
  layout?: IslandLifeLayout;
  preparedGeometry?: PreparedLifeGeometry;
  environmentState?: MutableRefObject<EnvironmentState>;
  moving?: boolean;
  reducedMotion?: boolean;
  quality?: "high" | "low";
  intro?: boolean;
};

const noRaycast = () => {};
type ResidentKind = "skin" | "coat" | "trousers" | "dark" | "hair" | "fruit";
type ResidentPart = { kind: ResidentKind; object: THREE.Object3D; index: number };

/** The shell follows the head; its hairline is high in front and lower behind. */
function hairGeometry(quality: "high" | "low") {
  const width = quality === "high" ? 18 : 12, rows = 7, positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) for (let index = 0; index <= width; index++) {
    const phi = index / width * Math.PI * 2, front = Math.max(0, Math.cos(phi)), maximum = 1.78 - front ** 3 * .76, theta = row / rows * maximum;
    positions.push(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi)); uv.push(index / width, row / rows);
    if (row < rows && index < width) { const a = row * (width + 1) + index, b = a + width + 1; indices.push(a,b,a+1,a+1,b,b+1); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function createRig(scale: number) {
  const root = new THREE.Object3D(), trunk = new THREE.Object3D(); root.add(trunk); root.scale.setScalar(scale);
  const parts: ResidentPart[] = [], counts: Record<ResidentKind, number> = { skin: 0, coat: 0, trousers: 0, dark: 0, hair: 0, fruit: 0 };
  const add = (kind: ResidentKind, parent: THREE.Object3D | null, position: Vec3, size: Vec3) => {
    const object = new THREE.Object3D(); object.position.set(...position); object.scale.set(...size); parent?.add(object);
    parts.push({ kind, object, index: counts[kind]++ }); return object;
  };
  const pivot = (parent: THREE.Object3D, position: Vec3) => { const object = new THREE.Object3D(); object.position.set(...position); parent.add(object); return object; };
  add("coat", trunk, [0, .735, -.004], [.182, .225, .112]); add("coat", trunk, [0, .865, 0], [.203, .095, .115]);
  add("trousers", trunk, [0, .515, 0], [.157, .090, .103]); add("skin", trunk, [0, .951, 0], [.056, .065, .057]);
  const head = pivot(trunk, [0, 1.085, .008]);
  add("skin", head, [0, 0, 0], [.123, .160, .121]); add("hair", head, [0, .008, -.003], [.128, .164, .126]);
  const eyes: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    add("skin", head, [side * .121, -.003, .001], [.023, .037, .025]);
    eyes.push(add("dark", head, [side * .043, .015, .114], [.0105, .014, .009]));
  }
  add("skin", head, [0, -.014, .123], [.023, .029, .026]);
  const arms: THREE.Object3D[] = [], elbows: THREE.Object3D[] = [], legs: THREE.Object3D[] = [], knees: THREE.Object3D[] = [], hands: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const arm = pivot(trunk, [side * .190, .866, .002]), elbow = pivot(arm, [0, -.205, 0]);
    add("coat", arm, [side * .006, -.097, 0], [.067, .134, .071]); add("coat", elbow, [0, -.085, 0], [.053, .115, .058]);
    const hand = add("skin", elbow, [0, -.215, 0], [.037, .049, .034]);
    const leg = pivot(root, [side * .085, .520, 0]), knee = pivot(leg, [0, -.240, 0]);
    add("trousers", leg, [0, -.108, 0], [.078, .137, .081]); add("trousers", knee, [0, -.105, 0], [.064, .132, .069]);
    add("dark", knee, [0, -.225, .037], [.073, .053, .125]);
    arms.push(arm); elbows.push(elbow); legs.push(leg); knees.push(knee); hands.push(hand);
  }
  const fruit = add("fruit", elbows[1], [0, -.222, .033], [.067, .067, .067]);
  const float = add("fruit", null, [0, 0, 0], [.048, .048, .048]);
  return { root, trunk, head, eyes, parts, counts, arms, elbows, legs, knees, fruit, float, rightHand: hands[1] };
}

type Rig = ReturnType<typeof createRig>;
function updateRig(rig: Rig, pose: ResidentPose, layout: IslandLifeLayout, meshes: Partial<Record<ResidentKind, THREE.InstancedMesh>>, greeting={wave:0,sway:0,look:0,lookPitch:0}) {
  rig.root.position.set(pose.x, pose.y + pose.bodyOffsetY, pose.z); rig.root.rotation.set(-pose.sleepBlend * Math.PI / 2, pose.heading, 0, "YXZ"); rig.trunk.rotation.x = pose.lean;
  for (const eye of rig.eyes) eye.scale.y = .014 * (1 - pose.sleepBlend * .85);
  rig.head.rotation.x = (pose.watering ? .11 : pose.seated ? -.035 : 0)+greeting.lookPitch;
  rig.head.rotation.y=greeting.look;
  rig.head.position.z = .008 + pose.sleepBlend * .08;
  rig.arms[0].rotation.set(pose.leftArm, 0, pose.rod ? .23 : .045); rig.arms[1].rotation.set(pose.rightArm, 0, pose.rod ? -.09 : -.045);
  rig.elbows[0].rotation.set(pose.leftElbow, 0, pose.rod ? .17 : 0); rig.elbows[1].rotation.set(pose.rightElbow, 0, 0);
  if(greeting.wave>0){rig.arms[0].rotation.x-=greeting.wave*1.95;rig.arms[0].rotation.z-=greeting.wave*(.85+greeting.sway);rig.elbows[0].rotation.x-=greeting.wave*.8;}
  rig.legs[0].rotation.x = pose.leftLeg; rig.legs[1].rotation.x = pose.rightLeg; rig.knees[0].rotation.x = pose.leftKnee; rig.knees[1].rotation.x = pose.rightKnee;
  rig.fruit.scale.setScalar(pose.fruit ? .067 : 0);
  rig.float.position.set(...(pose.fishingTarget ?? layout.fishing.target)); rig.float.scale.setScalar(pose.rod ? .049 : 0); rig.float.updateMatrixWorld(true); rig.root.updateMatrixWorld(true);
  for (const part of rig.parts) meshes[part.kind]?.setMatrixAt(part.index, part.object.matrixWorld);
  for (const kind of Object.keys(rig.counts) as ResidentKind[]) {
    const mesh = meshes[kind]; if (mesh) { mesh.visible = !pose.hidden; mesh.instanceMatrix.needsUpdate = true; }
  }
}

function createDoorGeometry() {
  const body = new THREE.BoxGeometry(.84, 1.90, .064); body.translate(.42, .95, 0); tintGeometry(body);
  const pieces: THREE.BufferGeometry[] = [body];
  for (const y of [.48, 1.39]) {
    const panel = new THREE.BoxGeometry(.64, .67, .018); panel.translate(.42, y, .039); pieces.push(tintGeometry(panel, 1.07));
  }
  const knob = new THREE.SphereGeometry(.037, 8, 6); knob.translate(.72, .98, .083); pieces.push(tintGeometry(knob, .47));
  return mergePieces(pieces);
}

function createWateringCanGeometry() {
  const pieces: THREE.BufferGeometry[] = [], body = new THREE.CylinderGeometry(.112, .125, .18, 12);
  body.translate(0, -.20, .025); pieces.push(body);
  const rim = new THREE.TorusGeometry(.112, .012, 5, 12); rim.rotateX(Math.PI / 2); rim.translate(0, -.11, .025); pieces.push(rim);
  const handle = new THREE.TorusGeometry(.116, .018, 6, 12, Math.PI); handle.scale(1, .92, 1); handle.translate(0, -.105, .025); pieces.push(handle);
  pieces.push(segment([.055, -.21, .04], [.055, -.105, .34], .025)); pieces.push(segment([.055, -.105, .34], [.055, -.095, .39], .047, 10));
  return mergePieces(pieces);
}

const staticColors: Record<StaticKind, string> = { oak: "#ae875b", rail: "#77684e", plaster: "#e7dfc9", roof: "#ad6246", window: "#e1e8d8", stone: "#b4ad92", snow: "#f2f3e9", grass: "#8c9d72", foliage: "#5a795b" };
const residentColors: Record<ResidentKind, string> = { skin: "#d7a67e", coat: "#da6e42", trousers: "#40627a", dark: "#343a36", hair: "#584237", fruit: "#bf4f39" };

export default function IslandLife({ onSpatialSound,interactionBlocked=false,companion, environment: suppliedEnvironment, layout: providedLayout, preparedGeometry, environmentState, moving = true, reducedMotion = false, quality = "high", intro = false }: IslandLifeProps) {
  const { gl, invalidate,camera } = useThree();
  const greeting=useRef(createGreeting()),greetingPose=useRef<GreetingPose>({active:false,heading:0,still:0,wave:0,sway:0,look:0,lookPitch:0}),previousBite=useRef(false),residentHit=useRef<THREE.Mesh>(null);
  const residentScreen=useMemo(()=>new THREE.Vector3(),[]);
  const environment = useMemo(() => suppliedEnvironment ?? createEnvironmentManifest(), [suppliedEnvironment]);
  const layout = useMemo(() => providedLayout ?? createIslandLifeLayout(environment), [providedLayout, environment]);
  const batches = useMemo(() => restoreLifeGeometry(preparedGeometry, layout) ?? createLifeGeometry(layout), [preparedGeometry, layout]); const state = useMemo(() => createResidentState(layout,Math.floor(Math.random()*0x100000000)), [layout]);
  const rig = useMemo(() => createRig(layout.resident.scale), [layout.resident.scale]);
  const residentMeshes = useRef<Partial<Record<ResidentKind, THREE.InstancedMesh>>>({});
  const windowMaterial = useRef<THREE.MeshStandardMaterial>(null), roofMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const snow = useRef<THREE.Mesh>(null), snowMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const door = useRef<THREE.Group>(null), rod = useRef<THREE.Group>(null), can = useRef<THREE.Group>(null), drops = useRef<THREE.InstancedMesh>(null);
  const caught = useRef<THREE.Mesh>(null), catchRing = useRef<THREE.Mesh>(null), catchRingMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const report = useRef(0), lastWeather = useRef({ snow: -1, wetness: -1, night: -1 });
  const pose = useMemo(() => writeResidentPose({} as ResidentPose, state), [state]);
  const rodGeometry = useMemo(() => segment([0, -.025, 0], [0, .89, 1.20], .012, 7), []);
  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, .89, 1.20), new THREE.Vector3(0, -.82, 1.28)]), []);
  const doorGeometry = useMemo(() => createDoorGeometry(), []), canGeometry = useMemo(() => createWateringCanGeometry(), []), headHairGeometry = useMemo(() => hairGeometry(quality), [quality]);
  const caughtGeometry = useMemo(() => createCaughtFishGeometry(), []);
  const rodTip = useMemo(() => new THREE.Vector3(), []), hook = useMemo(() => new THREE.Vector3(), []);
  const toolHand = useMemo(() => new THREE.Vector3(), []), toolEnd = useMemo(() => new THREE.Vector3(), []), dropPosition = useMemo(() => new THREE.Vector3(), []), dropObject = useMemo(() => new THREE.Object3D(), []);
  const context = (): ResidentContext => ({ moving, reducedMotion, intro, visible: document.visibilityState === "visible", weather: environmentState?.current.weather ?? "clear", hour: environmentState?.current.hour ?? 13, night: environmentState?.current.night ?? 0 });

  const updateArticulation = () => {
    updateRig(rig, pose, layout, residentMeshes.current,greetingPose.current);
    if(residentHit.current){residentHit.current.position.set(pose.x,pose.y+layout.resident.height*.5,pose.z);residentHit.current.visible=!pose.hidden&&!pose.inside&&!pose.sleeping;}
    if (door.current) door.current.rotation.y = layout.home.yaw - Math.max(0, Math.min(1, pose.doorOpen)) * 1.48;
    if(companion){
      const destination=companion.current;
      destination.available=pose.seated&&!pose.inside&&state.phaseTime>1.5&&(state.phase!=="sitting"||state.phaseTime<14)&&!state.shelterReason;
      toolEnd.set(.19,.97,0);rig.root.localToWorld(toolEnd);
      destination.position[0]=toolEnd.x;destination.position[1]=toolEnd.y;destination.position[2]=toolEnd.z;destination.heading=pose.heading;
    }
    rig.rightHand.getWorldPosition(toolHand);
    if (rod.current) {
      rod.current.visible = pose.rod && !pose.hidden;
      if (rod.current.visible) {
        rod.current.position.copy(toolHand); rod.current.scale.setScalar(layout.resident.scale); rod.current.rotation.set(-pose.catchLift * .38, pose.heading, pose.rodTilt, "YXZ"); rod.current.updateMatrixWorld(true);
        rodTip.set(0, .89, 1.20); rod.current.localToWorld(rodTip);
        hook.set(...(pose.fishingTarget ?? layout.fishing.target)); hook.setY(hook.y + (environmentState?.current.waterLevel ?? 0));
        if (pose.fishingBite) hook.setY(hook.y - .06 - Math.sin(state.phaseTime * 30) * .025);
        hook.lerp(toolEnd.copy(rodTip).addScaledVector(THREE.Object3D.DEFAULT_UP, -.80), pose.catchLift);
        toolEnd.copy(hook); rod.current.worldToLocal(toolEnd);
        const positions = lineGeometry.getAttribute("position"); positions.setXYZ(1, toolEnd.x, toolEnd.y, toolEnd.z); positions.needsUpdate = true; lineGeometry.computeBoundingSphere();
        rig.float.position.copy(hook); rig.float.scale.setScalar(pose.catchLift < .08 ? .049 : 0); rig.float.updateMatrixWorld(true);
        residentMeshes.current.fruit?.setMatrixAt(rig.counts.fruit - 1, rig.float.matrixWorld);
      }
    }
    if (caught.current) {
      caught.current.visible = pose.caughtFish && !pose.hidden;
      if (caught.current.visible) { caught.current.position.copy(hook).addScaledVector(THREE.Object3D.DEFAULT_UP, -.22); caught.current.rotation.set(-Math.PI / 2, pose.heading, Math.sin(state.phaseTime * 17) * .22, "YXZ"); }
    }
    if (catchRing.current) {
      const age = state.phaseTime - 3.1;
      catchRing.current.visible = pose.rod && age >= 0 && age < 1;
      if (catchRing.current.visible) { const target = pose.fishingTarget ?? layout.fishing.target; catchRing.current.position.set(target[0], target[1] + .015 + (environmentState?.current.waterLevel ?? 0), target[2]); catchRing.current.scale.setScalar(.5 + age * 2.8); if (catchRingMaterial.current) catchRingMaterial.current.opacity = (1 - age) * .55; }
    }
    if (can.current) {
      can.current.visible = pose.watering && !pose.hidden;
      if (can.current.visible) { can.current.position.copy(toolHand); can.current.scale.setScalar(layout.resident.scale); can.current.rotation.set(pose.wateringTilt, pose.heading, 0, "YXZ"); can.current.updateMatrixWorld(true); }
    }
    if (drops.current) {
      drops.current.visible = pose.watering && !pose.hidden;
      if (drops.current.visible && can.current) {
        toolEnd.set(.055, -.095, .39); can.current.localToWorld(toolEnd);
        const target = pose.activityTarget ?? layout.garden.target;
        for (let index = 0; index < 8; index++) {
          const t = (index / 8 + state.phaseTime * .63) % 1;
          dropPosition.set(target[0], target[1] + .02, target[2]).lerp(toolEnd, 1 - t); dropPosition.setY(dropPosition.y + Math.sin(t * Math.PI) * .06);
          dropObject.position.copy(dropPosition); dropObject.scale.set(.012, .024, .012); dropObject.updateMatrix(); drops.current.setMatrixAt(index, dropObject.matrix);
        }
        drops.current.instanceMatrix.needsUpdate = true;
      }
    }
  };

  const publish = () => {
    const attributes = {
      "data-world-island-life": String(layout.version), "data-world-life-draw-budget": String(batches.length + Object.keys(rig.counts).length + 7), "data-world-life-dynamic-lights": "0",
      "data-world-life-geometry": batches[0]?.geometry.userData.preparedLife ? "prepared" : "generated",
      "data-world-closing-bridge": "perspectivas,pesquisa", "data-world-closing-bridge-node": layout.bridge.node,
      "data-world-closing-bridge-points": String(layout.bridge.points.length), "data-world-closing-bridge-length": pathLength(layout.bridge.points).toFixed(3),
      "data-world-closing-bridge-endpoints": [layout.bridge.points[0], layout.bridge.points[layout.bridge.points.length - 1]].map(point => point.map(value => value.toFixed(3)).join(",")).join(";"),
      "data-world-life-home-island": layout.island, "data-world-life-home-position": layout.home.position.map(value => value.toFixed(3)).join(","),
      "data-world-life-home-porch": layout.home.porch.map(value => value.toFixed(3)).join(","), "data-world-life-door-open": pose.doorOpen.toFixed(3),
      "data-world-life-islet-radius": layout.islet.radius.toFixed(2), "data-world-life-connector-points": String(layout.connector.points.length), "data-world-life-bridge-rail-opening": "1.46",
      "data-world-life-house-openings": "physical-door,physical-window", "data-world-resident-rig": "rounded-front-face-articulated-knees",
      "data-world-resident-height": layout.resident.height.toFixed(2), "data-world-resident-scale": layout.resident.scale.toFixed(2),
      "data-world-resident-phase": state.phase, "data-world-resident-position": state.position.map(value => value.toFixed(3)).join(","),
      "data-world-resident-heading": state.heading.toFixed(3), "data-world-resident-cycle": String(state.cycle),
      "data-world-resident-greetings":String(greeting.current.count),"data-world-resident-wave":greetingPose.current.wave.toFixed(3),
      "data-world-resident-greeting-active":String(greetingPose.current.active),"data-world-resident-activity-id":state.activityId,
      "data-world-resident-fishing-visits":String(state.fishingVisits),"data-world-resident-fishing-target":pose.fishingTarget?.map(v=>v.toFixed(3)).join(',')??'',
      "data-world-resident-time": state.elapsed.toFixed(3), "data-world-resident-phase-time": state.phaseTime.toFixed(3),
      "data-world-resident-distance": state.distanceMoved.toFixed(3), "data-world-resident-gait": state.gait.toFixed(3),
      "data-world-resident-gesture": state.gesture.toFixed(3), "data-world-resident-visible": String(!state.hidden),
      "data-world-resident-pause": residentPauseReason(context()) ?? "none", "data-world-resident-shelter": state.shelterReason ?? "none",
      "data-world-resident-inside": String(pose.inside), "data-world-resident-seated": String(pose.seated),
      "data-world-resident-sleeping": String(pose.sleeping), "data-world-resident-caught-fish": String(pose.caughtFish), "data-world-resident-catch-lift": pose.catchLift.toFixed(3), "data-world-life-bed": "oak-mattress-pillow-blanket",
      "data-world-resident-activity": pose.caughtFish ? "reeling-visible-fish" : pose.rod ? "rod-line-water-float" : pose.watering ? "watering-can-small-water-arc" : pose.fruit ? "reach-and-pick-fruit" : pose.sleeping ? "sleeping-in-bed" : pose.inside ? "seated-on-bed" : pose.seated ? "seated-on-bench" : "articulated",
    };
    for (const [key, value] of Object.entries(attributes)) gl.domElement.setAttribute(key, value);
    const bounds=gl.domElement.getBoundingClientRect();residentScreen.set(pose.x,pose.y+layout.resident.height*.6,pose.z).project(camera);
    gl.domElement.setAttribute('data-world-resident-hit-point',[(residentScreen.x*.5+.5)*bounds.width+bounds.left,(-residentScreen.y*.5+.5)*bounds.height+bounds.top].map(value=>value.toFixed(1)).join(','));
  };

  useLayoutEffect(() => {
    writeResidentPose(pose, state, layout); updateArticulation(); invalidate();
    // Initialize the rig and tools before the first visible frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rig, pose, state, invalidate, quality]);
  useEffect(() => {
    const changed = () => { publish(); invalidate(); };
    changed(); document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
    // Diagnostics read the current shared environment ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, layout, state, moving, reducedMotion, intro, environmentState, invalidate]);
  useEffect(() => () => { for (const batch of batches) batch.geometry.dispose(); }, [batches]);
  useEffect(() => () => { rodGeometry.dispose(); lineGeometry.dispose(); doorGeometry.dispose(); canGeometry.dispose(); caughtGeometry.dispose(); }, [rodGeometry, lineGeometry, doorGeometry, canGeometry, caughtGeometry]);
  useEffect(() => () => headHairGeometry.dispose(), [headHairGeometry]);

  useFrame((_, delta) => {
    greetingPose.current=advanceResidentWithGreeting(state,greeting.current,pose,delta,{...context(),panelOpen:interactionBlocked},layout,{distance:Math.hypot(camera.position.x-state.position[0],camera.position.y-state.position[1],camera.position.z-state.position[2]),cameraHeading:Math.atan2(camera.position.x-state.position[0],camera.position.z-state.position[2]),cameraPitch:Math.atan2(camera.position.y-state.position[1]-layout.resident.height*.85,Math.hypot(camera.position.x-state.position[0],camera.position.z-state.position[2]))});
    if(moving&&pose.fishingBite&&!previousBite.current&&pose.fishingTarget)onSpatialSound?.('fishing',pose.fishingTarget);
    previousBite.current=pose.fishingBite;updateArticulation();
    const scenic = environmentState?.current, night = scenic?.night ?? 0, cover = scenic?.snow ?? 0, wetness = scenic?.wetness ?? 0;
    if (windowMaterial.current) { windowMaterial.current.emissiveIntensity = night * .85; windowMaterial.current.opacity = .10 + night * .10; }
    if (roofMaterial.current) roofMaterial.current.roughness = .90 - wetness * .32;
    if (snow.current) snow.current.visible = cover > .008;
    if (snowMaterial.current) snowMaterial.current.opacity = Math.min(.96, cover * 1.8);
    const previous = lastWeather.current;
    if (Math.abs(previous.snow - cover) + Math.abs(previous.night - night) + Math.abs(previous.wetness - wetness) > .004) {
      previous.snow = cover; previous.night = night; previous.wetness = wetness;
      gl.domElement.setAttribute("data-world-life-house-snow", cover.toFixed(3)); gl.domElement.setAttribute("data-world-life-house-window", night.toFixed(3));
    }
    report.current += Math.min(.1, Math.max(0, delta)); if (report.current >= .2) { report.current = 0; publish(); }
  });

  return <group name="island_life_v20">
    <mesh ref={residentHit} name="island_resident_greeting_target" scale={[.40,layout.resident.height*.52,.40]} onClick={event=>{event.stopPropagation();if(!interactionBlocked&&moving&&!intro){requestGreeting(greeting.current);invalidate();}}}>
      <sphereGeometry args={[1,8,6]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/>
    </mesh>
    {batches.map(batch => <mesh key={batch.kind} name={batch.kind === "oak" ? layout.bridge.node : `island_life_${batch.kind}`} ref={batch.kind === "snow" ? snow : undefined} geometry={batch.geometry} visible={batch.kind !== "snow"} raycast={noRaycast}>
      <meshStandardMaterial ref={batch.kind === "window" ? windowMaterial : batch.kind === "roof" ? roofMaterial : batch.kind === "snow" ? snowMaterial : undefined}
        color={staticColors[batch.kind]} vertexColors roughness={.90} emissive={batch.kind === "window" ? "#ffc87d" : "#000000"} emissiveIntensity={0}
        transparent={batch.kind === "snow" || batch.kind === "window"} opacity={batch.kind === "window" ? .10 : batch.kind === "snow" ? 0 : 1} depthWrite={batch.kind !== "snow" && batch.kind !== "window"} />
    </mesh>)}
    <group ref={door} name="island_life_opening_door" position={homeLocalPoint(layout.home, [.23, layout.home.floorHeight + .012, layout.home.footprint[1] / 2 + .016])} rotation-y={layout.home.yaw}>
      <mesh geometry={doorGeometry} raycast={noRaycast}><meshStandardMaterial color="#a77b4e" vertexColors roughness={.88} /></mesh>
    </group>
    {(Object.keys(rig.counts) as ResidentKind[]).map(kind => <instancedMesh key={kind} name={`island_resident_${kind}`} ref={mesh => { if (mesh) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); residentMeshes.current[kind] = mesh; } else delete residentMeshes.current[kind]; }} args={[kind === "hair" ? headHairGeometry : undefined, undefined, rig.counts[kind]]} frustumCulled={false} raycast={noRaycast}>
      {kind !== "hair" && <sphereGeometry args={[1, quality === "high" ? 14 : 10, quality === "high" ? 10 : 8]} />}
      <meshStandardMaterial color={residentColors[kind]} emissive={residentColors[kind]} emissiveIntensity={kind === "coat" ? .12 : .035} roughness={.90} />
    </instancedMesh>)}
    <group ref={rod} name="island_resident_fishing_rod" visible={false}>
      <mesh geometry={rodGeometry} raycast={noRaycast}><meshStandardMaterial color="#77634c" roughness={.85} /></mesh>
      <lineSegments geometry={lineGeometry} frustumCulled={false} raycast={noRaycast}><lineBasicMaterial color="#fff0c7" transparent opacity={.90} /></lineSegments>
    </group>
    <group ref={can} name="island_resident_watering_can" visible={false}>
      <mesh geometry={canGeometry} raycast={noRaycast}><meshStandardMaterial color="#72938b" metalness={.10} roughness={.65} /></mesh>
    </group>
    <mesh ref={caught} name="island_resident_caught_fish" geometry={caughtGeometry} visible={false} raycast={noRaycast}><meshStandardMaterial color="#e9bd67" vertexColors roughness={.56} side={THREE.DoubleSide} /></mesh>
    <mesh ref={catchRing} name="island_resident_fishing_splash" rotation-x={-Math.PI / 2} visible={false} raycast={noRaycast}><ringGeometry args={[.15,.18,24]} /><meshBasicMaterial ref={catchRingMaterial} color="#d9ede3" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <instancedMesh ref={mesh => { drops.current = mesh; mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }} name="island_resident_watering_drops" args={[undefined, undefined, 8]} visible={false} frustumCulled={false} raycast={noRaycast}>
      <sphereGeometry args={[1, 5, 4]} /><meshBasicMaterial color="#bbd8d4" transparent opacity={.62} depthWrite={false} />
    </instancedMesh>
  </group>;
}
