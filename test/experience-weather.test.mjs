import test from "node:test";
import assert from "node:assert/strict";
import { initialWeather, nextWeather, weatherDuration } from "../src/lib/experience/weather.mjs";

const allWeather = ["clear", "rain", "storm", "dusk"];
const severe = new Set(["storm"]);

test("a session can start with different calm skies but never a severe event", () => {
  const starts = new Set();
  for (let draw = 0; draw < 1000; draw++) {
    const weather = initialWeather(() => draw / 1000);
    starts.add(weather);
    assert.equal(severe.has(weather), false);
  }
  assert.deepEqual(starts, new Set(["clear", "dusk", "rain"]));
});

test("storms need an established rain front and then return to rain or clear weather", () => {
  for (const current of allWeather) {
    for (let draw = 0; draw <= 1000; draw++) {
      const next = nextWeather(current, () => draw / 1000);
      assert.ok(allWeather.includes(next));
      assert.notEqual(next, current, "a transition should visibly change the weather");
      if (next === "storm") assert.equal(current, "rain");
      if (current === "storm") assert.ok(next === "rain" || next === "clear");
    }
  }
});

test("the summer has more scenic rain than the dry winter without starting a storm", () => {
  const rain = { summer: 0, winter: 0 };
  const arrivingFront = { summer: 0, winter: 0 };
  for (const season of ["summer", "winter"]) {
    for (let draw = 0; draw < 1000; draw++) {
      const weather = initialWeather(() => draw / 1000, season);
      if (weather === "rain") rain[season]++;
      assert.notEqual(weather, "storm");
      if (nextWeather("clear", () => draw / 1000, season) === "rain") arrivingFront[season]++;
    }
  }
  assert.ok(rain.summer > rain.winter * 5);
  assert.ok(arrivingFront.summer > arrivingFront.winter * 5);
});

test("every weather remains for 35 to 80 seconds and bounded random values stay finite", () => {
  for (const weather of allWeather) {
    for (const value of [-10, 0, .3, .999, 1, 10, NaN, Infinity]) {
      const duration = weatherDuration(weather, () => value);
      assert.ok(Number.isInteger(duration));
      assert.ok(duration >= 35_000 && duration <= 80_000);
    }
  }
  assert.notEqual(weatherDuration("clear", () => 0), weatherDuration("clear", () => 1));
});

test("a long random session keeps the front ordering coherent", () => {
  let seed = 19283;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let weather = initialWeather(random);
  const visited = new Set([weather]);
  for (let step = 0; step < 10_000; step++) {
    const next = nextWeather(weather, random);
    if (next === "storm") assert.equal(weather, "rain");
    visited.add(next);
    weather = next;
  }
  assert.deepEqual(visited, new Set(allWeather));
});
