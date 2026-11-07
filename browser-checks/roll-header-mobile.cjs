"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const widths = [320, 360, 390, 414, 430];

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "roll-test@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Roll Test Artist", username: "rolltest" } };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/engagement") return { reactions: [], comments: [], savedPostIds: [], shares: [], views: {} };
  if (pathname === "/settings/presence") return { visible: true };
  if (pathname === "/settings/posts") return { hiddenPostIds: [] };
  if (pathname === "/profile-video") return { video: null };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
      });
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator(".reels-heading").waitFor({ state: "visible" });
      const geometry = await page.locator(".reels-heading").evaluate(element => {
        const heading = element.getBoundingClientRect();
        const open = element.querySelector(".roll-open")?.getBoundingClientRect();
        const close = element.querySelector(".roll-close");
        return {
          heading: { left: heading.left, right: heading.right, top: heading.top, bottom: heading.bottom },
          open: open ? { left: open.left, right: open.right, top: open.top, bottom: open.bottom, width: open.width, height: open.height } : null,
          closeDisplay: close ? getComputedStyle(close).display : "missing",
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      assert.equal(geometry.closeDisplay, "none", `${width}px close action leaked into the feed: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.open, `${width}px expand action is missing`);
      assert.ok(geometry.open.left >= geometry.heading.left && geometry.open.right <= geometry.heading.right, `${width}px expand action escapes horizontally: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.open.top >= geometry.heading.top && geometry.open.bottom <= geometry.heading.bottom, `${width}px expand action wraps outside its header: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.open.width >= 44 && geometry.open.height >= 44, `${width}px expand action is smaller than 44px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.pageWidth <= width, `${width}px feed overflows horizontally: ${JSON.stringify(geometry)}`);
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.locator(".reels-rail").screenshot({ path: path.join(captureDir, `roll-header-${width}.png`) });
      }
      await context.close();
    }
    console.log(`Roll header browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
