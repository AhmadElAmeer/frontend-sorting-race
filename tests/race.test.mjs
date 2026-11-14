import { test } from "node:test";
import assert from "node:assert/strict";
import { INPUTS, makeInput, Race, rng } from "../src/race.js";

test("rng is deterministic per seed", () => {
  const a = rng(5), b = rng(5), c = rng(6);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.notDeepEqual(xs, [c(), c(), c()]);
  for (const x of xs) assert.ok(x >= 0 && x < 1);
});

test("inputs have the requested size and shape", () => {
  for (const kind of Object.keys(INPUTS)) {
    const a = makeInput(kind, 100, 3);
    assert.equal(a.length, 100, kind);
    assert.ok(a.every((x) => Number.isInteger(x) && x >= 1), kind);
  }
  assert.deepEqual(makeInput("reversed", 4, 0), [4, 3, 2, 1]);
  assert.ok(new Set(makeInput("fewUnique", 200, 1)).size <= 5);
  const nearly = makeInput("nearly", 100, 1);
  const outOfPlace = nearly.filter((x, i) => x !== i + 1).length;
  assert.ok(outOfPlace > 0 && outOfPlace <= 10);
});

test("invalid inputs are rejected", () => {
  assert.throws(() => makeInput("zigzag", 10, 1), /unknown input/);
  for (const n of [0, -1, 2.5, 5001]) assert.throws(() => makeInput("random", n, 1), /size/);
  assert.throws(() => new Race([1, 2], ["bogo"]), /unknown algorithm/);
});

test("every lane gets its own copy of the input", () => {
  const input = [3, 1, 2];
  const race = new Race(input).runToEnd();
  assert.deepEqual(input, [3, 1, 2]);
  for (const lane of race.lanes) assert.deepEqual(lane.array, [1, 2, 3]);
});

test("the race is fair: one operation per lane per tick", () => {
  const race = new Race(makeInput("random", 80, 9));
  for (let t = 1; t <= 500; t++) {
    race.tick();
    for (const lane of race.lanes) {
      const ops = lane.compares + lane.writes;
      if (!lane.done) assert.equal(ops, t, lane.key);
    }
  }
});

test("finish places follow total operations, ties share a place", () => {
  const race = new Race(makeInput("reversed", 60, 1)).runToEnd();
  const total = (l) => l.compares + l.writes;
  for (const a of race.lanes) {
    for (const b of race.lanes) {
      if (total(a) < total(b)) assert.ok(a.place < b.place, `${a.key} vs ${b.key}`);
      if (total(a) === total(b)) assert.equal(a.place, b.place);
    }
  }
  // bubble and insertion do identical work on reversed input
  const byKey = Object.fromEntries(race.lanes.map((l) => [l.key, l]));
  assert.equal(byKey.bubble.place, byKey.insertion.place);
});

test("a race on a single element finishes after one tick", () => {
  const race = new Race([7]);
  race.tick();
  assert.ok(race.done);
  assert.ok(race.lanes.every((l) => l.place === 1 && l.compares + l.writes === 0));
});
