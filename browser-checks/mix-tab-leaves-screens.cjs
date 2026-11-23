"use strict";
// Fix-it 18 (owner 2026-11-18): one primary screen at a time. Friends (opened from the Menu or a #friends link)
// hides the Dailies strip, composer and posts; the Mix tab leaves Friends, restores the "Your Mix" title and shows Mix.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/mix-tab-leaves-screens.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const visibility = selectors => selectors.map(selector => {
  const node = document.querySelector(selector);
  if (!node) return [selector, false];
  const rect = node.getBoundingClientRect();
  return [selector, rect.width > 0 && rect.height > 0 && node.checkVisibility()];
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 360, 390, 430]) for (const entry of ["hash", "menu"]) {
      const context = await browser.newContext({ viewport: { width, height: 820 }, serviceWorkers: "block", isMobile: true, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@danzstak.test", sub: "me", name: "Night Shift" } }));
        return route.fulfill(json(p === "/posts" ? { posts: [] } : {}));
      });
      const label = `${width}px via ${entry}`;
      if (entry === "hash") await page.goto(`${baseUrl}/feed.html#friends`, { waitUntil: "domcontentloaded" });
      else {
        await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
        await page.locator('[data-route="home"]').waitFor();
        await page.waitForTimeout(800);
        await page.evaluate(() => document.querySelector('a[href="#friends"][data-feature="Friends"]').click());
      }
      await page.waitForFunction(() => document.title.includes("Friends"), null, { timeout: 15000 });
      await page.waitForTimeout(500);
      const map = Object.fromEntries(await page.evaluate(visibility, [".story-create", ".composer-avatar", "#featureView"]));
      assert.equal(map["#featureView"], true, `${label}: Friends screen shows`);
      assert.equal(map[".story-create"], false, `${label}: no Dailies strip on Friends`);
      assert.equal(map[".composer-avatar"], false, `${label}: no composer on Friends`);
      await page.locator('[data-route="home"]').click();
      await page.waitForTimeout(600);
      const onMix = Object.fromEntries(await page.evaluate(visibility, [".story-create", "#featureView"]));
      assert.equal(onMix["#featureView"], false, `${label}: Mix tab leaves Friends`);
      assert.equal(onMix[".story-create"], true, `${label}: Mix shows the Dailies strip`);
      assert.equal(await page.title(), "DanzStak | Your Mix", `${label}: title back to Your Mix`);
      assert.deepEqual(errors, [], `${label}: page errors`);
      await context.close();
    }
    console.log("Mix tab checks passed at 320/360/390/430px: Friends hides Mix; the Mix tab leaves Friends and restores its title.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
