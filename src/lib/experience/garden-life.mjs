const palettes = ["#ddbc70", "#e5d7ac", "#b7acc9", "#d0ae9c", "#c68b7e", "#b9c394", "#d7b5bf"];
/** Small beds occupy the outer garden, leaving the architecture and bridges clear. */
export function flowerBeds(environment, quality = "high") {
  const beds = [];
  environment.land.forEach((land, island) => {
    const count = quality === "high" ? 7 : 4;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count + island * .73;
      const radius = land.radius * (.77 + (i % 3) * .025);
      const x = land.center[0] + Math.cos(angle) * radius, z = land.center[1] + Math.sin(angle) * radius;
      const nearBridge = environment.bridges.some(bridge => {
        const dx = bridge.to[0] - bridge.from[0], dz = bridge.to[1] - bridge.from[1];
        const t = Math.max(0, Math.min(1, ((x - bridge.from[0]) * dx + (z - bridge.from[1]) * dz) / Math.max(.001, dx * dx + dz * dz)));
        return Math.hypot(x - bridge.from[0] - dx * t, z - bridge.from[1] - dz * t) < bridge.width + .28;
      });
      if (!nearBridge) beds.push({ x, y: land.height + .025, z, island: land.id, seed: island * 19 + i, color: palettes[island % palettes.length], height: .26 + (i % 3) * .095 });
    }
  });
  return beds;
}

/** Landing pauses are staggered: the garden never flaps in unison. */
export function butterflyPose(index, seconds, bed) {
  const t = seconds * (.22 + index % 3 * .025) + index * 3.7;
  const cycle = (t % 8 + 8) % 8;
  const flight = cycle < 2 ? 0 : Math.sin((cycle - 2) / 6 * Math.PI) ** 2;
  return { x: bed.x + Math.cos(t) * flight * .9, y: bed.y + bed.height + .14 + flight * (.5 + Math.sin(t * 1.7) * .14), z: bed.z + Math.sin(t * .8) * flight * .6, heading: -t, flap: .12 + flight * (.45 + Math.sin(seconds * 12 + index) * .35) };
}

export function fireflyPresence(season,weather,night=0,wind=0){
  if(season!=='summer'||['drizzle','rain','storm','hail','snow','freezing-rain'].includes(weather))return 0;
  const darkness=Math.max(0,Math.min(1,(night-.35)/.45));return darkness*(1-Math.max(0,Math.min(.8,wind-.35)));
}
export function fireflyPose(index,seconds,bed){
  const t=seconds*(.32+index%4*.035)+index*2.39996;
  return {x:bed.x+Math.sin(t)*.48,y:bed.y+1.55+Math.sin(t*.63+index)*.30,z:bed.z+Math.sin(t*.77+index)*.42,glow:.26+.74*((1+Math.sin(seconds*(1.05+index%5*.13)+index*1.7))/2)**3};
}
