"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_PROFILE_ORIGIN || "http://127.0.0.1:8024";
const output = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/pwa-v794-profile-post-contract");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const ownerId = "11111111-1111-4111-8111-111111111111";
const firstPostId = "33333333-3333-4333-8333-333333333333";
fs.mkdirSync(output, { recursive: true });

const profile = {
  memberId: ownerId,
  name: "Eroticon",
  handle: "eroticon",
  username: "eroticon",
  bio: "Independent electronic punk from San Francisco.",
  location: "San Francisco, California",
  work: "Artist · Producer · Live act",
  website: "https://danzstak.com",
  picture: `${origin}/__test-profile-portrait.svg`,
  cover: `${origin}/assets/danzstak-share-fb-v2.jpg`,
  isOwner: true,
  cloudProfile: true
};

const posts = [
  {
    postId: firstPostId,
    userId: ownerId,
    authorName: profile.name,
    authorPicture: profile.picture,
    content: "Profile posts keep familiar spacing while DanzStak keeps the artist in control.",
    createdAt: "2026-11-10T18:30:00.000Z",
    audience: "public",
    isOwner: true,
    mediaType: "image",
    mediaUrl: `${origin}/assets/danzstak-share-fb-v2.jpg`,
    viewCount: 42
  },
  {
    postId: "44444444-4444-4444-8444-444444444444",
    userId: ownerId,
    authorName: profile.name,
    authorPicture: profile.picture,
    content: "The second post proves the gray eight-pixel feed gap.",
    createdAt: "2026-11-10T17:30:00.000Z",
    audience: "public",
    isOwner: true,
    mediaType: "image",
    mediaUrl: `${origin}/assets/danzstak-share-fb-v2.jpg`,
    viewCount: 18
  }
];

function fixture(url) {
  switch (url.pathname) {
    case "/auth/session": return { authenticated: true, user: { sub: ownerId, email: "artist@danzstak.invalid" } };
    case "/profiles": return { profile };
    case "/secure-posts": return { posts };
    case "/profile-friends": return { friends: [] };
    case "/profile-video": return { video: null };
    case "/settings/presence": return { visible: true };
    default: return {};
  }
}

function normalized(value) { return String(value || "").replace(/\s+/g, ""); }

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: width < 700 ? 844 : 900 },
        serviceWorkers: "block",
        reducedMotion: "reduce"
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${origin}/__test-profile-portrait.svg`, route => route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><rect width="360" height="360" fill="#1769e0"/><circle cx="180" cy="150" r="80" fill="#f4c8a4"/><path d="M55 360c20-105 70-150 125-150s105 45 125 150" fill="#101722"/></svg>'
      }));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture(new URL(route.request().url())))
      }));
      await page.goto(`${origin}/profile.html#posts`, { waitUntil: "domcontentloaded" });
      const post = page.locator(`.profile-post-card[data-post-id="${firstPostId}"]`);
      try {
        await post.locator(".profile-post-header").waitFor();
      } catch (error) {
        const state = await page.evaluate(() => ({
          status: document.querySelector("#profileStatus")?.textContent?.trim() || "",
          tab: document.querySelector(".profile-tab-message")?.innerHTML || "",
          matches: [...document.querySelectorAll(".profile-post-card")].map(node => node.outerHTML.slice(0, 900))
        }));
        throw new Error(`${error.message}\nProfile state: ${JSON.stringify(state)}\nPage errors: ${errors.join(" | ")}`);
      }
      await post.locator(".profile-post-media").waitFor();
      await post.locator(".profile-post-tools").waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      const geometry = await post.evaluate((node, mobile) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const header = node.querySelector(".profile-post-header");
        const headerStyle = getComputedStyle(header);
        const avatar = node.querySelector(".profile-post-avatar").getBoundingClientRect();
        const media = node.querySelector(".profile-post-media");
        const mediaRect = media.getBoundingClientRect();
        const mediaStyle = getComputedStyle(media);
        const tools = node.querySelector(".profile-post-tools");
        const toolsStyle = getComputedStyle(tools);
        const toolRects = [...tools.children].map(element => element.getBoundingClientRect());
        const next = node.nextElementSibling?.matches(".profile-post-card") ? node.nextElementSibling.getBoundingClientRect() : null;
        return {
          mobile,
          documentWidth: document.documentElement.scrollWidth,
          canvas: getComputedStyle(document.body).backgroundColor,
          profileCardOverflow: getComputedStyle(document.querySelector(".card")).overflow,
          edges: [rect.left, rect.right],
          background: style.backgroundColor,
          radius: style.borderRadius,
          shadow: style.boxShadow,
          padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
          gap: next ? next.top - rect.bottom : null,
          avatar: [avatar.width, avatar.height],
          headerGap: headerStyle.gap,
          mediaEdges: [mediaRect.left, mediaRect.right],
          mediaMarginTop: mediaStyle.marginTop,
          toolsMarginTop: toolsStyle.marginTop,
          toolsBorder: [toolsStyle.borderTopWidth, toolsStyle.borderTopStyle, toolsStyle.borderTopColor],
          toolsOneRow: toolRects.length < 2 || toolRects.every(tool => Math.abs(tool.top - toolRects[0].top) <= 1),
          toolsMeetTarget: toolRects.every(tool => tool.height >= 44)
        };
      }, width < 560);

      assert.equal(errors.length, 0, `${width}px Profile errors: ${errors.join(" | ")}`);
      assert.ok(geometry.documentWidth <= width, `${width}px Profile has horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.ok(Math.abs(geometry.mediaEdges[0] - geometry.edges[0]) <= 1 && Math.abs(geometry.mediaEdges[1] - geometry.edges[1]) <= 1, `${width}px Profile media is inset: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.toolsOneRow && geometry.toolsMeetTarget, `${width}px Profile actions are not one accessible row: ${JSON.stringify(geometry)}`);
      if (width < 560) {
        assert.ok(Math.abs(geometry.edges[0]) <= 1 && Math.abs(geometry.edges[1] - width) <= 1, `${width}px Profile post is not viewport-wide: ${JSON.stringify(geometry)}`);
        assert.equal(normalized(geometry.canvas), "rgb(240,242,245)");
        assert.equal(geometry.profileCardOverflow, "visible", `${width}px Profile shell clips edge-to-edge posts`);
        assert.equal(normalized(geometry.background), "rgb(255,255,255)");
        assert.equal(geometry.radius, "0px");
        assert.equal(geometry.shadow, "none");
        assert.deepEqual(geometry.padding, ["12px", "16px", "12px", "16px"]);
        assert.deepEqual(geometry.avatar, [40, 40]);
        assert.equal(geometry.headerGap, "12px");
        assert.equal(geometry.mediaMarginTop, "12px");
        assert.equal(geometry.toolsMarginTop, "12px");
        assert.deepEqual(geometry.toolsBorder.map(normalized), ["1px", "solid", "rgb(206,208,212)"]);
        assert.ok(geometry.gap !== null && Math.abs(geometry.gap - 8) <= 1, `${width}px Profile post gap is not 8px: ${geometry.gap}`);
      }
      await page.screenshot({ path: path.join(output, `profile-${width}.png`), fullPage: width >= 700 });
      if (width < 560) {
        await post.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `profile-post-${width}.png`) });
      }
      await context.close();
    }
    console.log(`Profile post layout checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
