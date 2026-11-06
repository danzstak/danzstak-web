"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_FEED_ORIGIN || "http://127.0.0.1:8024";
const credentials = process.env.DANZSTAK_PREVIEW_USER && process.env.DANZSTAK_PREVIEW_PASSWORD
  ? { username: process.env.DANZSTAK_PREVIEW_USER, password: process.env.DANZSTAK_PREVIEW_PASSWORD }
  : null;
const widths = [320, 390, 430, 1366];
const ownerId = "11111111-1111-4111-8111-111111111111";
const imagePostId = "33333333-3333-4333-8333-333333333333";
const videoPostId = "44444444-4444-4444-8444-444444444444";
const output = path.resolve("docs/screenshots/issue-60-feed-art-direction");
fs.mkdirSync(output, { recursive: true });

const profile = {
  memberId: ownerId,
  name: "Eroticon",
  handle: "eroticon",
  username: "eroticon",
  bio: "Independent electronic punk from San Francisco. New releases, tour dates, and noise from the road.",
  location: "San Francisco, California",
  work: "Artist · Producer · Live act",
  website: "https://danzstak.com",
  picture: `${origin}/assets/danzstak-d-icon.png`,
  cover: `${origin}/assets/danzstak-share-fb-v2.jpg`,
  isOwner: true,
  cloudProfile: true
};

function fixture(url) {
  const route = url.pathname;
  if (route === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@danzstak.invalid" } };
  if (route === "/profiles") return { profile };
  if (route === "/secure-posts") return { posts: [
    {
      postId: imagePostId, userId: ownerId, authorName: profile.name, authorPicture: profile.picture,
      content: "West Coast dates are coming together. New live set, real clubs, no fake listings.",
      createdAt: "2026-11-05T18:30:00.000Z", audience: "public", isOwner: true,
      mediaType: "image", mediaUrl: `${origin}/assets/danzstak-share-fb-v2.jpg`, viewCount: 42, commentPolicy: "everyone"
    },
    {
      postId: videoPostId, userId: ownerId, authorName: profile.name, authorPicture: profile.picture,
      content: "A direct video post must use the same edge grid as artwork.",
      createdAt: "2026-11-05T17:30:00.000Z", audience: "public", isOwner: true,
      mediaType: "video", mediaUrl: "https://media.example.invalid/danzstak-test.mp4", viewCount: 18, commentPolicy: "everyone"
    }
  ] };
  if (route === "/engagement") return { myReaction: "", reactionCounts: { Like: 8, Love: 4 }, comments: [] };
  if (route === "/stories") return { stories: [], reels: [] };
  if (route === "/friends") return { friends: [] };
  if (["/calls/directory", "/people"].includes(route)) return { users: [] };
  if (["/notifications", "/engagement-notifications"].includes(route)) return { notifications: [] };
  if (route === "/groups") return { groups: [] };
  if (route === "/news") return { articles: [] };
  if (route === "/profile-posts") return { posts: [] };
  if (route === "/profile-friends") return { friends: [] };
  if (route === "/activity") return { items: [] };
  if (route === "/profile-video") return { video: null };
  if (route === "/settings/presence") return { visible: true };
  if (route === "/settings/posts") return { hiddenPostIds: [] };
  return {};
}

function normalize(value) { return String(value || "").replace(/\s+/g, ""); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of widths) {
      const height = width < 700 ? 844 : 900;
      const context = await browser.newContext({
        viewport: { width, height },
        serviceWorkers: "block",
        reducedMotion: "reduce",
        ...(credentials ? { httpCredentials: credentials } : {})
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://media.example.invalid/**", route => route.abort());
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto(`${origin}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator(`.post[data-post-id="${videoPostId}"]`).waitFor();
      await page.waitForTimeout(150);

      await page.locator("body").evaluate(body => body.classList.remove("danzstak-original"));
      await page.screenshot({ path: path.join(output, `before-feed-${width}.png`), fullPage: width >= 700 });
      await page.locator("body").evaluate(body => body.classList.add("danzstak-original"));

      const geometry = await page.evaluate(({ imagePostId, videoPostId }) => {
        const postGeometry = postId => {
          const post = document.querySelector(`.post[data-post-id="${postId}"]`);
          const media = post.querySelector(":scope > .feed-media-gallery, :scope > .danzstak-media-shell, :scope > .post-media");
          const p = post.getBoundingClientRect();
          const m = media.getBoundingClientRect();
          return { post: [p.left, p.right], media: [m.left, m.right], aligned: Math.abs(p.left - m.left) <= 1 && Math.abs(p.right - m.right) <= 1 };
        };
        const firstAction = document.querySelector(`.post[data-post-id="${imagePostId}"] .post-actions button`);
        firstAction.focus();
        const focus = getComputedStyle(firstAction);
        const menuRows = [...document.querySelectorAll(".left .menu a,.left .menu .menu-action")].map(row => ({
          label: row.textContent.trim(),
          className: row.className,
          height: row.getBoundingClientRect().height,
          minHeight: getComputedStyle(row).minHeight
        }));
        const composer = document.querySelector("#newsFeedView .post-composer")?.getBoundingClientRect();
        const root = getComputedStyle(document.documentElement);
        return {
          documentWidth: document.documentElement.scrollWidth,
          image: postGeometry(imagePostId),
          video: postGeometry(videoPostId),
          brand: root.getPropertyValue("--ds-brand").trim(),
          accent: root.getPropertyValue("--ds-accent").trim(),
          headerBorder: getComputedStyle(document.querySelector(".topbar")).borderBottomColor,
          focusWidth: parseFloat(focus.outlineWidth),
          focusStyle: focus.outlineStyle,
          menuTargets: menuRows,
          composerHeight: composer?.height || 0,
          bodyClass: document.body.classList.contains("danzstak-original")
        };
      }, { imagePostId, videoPostId });

      assert.equal(errors.length, 0, `${width}px Feed errors: ${errors.join(" | ")}`);
      assert.ok(geometry.bodyClass && geometry.documentWidth <= width, `${width}px Feed overflow or missing scope: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.brand, "#1769e0");
      assert.equal(geometry.accent, "#ef6c20");
      assert.equal(normalize(geometry.headerBorder), "rgb(239,108,32)");
      assert.ok(geometry.image.aligned, `${width}px direct image is inset: ${JSON.stringify(geometry.image)}`);
      assert.ok(geometry.video.aligned, `${width}px direct video is inset: ${JSON.stringify(geometry.video)}`);
      assert.ok(geometry.focusStyle !== "none" && geometry.focusWidth >= 3, `${width}px Feed action lacks a visible focus state`);
      assert.ok(geometry.menuTargets.every(row => row.height >= 44), `${width}px menu row below 44px: ${JSON.stringify(geometry.menuTargets.filter(row => row.height < 44))}`);
      if (width < 700) assert.ok(geometry.composerHeight <= 180, `${width}px composer is too tall: ${geometry.composerHeight}`);
      await page.screenshot({ path: path.join(output, `after-feed-${width}.png`), fullPage: width >= 700 });

      await page.goto(`${origin}/profile.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#profileContent:not([hidden])").waitFor();
      await page.locator(".profile-bio").waitFor();
      const profileGeometry = await page.evaluate(() => {
        const card = document.querySelector(".card").getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          inside: card.left >= 0 && card.right <= innerWidth + 1,
          surface: getComputedStyle(document.querySelector(".card")).backgroundColor,
          profileUsesFeedScope: document.body.classList.contains("danzstak-original")
        };
      });
      assert.ok(profileGeometry.documentWidth <= width && profileGeometry.inside, `${width}px Profile overflow: ${JSON.stringify(profileGeometry)}`);
      assert.equal(normalize(profileGeometry.surface), "rgb(255,255,255)");
      assert.equal(profileGeometry.profileUsesFeedScope, false, "Feed art direction must not leak into Profile");
      await page.screenshot({ path: path.join(output, `profile-${width}.png`), fullPage: width >= 700 });
      await context.close();
    }
    console.log(`Original Feed/Profile art-direction checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
