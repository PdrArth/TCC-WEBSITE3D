import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createLifeGeometry, lifeGeometrySignature, prepareLifeGeometry, restoreLifeGeometry } from "../src/lib/experience/life-geometry.mjs";

const layout = JSON.parse(readFileSync(new URL("../public/experience/world/manifest-v20.json", import.meta.url), "utf8")).islandLife;
const generated = createLifeGeometry(layout);
const prepared = JSON.parse(JSON.stringify(prepareLifeGeometry(layout)));
after(() => { for (const batch of generated) batch.geometry.dispose(); });

test("publication geometry round-trips all nine static batches without changing any vertex, index or bound", () => {
  const restored = restoreLifeGeometry(prepared, layout);
  assert.ok(restored); assert.equal(restored.length, 9);
  try {
    let triangles = 0;
    for (const [index, expected] of generated.entries()) {
      const actual = restored[index]; assert.equal(actual.kind, expected.kind);
      for (const [name, attribute] of Object.entries(expected.geometry.attributes)) {
        const restoredAttribute = actual.geometry.attributes[name];
        assert.equal(restoredAttribute.itemSize, attribute.itemSize); assert.equal(restoredAttribute.normalized, attribute.normalized);
        assert.deepEqual(restoredAttribute.array, attribute.array, `${actual.kind}/${name}`);
      }
      assert.deepEqual(actual.geometry.index.array, expected.geometry.index.array);
      assert.ok(actual.geometry.boundingSphere.equals(expected.geometry.boundingSphere)); triangles += actual.geometry.index.count / 3;
    }
    assert.equal(triangles, 10892);
  } finally { for (const batch of restored) batch.geometry.dispose(); }
});

test("the checked-in asset matches the current pure generator and geometry recipe", () => {
  const published = JSON.parse(readFileSync(new URL("../public/experience/world/life-geometry-v20.json", import.meta.url), "utf8"));
  assert.deepEqual(published, prepared);
  assert.equal(published.signature, lifeGeometrySignature(layout));
});

test("restoring reuses saved bounds instead of scanning or merging vertices", () => {
  const original = THREE.BufferGeometry.prototype.computeBoundingSphere;
  THREE.BufferGeometry.prototype.computeBoundingSphere = () => { throw new Error("Bounds must already be prepared."); };
  let restored;
  try { restored = restoreLifeGeometry(prepared, layout); assert.equal(restored?.length, 9); }
  finally { THREE.BufferGeometry.prototype.computeBoundingSphere = original; for (const batch of restored ?? []) batch.geometry.dispose(); }
});

test("absent, outdated, malformed and layout-incompatible payloads return null for the generator fallback", () => {
  assert.equal(restoreLifeGeometry(undefined, layout), null);
  assert.equal(restoreLifeGeometry({ ...prepared, schemaVersion: 2 }, layout), null);
  assert.equal(restoreLifeGeometry({ ...prepared, version: 19 }, layout), null);
  assert.equal(restoreLifeGeometry({ ...prepared, signature: "outdated" }, layout), null);
  assert.equal(restoreLifeGeometry(prepared, { ...layout, islet: { ...layout.islet, radius: layout.islet.radius + .1 } }), null);
  const malformed = structuredClone(prepared); malformed.batches[0].attributes.position.data = "bad";
  assert.equal(restoreLifeGeometry(malformed, layout), null);
});

test("restored geometries own their data independently across mounts", () => {
  const first = restoreLifeGeometry(prepared, layout), second = restoreLifeGeometry(prepared, layout);
  try {
    const expected = second[0].geometry.attributes.position.array[0];
    first[0].geometry.attributes.position.array[0] += 1;
    assert.equal(second[0].geometry.attributes.position.array[0], expected);
    assert.notEqual(first[0].geometry.attributes.position.array.buffer, second[0].geometry.attributes.position.array.buffer);
  } finally { for (const batch of [...first, ...second]) batch.geometry.dispose(); }
});
