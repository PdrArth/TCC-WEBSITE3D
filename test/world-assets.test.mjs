import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ids = ['pesquisa', 'gerar', 'comparar', 'validar', 'especificar', 'evoluir', 'perspectivas'];
const publicFile = (url) => path.join(root, 'public', url.replace(/^\//, ''));
function glbDocument(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'A model must be a real GLB');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
}
test('The active garden fits budgets and contains seven bridged islands, with the legacy rig preserved', async () => {
  const manifest = JSON.parse(await readFile(publicFile('/experience/world/manifest-v9.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.units, 'meters');
  assert.equal(manifest.upAxis, 'Y');
  assert.deepEqual(Object.keys(manifest.pavilions).sort(), ids.toSorted());
  const world = await readFile(publicFile(manifest.assets.world));
  const low = await readFile(publicFile(manifest.assets.worldLow));
  const avatar = await readFile(publicFile(manifest.assets.avatar));
  assert.ok(world.length <= 8_000_000, `World: ${world.length} bytes`);
  assert.ok(low.length <= 4_000_000, `Low world: ${low.length} bytes`);
  assert.ok(avatar.length <= 600 * 1024, `Avatar: ${avatar.length} bytes`);
  const scene = glbDocument(world);
  const lightScene = glbDocument(low);
  assert.ok(scene.meshes?.length > 7, 'The seven islands must be real modeled geometry');
  const names = new Set(scene.nodes.map(node => node.name));
  const lowNames = new Set(lightScene.nodes.map(node => node.name));
  for (const id of ids) assert.ok(names.has(manifest.pavilions[id].hitNode), `Missing clickable model ${id}`);
  for (const id of ids) assert.ok(lowNames.has(manifest.pavilions[id].hitNode), `Missing lightweight model ${id}`);
  for (const lod of [scene, lightScene]) for (const mesh of lod.meshes) for (const primitive of mesh.primitives) assert.ok(primitive.attributes.COLOR_0 !== undefined, 'Both quality levels retain authored vertex shading');
  assert.equal(manifest.navigation.mode, 'direct');
  assert.ok(names.has('lake_water') && lowNames.has('lake_water'), 'Both qualities retain the animated water');
  assert.equal(manifest.bridges.length, 6);
  for (let index = 0; index < manifest.bridges.length; index++) {
    const bridge = manifest.bridges[index];
    assert.equal(bridge.from, ids[index]);
    assert.equal(bridge.to, ids[index + 1]);
    for (const node of bridge.nodes) assert.ok(names.has(node) && lowNames.has(node), `Missing modeled bridge ${node}`);
  }
  assert.ok(manifest.birdPerches.length >= 7, 'The flock needs real authored refuges');
  assert.deepEqual(Object.keys(manifest.islands).sort(), ids.toSorted());
  assert.equal(names.has('island_foundation'), false, 'The shared central disk is gone');
  for (const id of ids) {
    assert.ok(names.has(manifest.islands[id].foundationNode), `Missing modeled island ${id}`);
    for (const other of ids.filter(other => other !== id)) {
      const a = manifest.islands[id], b = manifest.islands[other];
      assert.ok(Math.hypot(a.center[0] - b.center[0], a.center[2] - b.center[2]) > a.radius + b.radius + 1);
    }
  }
  const character = glbDocument(avatar);
  assert.ok(character.skins?.length > 0, 'Avatar must be skinned, not an image');
  const clips = new Set(character.animations?.map(clip => clip.name));
  assert.ok(clips.has('Idle'));
  assert.ok(clips.has('Walk'));
  const poster = await readFile(publicFile(manifest.assets.poster));
  assert.ok(poster.length > 1000, 'The scene needs a usable fallback image');
});
test('Every pavilion is reachable through existing navigation nodes', async () => {
  const manifest = JSON.parse(await readFile(publicFile('/experience/world/manifest-v9.json'), 'utf8'));
  const { nodes, edges, destinations } = manifest.navigation;
  const adjacency = new Map(Object.keys(nodes).map(id => [id, []]));
  for (const [a, b] of edges) {
    assert.ok(adjacency.has(a) && adjacency.has(b), 'Edge endpoints must exist');
    adjacency.get(a).push(b); adjacency.get(b).push(a);
  }
  for (const node of Object.values(nodes)) {
    assert.equal(node.position.length, 3);
    assert.ok(node.position.every(Number.isFinite));
  }
  const first = Object.keys(nodes)[0];
  const reached = new Set([first]);
  const queue = [first];
  for (const node of queue) for (const next of adjacency.get(node)) if (!reached.has(next)) { reached.add(next); queue.push(next); }
  for (const id of ids) assert.ok(reached.has(destinations[id]), `Unreachable pavilion ${id}`);
});
test('The original PDF and source registry remain intact', async () => {
  const pdf = await readFile(publicFile('/tcc-pedro-arthur.pdf'));
  assert.equal(createHash('sha256').update(pdf).digest('hex'), '59d208f910c5cec1bb951025a9d643e11e33f82e8dea86ec7c6e2105b96fe257');
  const sources = JSON.parse(await readFile(path.join(root, 'src/lib/sources.json'), 'utf8'));
  assert.equal(sources.filter(item => item.group === 'academic').length, 5);
  assert.equal(sources.filter(item => item.group === 'technical').length, 6);
  assert.equal(sources.filter(item => item.group === 'complementary').length, 13);
  assert.equal(new Set(sources.map(item => item.id)).size, 24);
});
test('Every active music track and bird excerpt has a resource and license provenance', async () => {
  const manifest = JSON.parse(await readFile(publicFile('/experience/audio/audio-manifest.json'), 'utf8'));
  assert.equal(manifest.playlist.length, 5);
  assert.deepEqual(manifest.playlist[0], manifest.music, 'Preserve the original track');
  const approved = new Set(['https://genshin.hoyoverse.com/en/home', 'https://www.youtube.com/watch?v=CDHTiOJu0xU', 'https://www.youtube.com/watch?v=UejrqpW7CnM', 'https://www.youtube.com/watch?v=lm3t3myPspk', 'https://www.youtube.com/watch?v=imSiOWE1bEo']);
  assert.deepEqual(new Set(manifest.playlist.map(track => track.source)), approved);
  for (const track of manifest.playlist) {
    assert.ok(track.author.includes('HOYO-MiX'));
    assert.equal(track.licenseSource, track.url.includes('nilou-tnbee') ? track.source : 'https://www.hoyolab.com/article/143107');
    assert.ok(track.attribution.includes('COGNOSPHERE'));
    assert.ok(['https://genshin.hoyoverse.com', 'https://www.youtube.com'].includes(new URL(track.assetSource).origin));
    assert.ok(track.url.startsWith('/experience/audio/'));
    try {
      const bytes = await readFile(publicFile(track.url));
      assert.ok(bytes.length > 1000);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), track.sha256);
    } catch (error) {
      if(error.code !== 'ENOENT')throw error;
      assert.equal(track.url,manifest.music.url,'only the original theme may be served by the existing backend');
      const {default:config}=await import('../next.config.ts');
      const {backendUrl}=await import('../src/lib/deployment-backend.mjs');
      const fallback=(await config.rewrites()).find(rule=>rule.source===track.url);
      assert.equal(fallback?.destination,backendUrl(track.url).href);
    }
  }
  assert.equal(manifest.birds.length, 4);
  for (const bird of manifest.birds) {
    assert.equal(bird.license, 'CC0 1.0');
    assert.ok(bird.source.startsWith('https://freesound.org/'));
    assert.ok((await readFile(publicFile(bird.url))).length > 100);
  }
  assert.ok(!JSON.stringify(manifest).includes('Kounine'));
  assert.ok(manifest.playlist.every(track => track.url.startsWith('/experience/audio/')), 'Playback uses local audio files, not embedded videos');
  for (const item of [manifest.selection, manifest.arrival]) {
    assert.ok(item.url.startsWith('/experience/audio/'));
    assert.ok((await readFile(publicFile(item.url))).length > 100);
    assert.ok(item.volume > 0 && item.volume <= 0.2);
  }
});
