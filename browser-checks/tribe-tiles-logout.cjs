"use strict";
// Owner 2026-11-18: Tribe initials sit dead centre in their box; a Tribe with its own picture shows it in the box;
// Log out leaves DanzStak for the landing page, opened at the top with no status box.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/tribe-tiles-logout.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 820 }, isMobile: true, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      let authed = true;
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        if (p === "/auth/logout") { authed = false; return route.fulfill(json({ ok: true })); }
        if (p === "/auth/session") return authed ? route.fulfill(json({ authenticated: true, user: { email: "me@danzstak.test", sub: "me", name: "Night Shift" } })) : route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
        if (p === "/groups") return route.fulfill(json({ groups: [{ id: "g1", name: "Oakland Noise", category: "Bands", description: "Noise rock.", coverUrl: `${baseUrl}/assets/danzstak-d-icon.png`, memberCount: 3 }] }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/feed.html#groups`, { waitUntil: "domcontentloaded" });
      await page.locator(".groups-workspace .group-card-cover").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(800);
      const tiles = await page.evaluate(() => [...document.querySelectorAll(".groups-workspace .group-card")].map(card => {
        const cover = card.querySelector(".group-card-cover"), box = cover.getBoundingClientRect(), after = getComputedStyle(cover, "::after");
        return { name: card.querySelector(".group-open")?.textContent, photo: cover.classList.contains("has-photo"), image: getComputedStyle(cover).backgroundImage, position: after.position, inset: [after.top, after.left, after.bottom, after.right], place: after.placeItems, box: [box.width, box.height] };
      }));
      const letters = tiles.filter(tile => !tile.photo);
      assert.ok(letters.length >= 3, `${width}px: default Tribes listed`);
      for (const tile of letters) {
        assert.equal(tile.position, "absolute", `${width}px ${tile.name}: initial is laid over the whole box`);
        assert.deepEqual(tile.inset, ["0px", "0px", "0px", "0px"], `${width}px ${tile.name}: initial box fills the tile`);
        assert.match(tile.place, /center/, `${width}px ${tile.name}: initial is centred`);
      }
      const custom = tiles.find(tile => tile.name === "Oakland Noise");
      if (custom) assert.ok(custom.photo && /danzstak-d-icon\.png/.test(custom.image), `${width}px: a Tribe's own picture fills its box (${JSON.stringify(custom)})`);
      if (width === 390) await page.screenshot({ path: "docs/screenshots/tribe-tiles-390.png" });
      // Log out → landing page at the top, no "Not signed in" box.
      await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.querySelector("[data-logout]").click());
      await page.getByRole("button", { name: /^Log out$/ }).click();
      await page.waitForURL(/\/\?signedout=1$/, { timeout: 6000 });
      await page.waitForTimeout(1200);
      const landing = await page.evaluate(() => ({ y: scrollY, status: document.getElementById("status")?.hidden ?? true }));
      assert.equal(landing.y, 0, `${width}px: landing opens at the top`);
      assert.equal(landing.status, true, `${width}px: no "Not signed in" box after logging out`);
      assert.deepEqual(errors.filter(e => !/posts list/.test(e)), [], `${width}px page errors`);
      await context.close();
    }
    console.log("Tribe tile and logout checks passed at 320/360/390/430px: centred initials, Tribe pictures, logout lands on the landing page top within 6 s.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
