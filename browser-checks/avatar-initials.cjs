"use strict";
// Fix-it 18 (Mix, owner 2026-11-18): the composer avatar and the member's own Dailies tile never show an empty black
// circle or the DanzStak "D": no photo or a broken photo shows the member's initial; a good photo shows the photo.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/avatar-initials.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const cases = [
  { name: "no photo", picture: "", photo: false },
  { name: "expired photo", picture: `${baseUrl}/__expired/avatar.jpg`, photo: false },
  { name: "good photo", picture: `${baseUrl}/assets/danzstak-d-icon.png`, photo: true }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390]) for (const item of cases) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", isMobile: true, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${baseUrl}/__expired/**`, route => route.fulfill({ status: 403, body: "" }));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const me = { email: "me@danzstak.test", sub: "me", name: "Night Shift", picture: item.picture };
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: me }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", picture: item.picture } }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".composer-avatar").first().waitFor({ state: "attached" });
      await page.waitForTimeout(2500);
      const state = await page.evaluate(() => {
        const composer = document.querySelector(".composer-avatar"), daily = document.querySelector(".story-create .story-create-avatar");
        return {
          composer: { text: composer.textContent.trim(), image: getComputedStyle(composer).backgroundImage },
          daily: daily ? { tag: daily.tagName, text: daily.textContent.trim() } : null
        };
      });
      const label = `${width}px ${item.name}`;
      if (item.photo) {
        assert.match(state.composer.image, /danzstak-d-icon\.png/, `${label}: composer shows the photo`);
      } else {
        assert.equal(state.composer.text, "N", `${label}: composer shows the member's initial (${JSON.stringify(state)})`);
        assert.equal(state.composer.image, "none", `${label}: no broken background photo`);
        if (state.daily) assert.ok(state.daily.tag === "SPAN" && state.daily.text === "N", `${label}: own Dailies tile shows the member's initial, not "D" (${JSON.stringify(state.daily)})`);
      }
      assert.deepEqual(errors, [], `${label}: page errors`);
      await context.close();
    }
    console.log("Avatar initial checks passed at 320/390px: no photo and broken photo show the member's initial; a good photo shows.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
