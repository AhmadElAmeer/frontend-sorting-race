// End-to-end test in a real browser (needs Playwright with Chromium).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";
import { makeInput, Race } from "../src/race.js";

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
  chromium = null;
}

let server, browser;
before(async () => {
  if (!chromium) return;
  server = await serve();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

test("a full race in the browser matches the engine's numbers", { skip: !chromium && "playwright not installed" }, async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(server.url + "?input=reversed&size=60&seed=1&speed=12&autostart=1");
  await page.waitForSelector("body[data-state=finished]", { timeout: 15000 });

  const expected = new Race(makeInput("reversed", 60, 1)).runToEnd();
  for (const lane of expected.lanes) {
    const card = page.locator(`[data-algorithm=${lane.key}]`);
    assert.equal(await card.locator(".compares").textContent(), lane.compares.toLocaleString("en-US"), lane.key);
    assert.equal(await card.locator(".writes").textContent(), lane.writes.toLocaleString("en-US"), lane.key);
    assert.match(await card.locator(".place").textContent(), new RegExp(`^${lane.place}(st|nd|rd|th)$`));
  }
  assert.match(await page.locator("#finishOrder").textContent(), /^Finish order: 1\. /);
  assert.equal(await page.locator("#start").isDisabled(), true);
  assert.deepEqual(errors, []);
  await page.close();
});

test("step button advances exactly one operation", { skip: !chromium && "playwright not installed" }, async () => {
  const page = await browser.newPage();
  await page.goto(server.url + "?input=random&size=30&seed=4");
  for (let i = 0; i < 5; i++) await page.click("#step");
  assert.equal(await page.locator("#tick").textContent(), "Step 5");
  const totals = await page.$$eval(".lane", (lanes) => lanes.map((l) =>
    Number(l.querySelector(".compares").textContent) + Number(l.querySelector(".writes").textContent)));
  assert.deepEqual(totals, [5, 5, 5, 5, 5, 5]);
  await page.close();
});

test("changing the input starts a new race; no horizontal scroll on a phone", { skip: !chromium && "playwright not installed" }, async () => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(server.url + "?size=40&seed=2");
  await page.click("#step");
  await page.selectOption("#input", "nearly");
  assert.equal(await page.locator("#tick").textContent(), "Step 0");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page is ${overflow}px wider than the screen`);
  await page.close();
});
