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
      mediaType: "video", mediaUrl: "https://media.example.invalid/danzstak-test.webm", viewCount: 18, commentPolicy: "everyone"
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

async function createPortraitVideo(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent('<canvas id="frame" width="360" height="640"></canvas>');
    const bytes = await page.evaluate(async () => {
      const canvas = document.querySelector("#frame");
      const paint = canvas.getContext("2d");
      const stream = canvas.captureStream(12);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      for (let frame = 0; frame < 10; frame += 1) {
        const gradient = paint.createLinearGradient(0, 0, 360, 640);
        gradient.addColorStop(0, "#07142b");
        gradient.addColorStop(1, "#1769e0");
        paint.fillStyle = gradient;
        paint.fillRect(0, 0, 360, 640);
        paint.fillStyle = "#ff7a1a";
        paint.fillRect(24, 54 + frame * 2, 312, 210);
        paint.fillStyle = "white";
        paint.font = "900 38px Arial";
        paint.textAlign = "center";
        paint.fillText("PORTRAIT VIDEO", 180, 350);
        paint.font = "700 22px Arial";
        paint.fillText("4:5 MIX PREVIEW", 180, 392);
        await new Promise(resolve => setTimeout(resolve, 24));
      }
      recorder.stop();
      await stopped;
      stream.getTracks().forEach(track => track.stop());
      return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
    });
    return Buffer.from(bytes);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const portraitVideo = await createPortraitVideo(browser);
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
      await page.route("https://media.example.invalid/**", route => route.fulfill({ status: 200, contentType: "video/webm", body: portraitVideo }));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto(`${origin}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator(`.post[data-post-id="${videoPostId}"]`).waitFor();
      await page.locator(".composer-media-tools").waitFor({ state: "attached" });
      await page.locator(`.post[data-post-id="${videoPostId}"] video`).evaluate(video => {
        video.preload = "metadata";
        video.load();
      });
      await page.waitForFunction(postId => {
        const video = document.querySelector(`.post[data-post-id="${postId}"] video`);
        return video?.videoWidth > 0 && video?.videoHeight > 0;
      }, videoPostId, { timeout: 30000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      await page.locator("body").evaluate(body => body.classList.remove("danzstak-original"));
      await page.screenshot({ path: path.join(output, `before-feed-${width}.png`), fullPage: width >= 700 });
      await page.locator("body").evaluate(body => body.classList.add("danzstak-original"));

      const geometry = await page.evaluate(({ imagePostId, videoPostId }) => {
        const postGeometry = postId => {
          const post = document.querySelector(`.post[data-post-id="${postId}"]`);
          const media = post.querySelector(":scope > .feed-media-gallery, :scope > .danzstak-media-shell, :scope > .post-media");
          const p = post.getBoundingClientRect();
          const m = media.getBoundingClientRect();
          const player = media.matches("video") ? media : media.querySelector("video");
          return {
            post: [p.left, p.right],
            media: [m.left, m.right],
            aligned: Math.abs(p.left - m.left) <= 1 && Math.abs(p.right - m.right) <= 1,
            ratio: m.width / m.height,
            fit: player ? getComputedStyle(player).objectFit : ""
          };
        };
        const firstPostTop = document.querySelector("#feed .post")?.getBoundingClientRect().top || 0;
        const menuRows = [...document.querySelectorAll(".left .menu a,.left .menu .menu-action")].map(row => ({
          label: row.textContent.trim(),
          className: row.className,
          height: row.getBoundingClientRect().height,
          minHeight: getComputedStyle(row).minHeight
        }));
        const composer = document.querySelector("#newsFeedView .post-composer")?.getBoundingClientRect();
        const dailyCard = document.querySelector("#storiesRail .story-create")?.getBoundingClientRect();
        const dailyPortrait = document.querySelector("#storiesRail .story-create-avatar")?.getBoundingClientRect();
        const dailyClapper = document.querySelector("#storiesRail .daily-clapper")?.getBoundingClientRect();
        const root = getComputedStyle(document.documentElement);
        return {
          documentWidth: document.documentElement.scrollWidth,
          image: postGeometry(imagePostId),
          video: postGeometry(videoPostId),
          brand: root.getPropertyValue("--ds-brand").trim(),
          accent: root.getPropertyValue("--ds-accent").trim(),
          headerBorder: getComputedStyle(document.querySelector(".topbar")).borderBottomColor,
          menuTargets: menuRows,
          composerHeight: composer?.height || 0,
          composerExpanded: document.querySelector("#postComposer")?.classList.contains("is-expanded") || false,
          composerTextHeight: document.querySelector("#postText")?.getBoundingClientRect().height || 0,
          dailyPortrait: dailyCard && dailyPortrait ? {
            card: [dailyCard.left, dailyCard.top, dailyCard.right, dailyCard.bottom],
            portrait: [dailyPortrait.left, dailyPortrait.top, dailyPortrait.right, dailyPortrait.bottom],
            dominatesCard: dailyPortrait.width >= dailyCard.width * .88
              && dailyPortrait.height >= dailyCard.height * .88,
            radius: getComputedStyle(document.querySelector("#storiesRail .story-create-avatar")).borderRadius,
            clapperInside: dailyClapper
              ? dailyClapper.left >= dailyCard.left && dailyClapper.bottom <= dailyCard.bottom
              : false,
            backgroundSize: getComputedStyle(document.querySelector("#storiesRail .story-create-avatar")).backgroundSize
          } : null,
          firstPostTop,
          bodyClass: document.body.classList.contains("danzstak-original")
        };
      }, { imagePostId, videoPostId });

      assert.equal(errors.length, 0, `${width}px Feed errors: ${errors.join(" | ")}`);
      assert.ok(geometry.bodyClass && geometry.documentWidth <= width, `${width}px Feed overflow or missing scope: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.brand, "#1769e0");
      assert.equal(geometry.accent, "#ef6c20");
      assert.equal(normalize(geometry.headerBorder), "rgb(239,108,32)");
      assert.ok(geometry.dailyPortrait?.dominatesCard, `${width}px Dailies portrait is too small for its tile: ${JSON.stringify(geometry.dailyPortrait)}`);
      assert.equal(geometry.dailyPortrait.radius, "50%", `${width}px Dailies portrait does not match the profile avatar`);
      assert.equal(geometry.dailyPortrait.backgroundSize, "cover", `${width}px Dailies portrait is not cropped to fill the tile`);
      assert.equal(geometry.dailyPortrait.clapperInside, true, `${width}px Dailies clapper is not contained in the lower-left of the image`);
      assert.ok(geometry.image.aligned, `${width}px direct image is inset: ${JSON.stringify(geometry.image)}`);
      assert.ok(geometry.video.aligned, `${width}px direct video is inset: ${JSON.stringify(geometry.video)}`);
      if (width < 700) {
        assert.ok(Math.abs(geometry.video.ratio - .8) <= .02, `${width}px portrait Mix preview is not 4:5: ${JSON.stringify(geometry.video)}`);
        assert.equal(geometry.video.fit, "cover", `${width}px portrait Mix preview does not fill its frame`);
      } else {
        assert.ok(Math.abs(geometry.video.ratio - 9 / 16) <= .02, `${width}px desktop portrait source ratio was not preserved`);
        assert.equal(geometry.video.fit, "contain", `${width}px desktop portrait video must remain contained`);
      }
      assert.ok(geometry.menuTargets.every(row => row.height >= 44), `${width}px menu row below 44px: ${JSON.stringify(geometry.menuTargets.filter(row => row.height < 44))}`);
      if (width < 700) assert.ok(geometry.composerHeight <= 180, `${width}px composer is too tall: ${geometry.composerHeight}`);
      if (width >= 700) {
        assert.ok(!geometry.composerExpanded && geometry.composerHeight <= 100 && geometry.composerTextHeight <= 48, `${width}px initial desktop composer is not compact: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.firstPostTop > 0 && geometry.firstPostTop < 900, `${width}px first post is outside the initial viewport: ${geometry.firstPostTop}`);
      }
      await page.screenshot({ path: path.join(output, `after-feed-${width}.png`), fullPage: width >= 700 });

      if (width < 700) {
        await page.evaluate(videoPostId => {
          const post = document.querySelector(`.post[data-post-id="${videoPostId}"]`);
          const headerHeight = document.querySelector(".topbar")?.getBoundingClientRect().height || 0;
          scrollTo(0, Math.max(0, post.offsetTop - headerHeight));
        }, videoPostId);
        await page.waitForTimeout(80);
        const composition = await page.evaluate(videoPostId => {
          const post = document.querySelector(`.post[data-post-id="${videoPostId}"]`);
          const header = post.querySelector(".post-header").getBoundingClientRect();
          const media = post.querySelector(":scope > .danzstak-media-shell").getBoundingClientRect();
          const actions = post.querySelector(".post-actions").getBoundingClientRect();
          const appHeader = document.querySelector(".topbar").getBoundingClientRect();
          const navigation = document.querySelector(".topnav").getBoundingClientRect();
          return {
            headerBelowApp: header.top >= appHeader.bottom - 1,
            actionsAboveNavigation: actions.bottom <= navigation.top + 1,
            mediaRatio: media.width / media.height,
            postVisibleHeight: Math.min(innerHeight, actions.bottom) - Math.max(0, header.top),
            headerTop: header.top,
            appHeaderBottom: appHeader.bottom,
            actionsBottom: actions.bottom,
            navigationTop: navigation.top
          };
        }, videoPostId);
        assert.equal(composition.headerBelowApp, true, `${width}px video author is hidden behind the app header`);
        assert.equal(composition.actionsAboveNavigation, true, `${width}px video reactions are hidden by the bottom navigation: ${JSON.stringify(composition)}`);
        assert.ok(Math.abs(composition.mediaRatio - .8) <= .02, `${width}px real Mix post lost its 4:5 preview`);
        assert.ok(composition.postVisibleHeight > 0, `${width}px video post is outside the usable viewport`);
        await page.screenshot({ path: path.join(output, `video-post-${width}.png`) });
      }

      const firstAction = page.locator(`.post[data-post-id="${imagePostId}"] .post-actions button`).first();
      await firstAction.focus();
      const focus = await firstAction.evaluate(element => ({ width: parseFloat(getComputedStyle(element).outlineWidth), style: getComputedStyle(element).outlineStyle }));
      assert.ok(focus.style !== "none" && focus.width >= 3, `${width}px Feed action lacks a visible focus state`);

      if (width >= 700) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator("#postText").focus();
        await page.locator("#postText").fill("Draft preserved while the composer expands.");
        await page.locator("#storiesRail").click({ position: { x: 2, y: 2 } });
        const expandedDraft = await page.evaluate(() => ({ expanded: document.querySelector("#postComposer").classList.contains("is-expanded"), value: document.querySelector("#postText").value }));
        assert.deepEqual(expandedDraft, { expanded: true, value: "Draft preserved while the composer expands." }, "desktop composer must expand on focus and preserve the draft");
      }

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
      assert.equal(normalize(profileGeometry.surface), "rgba(0,0,0,0)", "Profile must keep the shared fluid canvas instead of restoring a white container box");
      assert.equal(profileGeometry.profileUsesFeedScope, false, "Feed art direction must not leak into Profile");
      await page.screenshot({ path: path.join(output, `profile-${width}.png`), fullPage: width >= 700 });
      await context.close();
    }
    console.log(`Original Feed/Profile art-direction checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
