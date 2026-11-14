// Inputs and the race engine. No DOM here, so it runs in Node for tests
// and benchmarks and in the browser for the UI.

import { ALGORITHMS } from "./sorts.js";

// mulberry32: tiny seeded PRNG, so the same seed gives the same race.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const INPUTS = {
  random: { name: "Random", make: (n, r) => Array.from({ length: n }, () => 1 + Math.floor(r() * n)) },
  nearly: {
    name: "Nearly sorted",
    make: (n, r) => {
      const a = Array.from({ length: n }, (_, i) => i + 1);
      for (let k = 0; k < Math.max(1, Math.floor(n / 20)); k++) {   // swap 5% of neighbours
        const i = Math.floor(r() * (n - 1));
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
      }
      return a;
    },
  },
  reversed: { name: "Reversed", make: (n) => Array.from({ length: n }, (_, i) => n - i) },
  fewUnique: { name: "Few unique", make: (n, r) => Array.from({ length: n }, () => 1 + Math.floor(r() * 5) * Math.ceil(n / 5)) },
};

export function makeInput(kind, n, seed) {
  if (!INPUTS[kind]) throw new Error(`unknown input "${kind}"`);
  if (!Number.isInteger(n) || n < 1 || n > 5000) throw new Error("size must be an integer from 1 to 5000");
  return INPUTS[kind].make(n, rng(seed));
}

// One lane per algorithm, each with its own copy of the input. tick()
// advances every unfinished lane by exactly one operation, so the race is
// fair: a lane finishes first because it needed fewer operations.
export class Race {
  constructor(input, keys = Object.keys(ALGORITHMS)) {
    this.ops = 0;
    this.finished = [];
    this.lanes = keys.map((key) => {
      if (!ALGORITHMS[key]) throw new Error(`unknown algorithm "${key}"`);
      const array = input.slice();
      return {
        key,
        name: ALGORITHMS[key].name,
        array,
        gen: ALGORITHMS[key].run(array),
        compares: 0,
        writes: 0,
        done: false,
        place: null,
        last: null,
      };
    });
  }

  get done() {
    return this.lanes.every((l) => l.done);
  }

  tick() {
    this.ops++;
    const finishedNow = [];
    for (const lane of this.lanes) {
      if (lane.done) continue;
      const { value, done } = lane.gen.next();
      if (done) {
        lane.done = true;
        lane.last = null;
        finishedNow.push(lane);
        continue;
      }
      lane.last = value;
      if (value.type === "compare") lane.compares++;
      else lane.writes++;
    }
    // Lanes that finish on the same tick share a place.
    if (finishedNow.length) {
      const place = this.finished.length + 1;
      for (const lane of finishedNow) lane.place = place;
      this.finished.push(...finishedNow);
    }
    return finishedNow;
  }

  runToEnd(maxTicks = 50_000_000) {
    while (!this.done) {
      if (this.ops > maxTicks) throw new Error("race did not finish");
      this.tick();
    }
    return this;
  }
}
