/** A small clutch grows only while a parent actually occupies the nest. */
export function createNestState() {
  return { eggs: 0, reveal: 0, visit: 0, cooldown: 0, laidThisVisit: false };
}

export function advanceNest(state, seconds, occupied) {
  const dt = Math.min(.1, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  if (!dt) return state;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.reveal = Math.min(1, state.reveal + dt / 1.2);
  if (!occupied) {
    state.visit = 0;
    state.laidThisVisit = false;
    return state;
  }
  state.visit += dt;
  if (state.visit >= 3 && state.cooldown === 0 && !state.laidThisVisit && state.eggs < 3) {
    state.eggs++;
    state.reveal = 0;
    state.cooldown = 45;
    state.laidThisVisit = true;
  }
  return state;
}
