"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_PROFILE_ORIGIN || "http://127.0.0.1:8035";
const output = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/pwa-v795-profile-interactions");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const ownerId = "11111111-1111-4111-8111-111111111111";
const postId = "33333333-3333-4333-8333-333333333333";
const commentId = "55555555-5555-4555-8555-555555555555";
fs.mkdirSync(output, { recursive: true });

const profile = {
  memberId: ownerId,
  name: "Eroticon",
  handle: "eroticon",
  bio: "Independent electronic punk from San Francisco.",
  location: "San Francisco, California",
  work: "Artist · Producer · Live act",
  website: "https://danzstak.com",
  picture: `${origin}/__test-profile-portrait.svg`,
  cover: `${origin}/assets/danzstak-share-fb-v2.jpg`,
  isOwner: true,
  cloudProfile: true,
  canPostToProfile: true,
  profilePostPermission: "owner"
};

const posts = [{
  postId,
  userId: ownerId,
  authorName: profile.name,
  authorPicture: profile.picture,
  content: "This profile post proves that familiar interactions are connected to DanzStak.",
  createdAt: "2026-11-10T18:30:00.000Z",
  audience: "public",
  isOwner: true,
  mediaType: "image",
  mediaUrl: `${origin}/assets/danzstak-share-fb-v2.jpg`,
  viewCount: 42
}];

const engagement = {
  reactionCounts: { Like: 2, Fire: 1 },
  myReaction: "",
  comments: [
    {
      commentId,
      authorMemberId: "22222222-2222-4222-8222-222222222222",
      authorName: "Venue Booker",
      authorPicture: "",
      content: "This press photo looks strong.",
      createdAt: "2026-11-10T19:00:00.000Z",
      reactionCounts: { Like: 1 },
      reactionTotal: 1,
      canDelete: false
    },
    {
      commentId: "66666666-6666-4666-8666-666666666666",
      parentCommentId: commentId,
      replyToName: "Venue Booker",
      authorMemberId: ownerId,
      authorName: "Eroticon",
      authorPicture: profile.picture,
      content: "Thank you — the EPK is ready too.",
      createdAt: "2026-11-10T19:05:00.000Z",
      reactionCounts: {},
      reactionTotal: 0,
      canDelete: true
    }
  ]
};

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 900 : 950 }, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      const reactionWrites = [];
      const commentWrites = [];
      const postWrites = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${origin}/__test-profile-portrait.svg`, route => route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><rect width="360" height="360" fill="#1769e0"/><circle cx="180" cy="150" r="80" fill="#f4c8a4"/><path d="M55 360c20-105 70-150 125-150s105 45 125 150" fill="#101722"/></svg>'
      }));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        let body = {};
        let status = 200;
        if (url.pathname === "/auth/session") body = { authenticated: true, user: { sub: ownerId, email: "artist@danzstak.invalid" } };
        else if (url.pathname === "/profiles") body = { profile };
        else if (url.pathname === "/secure-posts" && method === "GET") body = { posts };
        else if (url.pathname === "/secure-posts" && method === "POST") { postWrites.push(request.postDataJSON()); body = { post: posts[0] }; }
        else if (url.pathname === "/engagement") body = engagement;
        else if (url.pathname === "/reactions" && method === "POST") { reactionWrites.push(request.postDataJSON()); body = { ok: true }; }
        else if (url.pathname === "/comments" && method === "POST") {
          const submitted = request.postDataJSON();
          commentWrites.push(submitted);
          body = { comment: { ...engagement.comments[0], commentId: crypto.randomUUID(), content: submitted.content, parentCommentId: submitted.parentCommentId || "" } };
        }
        else if (url.pathname === "/groups") body = { groups: [] };
        else if (url.pathname === "/groups/membership") body = { groupIds: [] };
        else if (url.pathname === "/marketplace/shop") { status = 404; body = { error: "No shop" }; }
        else if (url.pathname === "/profile-video") { status = 404; body = {}; }
        else body = {};
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      });

      await page.goto(`${origin}/profile.html#posts`, { waitUntil: "domcontentloaded" });
      const card = page.locator(`.profile-post-card[data-post-id="${postId}"]`);
      await card.locator(".profile-post-engagement").waitFor();
      await card.locator(".profile-comment-reply").waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      const geometry = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
        const tabs = rect(".profile-tabs");
        const composer = rect(".profile-wall-composer");
        const createAvatar = rect(".profile-create-avatar");
        const createInput = rect(".profile-create-opener");
        const shortcuts = rect(".profile-create-shortcuts");
        const counters = rect(".profile-post-counters");
        const actions = rect(".profile-post-actions");
        const rootAvatar = rect(".profile-comment-avatar-standard");
        const replyAvatar = rect(".profile-comment-avatar-reply");
        const root = rect(".profile-comment:not(.profile-comment-reply)");
        const reply = rect(".profile-comment-reply");
        const bubbleStyle = getComputedStyle(document.querySelector(".profile-comment-bubble"));
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          tabs: tabs && { height: tabs.height, labels: [...document.querySelectorAll(".profile-tabs button")].map(button => button.textContent.trim()) },
          composerMargins: composer && [getComputedStyle(document.querySelector(".profile-wall-composer")).marginTop, getComputedStyle(document.querySelector(".profile-wall-composer")).marginBottom],
          createAvatar: createAvatar && [createAvatar.width, createAvatar.height],
          createInput: createInput && [createInput.height, getComputedStyle(document.querySelector(".profile-create-opener")).borderRadius],
          shortcutsHeight: shortcuts?.height,
          shortcutLabels: [...document.querySelectorAll(".profile-create-shortcut")].map(item => item.textContent.trim()),
          countersHeight: counters?.height,
          actionsHeight: actions?.height,
          actionTargets: [...document.querySelectorAll(".profile-post-actions button")].map(button => button.getBoundingClientRect().height),
          rootAvatar: rootAvatar && [rootAvatar.width, rootAvatar.height],
          replyAvatar: replyAvatar && [replyAvatar.width, replyAvatar.height],
          replyIndent: root && reply ? reply.left - root.left : null,
          bubbleRadius: bubbleStyle.borderRadius,
          bubblePadding: bubbleStyle.padding
        };
      });

      assert.equal(errors.length, 0, `${width}px Profile errors: ${errors.join(" | ")}`);
      assert.equal(geometry.overflow, false, `${width}px Profile interactions overflow horizontally`);
      assert.equal(Math.round(geometry.tabs.height), 44, `${width}px profile tabs are not 44px high`);
      assert.deepEqual(geometry.tabs.labels, ["Posts", "About", "Photos", "Videos", "More"]);
      assert.deepEqual(geometry.composerMargins, ["8px", "8px"]);
      assert.deepEqual(geometry.createAvatar.map(Math.round), [36, 36]);
      assert.equal(Math.round(geometry.createInput[0]), 36);
      assert.equal(geometry.createInput[1], "20px");
      assert.equal(Math.round(geometry.shortcutsHeight), 40);
      assert.deepEqual(geometry.shortcutLabels, ["▶Video", "▧Photo/Video", "◆Life Event"]);
      assert.equal(Math.round(geometry.countersHeight), 32);
      assert.equal(Math.round(geometry.actionsHeight), 44);
      assert.ok(geometry.actionTargets.every(height => Math.round(height) === 44), `${width}px post action targets are not 44px`);
      assert.deepEqual(geometry.rootAvatar.map(Math.round), [32, 32]);
      assert.deepEqual(geometry.replyAvatar.map(Math.round), [24, 24]);
      assert.ok(Math.abs(geometry.replyIndent - 40) <= 1, `${width}px nested reply indent is ${geometry.replyIndent}px`);
      assert.equal(geometry.bubbleRadius, "18px");
      assert.ok(["9px 12px", "12px"].includes(geometry.bubblePadding), `${width}px comment bubble padding is ${geometry.bubblePadding}`);

      if (width === 390) {
        await page.screenshot({ path: path.join(output, "profile-comments-390.png"), fullPage: true });
        await card.locator(".profile-post-like").click();
        assert.deepEqual(reactionWrites.at(-1), { postId, reaction: "Like" });
        await card.locator(".profile-post-comment").click();
        const input = card.locator(".profile-comment-input");
        await input.fill("A new top-level comment");
        await card.locator(".profile-comment-send").click();
        assert.deepEqual(commentWrites.at(-1), { postId, content: "A new top-level comment" });
        await card.locator(".profile-comment:not(.profile-comment-reply)").getByRole("button", { name: "Reply" }).click();
        await input.fill("A nested reply");
        await card.locator(".profile-comment-send").click();
        assert.deepEqual(commentWrites.at(-1), { postId, content: "A nested reply", parentCommentId: commentId });
        await card.locator(".profile-post-share").click();
        await page.locator(".post-share-dialog[open]").waitFor();
        await page.locator(".post-share-dialog").evaluate(dialog => dialog.close());
        await page.locator(".profile-create-opener").click();
        await page.locator(".profile-create-form textarea").fill("A working profile post");
        await page.locator(".profile-wall-certify input").check();
        await page.locator('.profile-create-form button[type="submit"]').click();
        assert.equal(postWrites.at(-1).content, "A working profile post");
        assert.equal(postWrites.at(-1).originalContentCertified, true);
        assert.equal(postWrites.at(-1).audience, "public");
        await page.locator('[data-profile-tab="Photos"]').click();
        await page.locator(".profile-post-media").first().waitFor();
        await page.locator('[data-profile-tab="More"]').click();
        assert.deepEqual(await page.locator(".profile-more-navigation button").allTextContents(), ["Featured", "Memories", "Friends", "Media"]);
      }

      await page.screenshot({ path: path.join(output, `profile-interactions-${width}.png`), fullPage: width >= 700 });
      await context.close();
    }
    console.log(`Profile interaction checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
