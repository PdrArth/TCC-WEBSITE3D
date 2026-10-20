"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldEnvironmentManifest } from "@/lib/experience-contract";
import type { EnvironmentState } from "@/lib/experience/environment.mjs";
import { flowerBeds, butterflyPose } from "@/lib/experience/garden-life.mjs";
import { seasonInfo, type Season } from "@/lib/experience/seasons.mjs";

const noRaycast = () => {};
/** Instanced garden accents; the authored buildings, trees and routes remain intact. */
export default function GardenLife({ environment, environmentState, season, reducedMotion, quality }: {
  environment: WorldEnvironmentManifest; environmentState: MutableRefObject<EnvironmentState>;
  season: Season; reducedMotion: boolean; quality: "high" | "low";
}) {
  const { gl } = useThree();
  const beds = useMemo(() => flowerBeds(environment, quality), [environment, quality]);
  const flowers = useMemo(() => beds.flatMap(bed => [0, 1, 2].map(i => ({ ...bed, x: bed.x + Math.cos(i * 2.1) * .17, z: bed.z + Math.sin(i * 2.1) * .17, height: bed.height * (.8 + i * .14) }))), [beds]);
  const count = Math.min(beds.length, quality === "high" ? 14 : 7);
  const stems = useRef<THREE.InstancedMesh>(null), petals = useRef<THREE.InstancedMesh>(null), centers = useRef<THREE.InstancedMesh>(null), leaves = useRef<THREE.InstancedMesh>(null);
  const wings = useRef<THREE.InstancedMesh>(null), bodies = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flowerClock=useRef(-Infinity),flowerUpdates=useRef(0);
  const wingGeometry = useMemo(() => {
    const wing = new THREE.Shape();
    wing.moveTo(0, 0); wing.bezierCurveTo(.32, .8, 1.12, .85, .95, .15);
    wing.bezierCurveTo(1.15, -.5, .4, -.65, .08, -.2); wing.lineTo(0, 0);
    const geometry = new THREE.ShapeGeometry(wing, 8); geometry.rotateX(-Math.PI / 2); return geometry;
  }, []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 7, 5), []);
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 5), []);
  useEffect(() => () => { wingGeometry.dispose(); sphere.dispose(); stemGeometry.dispose(); }, [wingGeometry, sphere, stemGeometry]);
  useEffect(() => {
    flowers.forEach((flower, index) => { const color = new THREE.Color(flower.color); for (let p = 0; p < 5; p++) petals.current?.setColorAt(index * 5 + p, color); });
    for (let i = 0; i < count; i++) {
      const color = new THREE.Color(["#dfbc72", "#a4bbd2", "#d7b9cc", "#e6d9ac"][i % 4]);
      wings.current?.setColorAt(i * 2, color); wings.current?.setColorAt(i * 2 + 1, color);
    }
    for (const mesh of [petals.current, wings.current]) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flowers, count]);
  useEffect(()=>{
    flowerClock.current=-Infinity;
    flowers.forEach((flower,i)=>{dummy.position.set(flower.x+.065,flower.y+flower.height*.45,flower.z);dummy.rotation.set(0,flower.seed,-.35);dummy.scale.set(.11,.018,.04);dummy.updateMatrix();leaves.current?.setMatrixAt(i,dummy.matrix);});
    if(leaves.current)leaves.current.instanceMatrix.needsUpdate=true;
  },[flowers,season,dummy]);
  useFrame(() => {
    const state = environmentState.current;
    const time = reducedMotion ? 0 : state.elapsed;
    const bloom = (.28 + seasonInfo[season].flowerDensity * .72) * (1 - state.snow * .85);
    const wind = reducedMotion ? 0 : .025 + state.wind * .045;
    if(time-flowerClock.current>=.05){
    flowerClock.current=time;flowerUpdates.current++;
    flowers.forEach((flower, i) => {
      const sway = Math.sin(time * .8 + flower.seed) * wind;
      dummy.position.set(flower.x + sway * .5, flower.y + flower.height / 2, flower.z);
      dummy.rotation.set(0, 0, -sway); dummy.scale.set(.012, flower.height, .012); dummy.updateMatrix(); stems.current?.setMatrixAt(i, dummy.matrix);
      const topX = flower.x + sway, topY = flower.y + flower.height;
      for (let p = 0; p < 5; p++) {
        const angle = p * Math.PI * 2 / 5 + flower.seed;
        dummy.position.set(topX + Math.cos(angle) * .085 * bloom, topY, flower.z + Math.sin(angle) * .085 * bloom);
        dummy.rotation.set(.12, -angle, 0); dummy.scale.set(.10 * bloom, .035 * bloom, .06 * bloom); dummy.updateMatrix(); petals.current?.setMatrixAt(i * 5 + p, dummy.matrix);
      }
      dummy.position.set(topX, topY + .025, flower.z); dummy.scale.set(.042 * bloom, .027 * bloom, .042 * bloom); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); centers.current?.setMatrixAt(i, dummy.matrix);
    });
    for(const mesh of [stems.current,petals.current,centers.current])if(mesh)mesh.instanceMatrix.needsUpdate=true;
    }
    const calm = !["rain", "storm", "freezing-rain", "snow", "hail"].includes(state.weather) && state.night < .3;
    for (let i = 0; i < count; i++) {
      const pose = butterflyPose(i, time, beds[(i * 3) % beds.length]);
      const size = calm ? .16 + (i % 3) * .018 : 0;
      dummy.position.set(pose.x, pose.y, pose.z); dummy.rotation.set(0, pose.heading, 0); dummy.scale.set(size * .14, size * .15, size * .65); dummy.updateMatrix(); bodies.current?.setMatrixAt(i, dummy.matrix);
      for (let side = 0; side < 2; side++) {
        dummy.rotation.set(0, pose.heading, side ? Math.PI - pose.flap : pose.flap); dummy.scale.set(size, size, size); dummy.updateMatrix(); wings.current?.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    }
    for (const mesh of [wings.current, bodies.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    gl.domElement.setAttribute("data-garden-butterflies", String(calm ? count : 0));
    gl.domElement.setAttribute("data-garden-flower-beds", String(beds.length));
    gl.domElement.setAttribute('data-garden-flower-updates',String(flowerUpdates.current));
  });
  return <group name="garden_living_accents">
    <instancedMesh ref={stems} args={[stemGeometry, undefined, flowers.length]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#64805a" roughness={.88}/></instancedMesh>
    <instancedMesh ref={leaves} args={[sphere, undefined, flowers.length]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color={seasonInfo[season].palette.sage} roughness={.85}/></instancedMesh>
    <instancedMesh ref={petals} args={[sphere, undefined, flowers.length * 5]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#ffffff" roughness={.8}/></instancedMesh>
    <instancedMesh ref={centers} args={[sphere, undefined, flowers.length]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#bd9655" roughness={.9}/></instancedMesh>
    <instancedMesh ref={wings} args={[wingGeometry, undefined, count * 2]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} roughness={.8}/></instancedMesh>
    <instancedMesh ref={bodies} args={[sphere, undefined, count]} frustumCulled={false} raycast={noRaycast}><meshStandardMaterial color="#5c4b39" roughness={.9}/></instancedMesh>
  </group>;
}
