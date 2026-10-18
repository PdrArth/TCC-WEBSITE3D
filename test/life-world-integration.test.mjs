import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { surfaceAt } from "../src/lib/experience/environment.mjs";
import { advanceRainImpacts, createRainField, createRainImpacts } from "../src/components/island-experience/scene-motion.mjs";
import { advanceResident, createResidentState } from "../src/lib/experience/island-life.mjs";
import { restoreLifeGeometry } from "../src/lib/experience/life-geometry.mjs";

const before = JSON.parse(await readFile(new URL("../public/experience/world/manifest-v19.json", import.meta.url), "utf8"));
const current = JSON.parse(await readFile(new URL("../public/experience/world/manifest-v20.json", import.meta.url), "utf8"));

test("the inhabited islet preserves the seven academic destinations and visitor routes", () => {
  for (const key of ["assets", "pavilions", "navigation", "initialCamera", "bridges"]) assert.deepEqual(current[key], before[key], key);
  assert.ok(current.cameraBounds.minZoom < before.cameraBounds.minZoom);
  assert.ok(current.cameraBounds.maxZoom > before.cameraBounds.maxZoom);
  assert.deepEqual(current.environment.land, before.environment.land);
  assert.deepEqual(current.environment.lights, before.environment.lights);
  assert.equal(current.environment.bridges.filter(bridge => bridge.lighting !== false).length, before.environment.bridges.filter(bridge => bridge.lighting !== false).length);
  assert.equal(current.environment.decorativeLand.length, 1);
  assert.equal(current.environment.decorativeLand[0].id, "moradia");
});

test("rain and hail find the new roof and all exposed portions of the connector", () => {
  const environment = current.environment, home = current.islandLife.home;
  const roof = surfaceAt(home.position[0], home.position[2], environment);
  assert.equal(roof.kind, "land");
  assert.ok(roof.height > home.position[1] + 2, "precipitation must hit the roof before reaching the floor");
  for (const [index, point] of current.islandLife.connector.points.entries()) {
    const surface = surfaceAt(point[0], point[2], environment);
    assert.equal(surface.kind, "land", `connector ${index} must not produce water impacts`);
    assert.ok(surface.height > environment.water.height);
  }
  const roofEdge = surfaceAt(home.position[0] + home.footprint[0] / 2, home.position[2], environment);
  assert.ok(roof.height > roofEdge.height, "gable collision must follow the roof slope");
});

test("recycled rain remains above the new house roof after a long frame", () => {
  const environment = current.environment;
  const field = createRainField(420, 22, environment), impacts = createRainImpacts(32);
  for (let frame = 0; frame < 20; frame++) {
    advanceRainImpacts(field, impacts, 2, 1, { environment, count: 420, speed: 1 });
    for (let index = 0; index < 420; index++) {
      const offset = index * 6;
      const surface = surfaceAt(field.positions[offset], field.positions[offset + 2], environment);
      assert.ok(field.positions[offset + 1] >= surface.height - .00001, `drop ${index} below its surface on frame ${frame}`);
    }
  }
});

test("nighttime rest remains inside until morning", () => {
  const layout = current.islandLife, resident = createResidentState(layout);
  const context = { moving: true, reducedMotion: false, visible: true, weather: "clear", hour: 22, night: 1 };
  let previous = resident.phase, insideVisits = 0, porchVisits = 0;
  for (let frame = 0; frame < 3000; frame++) {
    advanceResident(resident, 1 / 30, context, layout);
    if (resident.phase !== previous) {
      if (resident.phase === "interior") insideVisits++;
      if (resident.phase === "porch") porchVisits++;
      previous = resident.phase;
    }
  }
  assert.equal(insideVisits,1);assert.equal(porchVisits,0);assert.equal(resident.sleepBlend,1);
});

test("the published manifest restores house geometry without regenerating its parts", () => {
  const batches = restoreLifeGeometry(current.preparedLifeGeometry, current.islandLife);
  assert.ok(batches, "prepared geometry must match the published layout");
  try {
    assert.equal(batches.length, 9);
    assert.ok(batches.every(batch => batch.geometry.userData.preparedLife));
  } finally {
    for (const batch of batches) batch.geometry.dispose();
  }
});
