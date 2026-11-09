"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_FEED_ORIGIN || "http://127.0.0.1:8021";
const output = path.resolve("docs/screenshots/feed-mobile-density");
const widths = [320, 360, 390, 414, 430, 1366];
const ownerId = "11111111-1111-4111-8111-111111111111";
fs.mkdirSync(output, { recursive: true });

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@example.test" } };
  if (pathname === "/profiles") return { profile: { memberId: ownerId, name: "Alice Rivera", handle: "alice-rivera", picture: "", cloudProfile: true } };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/friends") return { friends: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/conversations") return { conversations: [] };
  if (pathname === "/calls/devices") return { devices: [] };
  if (pathname === "/calls/inbox") return { events: [] };
  if (pathname === "/settings/presence") return { visible: true };
  if (pathname === "/settings/posts") return { hiddenPostIds: [] };
  if (pathname === "/profile-video") return { video: null };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const height = width < 700 ? 844 : 900;
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === "/secure-posts") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "controlled fixture outage" }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(pathname)) });
      });
      await page.goto(`${origin}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator("#feedStatus.feed-load-error").waitFor();
      await page.locator(".reels-rail").waitFor();
      await page.waitForTimeout(100);

      const geometry = await page.evaluate(() => {
        const rect = selector => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return box ? { top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null;
        };
        return {
          documentWidth: document.documentElement.scrollWidth,
          stories: rect("#storiesRail"),
          dailyCreate: rect(".story-create"),
          composer: rect("#postComposer"),
          error: rect("#feedStatus"),
          roll: rect(".reels-rail"),
          addTarget: rect(".roll-add-toggle"),
          closeHidden: document.querySelector(".roll-close").hidden,
          formHidden: document.querySelector(".reel-import-form").hidden,
          rollOpenVisible: document.querySelector(".roll-open").getClientRects().length > 0,
          composerBorderTop: getComputedStyle(document.querySelector("#postComposer")).borderTop,
          shellStyles: ["#postComposer", "#feedStatus", ".reels-rail", ".story-create"].map(selector => {
            const style = getComputedStyle(document.querySelector(selector));
            return { selector, background: style.backgroundColor, borderTop: style.borderTopWidth, shadow: style.boxShadow };
          })
        };
      });
      assert.deepEqual(errors, [], `${width}px feed errors: ${errors.join(" | ")}`);
      assert.ok(geometry.documentWidth <= width, `${width}px feed overflows: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.stories.top < geometry.composer.top && geometry.composer.bottom <= geometry.error.top + 1 && geometry.error.bottom <= geometry.roll.top + 1, `${width}px Mix order is wrong: ${JSON.stringify(geometry)}`);
      if (width < 700) {
        assert.ok(geometry.stories.height <= 178, `${width}px Dailies row is too tall: ${geometry.stories.height}`);
        assert.ok(geometry.dailyCreate.width >= 148 && geometry.dailyCreate.width <= 168, `${width}px Dailies tile must keep the approved responsive story width: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.dailyCreate.height >= 148 && geometry.dailyCreate.height <= 168, `${width}px Dailies action must remain a responsive square: ${geometry.dailyCreate.height}`);
        assert.ok(geometry.composer.height <= 120, `${width}px composer is too tall: ${geometry.composer.height}`);
        assert.ok(geometry.error.height <= 92, `${width}px recovery panel is too tall: ${geometry.error.height}`);
        assert.ok(geometry.roll.height <= 92, `${width}px empty Roll is too tall: ${geometry.roll.height}`);
        assert.ok(geometry.addTarget.width >= 44 && geometry.addTarget.height >= 44, `${width}px Add video needs a touch target`);
      }
      assert.equal(geometry.closeHidden, true, `${width}px inline Roll must not show a close button`);
      assert.equal(geometry.formHidden, true, `${width}px Roll form must start collapsed`);
      assert.equal(geometry.rollOpenVisible, false, `${width}px empty Roll must not offer a blank fullscreen player`);
      assert.ok(!geometry.composerBorderTop.includes("rgb(23, 105, 224)"), `${width}px composer still has the blue top rule: ${geometry.composerBorderTop}`);
      for (const shell of geometry.shellStyles) {
        assert.equal(shell.background, "rgba(0, 0, 0, 0)", `${width}px ${shell.selector} still has a container background`);
        assert.equal(shell.borderTop, "0px", `${width}px ${shell.selector} still has a container border`);
        assert.equal(shell.shadow, "none", `${width}px ${shell.selector} still has a container shadow`);
      }
      await page.screenshot({ path: path.join(output, `feed-recovery-${width}.png`), fullPage: false });

      await page.getByRole("button", { name: "Add video" }).click();
      await page.locator(".reel-import-form").waitFor({ state: "visible" });
      assert.equal(await page.locator(".roll-add-toggle").getAttribute("aria-expanded"), "true");
      if (width === 390) await page.screenshot({ path: path.join(output, "feed-roll-add-390.png"), fullPage: false });
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.locator(".reel-import-form").waitFor({ state: "hidden" });
      if (width < 700) {
        const postGap = await page.evaluate(() => {
          const feed = document.getElementById("feed");
          const first = createPostElement("First continuous post", "First artist", new Date().toISOString(), "public");
          const second = createPostElement("Second continuous post", "Second artist", new Date().toISOString(), "public");
          feed.replaceChildren(first, second);
          const firstPost = first.getBoundingClientRect();
          const secondPost = second.getBoundingClientRect();
          return { gap: secondPost.top - firstPost.bottom, feedGap: getComputedStyle(feed).gap };
        });
        const expectedPostGap = width <= 375 ? 12 : 16;
        assert.equal(postGap.feedGap, `${expectedPostGap}px`, `${width}px feed must use the approved responsive inter-post gap`);
        assert.ok(Math.abs(postGap.gap - expectedPostGap) <= 2, `${width}px consecutive post rhythm must match the approved ${expectedPostGap}px gap: ${JSON.stringify(postGap)}`);
        if (width === 390) await page.screenshot({ path: path.join(output, "feed-continuous-posts-390.png"), fullPage: false });
      }
      await context.close();
    }
    console.log(`Feed mobile-density browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
