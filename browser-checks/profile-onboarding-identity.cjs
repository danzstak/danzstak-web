"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const screenshotDir = String(process.env.DANZSTAK_SCREENSHOT_DIR || "").trim();
const widths = [320, 360, 375, 390, 414, 430, 1366];

function fixture(pathname, identityState) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "liana@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: {
    memberId: "11111111-1111-4111-8111-111111111111",
    name: identityState === "named" ? "Liana" : "DanzStak member",
    handle: identityState === "custom-handle" ? "liana" : "danzstak-member",
    picture: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`
  } };
  if (pathname === "/stories") return { dailyTakeCount: 0, stories: [], reels: [] };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [] };
  if (["/calls/directory", "/people"].includes(pathname)) return { users: [] };
  if (["/notifications", "/engagement-notifications"].includes(pathname)) return { notifications: [] };
  if (pathname === "/news") return { articles: [] };
  return {};
}

(async () => {
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      for (const identityState of ["named", "custom-handle", "new"]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        const profileWrites = [];
        let releaseProfilePicture;
        let profilePictureGate;
        page.on("pageerror", error => errors.push(error.message));
        if (width === 320 && identityState === "named") {
          profilePictureGate = new Promise(resolve => { releaseProfilePicture = resolve; });
          await page.route("**/assets/danzstak-share-fb-v2.jpg", async route => {
            await profilePictureGate;
            await route.continue();
          });
        }
        await page.route("https://api.danzstak.com/**", route => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;
          if (pathname === "/profiles" && request.method() === "POST") profileWrites.push(request.postDataJSON());
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixture(pathname, identityState))
          });
        });
        await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
        await page.locator("#storiesLoading").waitFor({ state: "detached" });
        if (width === 320 && identityState === "named") {
          await page.locator("img.story-create-avatar-pending").waitFor({ state: "attached", timeout: 5000 });
          const pendingState = await page.evaluate(() => ({
            fallbackVisible: document.querySelector(".story-create-avatar")?.tagName === "SPAN",
            candidateHidden: Boolean(document.querySelector("img.story-create-avatar-pending")?.hidden)
          }));
          assert.deepEqual(pendingState, { fallbackVisible: true, candidateHidden: true }, "Dailies must keep the initial visible until the signed profile picture is ready");
          releaseProfilePicture?.();
        }
        await page.locator("img.story-create-avatar").waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
        await page.waitForFunction(() => document.getElementById("menuProfileName")?.textContent?.trim() !== "My Profile", null, { timeout: 5000 });
        const result = await page.evaluate(() => {
          const daily = document.querySelector(".story-create-avatar");
          const art = document.querySelector(".story-create-art");
          const clapper = document.querySelector(".daily-clapper");
          const dailyRect = daily?.getBoundingClientRect();
          const artRect = art?.getBoundingClientRect();
          const clapperRect = clapper?.getBoundingClientRect();
          return {
            onboardingCount: document.querySelectorAll("#profileOnboarding").length,
            dailyIsImage: daily?.tagName === "IMG",
            dailyLoaded: daily?.tagName === "IMG" && daily.complete && daily.naturalWidth > 0,
            imageFillsTile: Boolean(dailyRect && artRect
              && Math.abs(dailyRect.left - artRect.left) <= 1
              && Math.abs(dailyRect.top - artRect.top) <= 1
              && Math.abs(dailyRect.right - artRect.right) <= 1
              && Math.abs(dailyRect.bottom - artRect.bottom) <= 1),
            dailyBorderRadius: getComputedStyle(daily).borderRadius,
            dailySize: dailyRect ? { width: dailyRect.width, height: dailyRect.height } : null,
            dailyShadow: getComputedStyle(daily).boxShadow,
            tileBackingIsTransparent: (() => {
              const color = getComputedStyle(art).backgroundColor;
              return color === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(color);
            })(),
            clapperOverlaysLowerLeft: Boolean(clapperRect && dailyRect
              && clapperRect.left >= dailyRect.left
              && clapperRect.left - dailyRect.left <= 12
              && clapperRect.bottom <= dailyRect.bottom
              && dailyRect.bottom - clapperRect.bottom <= 12
              && clapperRect.right > dailyRect.left
              && clapperRect.top < dailyRect.bottom),
            overflow: document.documentElement.scrollWidth > innerWidth
          };
        });
        assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
        assert.equal(result.overflow, false, `${width}px identity state overflows horizontally`);
        assert.equal(result.dailyIsImage, true, `${width}px Dailies did not use the signed profile image`);
        assert.equal(result.dailyLoaded, true, `${width}px Dailies profile image failed to load`);
        assert.equal(result.imageFillsTile, true, `${width}px Dailies profile image did not fill the tile`);
        assert.equal(result.dailyBorderRadius, "18px", `${width}px Dailies profile image did not retain its approved rounded-square tile (computed ${result.dailyBorderRadius})`);
        assert.equal(result.dailyShadow.trim().endsWith("inset"), true, `${width}px Dailies profile image retained an outer grey shadow/backing (${result.dailyShadow})`);
        if (width === 1366) {
          assert.ok(Math.abs(result.dailySize.width - 168) <= 1 && Math.abs(result.dailySize.height - 168) <= 1,
            `desktop Dailies profile image must use the full 168px tile (got ${result.dailySize.width}x${result.dailySize.height})`);
        }
        assert.equal(result.tileBackingIsTransparent, true, `${width}px Dailies tile added an unwanted backing behind the round image`);
        assert.equal(result.clapperOverlaysLowerLeft, true, `${width}px Dailies clapper was not over the image at lower left`);
        assert.equal(result.onboardingCount, 0, `${width}px the feed still contained the blocking visible-name prompt`);
        if (identityState === "named") {
          await page.evaluate(() => {
            document.querySelector(".composer-avatar")?.remove();
            const image = document.querySelector("img.story-create-avatar");
            const placeholder = document.createElement("span");
            placeholder.className = "story-create-avatar";
            placeholder.textContent = "D";
            image?.replaceWith(placeholder);
            window.dispatchEvent(new CustomEvent("danzstak:posts-loaded", { detail: { posts: [{
              isOwner: true,
              userId: "11111111-1111-4111-8111-111111111111",
              authorName: "Liana",
              authorPicture: "/assets/danzstak-share-fb-v2.jpg"
            }] } }));
          });
          await page.locator("img.story-create-avatar").waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
          assert.equal(await page.locator("img.story-create-avatar").count(), 1, `${width}px Dailies hydration still depended on the Mix composer`);
        }
        assert.deepEqual(profileWrites, [], `${width}px opening Mix attempted to claim or replace a username`);
        if (screenshotDir && identityState === "named") {
          await page.screenshot({
            path: path.join(screenshotDir, `dailies-round-profile-${width}.png`),
            fullPage: false
          });
        }
        await context.close();
      }
    }
    console.log(`Profile-identity browser checks passed at ${widths.join(", ")}px: Mix has no blocking visible-name prompt and signed profile images hydrate without changing usernames.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
