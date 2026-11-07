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
      await page.waitForTimeout(150);
      const result = await page.evaluate(() => {
        const creator = document.querySelector(".story-create");
        const avatar = document.querySelector(".story-create-avatar");
        const slate = document.querySelector(".daily-clapper");
        const slateRect = slate.getBoundingClientRect();
        const icons = [...document.querySelectorAll(".composer-media-button")];
        const longName = document.querySelector('.story[data-story-id="daily-video-1"] .story-author-link');
        const nameMore = document.querySelector('.story[data-story-id="daily-video-1"] .story-name-more');
        const creatorRect = creator.getBoundingClientRect();
        const longNameRect = longName.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          railLabel: document.querySelector("#storiesRail").getAttribute("aria-label"),
          creatorLabel: creator.getAttribute("aria-label"),
          avatarBackground: getComputedStyle(avatar).backgroundImage,
          take: slate.querySelector("small").textContent,
          clock: slate.querySelector("time").textContent,
          slateVisible: slateRect.width > 0 && slateRect.height > 0 && getComputedStyle(slate).display !== "none",
          icons: icons.map(button => ({ label: button.getAttribute("aria-label"), svg: !!button.querySelector("svg"), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
          creatorWidth: creatorRect.width,
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
      assert.equal(result.take, "TAKE 5", `${width}px durable Dailies take count is wrong`);
      assert.ok(result.clock.length > 0, `${width}px local slate time is missing`);
      assert.equal(result.slateVisible, true, `${width}px creator clapper is hidden`);
      assert.deepEqual(result.icons.map(icon => icon.label), ["Photo", "Video"]);
      if (width < 700) assert.ok(result.icons.every(icon => icon.svg && icon.height >= 38), `${width}px media controls are not usable: ${JSON.stringify(result.icons)}`);
      assert.ok(result.longNameHeight > 20 && result.longNameInside, `${width}px creator name is clipped or escapes its tile`);
      assert.match(result.fullNameLabel, /The Extraordinarily Long Touring Artist Name/, `${width}px long name has no expanded affordance`);
      const screenshot = path.join(output, `feed-after-${width}.png`);
      if (!fs.existsSync(screenshot)) await page.screenshot({ path: screenshot });
      await context.close();
    }
    console.log(`Dailies feed browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
