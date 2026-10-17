"use client";

/* eslint-disable react-hooks/immutability -- GPU uniforms are updated in place by Three.js's frame loop. */

import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldEnvironmentManifest } from "@/lib/experience-contract";
import { createEnvironmentManifest, type EnvironmentState } from "@/lib/experience/environment.mjs";

type NightLightingProps = {
  environment?: WorldEnvironmentManifest;
  environmentState?: MutableRefObject<EnvironmentState>;
  quality?: "low" | "high";
  moving?: boolean;
  reducedMotion?: boolean;
};
type Lamp = { x: number; y: number; z: number; height: number; hanging: boolean };
const noRaycast = () => {};

function makeLamps(environment: WorldEnvironmentManifest, quality: "low" | "high") {
  const lamps: Lamp[] = environment.lights.map(light => ({ x: light.position[0], y: light.position[1], z: light.position[2], height: .28, hanging: true }));
  for (const land of environment.land) {
    for (const side of quality === "high" ? [-1, 1] : [1]) lamps.push({ x: land.center[0] + side * 1.02, y: Math.min(.15, land.height) + .59, z: land.center[1] + 2.4, height: .51, hanging: false });
  }
  for (const bridge of environment.bridges) {
    if(bridge.lighting===false)continue;
    const dx = bridge.to[0] - bridge.from[0], dz = bridge.to[1] - bridge.from[1];
    const length = Math.hypot(dx, dz) || 1;
    for (const [index, t] of (quality === "high" ? [.32, .68] : [.5]).entries()) {
      const side = index % 2 ? -1 : 1;
      lamps.push({ x: bridge.from[0] + dx * t - dz / length * bridge.width * .8 * side, y: bridge.height + .59, z: bridge.from[1] + dz * t + dx / length * bridge.width * .8 * side, height: .51, hanging: false });
    }
  }
  return lamps;
}

/** Instanced fixtures and one rotating spotlight keep night lighting bounded. */
export default function NightLighting({ environment: providedEnvironment, environmentState, quality = "high", moving = true, reducedMotion = false }: NightLightingProps) {
  const { gl, invalidate } = useThree();
  const environment = useMemo(() => providedEnvironment ?? createEnvironmentManifest(), [providedEnvironment]);
  const lamps = useMemo(() => makeLamps(environment, quality), [environment, quality]);
  const posts = useRef<THREE.InstancedMesh>(null), caps = useRef<THREE.InstancedMesh>(null), globes = useRef<THREE.InstancedMesh>(null);
  const globeMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const spot = useRef<THREE.SpotLight>(null), roomLight = useRef<THREE.PointLight>(null), beam = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const previous = useRef({ time: 0, night: 0 });
  const beamUniforms = useMemo(() => ({ night: { value: 0 } }), []);
  const beamGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(2.2, .055, 19, quality === "high" ? 24 : 12, 1, true);
    geometry.translate(0, 9.5, 0); geometry.rotateZ(-Math.PI / 2);
    return geometry;
  }, [quality]);
  const beamMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 beamUv; varying vec3 beamNormal; varying vec3 beamWorld;
      void main() { beamUv=uv; beamNormal=normalize(mat3(modelMatrix)*normal); vec4 world=modelMatrix*vec4(position,1.); beamWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `uniform float night; varying vec2 beamUv; varying vec3 beamNormal; varying vec3 beamWorld;
      void main() { float edge=pow(1.-abs(dot(normalize(beamNormal),normalize(cameraPosition-beamWorld))),.7); float along=pow(1.-beamUv.y,1.5); gl_FragColor=vec4(1.,.81,.47,night*.062*along*edge); }`,
  }), [beamUniforms]);

  useLayoutEffect(() => {
    for (let i = 0; i < lamps.length; i++) {
      const lamp = lamps[i];
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(lamp.x, lamp.y + (lamp.hanging ? lamp.height / 2 + .12 : -lamp.height / 2 - .06), lamp.z);
      dummy.scale.set(lamp.hanging ? .022 : .035, lamp.height, lamp.hanging ? .022 : .035); dummy.updateMatrix(); posts.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(lamp.x, lamp.y + .13, lamp.z); dummy.scale.set(.16, .12, .16); dummy.updateMatrix(); caps.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(lamp.x, lamp.y, lamp.z); dummy.scale.set(.095, .105, .095); dummy.updateMatrix(); globes.current?.setMatrixAt(i, dummy.matrix);
    }
    for (const mesh of [posts.current, caps.current, globes.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [lamps, dummy, invalidate]);
  useEffect(() => () => { beamGeometry.dispose(); }, [beamGeometry]);
  useEffect(() => () => { beamMaterial.dispose(); }, [beamMaterial]);
  useEffect(() => { invalidate(); }, [environment, environmentState, moving, reducedMotion, invalidate]);

  useFrame(() => {
    const state = environmentState?.current;
    const night = state?.night ?? 0;
    // The shared environment clock owns pause/reduced-motion pacing.
    const time = moving ? state?.elapsed ?? previous.current.time : previous.current.time;
    previous.current.time = time;
    const baseYaw = Math.atan2(environment.lighthouse.direction[2], environment.lighthouse.direction[0]);
    const yaw = baseYaw + time * (reducedMotion ? .075 : .14);
    const [x, y, z] = environment.lighthouse.position;
    if (beam.current) { beam.current.position.set(x, y, z); beam.current.rotation.set(0, -yaw, -.022); beam.current.visible = night > .01; }
    beamUniforms.night.value = night;
    if (spot.current) {
      spot.current.visible = night > .005;
      spot.current.position.set(x, y, z); spot.current.intensity = night * 38;
      target.position.set(x + Math.cos(yaw) * 19, y - .42, z + Math.sin(yaw) * 19); target.updateMatrixWorld();
    }
    if (roomLight.current) {roomLight.current.visible=night>.005;roomLight.current.intensity=night*4.2;}
    if (globeMaterial.current) globeMaterial.current.emissiveIntensity = night * 2.35;
    const changed = Math.abs(previous.current.night - night) > .003;
    previous.current.night = night;
    gl.domElement.setAttribute("data-world-night-lights", night.toFixed(3));
    gl.domElement.setAttribute("data-world-lamp-count", String(lamps.length));
    gl.domElement.setAttribute("data-world-night-dynamic-lights", "2");
    gl.domElement.setAttribute("data-world-beacon-angle", yaw.toFixed(3));
    gl.domElement.setAttribute("data-world-beacon-position", environment.lighthouse.position.join(","));
    if (changed) invalidate();
  });

  return <group name="night_lighting">
    <instancedMesh name="night_lamp_posts" ref={posts} args={[undefined, undefined, lamps.length]} frustumCulled={false} raycast={noRaycast}><cylinderGeometry args={[1, 1, 1, 7]} /><meshStandardMaterial color="#5b6355" roughness={.67} metalness={.4} /></instancedMesh>
    <instancedMesh name="night_lamp_caps" ref={caps} args={[undefined, undefined, lamps.length]} frustumCulled={false} raycast={noRaycast}><coneGeometry args={[1, 1, 8]} /><meshStandardMaterial color="#626650" roughness={.56} metalness={.48} /></instancedMesh>
    <instancedMesh name="night_lamp_globes" ref={globes} args={[undefined, undefined, lamps.length]} frustumCulled={false} raycast={noRaycast}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial ref={globeMaterial} color="#e5cf9e" emissive="#ffc46d" emissiveIntensity={0} roughness={.35} toneMapped={false} /></instancedMesh>
    <group ref={beam} visible={false}><mesh geometry={beamGeometry} material={beamMaterial} renderOrder={5} raycast={noRaycast} /></group>
    <spotLight name="night_beacon_spot" ref={spot} visible={false} target={target} color="#ffe3a4" intensity={0} distance={34} angle={.12} penumbra={.65} decay={1.5} castShadow={false} />
    <primitive object={target} />
    <pointLight name="night_pavilion_light" ref={roomLight} visible={false} position={environment.lights[0]?.position ?? [-11, 2.35, 9.7]} color="#ffcb86" intensity={0} distance={6.2} decay={2} castShadow={false} />
  </group>;
}
