"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 414, 430];
const output = path.resolve("docs/screenshots/dailies-clapper");
fs.mkdirSync(output, { recursive: true });

function fixture(url) {
  const route = url.pathname;
  if (route === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "daily@danzstak.invalid" } };
  if (route === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Daily Creator", username: "dailycreator", picture: "http://127.0.0.1:8017/assets/danzstak-share-fb-v2.jpg" } };
  if (route === "/stories") return { dailyTakeCount: 5, stories: [], reels: [] };
  if (route === "/secure-posts") return { posts: [] };
  if (route === "/friends") return { friends: [] };
  if (["/calls/directory", "/people"].includes(route)) return { users: [] };
  if (["/notifications", "/engagement-notifications"].includes(route)) return { notifications: [] };
  if (route === "/news") return { articles: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto("http://127.0.0.1:8017/feed.html?view=feed", { waitUntil: "domcontentloaded" });
      await page.locator("#storiesLoading").waitFor({ state: "detached" });
      await page.waitForTimeout(100);
      const result = await page.evaluate(() => {
        const tile = document.querySelector(".story-create");
        const slate = document.querySelector(".daily-clapper");
        const photo = document.querySelector(".story-create-avatar");
        const art = document.querySelector(".story-create-art");
        const tileRect = tile.getBoundingClientRect();
        const slateRect = slate.getBoundingClientRect();
        const artRect = art.getBoundingClientRect();
        const photoRect = photo.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          take: slate.querySelector("small").textContent,
          scene: slate.querySelector("strong").textContent,
          date: slate.querySelector("time").textContent,
          slateVisible: slateRect.width > 0 && slateRect.height > 0 && slateRect.left >= tileRect.left && slateRect.right <= tileRect.right,
          photoVisible: getComputedStyle(photo).backgroundImage !== "none",
          plusPresent: Boolean(document.querySelector(".story-create-caption b")),
          tileHeight: tileRect.height,
          tileTop: tileRect.top,
          slateTop: slateRect.top,
          slateHeight: slateRect.height,
          slateZ: getComputedStyle(slate).zIndex,
          slateOpacity: getComputedStyle(slate).opacity,
          slateColor: getComputedStyle(slate).color,
          slateBackground: getComputedStyle(slate).backgroundColor,
          slateWidth: slateRect.width,
          artWidth: artRect.width,
          artHeight: artRect.height,
          clearPhotoHeight: slateRect.top - artRect.top,
          bottomInset: artRect.bottom - slateRect.bottom,
          photoBottom: photoRect.bottom,
          slateTopEdge: slateRect.top,
          imageSlateGap: slateRect.top - photoRect.bottom
        };
      });
      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
      assert.equal(result.overflow, false, `${width}px Dailies tile causes horizontal overflow`);
      assert.equal(result.scene, "SCENE 1");
      assert.equal(result.take, "TAKE 5");
      assert.match(result.date, /2026/, `${width}px current date is not visible: ${result.date}`);
      assert.equal(result.slateVisible, true, `${width}px clapper is clipped or hidden`);
      assert.equal(result.photoVisible, true, `${width}px creator photo is missing below the clapper`);
      assert.equal(result.plusPresent, false, `${width}px Dailies creator still shows a separate plus sign`);
      assert.ok(result.slateWidth <= 76, `${width}px clapper is too wide: ${result.slateWidth}px`);
      assert.ok(result.clearPhotoHeight >= 70, `${width}px placeholder image area is too short: ${result.clearPhotoHeight}px`);
      assert.ok(result.imageSlateGap >= 2, `${width}px clapper overlaps the placeholder image by ${Math.abs(result.imageSlateGap)}px`);
      assert.ok(result.bottomInset >= 5 && result.bottomInset <= 10, `${width}px clapper is not anchored at the lower-left: ${result.bottomInset}px bottom inset`);
      assert.ok(result.tileHeight >= 140, `${width}px Dailies creator tile is too short`);
      await page.screenshot({ path: path.join(output, `empty-dailies-${width}.png`) });
      await context.close();
    }
    console.log(`Empty Dailies clapper checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
