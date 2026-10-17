import test from "node:test";
import assert from "node:assert/strict";
import { advanceHour, phaseAtHour, clockLabel, initialFront, nextFront, frontDuration } from "../lib/experience/scenic-clock.mjs";
test("the scenic day crosses sunset, night and midnight without resetting at a front change", () => {
  assert.equal(phaseAtHour(advanceHour(16, 30)), "dusk");
  assert.equal(phaseAtHour(advanceHour(19, 30)), "night");
  assert.equal(advanceHour(23, 60), 1);
  assert.equal(clockLabel(advanceHour(23, 60)), "01:00");
  assert.equal(advanceHour(13, -10), 13);
  assert.equal(advanceHour(13, NaN), 13);
});
test("random fronts make all ten sky types reachable, with rain before storms and storms before hail", () => {
  const reachable = new Set(["clear"]), queue = ["clear"];
  while(queue.length) {
    const current = queue.shift();
    for(let i=0;i<100;i++) {
      const next = nextFront(current, () => i/100);
      assert.notEqual(next,current);
      if(next === "storm") assert.ok(current === "rain" || current === "hail");
      if(next === "hail") assert.equal(current,"storm");
      if(!reachable.has(next)) { reachable.add(next); queue.push(next); }
    }
  }
  assert.equal(reachable.size, 10);
  for(const value of [0, .25, .8, 1, NaN]) {
    assert.ok(["clear","partly-cloudy","overcast","fog"].includes(initialFront(() => value)));
    assert.ok(frontDuration(() => value) >= 55_000 && frontDuration(() => value) <= 90_000);
  }
});
