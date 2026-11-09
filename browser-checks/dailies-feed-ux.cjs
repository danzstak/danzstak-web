"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 430, 1024];
const ownerId = "11111111-1111-4111-8111-111111111111";
const friendId = "22222222-2222-4222-8222-222222222222";
const output = path.resolve("docs/screenshots/issue-49");
fs.mkdirSync(output, { recursive: true });

async function captureViewport(page, file) {
  const viewport = page.viewportSize();
  let failure;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.screenshot({
        path: file,
        clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
        animations: "disabled",
        caret: "hide"
      });
      return;
    } catch (error) {
      failure = error;
      await page.waitForTimeout(150);
    }
  }
  throw failure;
}

function fixture(url) {
  if (url.pathname === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "stage@danzstak.invalid" } };
  if (url.pathname === "/profiles") return { profile: { memberId: ownerId, name: "Long Dailies Creator Name", username: "dailycreator", picture: "http://127.0.0.1:8017/assets/danzstak-share-fb-v2.jpg" } };
  if (url.pathname === "/stories") return { dailyTakeCount: 5, stories: [{
    storyId: "daily-video-1", memberId: friendId, displayName: "The Extraordinarily Long Touring Artist Name", content: "Backstage rehearsal", mediaType: "video", mediaUrl: "", createdAt: "2026-11-05T12:30:00.000Z", isOwner: false
  }, {
    storyId: "daily-owner-video", memberId: ownerId, displayName: "Long Dailies Creator Name", content: "Soundcheck", mediaType: "video", mediaUrl: "", createdAt: "2026-11-05T13:30:00.000Z", isOwner: true
  }] };
  if (url.pathname === "/secure-posts") return { posts: [] };
  if (url.pathname === "/friends") return { friends: [] };
  if (["/calls/directory", "/people"].includes(url.pathname)) return { users: [] };
  if (["/notifications", "/engagement-notifications"].includes(url.pathname)) return { notifications: [] };
  if (url.pathname === "/news") return { items: [] };
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
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto("http://127.0.0.1:8017/feed.html?view=feed", { waitUntil: "domcontentloaded" });
      await page.locator('.story[data-story-id="daily-video-1"]').waitFor({ timeout: 5000 }).catch(async error => {
        throw new Error(`${error.message}\nPage errors: ${errors.join(" | ")}\nRail: ${await page.locator("#storiesRail").innerHTML().catch(() => "missing")}`);
      });
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
        const creator = document.querySelector(".story-create");
        const avatar = document.querySelector(".story-create-avatar");
        const art = document.querySelector(".story-create-art");
        const slate = document.querySelector(".daily-clapper");
        const slateRect = slate.getBoundingClientRect();
        const icons = [...document.querySelectorAll(".composer-media-button")];
        const longName = document.querySelector('.story[data-story-id="daily-video-1"] .story-author-link');
        const nameMore = document.querySelector('.story[data-story-id="daily-video-1"] .story-name-more');
        const creatorRect = creator.getBoundingClientRect();
        const avatarRect = avatar.getBoundingClientRect();
        const artRect = art.getBoundingClientRect();
        const longNameRect = longName.getBoundingClientRect();
        const storyRect = document.querySelector('.story[data-story-id="daily-video-1"]').getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          railLabel: document.querySelector("#storiesRail").getAttribute("aria-label"),
          creatorLabel: creator.getAttribute("aria-label"),
          avatarBackground: avatar.tagName === "IMG" ? avatar.currentSrc || avatar.src : getComputedStyle(avatar).backgroundImage,
          avatarRadius: getComputedStyle(avatar).borderRadius,
          avatarDominatesArt: avatarRect.width >= artRect.width * .88 && avatarRect.height >= artRect.height * .88,
          slateInsideAvatar: slateRect.left >= avatarRect.left && slateRect.right <= avatarRect.right && slateRect.top >= avatarRect.top && slateRect.bottom <= avatarRect.bottom,
          artCoversCreator: Math.abs(artRect.left - creatorRect.left) <= 1 && Math.abs(artRect.top - creatorRect.top) <= 1 && Math.abs(artRect.width - creatorRect.width) <= 1 && Math.abs(artRect.height - creatorRect.height) <= 1,
          take: slate.querySelector("small").textContent,
          clock: slate.querySelector("time").textContent,
          slateVisible: slateRect.width > 0 && slateRect.height > 0 && getComputedStyle(slate).display !== "none",
          icons: icons.map(button => ({ label: button.getAttribute("aria-label"), svg: !!button.querySelector("svg"), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
          creatorWidth: creatorRect.width,
          creatorHeight: creatorRect.height,
          storyWidth: storyRect.width,
          storyHeight: storyRect.height,
          longNameHeight: longNameRect.height,
          longNameInside: longNameRect.left >= creatorRect.left - 1 && longNameRect.right <= document.querySelector('.story[data-story-id="daily-video-1"]').getBoundingClientRect().right + 1,
          fullNameLabel: nameMore?.getAttribute("aria-label") || ""
        };
      });
      assert.equal(errors.length, 0, `${width}px errors: ${errors.join(" | ")}`);
      assert.ok(result.documentWidth <= width, `${width}px page overflow: ${JSON.stringify(result)}`);
      assert.equal(result.railLabel, "Dailies");
      assert.match(result.creatorLabel, /Dailies/);
      assert.notEqual(result.avatarBackground, "none", `${width}px genuine profile picture was not installed`);
      assert.equal(result.avatarRadius, "18px", `${width}px Dailies profile image must fill the rounded tile instead of remaining an inset circle`);
      assert.equal(result.avatarDominatesArt, true, `${width}px Dailies profile image is too small for its artwork`);
      assert.equal(result.slateInsideAvatar, true, `${width}px Dailies clapper is not over the profile image`);
      assert.equal(result.artCoversCreator, true, `${width}px Dailies artwork does not fill the complete creator tile`);
      assert.equal(result.take, "TAKE 5", `${width}px durable Dailies take count is wrong`);
      assert.ok(result.clock.length > 0, `${width}px local slate time is missing`);
      assert.equal(result.slateVisible, true, `${width}px creator clapper is hidden`);
      assert.deepEqual(result.icons.map(icon => icon.label), ["Photo", "Video"]);
      if (width < 700) {
        assert.ok(result.icons.every(icon => icon.svg && icon.height >= 38), `${width}px media controls are not usable: ${JSON.stringify(result.icons)}`);
        assert.ok(Math.abs(result.creatorWidth - result.creatorHeight) <= 1, `${width}px Dailies creator card is not square`);
        assert.ok(Math.abs(result.storyWidth - result.storyHeight) <= 1, `${width}px Dailies media card is not square`);
        assert.ok(result.creatorWidth >= 148, `${width}px Dailies profile tile is smaller than the profile treatment`);
      }
      assert.ok(result.longNameHeight > 20 && result.longNameInside, `${width}px creator name is clipped or escapes its tile`);
      assert.match(result.fullNameLabel, /The Extraordinarily Long Touring Artist Name/, `${width}px long name has no expanded affordance`);
      const screenshot = path.join(output, `feed-after-${width}.png`);
      await captureViewport(page, screenshot);
      await context.close();
    }
    console.log(`Dailies feed browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
