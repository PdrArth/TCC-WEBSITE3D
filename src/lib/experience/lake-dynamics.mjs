const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Scenic reservoir. Each overflow drains stored rainwater, then waits for a refill. */
export function advanceLake(state, seconds, weather, melt = 0) {
  const dt = Math.min(.1, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  if (!dt) return state;
  const inflow = ({ drizzle: .006, rain: .027, storm: .055, hail: .040, "freezing-rain": .012 })[weather] ?? 0;
  state.waterStorage = clamp((state.waterStorage ?? 0) + dt * (inflow - .010 - (state.outflow ?? 0) * .12) + Math.max(0, melt) * .45);
  if (state.waterStorage >= .88) state.overflowing = true;
  if (state.waterStorage <= .50 || (state.ice ?? 0) > .7) state.overflowing = false;
  const target = state.overflowing ? (.65 + .35 * smooth((state.waterStorage - .50) / .38)) * (1 - (state.ice ?? 0) * .96) : 0;
  const response = target > (state.outflow ?? 0) ? 2.2 : 1.5;
  state.outflow = Math.max(0, Math.min(1, (state.outflow ?? 0) + (target - (state.outflow ?? 0)) * (1 - Math.exp(-dt * response))));
  state.waterLevel = state.waterStorage * .09;
  return state;
}

export function lakeWaveParameters(wind = .2, ice = 0) {
  const force = clamp(wind), thawed = 1 - clamp(ice) * .96;
  return { amplitude: (.008 + force * force * .092) * thawed, speed: .55 + force * 1.05 };
}

export function lakeWaveHeight(x, z, seconds, wind = .2, ice = 0) {
  const { amplitude, speed } = lakeWaveParameters(wind, ice), t = seconds * speed;
  return amplitude * (.6 * Math.sin(x * .92 + z * .37 - t) + .3 * Math.sin(-x * .44 + z * 1.19 - t * 1.24) + .1 * Math.sin(x * 2.1 + z * 1.5 - t * 1.8));
}

/** One outlet on the original outer bank, clear of every island and visitor bridge. */
export function lakeSpillway(environment) {
  const center = environment.water.center;
  const point = environment.water.shoreline.reduce((best, p) => (p[0] - center[0]) * .28 + (p[1] - center[1]) * .96 > (best[0] - center[0]) * .28 + (best[1] - center[1]) * .96 ? p : best);
  const dx = point[0] - center[0], dz = point[1] - center[1], radius = Math.hypot(dx, dz);
  return { position: [point[0], environment.water.height + .055, point[1]], direction: [dx / radius, dz / radius], yaw: Math.atan2(dx, dz), width: 2.1, length: 1.65, drop: 1.12 };
}
