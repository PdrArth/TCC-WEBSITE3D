import fs from "node:fs/promises";
import { createEnvironmentManifest } from "../../lib/experience/environment.mjs";
import { bridgePillars, createIslandLifeLayout, lifeSurfaceSegments, pathLength, sampleLifePath } from "../../lib/experience/island-life.mjs";
import { createFishRoutes } from "../../components/island-experience/scene-motion.mjs";
import { prepareLifeGeometry } from "../../lib/experience/life-geometry.mjs";

const root = new URL("../../", import.meta.url);
const manifest = JSON.parse(await fs.readFile(new URL("public/experience/world/manifest-v19.json", root), "utf8"));
const environment = createEnvironmentManifest();
const layout = createIslandLifeLayout(environment);
environment.decorativeLand = [layout.islet];
const roofBack = -layout.home.footprint[1] / 2 - .17, roofFront = layout.home.footprint[1] / 2 + layout.home.porchDepth + .14, roofMiddle = (roofFront + roofBack) / 2;
environment.roofs = [{ center: [layout.home.position[0] + Math.sin(layout.home.yaw) * roofMiddle, layout.home.position[2] + Math.cos(layout.home.yaw) * roofMiddle], halfExtents: [layout.home.footprint[0] / 2 + .19, (roofFront - roofBack) / 2], height: layout.home.position[1] + layout.home.floorHeight + layout.home.wallHeight + .06, ridgeRise: layout.home.roofRise, yaw: layout.home.yaw }];
environment.bridges.push(...lifeSurfaceSegments(layout).map(surface => ({ ...surface, lighting: false })));
const obstacles = [], perches = [];
const ids = environment.land.map(land => land.id);
for (let index = 0; index < ids.length - 1; index++) {
  const a = environment.land[index], b = environment.land[index + 1];
  const dx = b.center[0] - a.center[0], dz = b.center[1] - a.center[1], distance = Math.hypot(dx, dz);
  const ux = dx / distance, uz = dz / distance;
  const start = [a.center[0] + ux * (a.radius - .10), a.center[1] + uz * (a.radius - .10)];
  const end = [b.center[0] - ux * (b.radius - .10), b.center[1] - uz * (b.radius - .10)];
  for (const t of [.15, .84]) for (const sign of [-1, 1]) obstacles.push({ center: [start[0] + (end[0] - start[0]) * t - uz * .42 * sign, start[1] + (end[1] - start[1]) * t + ux * .42 * sign], radius: .065 });
  for (const [t, island, side] of [[.15, a.id, 1], [.85, b.id, -1]]) perches.push({ island, position: [start[0] + (end[0] - start[0]) * t - uz * .52 * side, .13 + .21 * Math.sin(t * Math.PI) + .73 + .032, start[1] + (end[1] - start[1]) * t + ux * .52 * side] });
}
function appendBridgePillars(bridge, junction) {
  const length = pathLength(bridge.points), middle = length / 2;
  // Match the two rail spans around the physical doorway to the connector.
  for (const side of [-1, 1]) {
    const spans = junction && side === -1 ? [[0, middle - .73], [middle + .73, length]] : [[0, junction ? length : length - bridge.width / 2]];
    for (const [start, end] of spans) {
      const posts = Math.max(1, Math.ceil((end - start) / 1.25));
      for (let index = 0; index <= posts; index++) {
        if (index % 3 !== 1) continue;
        const distance = start + (end - start) * index / posts, p = sampleLifePath(bridge.points, distance), a = sampleLifePath(bridge.points, Math.max(0, distance - .05)), b = sampleLifePath(bridge.points, Math.min(length, distance + .05));
        const dx = b[0] - a[0], dz = b[2] - a[2], norm = Math.hypot(dx, dz) || 1, offset = (bridge.width / 2 + .015) * side;
        obstacles.push({ center: [p[0] + dz / norm * offset, p[2] - dx / norm * offset], radius: .055 });
      }
    }
  }
}
appendBridgePillars(layout.bridge, true);
appendBridgePillars(layout.connector, false);
for (const pillar of bridgePillars(layout)) obstacles.push({ center: [pillar.position[0], pillar.position[2]], radius: pillar.radius });
for (const [index, island] of [[7, "perspectivas"], [41, "pesquisa"]]) {
  const p = layout.bridge.points[index], a = layout.bridge.points[index - 1], b = layout.bridge.points[index + 1], dx = b[0] - a[0], dz = b[2] - a[2], norm = Math.hypot(dx, dz);
  perches.push({ island, position: [p[0] + dz / norm * .53, p[1] + .74 + .027, p[2] - dx / norm * .53] });
}
environment.waterObstacles = obstacles;
// Sub-millimetre path precision keeps the prepared data compact without changing
// landfalls, camera coordinates or the seven academic islands.
environment.fishRoutes = JSON.parse(JSON.stringify(createFishRoutes(environment, 20, 2020), (_key, value) => typeof value === "number" ? Number(value.toFixed(6)) : value));
manifest.version = 20;
manifest.environment = environment;
manifest.islandLife = layout;
manifest.preparedLifeGeometry = prepareLifeGeometry(layout);
manifest.birdPerches = perches;
const porchFloor = layout.home.position[1] + layout.home.floorHeight + .01;
manifest.birdShelters = [[1.15,10.30],[1.55,10.30],[1.15,10.60],[1.55,10.60],[1.15,10.90],[1.55,10.90],[-1.75,10.25],[-1.75,10.60],[-1.75,10.90],[-1.25,10.96],[-.80,10.96],[-.35,10.96]].map(([x,z]) => ({ island: "moradia", position: [x,porchFloor,z] }));
await fs.writeFile(new URL("public/experience/world/manifest-v20.json", root), JSON.stringify(manifest) + "\n");
console.log(JSON.stringify({ version: 20, themes: environment.land.length, decorativeIslands: environment.decorativeLand.length, perches: perches.length, pillars: obstacles.length }));
