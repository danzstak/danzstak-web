"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_FEED_ORIGIN || "http://127.0.0.1:8024";
const credentials = process.env.DANZSTAK_PREVIEW_USER && process.env.DANZSTAK_PREVIEW_PASSWORD
  ? { username: process.env.DANZSTAK_PREVIEW_USER, password: process.env.DANZSTAK_PREVIEW_PASSWORD }
  : null;
const widths = [320, 360, 375, 390, 414, 430, 1366];
const ownerId = "11111111-1111-4111-8111-111111111111";
const imagePostId = "33333333-3333-4333-8333-333333333333";
const videoPostId = "44444444-4444-4444-8444-444444444444";
const output = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/issue-60-feed-art-direction");
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
  picture: `${origin}/__test-profile-portrait.svg`,
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
      const consoleErrors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
      await page.route(`${origin}/__test-profile-portrait.svg`, route => route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#ff7a1a"/><stop offset="1" stop-color="#1769e0"/></linearGradient></defs><rect width="360" height="360" fill="url(#bg)"/><circle cx="180" cy="126" r="72" fill="#f4c8a4"/><path d="M95 132c4-88 166-103 173 3-29-28-48-53-78-60-29 32-60 50-95 57Z" fill="#2a1c19"/><circle cx="154" cy="126" r="7" fill="#1a2230"/><circle cx="207" cy="126" r="7" fill="#1a2230"/><path d="M151 164c22 17 44 17 64 0" fill="none" stroke="#874c3e" stroke-width="8" stroke-linecap="round"/><path d="M48 360c10-103 58-154 132-154s122 51 132 154" fill="#101722"/><path d="M126 218l54 54 54-54" fill="#fff" opacity=".9"/></svg>`
      }));
      await page.route("https://media.example.invalid/**", route => route.fulfill({ status: 200, contentType: "video/webm", body: portraitVideo }));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto(`${origin}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      try {
        await page.locator(`.post[data-post-id="${videoPostId}"]`).waitFor();
      } catch (error) {
        const feedState = await page.evaluate(() => ({
          status: document.querySelector("#feedStatus")?.textContent?.trim() || "",
          posts: [...document.querySelectorAll("#feed > .post")].map(post => post.dataset.postId || post.className)
        }));
        throw new Error(`${error.message}\nFeed state: ${JSON.stringify(feedState)}\nPage errors: ${errors.join(" | ")}\nConsole errors: ${consoleErrors.join(" | ")}`);
      }
      await page.locator(".composer-media-tools").waitFor({ state: "attached" });
      await page.locator("#storiesRail img.story-create-avatar-image").waitFor();
      await page.waitForFunction(() => {
        const image = document.querySelector("#storiesRail img.story-create-avatar-image");
        return image?.complete && image.naturalWidth > 0;
      });
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
      await page.waitForFunction(expectedGap => {
        const feed = document.querySelector("#feed");
        const post = feed?.querySelector(":scope > .post");
        return feed && post
          && Math.abs(parseFloat(getComputedStyle(feed).rowGap) - expectedGap) <= 1
          && parseFloat(getComputedStyle(post).marginBottom) <= 1;
      }, width <= 375 ? 12 : 16);

      const geometry = await page.evaluate(({ imagePostId, videoPostId }) => {
        const postGeometry = postId => {
          const post = document.querySelector(`.post[data-post-id="${postId}"]`);
          const media = post.querySelector(":scope > .feed-media-gallery, :scope > .danzstak-media-shell, :scope > .post-media");
          const p = post.getBoundingClientRect();
          const m = media.getBoundingClientRect();
          const player = media.matches("video") ? media : media.querySelector("video");
          const authorStyle = getComputedStyle(post.querySelector(".post-author"));
          const timeStyle = getComputedStyle(post.querySelector(".post-time"));
          const contentStyle = getComputedStyle(post.querySelector(".post-content"));
          return {
            post: [p.left, p.right],
            media: [m.left, m.right],
            aligned: Math.abs(p.left - m.left) <= 1 && Math.abs(p.right - m.right) <= 1,
            ratio: m.width / m.height,
            fit: player ? getComputedStyle(player).objectFit : getComputedStyle(media).objectFit,
            type: {
              author: [authorStyle.fontSize, authorStyle.fontWeight, authorStyle.lineHeight],
              time: [timeStyle.fontSize, timeStyle.fontWeight, timeStyle.lineHeight],
              content: [contentStyle.fontSize, contentStyle.fontWeight, contentStyle.lineHeight]
            }
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
        const dailyPortraitElement = document.querySelector("#storiesRail .story-create-avatar");
        const dailyClapper = document.querySelector("#storiesRail .daily-clapper")?.getBoundingClientRect();
        const center = document.querySelector("#yourMixMain")?.getBoundingClientRect();
        const feedPosts = [...document.querySelectorAll("#feed > .post")];
        const firstFeedPost = feedPosts[0];
        const firstFeedRect = firstFeedPost?.getBoundingClientRect();
        const secondFeedRect = feedPosts[1]?.getBoundingClientRect();
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
          centerWidth: center?.width || 0,
          feedGap: firstFeedRect && secondFeedRect ? secondFeedRect.top - firstFeedRect.bottom : 0,
          feedRowGap: document.querySelector("#feed") ? getComputedStyle(document.querySelector("#feed")).rowGap : "",
          firstPostMarginBottom: firstFeedPost ? getComputedStyle(firstFeedPost).marginBottom : "",
          secondPostMarginTop: feedPosts[1] ? getComputedStyle(feedPosts[1]).marginTop : "",
          postPadding: firstFeedPost ? parseFloat(getComputedStyle(firstFeedPost).paddingLeft) : 0,
          dailyPortrait: dailyCard && dailyPortrait ? {
            card: [dailyCard.left, dailyCard.top, dailyCard.right, dailyCard.bottom],
            portrait: [dailyPortrait.left, dailyPortrait.top, dailyPortrait.right, dailyPortrait.bottom],
            dominatesCard: dailyPortrait.width >= dailyCard.width * .88
              && dailyPortrait.height >= dailyCard.height * .88,
            fillsCard: Math.abs(dailyPortrait.left - dailyCard.left) <= 1
              && Math.abs(dailyPortrait.top - dailyCard.top) <= 1
              && Math.abs(dailyPortrait.right - dailyCard.right) <= 1
              && Math.abs(dailyPortrait.bottom - dailyCard.bottom) <= 1,
            radius: getComputedStyle(document.querySelector("#storiesRail .story-create-avatar")).borderRadius,
            isImage: dailyPortraitElement?.tagName === "IMG",
            imageLoaded: dailyPortraitElement?.tagName === "IMG" ? dailyPortraitElement.complete && dailyPortraitElement.naturalWidth > 0 : false,
            objectFit: getComputedStyle(dailyPortraitElement).objectFit,
            clapperInside: dailyClapper
              ? dailyClapper.left >= dailyCard.left && dailyClapper.bottom <= dailyCard.bottom
              : false,
            clapperOverPortrait: dailyClapper
              ? dailyClapper.left >= dailyPortrait.left && dailyClapper.right <= dailyPortrait.right
                && dailyClapper.top >= dailyPortrait.top && dailyClapper.bottom <= dailyPortrait.bottom
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
      assert.equal(geometry.dailyPortrait.fillsCard, true, `${width}px Dailies image does not fill the complete container`);
      assert.equal(geometry.dailyPortrait.radius, "18px", `${width}px Dailies image must use the tile corners instead of an inset circle`);
      assert.equal(geometry.dailyPortrait.isImage, true, `${width}px Dailies must render the signed-in member's profile picture as an image`);
      assert.equal(geometry.dailyPortrait.imageLoaded, true, `${width}px Dailies profile picture did not load`);
      assert.equal(geometry.dailyPortrait.objectFit, "cover", `${width}px Dailies profile picture does not fill the tile`);
      assert.equal(geometry.dailyPortrait.backgroundSize, "cover", `${width}px Dailies portrait is not cropped to fill the tile`);
      assert.equal(geometry.dailyPortrait.clapperInside, true, `${width}px Dailies clapper is not contained in the lower-left of the image`);
      assert.equal(geometry.dailyPortrait.clapperOverPortrait, true, `${width}px Dailies clapper is beside the portrait instead of over it`);
      const expectedGap = width <= 375 ? 12 : 16;
      assert.ok(Math.abs(geometry.feedGap - expectedGap) <= 1, `${width}px feed post gap is not ${expectedGap}px: ${geometry.feedGap}; computed ${geometry.feedRowGap}; margins ${geometry.firstPostMarginBottom}/${geometry.secondPostMarginTop}`);
      assert.ok(geometry.image.aligned, `${width}px direct image is inset: ${JSON.stringify(geometry.image)}`);
      assert.ok(geometry.video.aligned, `${width}px direct video is inset: ${JSON.stringify(geometry.video)}`);
      assert.deepEqual(geometry.image.type.author, ["15px", "600", "20px"], `${width}px post author typography drifted`);
      assert.deepEqual(geometry.image.type.time, ["13px", "400", "16px"], `${width}px post metadata typography drifted`);
      assert.deepEqual(geometry.image.type.content, ["15px", "400", "21px"], `${width}px post body typography drifted`);
      if (width < 700) {
        assert.ok(Math.abs(geometry.image.post[0]) <= 1 && Math.abs(geometry.image.post[1] - width) <= 1, `${width}px image post is not viewport-wide: ${JSON.stringify(geometry.image)}`);
        assert.ok(Math.abs(geometry.image.media[0]) <= 1 && Math.abs(geometry.image.media[1] - width) <= 1, `${width}px image media is not exactly 100vw: ${JSON.stringify(geometry.image)}`);
        assert.ok(Math.abs(geometry.video.post[0]) <= 1 && Math.abs(geometry.video.post[1] - width) <= 1, `${width}px video post is not viewport-wide: ${JSON.stringify(geometry.video)}`);
        assert.ok(Math.abs(geometry.video.media[0]) <= 1 && Math.abs(geometry.video.media[1] - width) <= 1, `${width}px video media is not exactly 100vw: ${JSON.stringify(geometry.video)}`);
        assert.ok(Math.abs(geometry.image.ratio - .8) <= .02, `${width}px image preview is not 4:5: ${JSON.stringify(geometry.image)}`);
        assert.equal(geometry.image.fit, "cover", `${width}px image preview does not fill its 4:5 frame`);
        assert.ok(Math.abs(geometry.video.ratio - .8) <= .02, `${width}px portrait Mix preview is not 4:5: ${JSON.stringify(geometry.video)}`);
        assert.equal(geometry.video.fit, "cover", `${width}px portrait Mix preview does not fill its frame`);
      } else {
        assert.ok(Math.abs(geometry.video.ratio - 9 / 16) <= .02, `${width}px desktop portrait source ratio was not preserved`);
        assert.equal(geometry.video.fit, "contain", `${width}px desktop portrait video must remain contained`);
      }
      assert.ok(geometry.menuTargets.every(row => row.height >= 44), `${width}px menu row below 44px: ${JSON.stringify(geometry.menuTargets.filter(row => row.height < 44))}`);
      if (width < 700) {
        assert.ok(geometry.composerHeight <= 180, `${width}px composer is too tall: ${geometry.composerHeight}`);
        assert.ok(Math.abs(geometry.postPadding - 12) <= 1, `${width}px post padding is not 12px: ${geometry.postPadding}`);
      }
      if (width >= 700) {
        assert.ok(geometry.centerWidth >= 470 && geometry.centerWidth <= 500, `${width}px desktop feed width is outside 470–500px: ${geometry.centerWidth}`);
        assert.ok(Math.abs(geometry.postPadding - 14) <= 1, `${width}px desktop post padding is not 14px: ${geometry.postPadding}`);
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
        await page.evaluate(videoPostId => {
          const actions = document.querySelector(`.post[data-post-id="${videoPostId}"] .post-actions`)?.getBoundingClientRect();
          const navigation = document.querySelector(".topnav")?.getBoundingClientRect();
          if (actions && navigation && actions.bottom > navigation.top) scrollBy(0, actions.bottom - navigation.top + 1);
        }, videoPostId);
        await page.waitForTimeout(40);
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
