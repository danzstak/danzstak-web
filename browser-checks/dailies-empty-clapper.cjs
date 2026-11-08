"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 414, 430, 1366];
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const output = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/dailies-clapper");
fs.mkdirSync(output, { recursive: true });
const profilePortrait = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#ff7a1a"/><stop offset="1" stop-color="#1769e0"/></linearGradient></defs><rect width="360" height="360" fill="url(#bg)"/><circle cx="180" cy="126" r="72" fill="#f4c8a4"/><path d="M95 132c4-88 166-103 173 3-29-28-48-53-78-60-29 32-60 50-95 57Z" fill="#2a1c19"/><circle cx="154" cy="126" r="7" fill="#1a2230"/><circle cx="207" cy="126" r="7" fill="#1a2230"/><path d="M151 164c22 17 44 17 64 0" fill="none" stroke="#874c3e" stroke-width="8" stroke-linecap="round"/><path d="M48 360c10-103 58-154 132-154s122 51 132 154" fill="#101722"/><path d="M126 218l54 54 54-54" fill="#fff" opacity=".9"/></svg>`;

function fixture(url) {
  const route = url.pathname;
  if (route === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "daily@danzstak.invalid" } };
  if (route === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Daily Creator", handle: "dailycreator", username: "dailycreator" } };
  if (route === "/stories") return { dailyTakeCount: 5, stories: [], reels: [] };
  if (route === "/secure-posts") return { posts: [{
    postId: "owner-profile-photo-source",
    userId: "11111111-1111-4111-8111-111111111111",
    isOwner: true,
    authorName: "Daily Creator",
    authorPicture: `${baseUrl}/__test-profile-portrait.svg`,
    content: "The signed-in member's existing post supplies the legacy profile photo fallback.",
    audience: "public",
    createdAt: "2026-11-08T10:00:00.000Z"
  }] };
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
      await page.route(`${baseUrl}/__test-profile-portrait.svg`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: profilePortrait }));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator("#storiesLoading").waitFor({ state: "detached" });
      await page.waitForFunction(() => {
        const avatar = document.querySelector(".story-create-avatar");
        return avatar?.tagName === "IMG" ? avatar.complete && avatar.naturalWidth > 0 : getComputedStyle(avatar).backgroundImage !== "none";
      });
      await page.evaluate(async () => {
        const avatar = document.querySelector(".story-create-avatar");
        const source = avatar?.tagName === "IMG"
          ? avatar.currentSrc || avatar.src
          : getComputedStyle(avatar).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1];
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
          photoVisible: photo.tagName === "IMG" ? photo.complete && photo.naturalWidth > 0 : getComputedStyle(photo).backgroundImage !== "none",
          photoSize: photo.tagName === "IMG" ? getComputedStyle(photo).objectFit : getComputedStyle(photo).backgroundSize,
          photoPosition: photo.tagName === "IMG" ? getComputedStyle(photo).objectPosition : getComputedStyle(photo).backgroundPosition,
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
          photoFillsArt: Math.abs(photoRect.left - artRect.left) <= 1 && Math.abs(photoRect.top - artRect.top) <= 1 && Math.abs(photoRect.width - artRect.width) <= 1 && Math.abs(photoRect.height - artRect.height) <= 1,
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
      assert.equal(result.photoRadius, "18px", `${width}px Dailies creator photo must fill the rounded tile instead of remaining an inset circle`);
      assert.equal(result.photoDominatesArt, true, `${width}px Dailies creator photo is too small for its artwork`);
      assert.equal(result.photoFillsArt, true, `${width}px profile image does not fill the complete Dailies container`);
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
        assert.ok(result.bottomInset >= 6 && result.bottomInset <= 10, `${width}px clapper is not anchored over the lower-left picture: ${result.bottomInset}px bottom inset`);
        assert.ok(result.leftInset >= 6 && result.leftInset <= 10, `${width}px clapper is not anchored over the lower-left picture: ${result.leftInset}px left inset`);
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
