// Count comparisons and writes for every algorithm on every input type.
//   node scripts/bench.mjs [size] [seed]
import { ALGORITHMS } from "../src/sorts.js";
import { INPUTS, makeInput, Race } from "../src/race.js";

const n = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 1);
const keys = Object.keys(ALGORITHMS);

console.log(`n = ${n}, seed = ${seed}. Each cell: comparisons + writes = total (finish place)\n`);
const width = 34;
console.log("algorithm".padEnd(16) + Object.values(INPUTS).map((i) => i.name.padStart(width)).join(""));
const races = Object.keys(INPUTS).map((kind) => new Race(makeInput(kind, n, seed)).runToEnd());
for (const key of keys) {
  const cells = races.map((race) => {
    const l = race.lanes.find((x) => x.key === key);
    const cell = `${l.compares.toLocaleString("en")} + ${l.writes.toLocaleString("en")} = ${(l.compares + l.writes).toLocaleString("en")} (${l.place})`;
    return cell.padStart(width);
  });
  console.log(ALGORITHMS[key].name.padEnd(16) + cells.join(""));
}
