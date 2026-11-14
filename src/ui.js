// Browser UI: builds one lane per algorithm, runs the race on
// requestAnimationFrame, and draws each array as bars on a canvas.

import { ALGORITHMS } from "./sorts.js";
import { makeInput, Race } from "./race.js";

const $ = (id) => document.getElementById(id);
const els = {
  input: $("input"), size: $("size"), sizeOut: $("sizeOut"),
  speed: $("speed"), speedOut: $("speedOut"), seed: $("seed"),
  start: $("start"), step: $("step"), reset: $("reset"),
  lanes: $("lanes"), tick: $("tick"), finishOrder: $("finishOrder"),
  template: $("laneTemplate"),
};

// Speed slider is exponential: 0..12 -> 1, 2, 4, ... 4096 operations per frame.
const opsPerFrame = () => 2 ** Number(els.speed.value);

let race = null;
let views = [];
let running = false;
let frame = 0;

function colors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();
  return { bar: v("--bar"), compare: v("--compare"), write: v("--write"), done: v("--done") };
}

function newRace() {
  stop();
  const seed = Math.max(0, Math.floor(Number(els.seed.value) || 0));
  els.seed.value = seed;
  const input = makeInput(els.input.value, Number(els.size.value), seed);
  race = new Race(input);
  els.lanes.replaceChildren();
  views = race.lanes.map((lane) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.querySelector("h2").textContent = lane.name;
    node.querySelector(".complexity").textContent = ALGORITHMS[lane.key].complexity;
    node.dataset.algorithm = lane.key;
    els.lanes.append(node);
    return {
      lane,
      node,
      canvas: node.querySelector("canvas"),
      compares: node.querySelector(".compares"),
      writes: node.querySelector(".writes"),
      place: node.querySelector(".place"),
      max: Math.max(...input, 1),
    };
  });
  els.start.textContent = "Start";
  els.start.disabled = false;
  els.step.disabled = false;
  render();
}

function render() {
  const c = colors();
  for (const v of views) drawLane(v, c);
  els.tick.textContent = `Step ${race.ops.toLocaleString()}`;
  els.finishOrder.textContent = race.finished.length
    ? "Finish order: " + race.finished.map((l) => `${l.place}. ${l.name}`).join("  ·  ")
    : "";
}

function drawLane(v, c) {
  const { lane, canvas } = v;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 120;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const a = lane.array;
  const n = a.length;
  const bw = w / n;
  const hot = new Map();
  if (lane.last) {
    const color = lane.last.type === "compare" ? c.compare : c.write;
    hot.set(lane.last.i, color);
    if (lane.last.j !== undefined) hot.set(lane.last.j, color);
  }
  for (let i = 0; i < n; i++) {
    const bh = Math.max(1, (a[i] / v.max) * (h - 2));
    ctx.fillStyle = lane.done ? c.done : hot.get(i) || c.bar;
    ctx.fillRect(i * bw, h - bh, Math.max(1, bw - (bw > 3 ? 1 : 0)), bh);
  }

  v.compares.textContent = lane.compares.toLocaleString();
  v.writes.textContent = lane.writes.toLocaleString();
  canvas.setAttribute("aria-label",
    `${lane.name}: ${lane.compares} comparisons, ${lane.writes} writes${lane.done ? `, finished in place ${lane.place}` : ""}`);
  if (lane.done) {
    v.node.classList.add("finished");
    v.place.hidden = false;
    v.place.textContent = ordinal(lane.place);
  }
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const m = n % 100;
  return n + (s[(m - 20) % 10] || s[m] || s[0]);
}

function loop() {
  const steps = opsPerFrame();
  for (let k = 0; k < steps && !race.done; k++) race.tick();
  render();
  if (race.done) return finish();
  if (running) frame = requestAnimationFrame(loop);
}

function start() {
  if (race.done) return;
  running = true;
  els.start.textContent = "Pause";
  frame = requestAnimationFrame(loop);
}

function stop() {
  running = false;
  cancelAnimationFrame(frame);
  if (race && !race.done) els.start.textContent = "Resume";
}

function finish() {
  running = false;
  els.start.textContent = "Finished";
  els.start.disabled = true;
  els.step.disabled = true;
  document.body.dataset.state = "finished";   // hook for automated UI tests
}

els.start.addEventListener("click", () => (running ? stop() : start()));
els.step.addEventListener("click", () => {
  stop();
  if (!race.done) race.tick();
  render();
  if (race.done) finish();
});
els.reset.addEventListener("click", () => {
  delete document.body.dataset.state;
  newRace();
});
for (const el of [els.input, els.size, els.seed]) el.addEventListener("change", () => els.reset.click());
els.size.addEventListener("input", () => (els.sizeOut.textContent = els.size.value));
els.speed.addEventListener("input", () => (els.speedOut.textContent = opsPerFrame()));
window.addEventListener("resize", () => race && render());
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => race && render());

// URL parameters let a specific race be shared or tested: ?input=reversed&size=100&seed=7&speed=12
const params = new URLSearchParams(location.search);
if (params.has("input") && isValidInput(params.get("input"))) els.input.value = params.get("input");
if (params.has("size")) els.size.value = params.get("size");
if (params.has("seed")) els.seed.value = params.get("seed");
if (params.has("speed")) els.speed.value = params.get("speed");
els.sizeOut.textContent = els.size.value;
els.speedOut.textContent = opsPerFrame();

function isValidInput(v) {
  return [...els.input.options].some((o) => o.value === v);
}

newRace();
if (params.get("autostart") === "1") start();
