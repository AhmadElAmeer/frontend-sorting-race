// Capture README screenshots: one race paused mid-way, one finished.
//   node scripts/screenshot.mjs
import { createRequire } from "node:module";
import { serve } from "../tests/serve.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const server = await serve();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });

await page.goto(server.url + "?input=random&size=80&seed=3&speed=4&autostart=1");
await page.waitForFunction(() => /^Step [\d,]+$/.test(document.querySelector("#tick").textContent) &&
  Number(document.querySelector("#tick").textContent.replace(/\D/g, "")) > 1500);
await page.click("#start");                       // pause
await page.screenshot({ path: "docs/race-midway.png", fullPage: true });

await page.click("#start");                       // resume
await page.locator("#speed").fill("12");
await page.waitForSelector("body[data-state=finished]");
await page.screenshot({ path: "docs/race-finished.png", fullPage: true });

await browser.close();
server.close();
console.log("wrote docs/race-midway.png and docs/race-finished.png");
