"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_DESIGN_ORIGIN || "http://127.0.0.1:8022";
const widths = [320, 390, 430, 1366];
const ownerId = "11111111-1111-4111-8111-111111111111";
const postId = "33333333-3333-4333-8333-333333333333";
const output = path.resolve("docs/screenshots/issue-55-foundation");
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
  if (route === "/secure-posts") return { posts: [{
    postId, userId: ownerId, authorName: profile.name, authorPicture: profile.picture,
    content: "West Coast dates are coming together. New live set, real clubs, no fake listings.",
    createdAt: "2026-11-05T18:30:00.000Z", audience: "public", isOwner: true,
    mediaType: "image", mediaUrl: `${origin}/assets/danzstak-share-fb-v2.jpg`, viewCount: 42, commentPolicy: "everyone"
  }] };
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

function color(value) { return String(value || "").replace(/\s+/g, ""); }

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const height = width < 700 ? 844 : 900;
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));

      await page.goto(`${origin}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator(`.post[data-post-id="${postId}"]`).waitFor();
      await page.waitForTimeout(120);
      const feed = await page.evaluate(postId => {
        const root = getComputedStyle(document.documentElement);
        const post = document.querySelector(`.post[data-post-id="${postId}"]`);
        const media = post.querySelector(":scope > .feed-media-gallery, :scope > .danzstak-media-shell, :scope > .post-media");
        const postRect = post.getBoundingClientRect();
        const mediaRect = media.getBoundingClientRect();
        const navButtons = [...document.querySelectorAll(".topnav button")];
        return {
          documentWidth: document.documentElement.scrollWidth,
          brand: root.getPropertyValue("--ds-brand").trim(),
          accent: root.getPropertyValue("--ds-accent").trim(),
          surface: root.getPropertyValue("--ds-surface").trim(),
          bodyFont: getComputedStyle(document.body).fontFamily,
          headerBorder: getComputedStyle(document.querySelector(".topbar")).borderBottomColor,
          postBackground: getComputedStyle(post).backgroundColor,
          postRadius: parseFloat(getComputedStyle(post).borderRadius),
          postEdges: [postRect.left, postRect.right],
          mediaEdges: [mediaRect.left, mediaRect.right],
          mediaClass: media.className,
          mediaAligned: Math.abs(mediaRect.left - postRect.left) <= 1 && Math.abs(mediaRect.right - postRect.right) <= 1,
          mobileTargets: innerWidth > 700 || navButtons.every(button => button.getBoundingClientRect().height >= 44)
        };
      }, postId);
      assert.equal(errors.length, 0, `${width}px Feed errors: ${errors.join(" | ")}`);
      assert.ok(feed.documentWidth <= width, `${width}px Feed overflow: ${JSON.stringify(feed)}`);
      assert.equal(feed.brand, "#1769e0");
      assert.equal(feed.accent, "#ef6c20");
      assert.match(feed.bodyFont, /Segoe UI|Inter|Arial/i);
      assert.equal(color(feed.headerBorder), "rgb(239,108,32)");
      assert.equal(color(feed.postBackground), "rgb(255,255,255)");
      assert.ok(feed.postRadius >= 10 && feed.mediaAligned && feed.mobileTargets, `${width}px Feed foundation geometry failed: ${JSON.stringify(feed)}`);
      const feedCapture = path.join(output, `feed-${width}.png`);
      if (!fs.existsSync(feedCapture)) await page.screenshot({ path: feedCapture, fullPage: width >= 700 });

      await page.goto(`${origin}/profile.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#profileContent:not([hidden])").waitFor();
      await page.locator(".profile-bio").waitFor();
      await page.waitForTimeout(120);
      const profileGeometry = await page.evaluate(() => {
        const card = document.querySelector(".card").getBoundingClientRect();
        const cover = document.querySelector(".cover");
        const avatar = document.querySelector(".avatar").getBoundingClientRect();
        const name = document.querySelector("#profileName").getBoundingClientRect();
        const details = [...document.querySelectorAll(".detail:not([hidden])")];
        return {
          documentWidth: document.documentElement.scrollWidth,
          cardInside: card.left >= 0 && card.right <= innerWidth + 1,
          coverPhoto: cover.classList.contains("has-photo"),
          coverHeight: cover.getBoundingClientRect().height,
          avatarOverlapsCover: avatar.top < cover.getBoundingClientRect().bottom && avatar.bottom > cover.getBoundingClientRect().bottom,
          nameLeft: name.left,
          bioLeft: document.querySelector(".profile-bio").getBoundingClientRect().left,
          nameAligned: Math.abs(name.left - document.querySelector(".profile-bio").getBoundingClientRect().left) <= 1,
          detailCount: details.length,
          detailBackgrounds: details.map(item => getComputedStyle(item).backgroundColor),
          bottomNavVisible: innerWidth > 700 || getComputedStyle(document.querySelector(".ds-mobile-nav")).display !== "none"
        };
      });
      assert.equal(errors.length, 0, `${width}px Profile errors: ${errors.join(" | ")}`);
      assert.ok(profileGeometry.documentWidth <= width && profileGeometry.cardInside, `${width}px Profile overflow: ${JSON.stringify(profileGeometry)}`);
      assert.ok(profileGeometry.coverPhoto && profileGeometry.avatarOverlapsCover, `${width}px real profile media is not integrated: ${JSON.stringify(profileGeometry)}`);
      assert.ok(profileGeometry.nameAligned && profileGeometry.detailCount >= 3 && profileGeometry.bottomNavVisible, `${width}px Profile hierarchy failed: ${JSON.stringify(profileGeometry)}`);
      assert.ok(profileGeometry.detailBackgrounds.every(value => color(value) === "rgb(246,248,251)"), `${width}px Profile details do not use the shared surface token`);
      const profileCapture = path.join(output, `profile-${width}.png`);
      if (!fs.existsSync(profileCapture)) await page.screenshot({ path: profileCapture, fullPage: width >= 700 });
      await context.close();
    }
    console.log(`Shared Feed/Profile design-system checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
