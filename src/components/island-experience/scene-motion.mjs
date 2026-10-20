import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { surfaceAt } from "../../lib/experience/environment.mjs";

/** Camera and atmosphere helpers shared by the scene and its behavioral checks. */
export function mayAdaptQuality(active, panelOpen, reducedMotion, visible, hasFocus, frameSeconds = 1 / 60) {
  // Embedded browsers may throttle to 1 Hz while still reporting visible/focused.
  // Sparse callbacks are not evidence that this model is too expensive to draw.
  return active && !panelOpen && !reducedMotion && visible && hasFocus && Number.isFinite(frameSeconds) && frameSeconds > 0 && frameSeconds <= .25;
}

export function fieldOfView(fov, width, height, detail = false) {
  if (width <= 0 || height <= 0 || width >= height) return fov;
  return Math.min(detail ? 72 : 64, fov / Math.max(.56, width / height));
}

/** Keep the authored horizontal composition when a tall phone cannot widen its FOV. */
export function overviewDistanceScale(fov, width, height) {
  if (width <= 0 || height <= 0) return 1;
  const aspect = width / height;
  const vertical = fieldOfView(fov, width, height) * Math.PI / 180;
  return Math.max(1, Math.tan(fov * Math.PI / 360) * 1.30 / (aspect * Math.tan(vertical / 2)));
}

export function restingPose(manifest, pavilionId, intro = false) {
  if (pavilionId) return manifest.pavilions[pavilionId].camera;
  const pose = manifest.initialCamera;
  if (!intro) return pose;
  return {
    position: pose.position.map((value, axis) => pose.target[axis] + (value - pose.target[axis]) * 1.05),
    target: pose.target,
    fov: pose.fov,
  };
}

export function clampZoom(value, bounds = { minZoom: .8, maxZoom: 2 }) {
  const min = Number.isFinite(bounds?.minZoom) ? Math.max(.1, bounds.minZoom) : .8;
  const max = Number.isFinite(bounds?.maxZoom) ? Math.max(min, bounds.maxZoom) : 2;
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 1));
}
export function wheelZoom(value, delta, bounds) {
  return clampZoom(value * Math.exp(-Math.min(240, Math.max(-240, Number.isFinite(delta) ? delta : 0)) * .0018), bounds);
}

/** Drag starts after six CSS pixels; a tap remains a selection. */
export class CameraOrbit {
  constructor() { this.reset(); }
  reset(pauseSeconds = 0) { this.yaw = 0; this.pitch = 0; this.anchor = null; this.pinchHeld = false; this.dragging = false; this.suppressClick = false; this.pauseRemaining = Number.isFinite(pauseSeconds) ? Math.max(0, pauseSeconds) : 0; this.autoMode = "paused"; }
  pause(seconds = 5) { this.pauseRemaining = Math.max(this.pauseRemaining, Number.isFinite(seconds) ? Math.max(0, seconds) : 5); }
  advanceAuto(seconds, enabled = true) {
    if (!enabled) { this.autoMode = "paused"; return false; }
    if (this.anchor || this.pinchHeld) { this.autoMode = "gesture"; return false; }
    const dt = motionSeconds(seconds), held = Math.min(dt, this.pauseRemaining);
    this.pauseRemaining -= held;
    if (dt <= held) { this.autoMode = this.pauseRemaining > 0 ? "cooldown" : "rotating"; return false; }
    this.yaw += (dt - held) * .065;
    this.autoMode = "rotating";
    return true;
  }
  begin(x, y) { this.anchor = { x, y, yaw: this.yaw, pitch: this.pitch }; this.dragging = false; this.suppressClick = false; this.pause(); }
  beginPinch() { this.end(); this.pinchHeld = true; this.suppressClick = true; this.pause(); }
  move(x, y, width = 1, height = 1) {
    if (!this.anchor) return false;
    const dx = x - this.anchor.x, dy = y - this.anchor.y;
    if (Math.hypot(dx, dy) > 6) this.dragging = true;
    if (!this.dragging) return false;
    this.yaw = this.anchor.yaw - dx / Math.max(1, width) * Math.PI * 1.8;
    this.pitch = Math.max(-.48, Math.min(.78, this.anchor.pitch + dy / Math.max(1, height) * 1.6));
    return true;
  }
  end() { this.suppressClick ||= this.dragging; if (this.anchor || this.pinchHeld) this.pause(); this.anchor = null; this.pinchHeld = false; this.dragging = false; return this.suppressClick; }
  cancel() { this.end(); this.suppressClick = true; }
  consumeClick() { const suppressed = this.suppressClick; this.suppressClick = false; return suppressed; }
}

export function orbitPosition(position, target, yaw = 0, pitch = 0, zoom = 1) {
  const x = position[0] - target[0], y = position[1] - target[1], z = position[2] - target[2];
  const radius = Math.hypot(x, y, z) / Math.max(.1, zoom);
  const azimuth = Math.atan2(x, z) + yaw;
  const elevation = Math.max(.16, Math.min(1.43, Math.atan2(y, Math.hypot(x, z)) + pitch));
  return [target[0] + Math.sin(azimuth) * Math.cos(elevation) * radius, target[1] + Math.sin(elevation) * radius, target[2] + Math.cos(azimuth) * Math.cos(elevation) * radius];
}

export function environmentSeconds(seconds, reduced = false) { return motionSeconds(seconds) * (reduced ? .45 : 1); }

/** Density changes with the weather; droplet contrast stays readable on pale skies. */
export function weatherVisualProfile(weather) {
  const base = { cloudClusters: 0, cloudScale: 1, rainRatio: 0, dropWidthPx: 1.15, dropLengthPx: 8.5, dropOpacity: .76, rainSpeed: 1 };
  switch (weather) {
    case "partly-cloudy": return { ...base, cloudClusters: 4, cloudScale: 1.15 };
    case "overcast": return { ...base, cloudClusters: 8, cloudScale: 1.5 };
    case "fog": return { ...base, cloudClusters: 5, cloudScale: 1.3 };
    case "drizzle": return { ...base, cloudClusters: 7, cloudScale: 1.35, rainRatio: .34, dropWidthPx: .95, dropLengthPx: 5.5, dropOpacity: .68, rainSpeed: .68 };
    case "rain": return { ...base, cloudClusters: 8, cloudScale: 1.5, rainRatio: 1 };
    case "freezing-rain": return { ...base, cloudClusters: 8, cloudScale: 1.5, rainRatio: .8, rainSpeed: .9 };
    case "storm": return { ...base, cloudClusters: 8, cloudScale: 1.65, rainRatio: 1, dropWidthPx: 1.35, dropLengthPx: 10.5, dropOpacity: .84 };
    case "hail": return { ...base, cloudClusters: 8, cloudScale: 1.5, rainRatio: .22, dropWidthPx: 1, dropLengthPx: 6, dropOpacity: .72 };
    case "snow": return { ...base, cloudClusters: 8, cloudScale: 1.4 };
    case "dusk": return { ...base, cloudClusters: 3, cloudScale: 1.05 };
    default: return base;
  }
}

/** Perspective-aware sizing avoids subpixel rain in the overview and on phones. */
export function rainDropScale(profile, distance, fov, viewportHeight) {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 720;
  const depth = Number.isFinite(distance) ? Math.max(1, distance) : 53;
  const angle = Number.isFinite(fov) ? Math.max(1, Math.min(89, fov)) : 38;
  const unitsPerPixel = 2 * Math.tan(angle * Math.PI / 360) * depth / height;
  const width = Math.max(.012, Math.min(.09, unitsPerPixel * profile.dropWidthPx / 2));
  return [width, Math.max(.14, Math.min(.8, unitsPerPixel * profile.dropLengthPx / 2)), width];
}

export const fishColors = ["#e8b653", "#e78068", "#f5e6bf", "#65b8ad"];
export function faunaCount(kind, quality) { return kind === "birds" ? quality === "high" ? 12 : 8 : quality === "high" ? 40 : 24; }
export function fishAppearance(index) { return { color: fishColors[index % fishColors.length], scale: .95 + index % 5 * .10 }; }
/** Independently phased swimmers reuse the validated corridors without marching in a line. */
export function createFishSchools(prepared, count) {
  if (!prepared.routes.length) return prepared;
  return { ...prepared, routes:Array.from({length:count},(_,index)=>{
    const route=prepared.routes[index%prepared.routes.length];
    return {...route,...fishAppearance(index),phase:(index*.61803398875+.137)%1,
      speed:.48+((index*.754877666)%1)*.56, direction:index%3===0?-1:1, wander:.085};
  }) };
}

function fishSegmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
function fishInsidePolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function fishSegmentsDistance(a, b, c, d) {
  const cross = (p,q,r) => (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.min(fishSegmentDistance(...a,c,d),fishSegmentDistance(...b,c,d),fishSegmentDistance(...c,a,b),fishSegmentDistance(...d,a,b));
}
/** Test a whole swept fish segment, including the tail, against authored water geometry. */
export function fishSegmentIsClear(a, b, environment, clearance = .56) {
  const shoreline = environment.water.shoreline;
  if (!fishInsidePolygon(a[0], a[1], shoreline) || !fishInsidePolygon(b[0], b[1], shoreline)) return false;
  const circles = [...environment.land, ...(environment.decorativeLand ?? []), ...(environment.waterObstacles ?? [])];
  for (const land of circles) if (fishSegmentDistance(...land.center, a, b) < land.radius + clearance) return false;
  // Distance to every shoreline segment also catches concave coastline crossings.
  for (let i = 0; i < shoreline.length; i++) {
    const c = shoreline[i], d = shoreline[(i + 1) % shoreline.length];
    if (Math.max(a[0],b[0])+clearance < Math.min(c[0],d[0]) || Math.min(a[0],b[0])-clearance > Math.max(c[0],d[0]) || Math.max(a[1],b[1])+clearance < Math.min(c[1],d[1]) || Math.min(a[1],b[1])-clearance > Math.max(c[1],d[1])) continue;
    const abC = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]), abD = (b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
    const cdA = (d[0]-c[0])*(a[1]-c[1])-(d[1]-c[1])*(a[0]-c[0]), cdB = (d[0]-c[0])*(b[1]-c[1])-(d[1]-c[1])*(b[0]-c[0]);
    if (abC*abD < 0 && cdA*cdB < 0) return false;
    if (Math.min(fishSegmentDistance(...a, c, d), fishSegmentDistance(...b, c, d), fishSegmentDistance(...c, a, b), fishSegmentDistance(...d, a, b)) < clearance) return false;
  }
  // A low deck has no usable clearance; normal raised decks permit swimming between supports.
  for (const bridge of environment.bridges) if (bridge.height - environment.water.height < .28 && fishSegmentsDistance(a,b,bridge.from,bridge.to) < bridge.width + clearance) return false;
  return true;
}

/** Build navigation and round its corners once. Rendering only samples the prepared loop. */
export function createFishRoutes(environment, count = 20, seed = 2020) {
  const step = 1, polygon = environment.water.shoreline;
  const minX = Math.floor(Math.min(...polygon.map(p => p[0]))), maxX = Math.ceil(Math.max(...polygon.map(p => p[0])));
  const minZ = Math.floor(Math.min(...polygon.map(p => p[1]))), maxZ = Math.ceil(Math.max(...polygon.map(p => p[1])));
  const grid = new Map(), nodes = [];
  for (let z = minZ; z <= maxZ; z += step) for (let x = minX; x <= maxX; x += step) {
    const point = [x, z];
    if (fishSegmentIsClear(point, point, environment, .67)) { grid.set(`${x},${z}`, nodes.length); nodes.push({ point, edges: [] }); }
  }
  if (!nodes.length) return { routes: [], waterHeight: environment.water.height, seed };
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const next = grid.get(`${node.point[0] + dx},${node.point[1] + dz}`);
      if (next !== undefined && fishSegmentIsClear(node.point, nodes[next].point, environment, .67)) node.edges.push(next);
    }
  }
  const nearest = point => nodes.reduce((best, node, index) => Math.hypot(node.point[0] - point[0], node.point[1] - point[1]) < Math.hypot(nodes[best].point[0] - point[0], nodes[best].point[1] - point[1]) ? index : best, 0);
  const pathCache = new Map();
  const connect = (start, end) => {
    const key = `${start}:${end}`;
    if (pathCache.has(key)) return pathCache.get(key);
    const queue = [start], previous = new Int32Array(nodes.length).fill(-1); previous[start] = start;
    for (let cursor = 0; cursor < queue.length && previous[end] === -1; cursor++) for (const next of nodes[queue[cursor]].edges) if (previous[next] === -1) { previous[next] = queue[cursor]; queue.push(next); }
    if (previous[end] === -1) return [];
    const result = [end];
    while (result.at(-1) !== start) result.push(previous[result.at(-1)]);
    result.reverse(); pathCache.set(key, result); return result;
  };
  const center = environment.water.center;
  const islet = environment.decorativeLand?.[0] ?? { center: [0, 9], radius: 3.1 };
  const ring = islet.radius + 1.15;
  const targets = [[center[0], center[1]],[-5,0],[-17,6],[-18,-6],[-5,-18],[5,-18],[18,-6],[17,6],
    [islet.center[0]+ring,islet.center[1]],[islet.center[0],islet.center[1]+ring],[islet.center[0]-ring,islet.center[1]],[islet.center[0],islet.center[1]-ring]].map(nearest);
  // A shallow/decorative barrier may split an older scene into disconnected pools.
  for(let i=targets.length-1;i>0;i--)if(!connect(targets[0],targets[i]).length)targets.splice(i,1);
  if(targets.length===1&&nodes[targets[0]].edges.length)targets.push(nodes[targets[0]].edges[0]);
  let randomSeed = seed >>> 0;
  const random = () => { randomSeed = (1664525 * randomSeed + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const routes = [], shapeCache = new Map();
  for (let index = 0; index < count; index++) {
    const offset = (index * 5 + Math.floor(random() * 3)) % targets.length;
    const shapeKey = `${offset}:${index % 2}`;
    if (shapeCache.has(shapeKey)) { const shape = shapeCache.get(shapeKey); routes.push({ ...shape, speed: .72 + random() * .28, phase: random(), ...fishAppearance(index) }); continue; }
    const order = Array.from({ length: targets.length }, (_, i) => targets[(offset + (index % 2 ? targets.length - i : i)) % targets.length]);
    const walk = [];
    for (let i = 0; i < order.length; i++) walk.push(...connect(order[i], order[(i + 1) % order.length]).slice(0, -1));
    // Remove collinear grid points before rounding each turn with a quadratic arc.
    const corners = walk.filter((node, i) => {
      const a = nodes[walk[(i + walk.length - 1) % walk.length]].point, b = nodes[node].point, c = nodes[walk[(i + 1) % walk.length]].point;
      return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > .01 || (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0;
    }).map(i => nodes[i].point);
    const points = [];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[(i + corners.length - 1) % corners.length], b = corners[i], c = corners[(i + 1) % corners.length];
      const before = Math.hypot(b[0] - a[0], b[1] - a[1]), after = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const trim = Math.min(.24, before * .3, after * .3);
      const enter = b.map((v, axis) => v + (a[axis] - v) * trim / before), leave = b.map((v, axis) => v + (c[axis] - v) * trim / after);
      const arc = Array.from({ length: 9 }, (_, j) => { const t = j / 8; return b.map((v, axis) => (1-t)*(1-t)*enter[axis] + 2*(1-t)*t*v + t*t*leave[axis]); });
      const safe = arc.every((p, j) => fishSegmentIsClear(p, arc[(j + 1) % arc.length], environment));
      points.push(...(safe ? arc : [enter, b, leave]));
    }
    // Validate every rendered line segment, including closures, rather than just control points.
    const valid = points.length > 1 && points.every((point, i) => fishSegmentIsClear(point, points[(i + 1) % points.length], environment));
    const routePoints = valid ? points : walk.length ? walk.map(i => nodes[i].point) : [nodes[targets[0]].point];
    const cumulative = [0];
    for (let i = 0; i < routePoints.length; i++) cumulative.push(cumulative.at(-1) + Math.hypot(routePoints[i][0] - routePoints[(i+1)%routePoints.length][0], routePoints[i][1] - routePoints[(i+1)%routePoints.length][1]));
    const headings = routePoints.map((p,i) => { const a = routePoints[(i+routePoints.length-1)%routePoints.length], b = routePoints[(i+1)%routePoints.length]; return Math.atan2(b[0]-a[0],b[1]-a[1]); });
    const shape = { points: routePoints, cumulative, headings, length: cumulative.at(-1) }; shapeCache.set(shapeKey, shape);
    routes.push({ ...shape, speed: .72 + random() * .28, phase: random(), ...fishAppearance(index) });
  }
  return { routes, waterHeight: environment.water.height, seed };
}

export function writeFishPose(pose, index, seconds, prepared) {
  const time=Math.max(0,Number.isFinite(seconds)?seconds:0);
  if (prepared?.routes.length) {
    const route = prepared.routes[index % prepared.routes.length];
    if(!route.length){pose.x=route.points[0][0];pose.z=route.points[0][1];pose.y=prepared.waterHeight-.15;pose.heading=0;pose.tail=0;return pose;}
    const direction=route.direction??1;
    const travel=time*route.speed + (route.wander ? Math.sin(time*.23+index)*.22 : 0);
    const distance = ((travel*direction + route.phase * route.length) % route.length + route.length) % route.length;
    let low = 0, high = route.points.length - 1;
    while (low < high) { const mid = (low + high) >> 1; if (route.cumulative[mid + 1] <= distance) low = mid + 1; else high = mid; }
    const a = route.points[low], b = route.points[(low + 1) % route.points.length], t = (distance - route.cumulative[low]) / Math.max(.00001, route.cumulative[low + 1] - route.cumulative[low]);
    pose.x = a[0] + (b[0] - a[0]) * t; pose.z = a[1] + (b[1] - a[1]) * t;
    pose.y = prepared.waterHeight - .14 - (route.wander ? index%3*.025 : 0) + Math.sin(time * .75 + index) * .018;
    const heading = route.headings[low], nextHeading = route.headings[(low+1)%route.points.length];
    pose.heading = heading + Math.atan2(Math.sin(nextHeading-heading),Math.cos(nextHeading-heading))*t + (direction<0?Math.PI:0);
    const wander=(route.wander??0)*Math.sin(time*.41+index*2.39996);
    pose.x+=Math.cos(pose.heading)*wander; pose.z-=Math.sin(pose.heading)*wander;
    pose.tail = Math.sin(time * (5 + index % 3 * .4) + index) * .3;
    return pose;
  }
  const t = time * (.16 + index % 3 * .02) + index * 1.7;
  const xRadius = 3.3 + index % 3 * .65, zRadius = 3.2 + index % 2 * .8;
  pose.x = Math.sin(t) * xRadius;
  pose.z = -1 + Math.sin(t * 1.32 + index) * zRadius;
  pose.y = -.235 + Math.sin(t * 2 + index) * .018;
  pose.heading = Math.atan2(Math.cos(t) * xRadius, Math.cos(t * 1.32 + index) * zRadius * 1.32);
  pose.tail = Math.sin(time * 5 + index) * .3;
  return pose;
}

export function createRainImpacts(count = 32) {
  return { positions: new Float32Array(count * 3), ages: new Float32Array(count).fill(10), next: 0, count: 0 };
}
/** Open droplets have no flat cap that can read as a square above the lake. */
export function createRainSprayGeometry() {
  const parts = [0, 1, 2].map(index => {
    const part = new THREE.ConeGeometry(.025, .105, 6, 1, true);
    const angle = index * Math.PI * 2 / 3;
    part.rotateZ(Math.sin(angle) * .35);
    part.translate(Math.cos(angle) * .055, .055, Math.sin(angle) * .055);
    return part;
  });
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  return geometry;
}
/** A completed splash has no geometry left, including the cone's bottom cap. */
export function writeRainImpactPose(pose, age, life = 1.35) {
  const alive = Number.isFinite(age) && age >= 0 && age < life;
  pose.ring = alive ? .085 + age * .32 : 0;
  pose.opacity = alive ? (1 - age / life) ** 1.5 : 0;
  const splash = alive && age > 0 && age < .3 ? Math.sin(age / .3 * Math.PI) : 0;
  pose.sprayY = splash;
  pose.sprayXZ = splash > .002 ? 1 + age * 2 : 0;
  pose.lift = splash * .15;
  return pose;
}

/** Screen-space sky anchors; depth and the minimum altitude are applied by the scene. */
export function writeCloudAnchor(pose, cluster, lobe, seconds, coverage, volume = 1) {
  pose.x = ((cluster * .73 + seconds * .014 + 1.4) % 2.8) - 1.4 + (lobe - 1.5) * .085;
  pose.y = .82 + (cluster % 3 - 1) * .08 + Math.sin(lobe * 1.9) * .015;
  const visible = Math.max(0, Math.min(1, coverage - cluster)) * volume;
  pose.width = (.14 + Math.sin(lobe * 2) * .015) * visible;
  pose.height = (.077 + lobe % 2 * .025) * visible;
  return pose;
}
export function advanceRainImpacts(field, impacts, seconds, wind = 1, options = {}) {
  const dt = motionSeconds(seconds);
  if (!dt) return;
  const count = Math.min(field.speeds.length, Math.max(0, options.count ?? field.speeds.length));
  const speed = options.speed ?? 1;
  const life = options.life ?? 1.35;
  const span = options.span ?? field.span ?? 22;
  const drift = .6 * wind;
  const centerX = field.center?.[0] ?? 0;
  const wrap = x => ((x - centerX + span) % (span * 2) + span * 2) % (span * 2) - span + centerX;
  for (let slot = 0; slot < impacts.ages.length; slot++) impacts.ages[slot] += dt;
  for (let index = 0; index < count; index++) {
    const offset = index * 6;
    const previousX = field.positions[offset], previousY = field.positions[offset + 1];
    const rate = field.speeds[index] * speed;
    const y = previousY - rate * dt;
    field.positions[offset] = wrap(previousX + drift * dt);
    const x = field.positions[offset], z = field.positions[offset + 2];
    const surface = surfaceAt(x, z, options.environment);
    const floor = surface.height;
    let age = 0;
    // Query the actual shoreline, islands and bridges, including the lake margins.
    // Keep the most recent collision after a slow frame without recycling a live ring.
    if (rate > 0 && y <= floor && impacts.ages.length) {
      const period = (14 - floor) / rate;
      age = Math.max(0, dt - Math.max(0, previousY - floor) / rate) % period;
      const impactX = wrap(x - drift * age);
      const impactSurface = surfaceAt(impactX, z, options.environment);
      if (impactSurface.kind === "water" && age < life) for (let search = 0; search < impacts.ages.length; search++) {
        const slot = (impacts.next + search) % impacts.ages.length;
        if (impacts.ages[slot] < life) continue;
        impacts.next = (slot + 1) % impacts.ages.length;
        impacts.positions[slot * 3] = impactX; impacts.positions[slot * 3 + 1] = impactSurface.height + .025; impacts.positions[slot * 3 + 2] = z; impacts.ages[slot] = age; impacts.count++;
        break;
      }
    }
    field.positions[offset + 1] = y <= floor ? floor + ((y - floor) % (14 - floor) + 14 - floor) % (14 - floor) : y;
    // A new fall gets a new origin. Wind cannot gradually empty the central lake,
    // and droplets never jump sideways before their actual surface collision.
    if (y <= floor && field.cycles) {
      field.cycles[index]++;
      writeRainOrigin(field.positions, offset, index, field.cycles[index], span, field.center);
      field.positions[offset] = wrap(field.positions[offset] + drift * age);
      // A recycled drop can move from the lake onto a roof. Rebase its fall
      // above that new surface, including after a long foreground frame.
      const nextFloor = surfaceAt(field.positions[offset], field.positions[offset + 2], options.environment).height;
      if (field.positions[offset + 1] <= nextFloor) {
        const height = 14 - nextFloor;
        field.positions[offset + 1] = nextFloor + ((field.positions[offset + 1] - nextFloor) % height + height) % height;
      }
    }
    field.positions[offset + 3] = field.positions[offset] - .06 * wind;
    field.positions[offset + 4] = field.positions[offset + 1] + .32;
    field.positions[offset + 5] = field.positions[offset + 2];
  }
}

export function createHailField(count) {
  const positions = new Float32Array(count * 3), velocities = new Float32Array(count), bounces = new Uint8Array(count), sinking = new Uint8Array(count);
  for (let index = 0; index < count; index++) { positions[index * 3] = Math.sin(index * 5.71) * 20; positions[index * 3 + 1] = (index * .83) % 14; positions[index * 3 + 2] = Math.cos(index * 7.13) * 20; velocities[index] = -6 - index % 5; }
  return { positions, velocities, bounces, sinking, totalBounces: 0, waterHits: 0, respawns: 0 };
}
export function advanceHail(field, seconds, environment) {
  const dt = motionSeconds(seconds);
  if (!dt) return;
  const steps = Math.ceil(dt / .03), step = dt / steps;
  for (let repeat = 0; repeat < steps; repeat++) for (let index = 0; index < field.velocities.length; index++) {
    const offset = index * 3;
    field.velocities[index] -= 12 * step;
    field.positions[offset + 1] += field.velocities[index] * step;
    const surface = surfaceAt(field.positions[offset], field.positions[offset + 2], environment);
    const floor = surface.height + (surface.kind === "land" ? .035 : 0);
    if (field.positions[offset + 1] > floor) continue;
    if (surface.kind === "land" && field.velocities[index] < 0 && field.bounces[index] < 2) {
      field.positions[offset + 1] = floor;
      field.velocities[index] = Math.abs(field.velocities[index]) * (field.bounces[index] ? .20 : .31);
      field.bounces[index]++; field.totalBounces++;
      continue;
    }
    if (surface.kind === "water") {
      if (!field.sinking[index]) { field.sinking[index] = 1; field.waterHits++; }
      if (field.positions[offset + 1] > surface.height - .32) continue;
    }
    field.positions[offset + 1] = 12 + index % 3;
    field.velocities[index] = -6 - index % 5;
    field.bounces[index] = 0; field.sinking[index] = 0; field.respawns++;
  }
}

export function writeBranchedLightning(positions, target, variant = 0) {
  writeLightningBolt(positions.subarray(0, 54), target, variant);
  let offset = 54;
  for (let branch = 0; branch < 3; branch++) {
    const start = 2 + branch * 2;
    const base = start * 6;
    let x = positions[base], y = positions[base + 1], z = positions[base + 2];
    for (let segment = 0; segment < 4; segment++) {
      const nextX = x + (branch % 2 ? -1 : 1) * (.48 + Math.sin(segment * 3 + variant) * .2);
      const nextY = y - .4 - segment * .12;
      const nextZ = z + Math.sin(branch * 4 + variant) * .2;
      positions.set([x, y, z, nextX, nextY, nextZ], offset); offset += 6; x = nextX; y = nextY; z = nextZ;
    }
  }
  return positions;
}

/** Update matrixWorld before labels project, including the final demand-rendered frame. */
export function easeCamera(camera, target, desiredPosition, desiredTarget, desiredFov, seconds, immediate = false, damping = 4.5) {
  const elapsed = Math.min(2, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  const alpha = immediate ? 1 : 1 - Math.exp(-Math.max(0, damping) * elapsed);
  camera.position.lerp(desiredPosition, alpha);
  target.lerp(desiredTarget, alpha);
  const previousFov = camera.fov;
  if (Number.isFinite(previousFov)) camera.fov += (desiredFov - camera.fov) * alpha;
  const unsettled = camera.position.distanceToSquared(desiredPosition) > .000025 || target.distanceToSquared(desiredTarget) > .000025 || Number.isFinite(camera.fov) && Math.abs(camera.fov - desiredFov) > .012;
  if (!unsettled) {
    camera.position.copy(desiredPosition);
    target.copy(desiredTarget);
    if (Number.isFinite(camera.fov)) camera.fov = desiredFov;
  }
  if (previousFov !== camera.fov) camera.updateProjectionMatrix();
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return unsettled;
}

/** In low-FPS tabs, ambience still consumes real time rather than slowing to a crawl. */
export function motionSeconds(seconds) {
  return Math.min(2, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
}

export function easeHeading(current, desired, seconds, immediate = false) {
  const difference = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
  return current + difference * (immediate ? 1 : 1 - Math.exp(-8 * motionSeconds(seconds)));
}

/** Small songbird silhouette with a shoulder pivot at the wing origin. */
export function createBirdGeometry() {
  const body = new THREE.SphereGeometry(1,10,7); body.scale(.077,.072,.16); body.translate(0,0,-.018);
  const head = new THREE.SphereGeometry(.065,8,6); head.translate(0,.055,.125);
  const tail = new THREE.ConeGeometry(.055,.17,4); tail.rotateX(-Math.PI/2); tail.scale(1,.45,1); tail.translate(0,-.016,-.22);
  const bodies = mergeGeometries([body,head,tail]); body.dispose(); head.dispose(); tail.dispose();
  const beak = new THREE.ConeGeometry(.021,.073,5); beak.rotateX(Math.PI/2); beak.translate(0,.052,.21);
  const eyes = [-1,1].map(side => { const eye = new THREE.SphereGeometry(.008,5,4); eye.translate(side*.054,.07,.15); return eye; });
  const detail = mergeGeometries([beak,...eyes]); beak.dispose(); eyes.forEach(eye => eye.dispose());
  const wing = new THREE.BufferGeometry();
  wing.setAttribute("position",new THREE.Float32BufferAttribute([0,0,0, .18,-.015,-.085, .32,-.03,-.18, 0,0,0, .32,-.03,-.18, .22,-.01,.028, 0,0,0, .22,-.01,.028,.11,0,.065],3)); wing.computeVertexNormals();
  return { bodies, beak: detail, wing };
}

/** Varied crossing/gliding routes, authored as smooth waypoints rather than orbits. */
export const birdFlightPaths = [
  [[-16, 5.2, 7], [-6, 5.9, -2], [6, 6.8, -8], [16, 6.1, -1], [7, 5.2, 8], [-5, 5.7, 10]],
  [[14, 7.6, 8], [7, 7.1, 0], [4, 6.3, -13], [-8, 7.1, -11], [-15, 7.8, 0], [-1, 7.5, 9]],
  [[-12, 4.9, -13], [1, 5.4, -6], [12, 5.7, 6], [7, 6.4, 12], [-6, 6.3, 7], [-15, 5.1, -2]],
  [[3, 8.7, -16], [12, 8.2, -7], [4, 7.9, 3], [-9, 8.3, 7], [-12, 9.1, -5], [-3, 8.9, -11]],
  [[-15, 6.6, 3], [-4, 6.2, 0], [10, 6.9, -3], [15, 7.3, -11], [1, 7.6, -14], [-10, 7.1, -8]],
  [[11, 5.9, -15], [6, 6.1, -3], [-8, 5.8, 8], [-16, 6.4, 4], [-4, 7.0, -9], [5, 6.3, -12]],
];
const birdShelters = [[-7.6, 2.35, -5.92], [7.6, 2.45, -5.92], [-7.6, 2.48, 3.48], [7.6, 2.56, 3.48]];
const birdRoutes = birdFlightPaths.map((points, route) => {
  const cumulative = [0];
  for (let index = 0; index < points.length; index++) {
    const a = points[index], b = points[(index + 1) % points.length];
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    cumulative.push(cumulative.at(-1) + distance / (2.5 + route * .11));
  }
  return { points, cumulative, duration: cumulative.at(-1) };
});
const spline = (a, b, c, d, t) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
const tangent = (a, b, c, d, t) => .5 * ((c - a) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (3 * b - a - 3 * c + d) * t * t);
export function birdsMayFly(weather, phase = "day") { return phase !== "night" && !["rain", "storm", "freezing-rain", "snow", "hail"].includes(weather); }

/** A few birds still cross in drizzle; darkness and hard rain bring the flock to cover. */
export function birdFlightShare(weather, hour, phase = "day") {
  const h = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : undefined;
  if (!birdsMayFly(weather, phase) || h !== undefined && (h < 6 || h >= 19.5)) return 0;
  const daylight = h !== undefined && (h < 8 || h > 17.5) || phase === "dusk" || phase === "dawn" ? .55 : 1;
  return daylight * (weather === "drizzle" ? .3 : weather === "fog" ? .4 : weather === "overcast" ? .75 : 1);
}

/** Reuse a pose; a weather refuge brings the flock into the garden foliage. */
export function writeBirdPose(pose, index, seconds, startled = 0, flying = true, refuge = 0, perches, shelters) {
  if (perches?.length > 1) return writePerchedBirdPose(pose, index, seconds, startled, flying, refuge, perches, shelters);
  const route = birdRoutes[index % birdRoutes.length];
  const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const rise = Number.isFinite(startled) ? Math.min(1, Math.max(0, startled)) : 0;
  const clock = (time * (1 + Math.floor(index / 6) * .055) + index * 2.71) % route.duration;
  let segment = 0;
  while (segment < route.points.length - 1 && clock >= route.cumulative[segment + 1]) segment++;
  const t = (clock - route.cumulative[segment]) / (route.cumulative[segment + 1] - route.cumulative[segment]);
  const length = route.points.length;
  const a = route.points[(segment + length - 1) % length], b = route.points[segment], c = route.points[(segment + 1) % length], d = route.points[(segment + 2) % length];
  pose.x = spline(a[0], b[0], c[0], d[0], t);
  pose.y = spline(a[1], b[1], c[1], d[1], t) + Math.floor(index / 6) * .28 + rise * 1.8;
  pose.z = spline(a[2], b[2], c[2], d[2], t);
  const vx = tangent(a[0], b[0], c[0], d[0], t), vz = tangent(a[2], b[2], c[2], d[2], t);
  pose.heading = Math.atan2(vx, vz);
  pose.bank = Math.sin(t * Math.PI * 2 + index) * .14;
  const shelter = shelters?.length ? shelters[index % shelters.length].position : birdShelters[index % birdShelters.length];
  const blend = Math.min(1, Math.max(0, Number.isFinite(refuge) ? refuge : 0));
  pose.x += (shelter[0] - pose.x) * blend;
  pose.y += (shelter[1] - pose.y) * blend;
  pose.z += (shelter[2] - pose.z) * blend;
  pose.flap = flying && blend < .95 ? Math.sin(time * (9.6 + index * .24) + index) * .62 : .16;
  return pose;
}

/** A bird rests, lifts, crosses a varied arc, glides, then slows onto a real perch. */
function writePerchedBirdPose(pose, index, seconds, startled, flying, refuge, perches, shelters) {
  const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const rest = 2.2 + index % 4 * .8, duration = 12 + index % 5;
  const cycleTime = rest + duration;
  const clock = time + index * 1.7;
  const cycle = Math.floor(clock / cycleTime);
  const local = clock % cycleTime;
  let stride = Math.min(perches.length - 1, Math.floor(perches.length / 2) + index % 3);
  if (perches[(index + stride) % perches.length].island === perches[index % perches.length].island) stride = stride % (perches.length - 1) + 1;
  const fromIndex = (index + cycle * stride) % perches.length;
  const toIndex = (fromIndex + stride) % perches.length;
  const from = perches[fromIndex].position, to = perches[toIndex].position;
  const t = Math.min(1, Math.max(0, (local - rest) / duration));
  const smooth = t * t * (3 - 2 * t);
  const arc = Math.sin(Math.PI * t);
  const lateral = Math.sin(Math.PI * t) * Math.sin(index * 2.3 + cycle) * 2.4;
  const dx = to[0] - from[0], dz = to[2] - from[2], distance = Math.max(.01, Math.hypot(dx, dz));
  pose.x = from[0] + dx * smooth - dz / distance * lateral;
  pose.y = from[1] + (to[1] - from[1]) * smooth + arc * (2.8 + index % 3 * .7);
  pose.z = from[2] + dz * smooth + dx / distance * lateral;
  pose.heading = Math.atan2(dx, dz);
  pose.bank = Math.sin(t * Math.PI * 2 + index) * .09 * arc;
  const rise = Math.min(1, Math.max(0, Number.isFinite(startled) ? startled : 0));
  pose.y += rise * 1.5;
  const blend = Math.min(1, Math.max(0, Number.isFinite(refuge) ? refuge : 0));
  const refugePoints = shelters?.length ? shelters : perches;
  const shelter = refugePoints[index % refugePoints.length].position;
  pose.x += (shelter[0] - pose.x) * blend; pose.y += (shelter[1] - pose.y) * blend; pose.z += (shelter[2] - pose.z) * blend;
  pose.bank *= 1-blend;
  if (blend === 1) { pose.x = shelter[0]; pose.y = shelter[1]; pose.z = shelter[2]; }
  // 0 perched, 1 takeoff, 2 flap, 3 glide, 4 landing. Numeric for reusable poses.
  pose.mode = blend > .95 || local < rest && rise < .01 ? 0 : t < .17 || rise > .01 ? 1 : t > .83 ? 4 : Math.sin(clock * .65 + index) > -.2 ? 3 : 2;
  pose.flap = !flying || pose.mode === 0 ? .16 : pose.mode === 3 ? .08 + Math.sin(time * 1.5 + index) * .04 : Math.sin(time * (10.8 + index * .19)) * .5;
  pose.fold = pose.mode === 0 ? .84 : blend * .84;
  return pose;
}

export function createSnowField(count) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let index = 0; index < count; index++) { positions[index * 3] = Math.sin(index * 8.37) * 22; positions[index * 3 + 1] = (index * .739) % 16; positions[index * 3 + 2] = Math.cos(index * 3.13) * 22; speeds[index] = .42 + index % 7 * .13; }
  return { positions, speeds };
}
export function advanceSnow(field, seconds, hail = false, wind = 1) {
  const dt = motionSeconds(seconds);
  if (!dt) return;
  for (let index = 0; index < field.speeds.length; index++) {
    const offset = index * 3;
    field.positions[offset] = ((field.positions[offset] + dt * (hail ? .25 : .15 + Math.sin(index) * .2) * wind + 22) % 44 + 44) % 44 - 22;
    field.positions[offset + 1] = ((field.positions[offset + 1] - dt * field.speeds[index] * (hail ? 7 : 1)) % 16 + 16) % 16;
    field.positions[offset + 2] = ((field.positions[offset + 2] + dt * Math.sin(index * 2.1 + field.positions[offset + 1] * .25) * .035 + 22) % 44 + 44) % 44 - 22;
  }
}

/** Alternate the open lake and exposed margins, away from the reading islands. */
export const lightningTargets = [[0, -.16, -1], [-19, .3144, -7], [-5.2, -.16, 2.8], [19, .3144, -7], [4.8, -.16, -4.6], [0, .3466, 17.5], [-3.5, -.16, 7.5], [5.2, -.16, 5.5]];
export function writeLightningBolt(positions, target, variant = 0) {
  const segments = 9;
  const top = target[1] + 18.4;
  for (let segment = 0; segment < segments; segment++) {
    for (let end = 0; end < 2; end++) {
      const step = segment + end;
      const fraction = step / segments;
      const offset = (segment * 2 + end) * 3;
      const jitter = step === segments ? 0 : Math.sin(step * 8.1 + variant * 1.73) * .46 * (1 - fraction * .25);
      positions[offset] = target[0] + jitter + (1 - fraction) * .6;
      positions[offset + 1] = top + (target[1] - top) * fraction;
      positions[offset + 2] = target[2] + (step === segments ? 0 : Math.cos(step * 4.9 + variant) * .18);
    }
  }
  return positions;
}

/** Individual storm events have bounded gaps and cannot flash in a paused/reduced scene. */
export class ThunderClock {
  constructor(random = Math.random) { this.reset(random, true); }
  reset(random = Math.random, first = false) {
    const value = random();
    const sample = Math.min(1, Math.max(0, Number.isFinite(value) ? value : .5));
    this.remaining = first ? 2 + sample * 2 : 3.5 + sample * 3.5;
    this.glow = 0;
    this.soundRemaining = -1;
    this.soundReady = false;
  }
  cancel() { this.glow = 0; this.soundRemaining = -1; this.soundReady = false; }
  takeThunder() {
    const ready = this.soundReady;
    this.soundReady = false;
    return ready;
  }
  advance(seconds, enabled, random = Math.random) {
    if (!enabled) { this.cancel(); return false; }
    const elapsed = motionSeconds(seconds);
    if (!elapsed) return false;
    if (this.soundRemaining >= 0) {
      this.soundRemaining -= elapsed;
      if (this.soundRemaining <= 0) { this.soundReady = true; this.soundRemaining = -1; }
    }
    this.glow = Math.max(0, this.glow - elapsed / .36);
    this.remaining -= elapsed;
    if (this.remaining > 0) return false;
    this.reset(random);
    this.glow = 1;
    const value = random();
    this.soundRemaining = .28 + Math.min(1, Math.max(0, Number.isFinite(value) ? value : .5)) * .5;
    return true;
  }
}

/** Every density prefix covers the open center as well as the wider circular field. */
function writeRainOrigin(positions, offset, index, cycle, span, center = [0, -2]) {
  const radial = (index * .4142135623730951 + cycle * .5698402909980532 + .23) % 1;
  const radius = span * Math.sqrt(index % 4 === 0 ? .0025 + radial * .0675 : .075 + radial * .925);
  const angle = (index * .618033988749895 + cycle * .7548776662466927) * Math.PI * 2;
  positions[offset] = center[0] + Math.cos(angle) * radius;
  positions[offset + 2] = center[1] + Math.sin(angle) * radius;
}
export function createRainField(count, span = 14, environment) {
  const positions = new Float32Array(count * 6);
  const speeds = new Float32Array(count);
  const cycles = new Uint32Array(count);
  const center = environment?.water.center ?? [0, -2];
  let seed = 24971;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let index = 0; index < count; index++) {
    const offset = index * 6;
    writeRainOrigin(positions, offset, index, 0, span, center);
    positions[offset + 1] = random() * 13;
    positions[offset + 3] = positions[offset] - .06;
    positions[offset + 4] = positions[offset + 1] + .46;
    positions[offset + 5] = positions[offset + 2];
    speeds[index] = 7 + random() * 5;
  }
  return { positions, speeds, cycles, center, span };
}

export function advanceRain(field, seconds) {
  const elapsed = motionSeconds(seconds);
  if (!elapsed) return;
  for (let index = 0; index < field.speeds.length; index++) {
    const offset = index * 6;
    field.positions[offset] = ((field.positions[offset] + .7 * elapsed + 14) % 28) - 14;
    field.positions[offset + 1] = ((field.positions[offset + 1] - field.speeds[index] * elapsed) % 13 + 13) % 13;
    field.positions[offset + 3] = field.positions[offset] - .06;
    field.positions[offset + 4] = field.positions[offset + 1] + .46;
  }
}


/** Continuous clock colors with smooth endpoint tangents at dawn and sunset. */
export function daylightPalette(timeOfDay, day, dawn, dusk, night) {
  const hour=((Number.isFinite(timeOfDay)?timeOfDay:12)%24+24)%24;
  const steps=[[0,night],[5.5,night],[7,dawn],[9,day],[15.5,day],[17.5,dusk],[20.5,night],[24,night]];
  const index=steps.findIndex((step,i)=>i<steps.length-1&&hour>=step[0]&&hour<steps[i+1][0]);
  const [start,a]=steps[Math.max(0,index)], [end,b]=steps[Math.max(0,index)+1];
  const t=(hour-start)/(end-start), blend=t*t*(3-2*t), result={...day};
  for(const key of ["sky","upper","lower","sun","fill","cloudColor"]) result[key]="#"+new THREE.Color(a[key]).lerp(new THREE.Color(b[key]),blend).getHexString();
  for(const key of ["ambient","intensity","fillIntensity","exposure"]) result[key]=THREE.MathUtils.lerp(a[key],b[key],blend);
  result.sunPosition=a.sunPosition.map((v,axis)=>THREE.MathUtils.lerp(v,b.sunPosition[axis],blend));
  return result;
}

const clearPalette = { sky: "#e2ebe6", upper: "#fff5df", lower: "#9ba587", sun: "#fff0d2", fill: "#e1edf0", ambient: 2.0, intensity: 3.45, fillIntensity: .65, exposure: 1.12, sunPosition: [-8,16,10], rain: 0, cloud: .12, cloudColor: "#f1f4ef" };
const cloudPalette = { ...clearPalette, sky: "#c7d1d0", upper: "#d7e3e4", ambient: 1.8, intensity: 1.55, exposure: 1.02, cloud: .85, cloudColor: "#bcc9ce" };
const rainPalette = { ...cloudPalette, sky: "#a5b9c1", sun: "#d6e4ea", fill: "#c0d5e4", rain: .4, cloud: .88 };
const weatherPalettes = {
  clear: clearPalette,
  "partly-cloudy": { ...clearPalette, sky: "#c6dbe6", intensity: 2.65, cloud: .72 },
  overcast: cloudPalette,
  fog: { ...cloudPalette, sky: "#d3dbd7", intensity: .8, cloud: .66 },
  drizzle: { ...rainPalette, rain: .16, intensity: 1.5 },
  rain: rainPalette,
  "freezing-rain": { ...rainPalette, sky: "#b8ced7", sun: "#d9eaff", rain: .32, exposure: 1.03 },
  snow: { ...cloudPalette, sky: "#dce6e7", upper: "#f0f5f5", intensity: 1.3, exposure: 1.08, cloudColor: "#d4e1e5" },
  storm: { ...rainPalette, sky: "#718590", upper: "#a8bcc8", lower: "#77837e", ambient: 1.65, intensity: .72, fillIntensity: .6, exposure: .98, rain: .6, cloud: .96, cloudColor: "#6e828d" },
  hail: { ...rainPalette, sky: "#8296a0", upper: "#b4c5cf", lower: "#7b8c88", ambient: 1.8, intensity: .9, rain: .16, cloud: .94, cloudColor: "#82949d" },
  dusk: { ...clearPalette, sky: "#ee9c6d", upper: "#ffbe7c", lower: "#846b6a", sun: "#ff883a", fill: "#c2b0d1", ambient: 1.45, intensity: 3.2, fillIntensity: .58, exposure: 1.1, sunPosition: [-18,5.5,5], cloud: .5, cloudColor: "#efbd96" },
};
const mixColor = (a, b, blend) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), blend).getHexString();

/** Solar color is filtered through cloud cover, so sunset never clears a storm. */
export function atmospherePalette(weather, phase, timeOfDay) {
  const base = weatherPalettes[weather] ?? clearPalette;
  const closed = weather === "storm" || weather === "hail";
  const warmth = closed ? .035 : ["rain", "freezing-rain", "snow", "fog", "overcast"].includes(weather) ? .20 : weather === "drizzle" ? .38 : 1;
  const night = { ...base, sky: closed ? "#253542" : "#243a53", upper: "#a9bfe1", lower: "#45556a", sun: "#b2cbed", fill: "#829ed2", ambient: closed ? .78 : 1.02, intensity: closed ? .24 : .72, fillIntensity: .48, exposure: .96, sunPosition: [12,15,-6], cloudColor: closed ? "#435462" : "#54657b" };
  const dawn = { ...base, sky: mixColor(base.sky,"#e7bc94",warmth), upper: mixColor(base.upper,"#ffd8a9",warmth), sun: mixColor(base.sun,"#ffb75c",warmth), ambient: base.ambient * .82, intensity: base.intensity * .68, sunPosition: [18,6,5], cloudColor: mixColor(base.cloudColor,"#e4c1a8",warmth) };
  const dusk = { ...base, sky: mixColor(base.sky,weatherPalettes.dusk.sky,warmth), upper: mixColor(base.upper,weatherPalettes.dusk.upper,warmth), lower: mixColor(base.lower,weatherPalettes.dusk.lower,warmth), sun: mixColor(base.sun,weatherPalettes.dusk.sun,warmth), fill: mixColor(base.fill,weatherPalettes.dusk.fill,warmth), ambient: closed ? base.ambient * .83 : Math.min(base.ambient,1.65), intensity: closed ? base.intensity * .68 : base.intensity * .96, sunPosition: [-18,5.5,5], cloudColor: mixColor(base.cloudColor,weatherPalettes.dusk.cloudColor,warmth) };
  if (!Number.isFinite(timeOfDay)) return phase === "night" ? night : phase === "dawn" ? dawn : phase === "dusk" ? dusk : base;
  return daylightPalette(timeOfDay,base,dawn,dusk,night);
}
