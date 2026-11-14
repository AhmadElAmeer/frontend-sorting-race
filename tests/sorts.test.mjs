import { test } from "node:test";
import assert from "node:assert/strict";
import { ALGORITHMS } from "../src/sorts.js";
import { rng } from "../src/race.js";

const KEYS = Object.keys(ALGORITHMS);

function randomArrays() {
  const r = rng(42);
  const out = [[], [1], [2, 1], [1, 2], [3, 3, 3], [5, 1, 4, 1, 5, 9, 2, 6]];
  for (let k = 0; k < 150; k++) {
    const n = Math.floor(r() * 120);
    const range = 1 + Math.floor(r() * (k % 3 === 0 ? 4 : 1000));   // some with many duplicates
    out.push(Array.from({ length: n }, () => Math.floor(r() * range)));
  }
  out.push(Array.from({ length: 200 }, (_, i) => i));          // sorted
  out.push(Array.from({ length: 200 }, (_, i) => 200 - i));    // reversed
  return out;
}

const sorted = (a) => a.slice().sort((x, y) => x - y);

function run(key, input) {
  const a = input.slice();
  const ops = [...ALGORITHMS[key].run(a)];
  return { a, ops };
}

for (const key of KEYS) {
  test(`${key}: sorts every test array`, () => {
    for (const input of randomArrays()) {
      assert.deepEqual(run(key, input).a, sorted(input), `input ${JSON.stringify(input.slice(0, 20))}`);
    }
  });

  test(`${key}: replaying the yielded operations reproduces the sort`, () => {
    // The animation only sees the operations, so they must describe every
    // change to the array exactly.
    for (const input of randomArrays()) {
      const { a, ops } = run(key, input);
      const replay = input.slice();
      for (const op of ops) {
        assert.ok(op.i >= 0 && op.i < input.length, `index ${op.i} out of range`);
        if (op.type === "swap") [replay[op.i], replay[op.j]] = [replay[op.j], replay[op.i]];
        else if (op.type === "write") replay[op.i] = op.value;
        else assert.equal(op.type, "compare");
        if (op.j !== undefined) assert.ok(op.j >= 0 && op.j < input.length);
      }
      assert.deepEqual(replay, a);
    }
  });
}

const count = (ops, type) => ops.filter((o) => o.type === type).length;

test("selection sort always makes n(n-1)/2 comparisons", () => {
  for (const n of [1, 2, 10, 57]) {
    const input = Array.from({ length: n }, (_, i) => (i * 7919) % n);
    assert.equal(count(run("selection", input).ops, "compare"), (n * (n - 1)) / 2);
  }
});

test("bubble and insertion sort need n-1 comparisons on sorted input", () => {
  const input = Array.from({ length: 100 }, (_, i) => i);
  for (const key of ["bubble", "insertion"]) {
    const { ops } = run(key, input);
    assert.equal(count(ops, "compare"), 99, key);
    assert.equal(ops.length, 99, `${key} should write nothing`);
  }
});

test("insertion sort makes exactly one swap per inversion", () => {
  const input = [3, 1, 2, 5, 4];          // inversions: (3,1) (3,2) (5,4)
  assert.equal(count(run("insertion", input).ops, "swap"), 3);
});

test("merge sort stays within n*ceil(log2 n) comparisons", () => {
  for (const input of randomArrays()) {
    const n = input.length;
    if (n < 2) continue;
    assert.ok(count(run("merge", input).ops, "compare") <= n * Math.ceil(Math.log2(n)));
  }
});

test("quicksort avoids the O(n^2) worst case on sorted and reversed input", () => {
  const n = 2000;
  const bound = 4 * n * Math.log2(n);
  for (const input of [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => n - i)]) {
    assert.ok(count(run("quick", input).ops, "compare") < bound);
  }
});

test("merge, insertion and bubble sort are stable", () => {
  // Objects whose numeric value is only the key: equal keys compare equal,
  // but the id records the original order.
  const r = rng(7);
  const items = Array.from({ length: 300 }, (_, id) => ({ key: Math.floor(r() * 10), id, valueOf() { return this.key; } }));
  for (const key of ["merge", "insertion", "bubble"]) {
    const a = items.slice();
    for (const _ of ALGORITHMS[key].run(a)) { /* run to completion */ }
    for (let i = 1; i < a.length; i++) {
      assert.ok(a[i - 1].key <= a[i].key, `${key} not sorted`);
      if (a[i - 1].key === a[i].key) assert.ok(a[i - 1].id < a[i].id, `${key} reordered equal keys`);
    }
  }
});
