/** Rare visitors to the existing sky; timers count visible simulation time only. */
const wetFronts = new Set(['drizzle', 'rain', 'storm', 'hail']);
const sunnyFronts = new Set(['clear', 'partly-cloudy', 'dusk']);
const hourOf = hour => ((Number.isFinite(hour) ? hour : 13) % 24 + 24) % 24;
const draw = random => {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .5;
};
export const RAINBOW_SECONDS = 45;
export const METEOR_SECONDS = 1.8;

export function createSkyEvents(random = Math.random) {
  return {
    rainSeconds: 0, wasWet: false, afterRain: 0, rainbowCooldown: 0,
    rainbowAge: -1, rainbowOpacity: 0, rainbows: 0,
    meteorWait: 28 + draw(random) * 42, meteorAge: -1, meteorOpacity: 0,
    meteorStart: [.2, .88], meteorEnd: [.48, .68], meteors: 0,
  };
}

export function advanceSkyEvents(state, seconds, { weather, hour, active = true, reducedMotion = false }, random = Math.random) {
  if (!active) return state;
  const dt = Math.min(.1, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  const h = hourOf(hour), wet = wetFronts.has(weather);
  const sunny = sunnyFronts.has(weather) && h >= 7.5 && h < 18.5;
  const starry = weather === 'clear' && (h >= 20.5 || h < 5);
  state.rainbowCooldown = Math.max(0, state.rainbowCooldown - dt);
  if (wet) {
    state.rainSeconds = Math.min(180, state.rainSeconds + dt);
    state.afterRain = 0;
  } else {
    if (state.wasWet) {
      if (state.rainSeconds >= 6 - 1e-8) state.afterRain = 100;
      state.rainSeconds = 0;
    }
    state.afterRain = Math.max(0, state.afterRain - dt);
    if (sunny && state.afterRain > 0 && state.rainbowCooldown === 0) {
      state.rainbowAge = 0;
      state.rainbowCooldown = 180;
      state.afterRain = 0;
      state.rainbows++;
    }
  }
  state.wasWet = wet;
  if (state.rainbowAge >= 0) {
    state.rainbowAge += dt;
    if (state.rainbowAge >= RAINBOW_SECONDS) state.rainbowAge = -1;
  }
  const rainbow = sunny && state.rainbowAge >= 0
    ? .48 * Math.max(0, Math.min(1, state.rainbowAge / 5, (RAINBOW_SECONDS - state.rainbowAge) / 7)) : 0;
  state.rainbowOpacity += (rainbow - state.rainbowOpacity) * (1 - Math.exp(-dt * 2));
  if (state.rainbowOpacity < .0001) state.rainbowOpacity = 0;

  if (state.meteorAge >= 0) {
    state.meteorAge += dt;
    if (state.meteorAge >= METEOR_SECONDS || !starry || reducedMotion) state.meteorAge = -1;
  }
  if (starry && !reducedMotion && state.meteorAge < 0) {
    state.meteorWait = Math.max(0, state.meteorWait - dt);
    if (state.meteorWait === 0) {
      const direction = draw(random) < .5 ? 1 : -1;
      state.meteorStart[0] = direction > 0 ? .12 + draw(random) * .25 : .63 + draw(random) * .25;
      state.meteorStart[1] = .85 + draw(random) * .08;
      state.meteorEnd[0] = state.meteorStart[0] + direction * (.22 + draw(random) * .08);
      state.meteorEnd[1] = state.meteorStart[1] - .16 - draw(random) * .07;
      state.meteorAge = 0;
      state.meteorWait = 90 + draw(random) * 80;
      state.meteors++;
    }
  }
  state.meteorOpacity = state.meteorAge >= 0 ? Math.sqrt(Math.max(0, Math.sin(Math.PI * state.meteorAge / METEOR_SECONDS))) : 0;
  return state;
}
