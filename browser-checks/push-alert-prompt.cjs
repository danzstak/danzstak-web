"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = String(process.env.DANZSTAK_SCREENSHOT_DIR || "").trim();
const widths = [320, 360, 390, 414, 430, 1366];

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } };
  if (pathname === "/profiles") return { profile: { name: "Tour Artist", handle: "tour-artist", picture: `${baseUrl}/assets/danzstak-share-fb-v2.jpg` } };
  if (pathname === "/stories") return { dailyTakeCount: 0, stories: [], reels: [] };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [] };
  if (["/calls/directory", "/people"].includes(pathname)) return { users: [] };
  if (["/notifications", "/engagement-notifications"].includes(pathname)) return { notifications: [] };
  if (pathname === "/news") return { articles: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const height = width <= 430 ? 844 : 900;
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture(new URL(route.request().url()).pathname))
      }));
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator(".topbar .topnav").waitFor({ state: "attached" });
      await page.evaluate(() => {
        document.querySelector(".push-alert-prompt")?.remove();
        const prompt = document.createElement("aside");
        prompt.className = "push-alert-prompt";
        prompt.innerHTML = '<div><strong>Never miss a DanzStak call</strong><span>Receive call and message notifications while DanzStak is in the background.</span></div><button class="primary">Enable alerts</button><button class="push-alert-dismiss">Not now</button>';
        document.body.appendChild(prompt);
      });
      const result = await page.evaluate(() => {
        const prompt = document.querySelector(".push-alert-prompt");
        const nav = document.querySelector(".topbar .topnav");
        const action = prompt.querySelector(".primary");
        const dismiss = prompt.querySelector(".push-alert-dismiss");
        const detail = prompt.querySelector("span");
        const rect = prompt.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        return {
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height },
          navTop: navRect.top,
          navVisible: getComputedStyle(nav).display !== "none",
          actionHeight: action.getBoundingClientRect().height,
          dismissHeight: dismiss.getBoundingClientRect().height,
          detailVisible: getComputedStyle(detail).display !== "none",
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
      assert.equal(result.overflow, false, `${width}px prompt caused horizontal overflow`);
      assert.ok(result.rect.left >= 0 && result.rect.right <= width, `${width}px prompt escaped the viewport`);
      assert.ok(result.actionHeight >= 44 && result.dismissHeight >= 44, `${width}px prompt actions are not touchable`);
      if (width <= 430) {
        assert.equal(result.navVisible, true, `${width}px mobile navigation was not visible`);
        assert.ok(result.rect.bottom <= result.navTop - 7, `${width}px prompt covered the mobile navigation`);
        assert.ok(result.rect.height <= 64, `${width}px prompt consumes too much of the feed`);
        assert.equal(result.detailVisible, false, `${width}px secondary prompt copy was not compacted`);
      } else {
        assert.ok(result.rect.bottom <= height - 15, "desktop prompt lost its viewport inset");
      }
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, `push-alert-${width}.png`), fullPage: false, animations: "disabled", caret: "hide" });
      }
      await context.close();
    }
    console.log(`Push-alert browser checks passed at ${widths.join(", ")}px: compact, touchable, and clear of mobile navigation.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
