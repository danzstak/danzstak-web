"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 414, 430, 1366];
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const output = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/dailies-clapper");
fs.mkdirSync(output, { recursive: true });

function fixture(url) {
  const route = url.pathname;
  if (route === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "daily@danzstak.invalid" } };
  if (route === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Daily Creator", handle: "dailycreator", username: "dailycreator", picture: `${baseUrl}/assets/danzstak-share-fb-v2.jpg` } };
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
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator("#storiesLoading").waitFor({ state: "detached" });
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".story-create-avatar")).backgroundImage !== "none");
      await page.evaluate(async () => {
        const source = getComputedStyle(document.querySelector(".story-create-avatar")).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1];
        if (!source) throw new Error("Dailies profile image source is missing");
        await new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = source; });
      });
      const result = await page.evaluate(() => {
        const tile = document.querySelector(".story-create");
        const slate = document.querySelector(".daily-clapper");
        const photo = document.querySelector(".story-create-avatar");
        const art = document.querySelector(".story-create-art");
        const caption = document.querySelector(".story-create-caption");
        const tileRect = tile.getBoundingClientRect();
        const slateRect = slate.getBoundingClientRect();
        const artRect = art.getBoundingClientRect();
        const photoRect = photo.getBoundingClientRect();
        const captionRect = caption.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          take: slate.querySelector("small").textContent,
          scene: slate.querySelector("strong").textContent,
          date: slate.querySelector("time").textContent,
          slateVisible: slateRect.width > 0 && slateRect.height > 0 && slateRect.left >= tileRect.left && slateRect.right <= tileRect.right,
          photoVisible: getComputedStyle(photo).backgroundImage !== "none",
          photoSize: getComputedStyle(photo).backgroundSize,
          photoPosition: getComputedStyle(photo).backgroundPosition,
          photoRadius: getComputedStyle(photo).borderRadius,
          photoWidth: photoRect.width,
          photoHeight: photoRect.height,
          artBackground: getComputedStyle(art).backgroundColor,
          plusPresent: Boolean(document.querySelector(".story-create-caption b")),
          tileWidth: tileRect.width,
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
          artRatio: artRect.width / artRect.height,
          photoDominatesArt: photoRect.width >= artRect.width * .88 && photoRect.height >= artRect.height * .88,
          artCoversTile: Math.abs(artRect.left - tileRect.left) <= 1 && Math.abs(artRect.top - tileRect.top) <= 1 && Math.abs(artRect.width - tileRect.width) <= 1 && Math.abs(artRect.height - tileRect.height) <= 1,
          captionInside: captionRect.left >= tileRect.left && captionRect.right <= tileRect.right && captionRect.top >= tileRect.top && captionRect.bottom <= tileRect.bottom,
          captionOverlapsSlate: !(captionRect.right <= slateRect.left || captionRect.left >= slateRect.right || captionRect.bottom <= slateRect.top || captionRect.top >= slateRect.bottom),
          bottomInset: artRect.bottom - slateRect.bottom,
          leftInset: slateRect.left - artRect.left,
          slateInsidePhoto: slateRect.left >= photoRect.left && slateRect.right <= photoRect.right && slateRect.top >= photoRect.top && slateRect.bottom <= photoRect.bottom
        };
      });
      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
      assert.equal(result.overflow, false, `${width}px Dailies tile causes horizontal overflow`);
      assert.equal(result.scene, "SCENE 1");
      assert.equal(result.take, "TAKE 5");
      assert.match(result.date, /2026/, `${width}px current date is not visible: ${result.date}`);
      assert.equal(result.slateVisible, true, `${width}px clapper is clipped or hidden`);
      assert.equal(result.photoVisible, true, `${width}px creator photo is missing below the clapper`);
      assert.equal(result.photoSize, "cover", `${width}px creator photo does not fill its slot`);
      assert.equal(result.photoPosition, "50% 28%", `${width}px creator face is not framed in the upper center`);
      assert.equal(result.photoRadius, "50%", `${width}px Dailies creator photo must match the circular profile portrait`);
      assert.equal(result.photoDominatesArt, true, `${width}px Dailies creator photo is too small for its artwork`);
      assert.equal(result.artBackground, "rgba(0, 0, 0, 0)", `${width}px Dailies still has a box behind the profile picture`);
      assert.equal(result.slateInsidePhoto, true, `${width}px clapper is beside or below the profile picture instead of over it`);
      assert.equal(result.artCoversTile, true, `${width}px Dailies artwork leaves a dead label strip`);
      assert.equal(result.captionInside, true, `${width}px Dailies label is outside the image tile`);
      assert.equal(result.captionOverlapsSlate, false, `${width}px Dailies label collides with the clapper`);
      assert.equal(result.plusPresent, false, `${width}px Dailies creator still shows a separate plus sign`);
      if (width <= 700) {
        assert.ok(Math.abs(result.tileWidth - result.tileHeight) <= 1, `${width}px Dailies creator card is not square`);
        assert.ok(result.slateWidth <= 76, `${width}px clapper is too wide: ${result.slateWidth}px`);
        assert.ok(result.artWidth >= 148, `${width}px Dailies photo slot is too narrow: ${result.artWidth}px`);
        assert.ok(result.photoWidth >= 134 && result.photoHeight >= 134, `${width}px Dailies profile image is smaller than the profile treatment`);
        assert.ok(Math.abs(result.artRatio - 1) <= .02, `${width}px Dailies photo does not fill the square tile: ${result.artRatio}`);
        assert.ok(result.bottomInset >= 16 && result.bottomInset <= 20, `${width}px clapper is not anchored over the lower-left picture: ${result.bottomInset}px bottom inset`);
        assert.ok(result.leftInset >= 16 && result.leftInset <= 20, `${width}px clapper is not anchored over the lower-left picture: ${result.leftInset}px left inset`);
      }
      assert.ok(result.tileHeight >= 128, `${width}px Dailies creator tile is too short`);
      await page.screenshot({ path: path.join(output, `empty-dailies-${width}.png`) });
      await context.close();
    }
    console.log(`Empty Dailies clapper checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
