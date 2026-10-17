import test from "node:test";
import assert from "node:assert/strict";
import { weatherFromCode, roundCoordinates, weatherPhase, seasonAtLocation, normalizeForecast } from "../lib/experience/weather.mjs";
test("WMO conditions include fog, freezing rain, snow and hail without inventing severe events", () => {
  const groups = [["clear",[0]],["partly-cloudy",[1,2]],["overcast",[3]],["fog",[45,48]],["drizzle",[51,53,55]],["freezing-rain",[56,57,66,67]],["rain",[61,63,65,80,81,82]],["snow",[71,73,75,77,85,86]],["storm",[95]],["hail",[96,99]]];
  for (const [condition,codes] of groups) for (const code of codes) assert.equal(weatherFromCode(code), condition);
  assert.equal(weatherFromCode(999),null);
});
test("coordinates are coarse and reject invalid input", () => {
  assert.deepEqual(roundCoordinates(-20.754133,-42.879291), {latitude:-20.8,longitude:-42.9});
  assert.throws(()=>roundCoordinates(NaN,0)); assert.throws(()=>roundCoordinates(91,0));
});
test("phase compares timestamps in provider-local time, including polar fallback",()=>{
  assert.equal(weatherPhase("2026-10-12T05:40","2026-10-12T06:00","2026-10-12T18:00",false),"dawn");
  assert.equal(weatherPhase("2026-10-12T18:15","2026-10-12T06:00","2026-10-12T18:00",false),"dusk");
  assert.equal(weatherPhase("2026-10-12T23:00",null,null,false),"night");
});
test("regional season respects hemispheres and result records modeled observation separately",()=>{
  assert.equal(seasonAtLocation("2026-01-01T01:00",-20),"summer"); assert.equal(seasonAtLocation("2026-01-01T01:00",40),"winter");
  const result=normalizeForecast({timezone:"America/Sao_Paulo",current:{weather_code:95,time:"2026-10-12T12:00",temperature_2m:23,is_day:1,wind_speed_10m:15,precipitation:2},daily:{sunrise:["2026-10-12T05:30"],sunset:["2026-10-12T18:00"]}}, {latitude:-20.8,longitude:-42.9},"2026-10-12T15:01:00Z");
  assert.equal(result.weather,"storm");assert.equal(result.phase,"day");assert.equal(result.approximate,true);assert.equal(result.observedAt,"2026-10-12T12:00");assert.equal(result.fetchedAt,"2026-10-12T15:01:00Z");
  assert.throws(()=>normalizeForecast({current:{weather_code:888}}, {latitude:0,longitude:0}));
});
