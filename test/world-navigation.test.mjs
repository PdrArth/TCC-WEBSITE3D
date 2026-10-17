import test from "node:test";
import assert from "node:assert/strict";
import { FrameCadence, WorldNavigator, advanceWorld, shortestPath } from "../lib/experience/navigation.mjs";

const graph = {
  nodes: { spawn: { position: [0, 0, 0] }, junction: { position: [0, 0, 2] }, stair: { position: [1, .25, 2] }, landing: { position: [2, .5, 2] }, other: { position: [-2, 0, 2] } },
  edges: [["spawn", "junction"], ["junction", "stair"], ["stair", "landing"], ["junction", "other"]],
  destinations: { especificar: "landing", gerar: "other", validar: "junction", evoluir: "spawn" },
};

test("authored path includes the stair nodes and reaches the exact landing height", () => {
  assert.deepEqual(shortestPath(graph, "spawn", "landing").nodes, ["spawn", "junction", "stair", "landing"]);
  const navigator = new WorldNavigator(graph, [0, 0, 0], 2);
  navigator.select("especificar");
  let arrival;
  for (let frame = 0; frame < 100; frame++) arrival = navigator.advance(.1) ?? arrival;
  assert.equal(arrival.id, "especificar");
  assert.deepEqual(navigator.position, [2, .5, 2]);
  assert.equal(navigator.advance(.1), null, "an arrival is emitted only once");
});

test("changing a destination mid-edge reverses on the walkway and cancels the previous arrival", () => {
  const navigator = new WorldNavigator(graph, [0, 0, 0], 2);
  navigator.select("especificar");
  for (let frame = 0; frame < 14; frame++) navigator.advance(.1);
  assert.ok(navigator.position[0] > 0 && navigator.position[0] < 1);
  const before = [...navigator.position];
  navigator.select("gerar");
  navigator.advance(.1);
  assert.ok(navigator.position[0] < before[0], "returns along the current stair edge");
  const arrivals = [];
  for (let frame = 0; frame < 100; frame++) { const arrival = navigator.advance(.1); if (arrival) arrivals.push(arrival); }
  assert.deepEqual(arrivals.map(item => item.id), ["gerar"]);
  assert.equal(arrivals[0].token, 2);
  assert.deepEqual(navigator.position, [-2, 0, 2]);
});

test("cancel and reduced motion never leave a delayed arrival", () => {
  const navigator = new WorldNavigator(graph, [0, 0, 0]);
  navigator.select("especificar");
  navigator.cancel();
  assert.equal(navigator.advance(.1), null);
  assert.deepEqual(navigator.select("validar", true), { id: "validar", token: 3 });
  assert.equal(navigator.walking, false);
  assert.deepEqual(navigator.position, [0, 0, 2]);
  assert.equal(navigator.advance(.1), null);
});

test("successive changes preserve both ends of the occupied walkway edge", () => {
  const navigator = new WorldNavigator(graph, [0, 0, 0], 2);
  navigator.select("especificar");
  for (let frame = 0; frame < 14; frame++) navigator.advance(.1);
  navigator.select("gerar");
  navigator.advance(.1);
  const position = [...navigator.position];
  navigator.select("especificar");
  navigator.advance(.1);
  assert.ok(navigator.position[0] > position[0], "can turn back toward the stair without a detour through its previous node");
  const arrivals = [];
  for (let frame = 0; frame < 100; frame++) { const arrival = navigator.advance(.1); if (arrival) arrivals.push(arrival); }
  assert.deepEqual(arrivals, [{ id: "especificar", token: 3 }]);
});

test("disconnected authored graphs fail clearly instead of crossing obstacles", () => {
  assert.throws(() => shortestPath({ ...graph, edges: [["spawn", "junction"]] }, "spawn", "landing"), /Unreachable/);
});

test("one-frame-per-second rendering covers the same walkway distance as fast rendering", () => {
  const fast = new WorldNavigator(graph, [0, 0, 0], 2);
  const slow = new WorldNavigator(graph, [0, 0, 0], 2);
  fast.select("especificar");
  slow.select("especificar");
  for (let frame = 0; frame < 20; frame++) advanceWorld(fast, .1);
  for (let frame = 0; frame < 2; frame++) advanceWorld(slow, 1);
  fast.position.forEach((value, axis) => assert.ok(Math.abs(value - slow.position[axis]) < .000001));
  assert.deepEqual(advanceWorld(slow, 1), { id: "especificar", token: 1 });
  assert.deepEqual(slow.position, [2, .5, 2]);
  assert.equal(advanceWorld(slow, 1), null);
});

test("resume excludes exactly its first frame; sustained long frames keep real time", () => {
  const cadence = new FrameCadence();
  assert.deepEqual(cadence.sample(20), { sampled: false, elapsed: 0 });
  assert.deepEqual(cadence.sample(1), { sampled: true, elapsed: 1 });
  assert.deepEqual(cadence.sample(1.1), { sampled: true, elapsed: 1.1 });
  cadence.reset();
  assert.deepEqual(cadence.sample(90), { sampled: false, elapsed: 0 });
  assert.deepEqual(cadence.sample(.016), { sampled: true, elapsed: .016 });
});
