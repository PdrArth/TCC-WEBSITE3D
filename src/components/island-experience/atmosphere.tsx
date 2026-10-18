"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { FrameCadence } from "@/lib/experience/navigation.mjs";
import type { WorldEnvironmentManifest } from "@/lib/experience-contract";
import { createEnvironmentManifest, type EnvironmentState } from "@/lib/experience/environment.mjs";
import type { Weather, WeatherPhase } from "@/lib/experience/weather.mjs";
import { seasonInfo, type Season } from "@/lib/experience/seasons.mjs";
import { advanceBird, createBirdState, type BirdState, type BirdCompanion } from "@/lib/experience/bird-life.mjs";
import { faunaCount, rainDropScale, weatherVisualProfile, atmospherePalette, advanceHail, createHailField, createRainImpacts, createRainSprayGeometry, advanceRainImpacts, writeRainImpactPose, writeCloudAnchor, environmentSeconds, createBirdGeometry, advanceSnow, createSnowField, birdFlightShare, createRainField, lightningTargets as defaultLightningTargets, ThunderClock, writeBranchedLightning, type LightPalette } from "./scene-motion.mjs";

export type { Weather } from "@/lib/experience/weather.mjs";
type AtmosphereProps = {
  companion?: MutableRefObject<BirdCompanion>;
  weather: Weather; phase?: WeatherPhase; timeOfDay?: number; windSpeed?: number; precipitation?: number; snowfall?: number;
  strikeTargets?: [number,number,number][]; birdPerches?: { position: [number,number,number]; island: string }[]; birdShelters?: { position: [number,number,number]; island: string }[];
  environment?: WorldEnvironmentManifest; environmentState?: MutableRefObject<EnvironmentState>;
  season: Season; quality: "high" | "low"; active: boolean; moving: boolean; reducedMotion: boolean;
  onInteract?: () => void; onThunder?: () => void;
};
const defaultEnvironment = createEnvironmentManifest();
const rippleLife = 1.35;
const phaseAt = (hour: number | undefined, phase?: WeatherPhase): WeatherPhase => {
  if (!Number.isFinite(hour)) return phase ?? "day";
  const h = ((hour! % 24) + 24) % 24;
  return h < 5.5 || h >= 20.5 ? "night" : h < 9 ? "dawn" : h >= 15.5 ? "dusk" : "day";
};

function softTexture(cloud = false) {
  const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32,32,cloud ? 0 : 2,32,32,31);
  gradient.addColorStop(0,"rgba(255,255,255,1)");
  if(cloud){gradient.addColorStop(.55,"rgba(255,255,255,.98)");gradient.addColorStop(.79,"rgba(255,255,255,.78)");}
  else gradient.addColorStop(.52,"rgba(255,255,255,.75)");
  gradient.addColorStop(1,"rgba(255,255,255,0)");
  context.fillStyle = gradient; context.fillRect(0,0,64,64);
  if(cloud){
    const shade=context.createLinearGradient(0,0,0,64);shade.addColorStop(0,"#ffffff");shade.addColorStop(.45,"#f8fbfa");shade.addColorStop(1,"#9eb4bd");
    context.globalCompositeOperation="source-atop";context.fillStyle=shade;context.fillRect(0,0,64,64);
  }
  return new THREE.CanvasTexture(canvas);
}

function Birds({ companion, weather, phase, timeOfDay, environment, environmentState, birdPerches, birdShelters, quality, active, moving, reducedMotion, onInteract }: Pick<AtmosphereProps,"companion"|"weather"|"phase"|"timeOfDay"|"environment"|"environmentState"|"birdPerches"|"birdShelters"|"quality"|"active"|"moving"|"reducedMotion"|"onInteract">) {
  const { invalidate, gl } = useThree();
  const wings = useRef<THREE.InstancedMesh>(null), bodies = useRef<THREE.InstancedMesh>(null), details = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0), startled = useRef(0), cadence = useRef(new FrameCadence());
  const count = faunaCount("birds",quality);
  const flock = useRef<BirdState[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(),[]);
  const geometry = useMemo(() => createBirdGeometry(),[]);
  const perches = useMemo(() => birdPerches && birdPerches.length>1 ? birdPerches : (environment ?? defaultEnvironment).land.map((land,index) => ({position:[land.center[0] + Math.sin(index) * 1.8,2.5,land.center[1] + Math.cos(index) * 1.5] as [number,number,number],island:land.id})),[birdPerches,environment]);
  const birdColors = useMemo(() => ["#826b4b","#71878c","#b6a686"].map(color => new THREE.Color(color)),[]);
  useEffect(() => () => { Object.values(geometry).forEach(part => part.dispose()); },[geometry]);
  useEffect(() => { cadence.current.reset(); },[moving,active]);
  useFrame((_,delta) => {
    if (!active || !wings.current || !bodies.current || !details.current) return;
    const dt = moving ? environmentSeconds(cadence.current.sample(delta).elapsed,reducedMotion) : 0;
    elapsed.current += dt; startled.current = Math.max(0,startled.current-dt*.42);
    const liveWeather = environmentState?.current.weather ?? weather;
    const hour = environmentState?.current.hour ?? timeOfDay;
    const share = birdFlightShare(liveWeather,hour,phaseAt(hour,phase));
    let flying = 0;
    for (let index = 0; index < count; index++) {
      const mayFly=(index+.5)/count <= share;
      const shelters=birdShelters?.length?birdShelters:perches;
      const state=flock.current[index] ??= createBirdState(index,perches,shelters,!mayFly);
      const pose=advanceBird(state,dt,mayFly,perches,shelters,companion?.current,startled.current);
      if(state.flight)flying++;
      const scale = 1.4*(.9+index%3*.09), width = index%3===1 ? 1.1 : 1, length = index%3===2 ? .9 : 1;
      dummy.position.set(pose.x,pose.y+.105,pose.z);
      dummy.rotation.set(0,pose.heading,pose.bank); dummy.scale.set(scale*width,scale,scale*length); dummy.updateMatrix();
      bodies.current.setMatrixAt(index,dummy.matrix); details.current.setMatrixAt(index,dummy.matrix);
      bodies.current.setColorAt(index,birdColors[index%birdColors.length]);
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? 1 : -1;
        dummy.rotation.set(0,pose.heading,pose.bank); dummy.rotateY(sign*pose.fold*1.2); dummy.rotateZ(sign*pose.flap*(1-pose.fold*.9));
        dummy.scale.set(sign*scale*width,scale,scale*length); dummy.updateMatrix(); wings.current.setMatrixAt(index*2+side,dummy.matrix);
        wings.current.setColorAt(index*2+side,birdColors[index%birdColors.length]);
      }
      if (index === 0) { gl.domElement.setAttribute("data-world-bird-position",[pose.x,pose.y,pose.z].map(v=>v.toFixed(3)).join(",")); gl.domElement.setAttribute("data-world-bird-mode",String(pose.mode)); }
    }
    gl.domElement.setAttribute("data-world-bird-shoulder",String(flock.current.some(bird=>bird.shoulder)));
    bodies.current.instanceMatrix.needsUpdate = true; details.current.instanceMatrix.needsUpdate = true; wings.current.instanceMatrix.needsUpdate = true;
    if (bodies.current.instanceColor) bodies.current.instanceColor.needsUpdate = true;
    if (wings.current.instanceColor) wings.current.instanceColor.needsUpdate = true;
    gl.domElement.setAttribute("data-world-bird-count",String(count)); gl.domElement.setAttribute("data-world-bird-flying",String(flying));
    gl.domElement.setAttribute("data-world-birds-sheltered",String(share===0)); gl.domElement.setAttribute("data-world-bird-time",elapsed.current.toFixed(3));
  });
  const startle = (event:ThreeEvent<MouseEvent>) => {
    if (!onInteract) return;
    event.stopPropagation();
    if (moving && birdFlightShare(weather,environmentState?.current.hour??timeOfDay,phase)>0) startled.current = 1;
    onInteract(); invalidate();
  };
  return <group>
    <instancedMesh name="bird_bodies_and_heads" ref={bodies} args={[geometry.bodies,undefined,count]} frustumCulled={false} onClick={startle}><meshStandardMaterial color="#ffffff" roughness={.88}/></instancedMesh>
    <instancedMesh name="bird_beaks" ref={details} args={[geometry.beak,undefined,count]} frustumCulled={false} onClick={startle}><meshStandardMaterial color="#474c40" roughness={.8}/></instancedMesh>
    <instancedMesh name="bird_articulated_wings" ref={wings} args={[geometry.wing,undefined,count*2]} frustumCulled={false} onClick={startle}><meshStandardMaterial color="#ffffff" roughness={.86} side={THREE.DoubleSide}/></instancedMesh>
  </group>;
}

function Clouds({weather,active,moving,reducedMotion,windSpeed=7,palette}:Pick<AtmosphereProps,"weather"|"active"|"moving"|"reducedMotion"|"windSpeed"> & {palette:MutableRefObject<LightPalette>}) {
  const {gl,camera} = useThree();
  const cloud = useRef<THREE.InstancedMesh>(null), material = useRef<THREE.MeshBasicMaterial>(null);
  const time = useRef(0), coverage = useRef(0), volume = useRef(1), cadence = useRef(new FrameCadence());
  const dummy = useMemo(() => new THREE.Object3D(),[]), tint = useMemo(() => new THREE.Color(),[]);
  const texture = useMemo(() => softTexture(true),[]);
  const ray = useMemo(() => new THREE.Vector3(),[]);
  const anchor = useMemo(() => ({x:0,y:0,width:0,height:0}),[]);
  const profile = useMemo(() => weatherVisualProfile(weather),[weather]);
  useEffect(() => () => texture.dispose(),[texture]);
  useEffect(() => { cadence.current.reset(); },[moving,active]);
  useFrame((_,delta) => {
    if (!active || !cloud.current || !material.current) return;
    const alpha = 1-Math.exp(-1.5*Math.min(2,Math.max(1/120,delta)));
    material.current.opacity += (palette.current.cloud*.90-material.current.opacity)*alpha;
    material.current.color.lerp(tint.set(palette.current.cloudColor),alpha);
    coverage.current += (profile.cloudClusters-coverage.current)*alpha; volume.current += (profile.cloudScale-volume.current)*alpha;
    if (moving) time.current += environmentSeconds(cadence.current.sample(delta).elapsed,reducedMotion)*Math.min(2,.8+Math.max(0,windSpeed??7)*.03);
    cloud.current.count = Math.min(32,Math.ceil(coverage.current)*4); cloud.current.visible = coverage.current>.005;
    // Keep soft clouds inside the upper sky instead of above the camera frustum.
    // Their minimum world altitude remains well above every pavilion.
    const perspective = camera as THREE.PerspectiveCamera;
    const tangent = Math.tan(THREE.MathUtils.degToRad(perspective.fov)/2);
    for (let cluster = 0; cluster < 8; cluster++) {
      for (let lobe = 0; lobe < 4; lobe++) {
        writeCloudAnchor(anchor,cluster,lobe,time.current,coverage.current,volume.current);
        ray.set(anchor.x,anchor.y,.5).unproject(camera).sub(camera.position).normalize();
        const distance = ray.y < 0 ? Math.min(78,Math.max(10,(camera.position.y-14.8)/-ray.y)) : 78;
        dummy.position.copy(camera.position).addScaledVector(ray,distance);
        dummy.position.setY(Math.max(14.8,dummy.position.y));
        const view=perspective.view;
        const halfHeight = distance*tangent*(view?.enabled?view.height/view.fullHeight:1);
        const aspect=view?.enabled?view.width/view.height:perspective.aspect;
        dummy.quaternion.copy(camera.quaternion); dummy.scale.set(anchor.width*halfHeight*aspect,anchor.height*halfHeight,1); dummy.updateMatrix();
        cloud.current.setMatrixAt(cluster*4+lobe,dummy.matrix);
      }
    }
    cloud.current.instanceMatrix.needsUpdate = true;
    gl.domElement.setAttribute("data-world-cloud-clusters",String(profile.cloudClusters)); gl.domElement.setAttribute("data-world-cloud-coverage",coverage.current.toFixed(3));
    gl.domElement.setAttribute("data-world-cloud-opacity",material.current.opacity.toFixed(3)); gl.domElement.setAttribute("data-world-cloud-min-height","14.42");
  });
  return <instancedMesh ref={cloud} args={[undefined,undefined,32]} renderOrder={0} frustumCulled={false} raycast={()=>{}}><planeGeometry args={[2,2]}/><meshBasicMaterial ref={material} map={texture} color="#f1f4ef" transparent opacity={0} depthWrite={false} fog={false}/></instancedMesh>;
}

/* eslint-disable react-hooks/immutability -- R3F owns mutable scene objects and GPU buffers outside React state. */
export default function Atmosphere({companion,weather,phase,windSpeed,precipitation,snowfall,birdPerches,birdShelters,strikeTargets,timeOfDay,environment=defaultEnvironment,environmentState,season,quality,active,moving,reducedMotion,onInteract,onThunder}:AtmosphereProps) {
  const {gl,scene,camera,size,invalidate} = useThree();
  const lightningTargets = strikeTargets?.length ? strikeTargets : defaultLightningTargets;
  const hemisphere = useRef<THREE.HemisphereLight>(null), sun = useRef<THREE.DirectionalLight>(null), fill = useRef<THREE.DirectionalLight>(null);
  const rain = useRef<THREE.LineSegments>(null), drops = useRef<THREE.InstancedMesh>(null), ripples = useRef<THREE.InstancedMesh>(null), spray = useRef<THREE.InstancedMesh>(null), hail = useRef<THREE.InstancedMesh>(null);
  const snow = useRef<THREE.Points>(null), lightning = useRef<THREE.LineSegments>(null), lightningVolume = useRef<THREE.InstancedMesh>(null), lightningLight = useRef<THREE.PointLight>(null);
  const dummy = useMemo(() => new THREE.Object3D(),[]), axis = useMemo(() => new THREE.Vector3(0,1,0),[]), segment = useMemo(() => new THREE.Vector3(),[]);
  const clock = useRef(0), thunder = useRef(new ThunderClock()), strikeIndex = useRef(0), cadence = useRef(new FrameCadence()), initialized = useRef(false);
  const palette = useRef(atmospherePalette(weather,phase,timeOfDay));
  const colors = useMemo(() => ({sky:new THREE.Color("#e2ebe6"),upper:new THREE.Color(),lower:new THREE.Color(),sun:new THREE.Color(),fill:new THREE.Color()}),[]);
  const rainProfile = useMemo(() => weatherVisualProfile(weather),[weather]);
  const rainStyle = useRef(rainProfile);
  const snowField = useMemo(() => createSnowField(quality==="high"?640:250),[quality]);
  const snowGeometry = useMemo(() => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.BufferAttribute(snowField.positions,3).setUsage(THREE.DynamicDrawUsage)); return geometry; },[snowField]);
  const particleTexture = useMemo(() => softTexture(),[]);
  const rainField = useMemo(() => createRainField(quality==="high"?420:180,22,environment),[quality,environment]);
  const impacts = useMemo(() => createRainImpacts(quality==="high"?96:44),[quality]);
  const impactPose = useMemo(() => ({ring:0,opacity:0,sprayY:0,sprayXZ:0,lift:0}),[]);
  const rippleGeometry = useMemo(() => { const geometry = new THREE.RingGeometry(.85,1,24); geometry.setAttribute("rippleOpacity",new THREE.InstancedBufferAttribute(new Float32Array(impacts.ages.length),1)); return geometry; },[impacts]);
  const rippleMaterial = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({color:"#d8efe9",transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
    material.onBeforeCompile = shader => {
      shader.vertexShader = "attribute float rippleOpacity; varying float vRippleOpacity;\n"+shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvRippleOpacity=rippleOpacity;");
      shader.fragmentShader = "varying float vRippleOpacity;\n"+shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.a*=vRippleOpacity;");
    };
    material.customProgramCacheKey = () => "island-water-ripples-v14"; return material;
  },[]);
  const sprayGeometry = useMemo(() => createRainSprayGeometry(),[]);
  const hailField = useMemo(() => createHailField(quality==="high"?120:52),[quality]);
  const rainGeometry = useMemo(() => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.BufferAttribute(rainField.positions,3).setUsage(THREE.DynamicDrawUsage)); return geometry; },[rainField]);
  const lightningGeometry = useMemo(() => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.BufferAttribute(writeBranchedLightning(new Float32Array(21*6),lightningTargets[0]),3).setUsage(THREE.DynamicDrawUsage)); return geometry; },[lightningTargets]);
  const backdrop = useMemo(() => gl.domElement.closest<HTMLElement>(".island-experience"),[gl]);

  useEffect(() => { scene.background = null; scene.fog = new THREE.Fog(colors.sky,65,145); return () => { scene.background = null; scene.fog = null; }; },[scene,colors]);
  useEffect(() => () => { snowGeometry.dispose(); },[snowGeometry]);
  useEffect(() => () => particleTexture.dispose(),[particleTexture]);
  useEffect(() => () => rainGeometry.dispose(),[rainGeometry]);
  useEffect(() => () => rippleGeometry.dispose(),[rippleGeometry]);
  useEffect(() => () => rippleMaterial.dispose(),[rippleMaterial]);
  useEffect(() => () => sprayGeometry.dispose(),[sprayGeometry]);
  useEffect(() => () => lightningGeometry.dispose(),[lightningGeometry]);
  useEffect(() => { if (weather==="storm" || weather==="hail") thunder.current.reset(Math.random,true); else thunder.current.cancel(); },[weather]);
  useEffect(() => {
    cadence.current.reset();
    if (!active || !moving || reducedMotion) {
      thunder.current.cancel();
      if (lightning.current) lightning.current.visible = false;
      if (lightningVolume.current) lightningVolume.current.visible = false;
      if (lightningLight.current) lightningLight.current.intensity = 0;
    }
  },[active,moving,reducedMotion]);
  useEffect(() => { if (active) invalidate(); },[active,weather,phase,timeOfDay,season,quality,reducedMotion,invalidate]);

  useFrame((_,delta) => {
    if (!active || !hemisphere.current || !sun.current || !fill.current || !rain.current) return;
    const alpha = !initialized.current ? 1 : 1-Math.exp(-1.5*Math.min(2,Math.max(1/120,delta)));
    const dt = moving ? environmentSeconds(cadence.current.sample(delta).elapsed,reducedMotion) : 0;
    clock.current += dt; initialized.current = true;
    const liveWeather = environmentState?.current.weather ?? weather;
    const hour = environmentState?.current.hour ?? timeOfDay;
    const livePhase = phaseAt(hour,phase);
    const goal = atmospherePalette(liveWeather,livePhase,hour); palette.current = goal;
    const seasonal = liveWeather==="clear" && !Number.isFinite(hour) && livePhase==="day";
    const sky = colors.upper.set(seasonal?seasonInfo[season].palette.sky:goal.sky);
    colors.sky.lerp(sky,alpha); scene.fog?.color.copy(colors.sky);
    backdrop?.style.setProperty("--world-sky","#"+colors.sky.getHexString());
    if (scene.fog instanceof THREE.Fog) {
      const near = liveWeather==="fog" ? Math.max(12,camera.position.length()-13) : camera.position.length()+25;
      const range = liveWeather==="fog" ? 67 : 105;
      scene.fog.near += (near-scene.fog.near)*alpha; scene.fog.far += (near+range-scene.fog.far)*alpha;
    }
    hemisphere.current.color.lerp(colors.upper.set(goal.upper),alpha);
    hemisphere.current.groundColor.lerp(colors.lower.set(seasonal?seasonInfo[season].palette.ground:goal.lower),alpha);
    hemisphere.current.intensity += (goal.ambient-hemisphere.current.intensity)*alpha;
    sun.current.color.lerp(colors.sun.set(goal.sun),alpha); sun.current.intensity += (goal.intensity-sun.current.intensity)*alpha;
    sun.current.position.x += (goal.sunPosition[0]-sun.current.position.x)*alpha; sun.current.position.y += (goal.sunPosition[1]-sun.current.position.y)*alpha; sun.current.position.z += (goal.sunPosition[2]-sun.current.position.z)*alpha;
    fill.current.color.lerp(colors.fill.set(goal.fill),alpha); fill.current.intensity += (goal.fillIntensity-fill.current.intensity)*alpha;
    gl.toneMappingExposure += (goal.exposure-gl.toneMappingExposure)*alpha;

    const rainMaterial = rain.current.material as THREE.LineBasicMaterial;
    const wet = precipitation===undefined ? 1 : Math.min(1,.45+Math.max(0,precipitation)/2);
    if (rainProfile.rainRatio>0) rainStyle.current = rainProfile;
    const dropCount = Math.round(rainField.speeds.length*rainStyle.current.rainRatio*wet);
    const dropScale = rainDropScale(rainStyle.current,Math.hypot(camera.position.x,camera.position.y-6,camera.position.z),(camera as THREE.PerspectiveCamera).fov,size.height);
    const rainOpacity = rainProfile.rainRatio>0 ? rainProfile.dropOpacity*wet : 0;
    rainMaterial.opacity += (rainOpacity-rainMaterial.opacity)*alpha;
    rainMaterial.color.set(liveWeather==="freezing-rain"?"#bad8e6":"#96b3c0"); rain.current.visible = rainMaterial.opacity>.015;
    if (moving) advanceRainImpacts(rainField,impacts,dt,Math.max(.25,(windSpeed??7)/7),{count:rain.current.visible?dropCount:0,speed:rainStyle.current.rainSpeed,life:rippleLife,environment});
    if (moving && rain.current.visible) rainGeometry.attributes.position.needsUpdate = true;
    if (drops.current && ripples.current && spray.current) {
      const dropMaterial = drops.current.material as THREE.MeshBasicMaterial, sprayMaterial = spray.current.material as THREE.MeshBasicMaterial;
      dropMaterial.opacity = rainMaterial.opacity*.82; rippleMaterial.opacity = Math.max(rainMaterial.opacity,.36)*.86; sprayMaterial.opacity = Math.max(rainMaterial.opacity,.36)*.9;
      dropMaterial.color.set(liveWeather==="storm"||liveWeather==="hail"?"#bfd4dc":"#698b9c");
      drops.current.visible = rain.current.visible; drops.current.count = dropCount; rainGeometry.setDrawRange(0,dropCount*2);
      for (let index = 0; index < dropCount; index++) { const o = index*6; dummy.position.set(rainField.positions[o],rainField.positions[o+1],rainField.positions[o+2]); dummy.rotation.set(0,0,-.09); dummy.scale.set(...dropScale); dummy.updateMatrix(); drops.current.setMatrixAt(index,dummy.matrix); }
      const opacity = rippleGeometry.getAttribute("rippleOpacity") as THREE.InstancedBufferAttribute;
      let live = 0, centerLive = 0, marginLive = 0;
      for (let index = 0; index < impacts.ages.length; index++) {
        const o = index*3, age = impacts.ages[index], alive = age<rippleLife;
        writeRainImpactPose(impactPose,age,rippleLife);
        if (alive) {
          live++;
          const x = impacts.positions[o]-environment.water.center[0], z = impacts.positions[o+2]-environment.water.center[1], radiusSquared = x*x+z*z;
          if (radiusSquared<36) centerLive++;
          if (radiusSquared>100) marginLive++;
        }
        dummy.position.set(impacts.positions[o],impacts.positions[o+1],impacts.positions[o+2]); dummy.rotation.set(-Math.PI/2,0,0); dummy.scale.setScalar(impactPose.ring);
        opacity.setX(index,impactPose.opacity); dummy.updateMatrix(); ripples.current.setMatrixAt(index,dummy.matrix);
        dummy.position.y += impactPose.lift; dummy.rotation.set(0,index*2.1,0); dummy.scale.set(impactPose.sprayXZ,impactPose.sprayY,impactPose.sprayXZ); dummy.updateMatrix(); spray.current.setMatrixAt(index,dummy.matrix);
      }
      ripples.current.visible = live>0; spray.current.visible = live>0;
      opacity.needsUpdate = true; drops.current.instanceMatrix.needsUpdate = true; ripples.current.instanceMatrix.needsUpdate = true; spray.current.instanceMatrix.needsUpdate = true;
      gl.domElement.setAttribute("data-world-rain-ripple-live",String(live));
      gl.domElement.setAttribute("data-world-rain-center-live",String(centerLive)); gl.domElement.setAttribute("data-world-rain-margins-live",String(marginLive));
    }
    if (snow.current) {
      const material = snow.current.material as THREE.PointsMaterial;
      const density = snowfall===undefined ? 1 : Math.min(1,.45+Math.max(0,snowfall)/.3);
      material.opacity += ((liveWeather==="snow"?.93:0)*density-material.opacity)*alpha; material.size = reducedMotion?.14:.19;
      snow.current.visible = material.opacity>.01;
      if (moving && snow.current.visible) { advanceSnow(snowField,dt,false,Math.max(.3,(windSpeed??7)/7)); snowGeometry.attributes.position.needsUpdate = true; }
      gl.domElement.setAttribute("data-world-snow-opacity",material.opacity.toFixed(3));
    }
    if (hail.current) {
      const material = hail.current.material as THREE.MeshStandardMaterial;
      material.opacity += ((liveWeather==="hail"?.92:0)-material.opacity)*alpha; hail.current.visible = material.opacity>.01;
      if (hail.current.visible) {
        if (moving) advanceHail(hailField,dt,environment);
        for (let index = 0; index < hailField.velocities.length; index++) {
          const o = index*3, depth = hailField.sinking[index] ? Math.max(0,environment.water.height-hailField.positions[o+1]) : 0;
          dummy.position.set(hailField.positions[o],hailField.positions[o+1],hailField.positions[o+2]); dummy.rotation.set(clock.current*.8+index,clock.current*.65,0); dummy.scale.setScalar((.026+index%4*.006)*Math.max(0,1-depth/.25)); dummy.updateMatrix(); hail.current.setMatrixAt(index,dummy.matrix);
        }
        hail.current.instanceMatrix.needsUpdate = true;
      }
      gl.domElement.setAttribute("data-world-hail-opacity",material.opacity.toFixed(3)); gl.domElement.setAttribute("data-world-hail-bounces",String(hailField.totalBounces)); gl.domElement.setAttribute("data-world-hail-water-hits",String(hailField.waterHits));
    }

    const thunderEnabled = moving && !reducedMotion && (liveWeather==="storm"||liveWeather==="hail");
    if (thunder.current.advance(dt,thunderEnabled)) {
      const target = lightningTargets[strikeIndex.current%lightningTargets.length]; strikeIndex.current++;
      const points = writeBranchedLightning(lightningGeometry.attributes.position.array as Float32Array,target,strikeIndex.current);
      lightningGeometry.attributes.position.needsUpdate = true; lightningGeometry.computeBoundingSphere();
      if (lightningVolume.current) for (let index = 0; index < 21; index++) {
        const o = index*6; dummy.position.set((points[o]+points[o+3])*.5,(points[o+1]+points[o+4])*.5,(points[o+2]+points[o+5])*.5);
        segment.set(points[o+3]-points[o],points[o+4]-points[o+1],points[o+5]-points[o+2]); const length = segment.length();
        dummy.quaternion.setFromUnitVectors(axis,segment.normalize()); dummy.scale.set(index<9?.022:.013,length,index<9?.022:.013); dummy.updateMatrix(); lightningVolume.current.setMatrixAt(index,dummy.matrix);
      }
      if (lightningVolume.current) lightningVolume.current.instanceMatrix.needsUpdate = true;
      lightningLight.current?.position.set(target[0],target[1]+1.8,target[2]);
      gl.domElement.setAttribute("data-world-lightning-target",target.join(",")); gl.domElement.setAttribute("data-world-lightning-count",String(strikeIndex.current));
      scene.userData.lastWeatherStrike={at:performance.now(),index:strikeIndex.current};
    }
    if (thunderEnabled && thunder.current.takeThunder()) onThunder?.();
    const glow = thunderEnabled ? thunder.current.glow : 0;
    if (lightning.current && lightningLight.current && lightningVolume.current) {
      lightning.current.visible = glow>.01; lightningVolume.current.visible = glow>.01;
      (lightning.current.material as THREE.LineBasicMaterial).opacity = glow*.95; (lightningVolume.current.material as THREE.MeshBasicMaterial).opacity = glow*.58;
      lightningLight.current.intensity = glow*glow*3.2;
    }
    gl.domElement.setAttribute("data-world-phase",livePhase); gl.domElement.setAttribute("data-world-time-of-day",String(hour??"phase"));
    gl.domElement.setAttribute("data-world-sky",colors.sky.getHexString()); gl.domElement.setAttribute("data-world-sun-intensity",sun.current.intensity.toFixed(3));
    gl.domElement.setAttribute("data-world-rain-opacity",rainMaterial.opacity.toFixed(3)); gl.domElement.setAttribute("data-world-rain-position",rainField.positions[1].toFixed(3));
    gl.domElement.setAttribute("data-world-rain-splashes",String(impacts.count)); gl.domElement.setAttribute("data-world-rain-drop-count",String(rain.current.visible?dropCount:0));
    gl.domElement.setAttribute("data-world-rain-drop-scale",dropScale.map(value=>value.toFixed(4)).join(",")); gl.domElement.setAttribute("data-world-rain-ripple-height",(environment.water.height+.025).toFixed(3));
    gl.domElement.setAttribute("data-world-weather-clock",clock.current.toFixed(3)); gl.domElement.setAttribute("data-world-lightning-branches","3");
    const targetSky = colors.upper.set(seasonal?seasonInfo[season].palette.sky:goal.sky);
    const skyPending = Math.abs(colors.sky.r-targetSky.r)+Math.abs(colors.sky.g-targetSky.g)+Math.abs(colors.sky.b-targetSky.b)>.002;
    if (Math.abs(sun.current.intensity-goal.intensity)>.005 || skyPending || Math.abs(rainMaterial.opacity-rainOpacity)>.002) invalidate();
  });

  return <>
    <hemisphereLight ref={hemisphere} args={["#fff5df","#9ba587",2.3]}/>
    <directionalLight ref={sun} position={[-8,16,10]} intensity={3.3} color="#fff0d2" castShadow shadow-mapSize={quality==="high"?[2048,2048]:[1024,1024]} shadow-camera-left={-27} shadow-camera-right={27} shadow-camera-top={27} shadow-camera-bottom={-27} shadow-camera-far={85} shadow-radius={2.5} shadow-normalBias={.025} shadow-bias={-.0001}/>
    <directionalLight ref={fill} position={[10,6,-8]} intensity={.65} color="#e1edf0"/>
    <Clouds weather={weather} active={active} moving={moving} windSpeed={windSpeed} palette={palette} reducedMotion={reducedMotion}/>
    <Birds companion={companion} weather={weather} phase={phase} timeOfDay={timeOfDay} environment={environment} environmentState={environmentState} birdPerches={birdPerches} birdShelters={birdShelters} quality={quality} active={active} moving={moving} reducedMotion={reducedMotion} onInteract={onInteract}/>
    <lineSegments ref={rain} geometry={rainGeometry} frustumCulled={false} raycast={()=>{}}><lineBasicMaterial color="#96b3c0" transparent opacity={0} depthWrite={false}/></lineSegments>
    <instancedMesh ref={drops} args={[undefined,undefined,rainField.speeds.length]} frustumCulled={false} raycast={()=>{}}><sphereGeometry args={[1,4,3]}/><meshBasicMaterial color="#698b9c" transparent opacity={0} depthWrite={false} toneMapped={false}/></instancedMesh>
    <instancedMesh name="water_rain_ripples" ref={ripples} args={[rippleGeometry,rippleMaterial,impacts.ages.length]} renderOrder={4} frustumCulled={false} raycast={()=>{}}/>
    <instancedMesh name="water_rain_spray" ref={spray} args={[sprayGeometry,undefined,impacts.ages.length]} renderOrder={5} frustumCulled={false} raycast={()=>{}}><meshBasicMaterial color="#dfefea" transparent opacity={0} depthWrite={false} toneMapped={false}/></instancedMesh>
    <instancedMesh ref={hail} args={[undefined,undefined,hailField.velocities.length]} frustumCulled={false} raycast={()=>{}}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#dceaf1" roughness={.29} metalness={.015} transparent opacity={0}/></instancedMesh>
    <points ref={snow} geometry={snowGeometry} frustumCulled={false} raycast={()=>{}}><pointsMaterial map={particleTexture} color="#ffffff" size={.19} transparent opacity={0} depthWrite={false} sizeAttenuation/></points>
    <instancedMesh ref={lightningVolume} args={[undefined,undefined,21]} visible={false} renderOrder={7} frustumCulled={false} raycast={()=>{}}><cylinderGeometry args={[1,1,1,4]}/><meshBasicMaterial color="#b9d6ef" transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending}/></instancedMesh>
    <lineSegments ref={lightning} geometry={lightningGeometry} visible={false} renderOrder={8} frustumCulled={false} raycast={()=>{}}><lineBasicMaterial color="#eff7ff" transparent opacity={0} depthWrite={false} toneMapped={false}/></lineSegments>
    <pointLight ref={lightningLight} color="#dbeaff" position={[-15.2,4.6,-5.8]} intensity={0} distance={10} decay={2}/>
  </>;
}
/* eslint-enable react-hooks/immutability */
