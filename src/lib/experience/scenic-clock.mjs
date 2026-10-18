/** A fictional day and fictional fronts; never a visitor's local forecast. */
export const DAY_SECONDS = 720;
export const wrapHour = value => ((Number.isFinite(value) ? value : 13) % 24 + 24) % 24;
export function advanceHour(hour, seconds) {
  return wrapHour(hour + Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 24 / DAY_SECONDS);
}
export function phaseAtHour(hour) {
  const h = wrapHour(hour);
  return h < 5.5 || h >= 20 ? "night" : h < 7.5 ? "dawn" : h < 16.5 ? "day" : "dusk";
}
export function clockLabel(hour) {
  const minute = Math.floor(wrapHour(hour) * 60);
  return `${String(Math.floor(minute / 60)).padStart(2,"0")}:${String(minute % 60).padStart(2,"0")}`;
}
const fronts = {
  clear: [["partly-cloudy", .78], ["fog", .22]],
  "partly-cloudy": [["clear", .35], ["overcast", .65]],
  overcast: [["drizzle", .55], ["rain", .25], ["snow", .1], ["partly-cloudy", .1]],
  fog: [["partly-cloudy", .65], ["drizzle", .35]],
  drizzle: [["rain", .65], ["overcast", .35]],
  rain: [["storm", .5], ["overcast", .35], ["freezing-rain", .15]],
  "freezing-rain": [["snow", .6], ["rain", .4]],
  snow: [["overcast", .8], ["freezing-rain", .2]],
  storm: [["rain", .65], ["hail", .35]],
  hail: [["storm", .25], ["rain", .75]],
  dusk: [["clear", 1]],
};
function pick(choices, random) {
  const value = random();
  let draw = Number.isFinite(value) ? Math.max(0, Math.min(.999999, value)) : .5;
  for (const [kind, weight] of choices) { draw -= weight; if (draw < 0) return kind; }
  return choices.at(-1)[0];
}
export function initialFront(random = Math.random, season = "spring") {
  return pick(season === "summer" ? [["clear",.4],["partly-cloudy",.4],["overcast",.2]] : [["clear",.55],["partly-cloudy",.35],["fog",.1]], random);
}
export function nextFront(current, random = Math.random) { return pick(fronts[current] ?? fronts.clear, random); }
export function frontDuration(random = Math.random) {
  const value = random();
  return 55_000 + 35_000 * (Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : .5);
}
