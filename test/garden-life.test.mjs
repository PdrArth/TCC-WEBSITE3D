import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { flowerBeds, butterflyPose } from "../src/lib/experience/garden-life.mjs";

const { environment } = JSON.parse(await readFile(new URL("../public/experience/world/manifest-v20.json", import.meta.url), "utf8"));

test("garden accents stay on authored islands and away from the walking bridges", () => {
  for (const quality of ["high", "low"]) {
    const beds = flowerBeds(environment, quality);
    assert.equal(new Set(beds.map(bed => bed.island)).size, 7);
    for (const bed of beds) {
      const land = environment.land.find(land => land.id === bed.island);
      assert.ok(Math.hypot(bed.x - land.center[0], bed.z - land.center[1]) + .35 < land.radius);
      for (const bridge of environment.bridges) {
        const dx = bridge.to[0] - bridge.from[0], dz = bridge.to[1] - bridge.from[1];
        const t = Math.max(0, Math.min(1, ((bed.x - bridge.from[0]) * dx + (bed.z - bridge.from[1]) * dz) / (dx * dx + dz * dz)));
        assert.ok(Math.hypot(bed.x - bridge.from[0] - dx * t, bed.z - bridge.from[1] - dz * t) >= bridge.width + .28);
      }
    }
  }
});

test("butterflies rest at flowers, fly locally, and remain stable when the clock is frozen", () => {
  const bed = flowerBeds(environment)[0];
  assert.deepEqual(butterflyPose(2, 20, bed), butterflyPose(2, 20, bed));
  const rest = butterflyPose(0, 0, bed), flying = butterflyPose(0, 22, bed);
  assert.equal(rest.x, bed.x); assert.equal(rest.z, bed.z);
  assert.ok(flying.y > rest.y + .25);
  for (let i = 0; i < 14; i++) for (let seconds = 0; seconds < 180; seconds += .5) {
    const pose = butterflyPose(i, seconds, bed);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(Math.hypot(pose.x - bed.x, pose.z - bed.z) < 1.1);
    assert.ok(pose.y >= bed.y + bed.height);
  }
});
