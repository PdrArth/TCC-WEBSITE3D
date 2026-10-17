/** Navigation follows the authored walkway graph, including its stair heights. */
export function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function shortestPath(graph, start, end) {
  if (!graph.nodes[start] || !graph.nodes[end]) throw new Error("Unknown navigation node");
  const costs = new Map([[start, 0]]);
  const previous = new Map();
  const pending = new Set(Object.keys(graph.nodes));
  while (pending.size) {
    let current;
    let best = Infinity;
    for (const id of pending) {
      const cost = costs.get(id) ?? Infinity;
      if (cost < best) { best = cost; current = id; }
    }
    if (!current) break;
    pending.delete(current);
    if (current === end) {
      const path = [end];
      while (path[0] !== start) path.unshift(previous.get(path[0]));
      return { nodes: path, distance: best };
    }
    for (const [a, b] of graph.edges) {
      const next = a === current ? b : b === current ? a : null;
      if (!next || !pending.has(next)) continue;
      const cost = best + distance(graph.nodes[current].position, graph.nodes[next].position);
      if (cost < (costs.get(next) ?? Infinity)) { costs.set(next, cost); previous.set(next, current); }
    }
  }
  throw new Error(`Unreachable navigation destination: ${end}`);
}

export function nearestNode(graph, position) {
  return Object.keys(graph.nodes).reduce((best, id) => !best || distance(graph.nodes[id].position, position) < distance(graph.nodes[best].position, position) ? id : best, "");
}

export class WorldNavigator {
  constructor(graph, spawn, speed = 2.2) {
    this.graph = graph;
    this.position = [...spawn];
    this.speed = speed;
    this.node = nearestNode(graph, spawn);
    this.segment = null;
    this.route = [];
    this.destination = null;
    this.token = 0;
    this.walking = false;
    this.heading = 0;
  }

  select(id, immediate = false) {
    const end = this.graph.destinations[id];
    if (!end) throw new Error(`Unknown pavilion: ${id}`);
    this.token += 1;
    this.destination = id;
    if (immediate) {
      this.position = [...this.graph.nodes[end].position];
      this.node = end;
      this.segment = null;
      this.route = [];
      this.walking = false;
      this.destination = null;
      return { id, token: this.token };
    }
    // A changed destination must begin along the current edge, not cut across scenery.
    const previousSegment = this.segment;
    const candidates = previousSegment ? [previousSegment.from, previousSegment.to] : [this.node];
    const options = candidates.map(start => {
      const path = shortestPath(this.graph, start, end);
      return { ...path, cost: distance(this.position, this.graph.nodes[start].position) + path.distance };
    });
    options.sort((a, b) => a.cost - b.cost);
    this.route = [...options[0].nodes];
    if (distance(this.position, this.graph.nodes[this.route[0]].position) < 0.0001) this.route.shift();
    this.segment = this.route.length ? previousSegment && this.route[0] === options[0].nodes[0] ? previousSegment : { from: options[0].nodes[0], to: this.route[0] } : null;
    this.walking = true;
    return null;
  }

  cancel() {
    this.token += 1;
    this.destination = null;
    this.route = [];
    this.walking = false;
  }

  advance(seconds) {
    if (!this.walking || !this.destination) return null;
    let remaining = Math.min(Math.max(seconds, 0), 0.1) * this.speed;
    while (this.route.length) {
      const next = this.route[0];
      const point = this.graph.nodes[next].position;
      const length = distance(this.position, point);
      if (length > 0.00001) this.heading = Math.atan2(point[0] - this.position[0], point[2] - this.position[2]);
      if (length > remaining) {
        const fraction = remaining / length;
        this.position = this.position.map((value, axis) => value + (point[axis] - value) * fraction);
        return null;
      }
      this.position = [...point];
      this.node = next;
      this.route.shift();
      remaining -= length;
      this.segment = this.route.length ? { from: next, to: this.route[0] } : null;
    }
    const arrival = { id: this.destination, token: this.token };
    this.destination = null;
    this.walking = false;
    return arrival;
  }
}

/** Preserve real travel time at slow rendering cadence while following every graph edge. */
export function advanceWorld(navigator, seconds) {
  let remaining = Math.min(2, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  while (remaining > 0.000001) {
    const step = Math.min(.05, remaining);
    const arrival = navigator.advance(step);
    if (arrival) return arrival;
    remaining -= step;
  }
  return null;
}

/** Only the first frame after a known pause is excluded, not sustained slow frames. */
export class FrameCadence {
  constructor() { this.firstFrame = true; }
  reset() { this.firstFrame = true; }
  sample(seconds) {
    if (this.firstFrame) { this.firstFrame = false; return { sampled: false, elapsed: 0 }; }
    const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    return { sampled: elapsed > 0, elapsed };
  }
}
