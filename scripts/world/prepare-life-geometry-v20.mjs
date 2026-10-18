import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createLifeGeometry, lifeGeometrySignature, prepareLifeGeometry, restoreLifeGeometry } from "../../src/lib/experience/life-geometry.mjs";

const manifestPath = resolve(process.argv[2] ?? "public/experience/world/manifest-v20.json");
const outputPath = resolve(process.argv[3] ?? "public/experience/world/life-geometry-v20.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const layout = manifest.islandLife;
assert.equal(layout?.version, 20, "Prepare the v20 layout before preparing its static geometry.");

const prepared = prepareLifeGeometry(layout);
const json = JSON.stringify(prepared);
const restored = restoreLifeGeometry(JSON.parse(json), layout);
const generated = createLifeGeometry(layout);
let vertices = 0, triangles = 0, rawBytes = 0;
try {
  assert.ok(restored, "Prepared geometry must restore with the current layout.");
  assert.equal(restored.length, 9);
  assert.equal(prepared.signature, lifeGeometrySignature(layout));
  for (const [index, expected] of generated.entries()) {
    const actual = restored[index];
    assert.equal(actual.kind, expected.kind);
    for (const [name, attribute] of Object.entries(expected.geometry.attributes)) {
      assert.equal(actual.geometry.attributes[name].itemSize, attribute.itemSize);
      assert.equal(actual.geometry.attributes[name].normalized, attribute.normalized);
      assert.deepEqual(actual.geometry.attributes[name].array, attribute.array, `${expected.kind}/${name} must remain byte-exact.`);
      rawBytes += attribute.array.byteLength;
    }
    assert.deepEqual(actual.geometry.index.array, expected.geometry.index.array, `${expected.kind}/index must remain byte-exact.`);
    assert.ok(actual.geometry.boundingSphere.equals(expected.geometry.boundingSphere));
    rawBytes += actual.geometry.index.array.byteLength;
    vertices += actual.geometry.attributes.position.count;
    triangles += actual.geometry.index.count / 3;
  }
  await writeFile(outputPath, json);
  console.log(JSON.stringify({ output: outputPath, signature: prepared.signature, batches: restored.length,
    vertices, triangles, rawBytes, jsonBytes: Buffer.byteLength(json), gzipBytes: gzipSync(json).byteLength, roundTrip: "byte-exact" }, null, 2));
} finally {
  for (const batch of generated) batch.geometry.dispose();
  for (const batch of restored ?? []) batch.geometry.dispose();
}
