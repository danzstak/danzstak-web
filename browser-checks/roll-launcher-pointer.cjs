"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_VISUAL_BASE_URL || "http://127.0.0.1:8013";
const widths = [320, 360, 390, 414, 430, 1366];
const output = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/roll-launcher-pointer");
fs.mkdirSync(output, { recursive: true });

function fixture(url) {
  if (url.pathname === "/auth/session") return { authenticated: true, email: "roll-test@danzstak.invalid", name: "Roll Test Artist", memberId: "11111111-1111-4111-8111-111111111111" };
  if (url.pathname === "/posts" || url.pathname === "/secure-posts") return { posts: [] };
  if (url.pathname === "/stories") return { stories: [], reels: [{ id: "roll-pointer-fixture", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", authorName: "Roll Test Artist", memberId: "11111111-1111-4111-8111-111111111111", content: "Roll launcher pointer verification", sharedAt: "2026-11-08T00:00:00.000Z", isOwner: true }] };
  if (url.pathname === "/friends") return { friends: [] };
  if (url.pathname === "/calls/directory" || url.pathname === "/people") return { users: [] };
  if (url.pathname === "/notifications" || url.pathname === "/engagement-notifications") return { notifications: [] };
  if (url.pathname === "/messages/conversations") return { conversations: [] };
  if (url.pathname === "/settings/presence") return { dataSaver: false };
  if (url.pathname === "/profiles" || url.pathname === "/profile") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Roll Test Artist", isOwner: true } };
  return {};
}

async function pointerOwner(page, selector) {
  return page.locator(selector).evaluate(control => {
    const box = control.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      ownsCenter: Boolean(hit && (hit === control || control.contains(hit))),
      hit: hit?.className || hit?.tagName || ""
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator(".reel-fullscreen-trigger").waitFor();

      const launcher = page.locator(".roll-open");
      await launcher.scrollIntoViewIfNeeded();
      await page.waitForTimeout(50);
      const headerHit = await pointerOwner(page, ".roll-open");
      const previewBox = await page.locator(".reel-fullscreen-trigger").evaluate(control => {
        const box = control.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      });
      assert.equal(headerHit.ownsCenter, true, `${width}px Roll header launcher is covered by ${headerHit.hit}: ${JSON.stringify({ headerHit, previewBox })}`);
      assert.ok(previewBox.top >= headerHit.box.bottom, `${width}px per-video fullscreen control overlaps the Roll header launcher: ${JSON.stringify({ headerHit, previewBox })}`);
      await page.screenshot({ path: path.join(output, `roll-launcher-${width}.png`) });

      await launcher.click();
      await page.locator(".reels-rail.roll-fullscreen").waitFor();
      await page.locator(".roll-close").click();
      await page.locator(".reels-rail:not(.roll-fullscreen)").waitFor();

      const preview = page.locator(".reel-fullscreen-trigger");
      await preview.scrollIntoViewIfNeeded();
      await page.waitForTimeout(50);
      const previewHit = await pointerOwner(page, ".reel-fullscreen-trigger");
      assert.equal(previewHit.ownsCenter, true, `${width}px per-video Roll launcher is covered by ${previewHit.hit}: ${JSON.stringify(previewHit)}`);
      await preview.click();
      await page.locator(".reels-rail.roll-fullscreen").waitFor();
      await page.screenshot({ path: path.join(output, `roll-fullscreen-${width}.png`) });
      await page.locator(".roll-close").click();
      await context.close();
    }
    console.log(`Roll launcher pointer checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
