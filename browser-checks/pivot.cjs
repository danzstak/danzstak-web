"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8023").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const endpoint = new URL(route.request().url()).pathname;
        if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "pivot@example.test" } });
        if (endpoint === "/profiles") return json(route, { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Pivot Artist", username: "pivotartist" } });
        if (endpoint === "/secure-posts") return json(route, { posts: [] });
        if (endpoint === "/stories") return json(route, { stories: [], reels: [] });
        if (["/friends", "/calls/directory", "/people"].includes(endpoint)) return json(route, { friends: [], users: [], incoming: [], outgoing: [] });
        if (["/notifications", "/engagement-notifications"].includes(endpoint)) return json(route, { notifications: [] });
        if (endpoint === "/groups") return json(route, { groups: [] });
        if (endpoint === "/news") return json(route, { articles: [] });
        if (endpoint === "/conversations") return json(route, { conversations: [] });
        if (endpoint === "/calls/devices") return json(route, { devices: [] });
        if (endpoint === "/calls/inbox") return json(route, { events: [] });
        if (endpoint === "/settings/presence") return json(route, { visible: true });
        if (endpoint === "/settings/posts") return json(route, { hiddenPostIds: [] });
        if (endpoint === "/profile-video") return json(route, { video: null });
        if (endpoint === "/engagement") return json(route, { reactions: [], comments: [], shares: [], views: {} });
        return json(route, {});
      });
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      const pivot = page.locator("#pivotButton"); await pivot.waitFor({ state: "visible" }); await page.waitForTimeout(100);
      assert.match(await pivot.textContent(), /Pivot/, `${width}px Pivot label must stay visible`);
      const header = await page.evaluate(() => {
        const search = document.querySelector(".topbar .search").getBoundingClientRect();
        const pivot = document.querySelector("#pivotButton").getBoundingClientRect();
        return { search: { left: search.left, right: search.right, width: search.width, height: search.height }, pivot: { left: pivot.left, right: pivot.right, width: pivot.width, height: pivot.height }, scrollWidth: document.documentElement.scrollWidth };
      });
      assert.ok(header.pivot.left >= header.search.right - .5, `${width}px Pivot must sit to the right of Search`);
      assert.ok(header.pivot.height >= 38 && header.pivot.width >= (width <= 700 ? 68 : 44), `${width}px Pivot must remain readable and touchable: ${JSON.stringify(header.pivot)}`);
      if (width < 700) {
        const share = header.search.width / (header.search.width + header.pivot.width);
        assert.ok(share >= .70 && share <= .82, `${width}px Search must occupy about three quarters of Search + Pivot: ${share}`);
      }
      assert.ok(header.scrollWidth <= width, `${width}px Pivot header overflows`);
      await pivot.click(); const dialog = page.locator(".pivot-dialog"); await dialog.waitFor({ state: "visible" });
      assert.equal((await dialog.locator("h2").textContent()).trim(), "Moving Day");
      assert.match(await dialog.locator(".pivot-privacy").textContent(), /nothing imports automatically/i);
      assert.match(await dialog.locator(".pivot-privacy").textContent(), /review it and choose what to bring/i);
      assert.match(await dialog.locator(".pivot-tracking").textContent(), /tracks content, not people/i);
      if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `pivot-moving-day-${width}.png`), fullPage: false }); }
      await dialog.getByRole("tab", { name: "Instagram" }).click();
      assert.match(await dialog.locator(".pivot-availability").textContent(), /not ready yet/i);
      await dialog.getByRole("tab", { name: "Reddit" }).click();
      assert.match(await dialog.locator(".pivot-guide").textContent(), /up to 30 days/i);
      await dialog.getByRole("tab", { name: "Facebook" }).click();
      await dialog.getByRole("button", { name: "Choose Facebook export" }).click();
      const importer = page.locator(".facebook-import-dialog"); await importer.waitFor({ state: "visible" });
      assert.match(await importer.textContent(), /Pick exactly what moves/);
      assert.match(await importer.textContent(), /Nothing comes to DanzStak until you choose it/);
      assert.equal(errors.length, 0, `${width}px Pivot browser errors: ${errors.join(" | ")}`);
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= width, `${width}px Pivot dialog overflows`);
      if (captureDir) await page.screenshot({ path: path.join(captureDir, `pivot-facebook-${width}.png`), fullPage: false });
      await context.close();
    }
    console.log(`Pivot browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
