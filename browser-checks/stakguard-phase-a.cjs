"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 414, 430, 1366];
const output = path.resolve("docs/screenshots/stakguard-phase-a");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport:{ width, height:width < 700 ? 844 : 900 }, serviceWorkers:"block" });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("http://127.0.0.1:8021/stakguard.html", { waitUntil:"domcontentloaded" });
      await page.locator(".findings-empty").waitFor();
      const state = await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth > innerWidth,
        findingCount:document.querySelectorAll(".finding").length,
        registryCount:document.querySelectorAll("#sourceRegistry li").length,
        disabled:document.getElementById("monitorUnavailable").disabled,
        minimumTargets:[...document.querySelectorAll("button,.section-jump a,.ds-mobile-nav a")].map(node => node.getBoundingClientRect().height).filter(Boolean),
        notice:document.querySelector(".prototype-notice").innerText,
        total:document.getElementById("monitorTotal").textContent
      }));
      assert.deepEqual(errors, [], `${width}px page errors: ${errors.join(" | ")}`);
      assert.equal(state.overflow, false, `${width}px page overflows horizontally`);
      assert.equal(state.findingCount, 0);
      assert.equal(state.registryCount, 5);
      assert.equal(state.disabled, true);
      assert.match(state.notice, /No scan provider connected/i);
      assert.equal(state.total, "$4");
      assert.ok(state.minimumTargets.every(height => height >= 44), `${width}px has a touch target below 44px: ${state.minimumTargets}`);
      await page.selectOption("#monitorMonths", "5");
      await page.waitForFunction(() => document.getElementById("monitorTotal").textContent === "$20");
      assert.match(await page.locator(".findings-empty").innerText(), /No broker findings yet/);
      await page.screenshot({ path:path.join(output, `stakguard-${width}.png`), fullPage:true });
      await page.close();
    }
    console.log(`StakGuard browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
