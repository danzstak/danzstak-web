"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8023").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const profile = { memberId: "11111111-1111-4111-8111-111111111111", name: "Pivot Artist", username: "pivotartist", bio: "Independent artist.", picture: "", cover: "", website: "", isOwner: true };

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: profile.memberId, email: "pivot@example.test" } };
  if (pathname === "/profiles") return { profile };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/profile-video") return { video: null };
  if (pathname === "/engagement") return { reactions: [], comments: [], shares: [], savedPostIds: [], views: {} };
  if (pathname === "/calls/inbox") return { events: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()).pathname)) }));
      await page.goto(`${baseUrl}/profile.html?edit=identity`, { waitUntil: "domcontentloaded" });
      const panel = page.locator(".edit-profile-panel");
      await panel.waitFor({ state: "visible" });
      const section = panel.locator(".profile-import");
      await section.locator("summary").click();
      const pivot = section.locator(".profile-pivot-button");
      await pivot.waitFor({ state: "visible" });
      assert.match(await pivot.textContent(), /Open Moving Day/);
      const buttonBox = await pivot.boundingBox();
      assert.ok(buttonBox && buttonBox.height >= 44 && buttonBox.x >= 0 && buttonBox.x + buttonBox.width <= width, `${width}px profile Pivot action must remain touchable and contained`);
      if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `pivot-profile-entry-${width}.png`), fullPage: false }); }
      await pivot.click();
      const dialog = page.locator(".pivot-dialog");
      await dialog.waitFor({ state: "visible" });
      assert.equal((await dialog.locator("h2").textContent()).trim(), "Moving Day");
      assert.match(await dialog.locator(".pivot-intro").textContent(), /You own the data you choose to move/);
      assert.equal(errors.length, 0, `${width}px profile Pivot browser errors: ${errors.join(" | ")}`);
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= width, `${width}px profile Pivot flow overflows`);
      if (captureDir) await page.screenshot({ path: path.join(captureDir, `pivot-profile-${width}.png`), fullPage: false });
      await context.close();
    }
    console.log(`Profile Pivot browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
