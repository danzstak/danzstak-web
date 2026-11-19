"use strict";
// Directive F15b: the DanzStak welcome post is first in Mix with a small "Pinned" label while its pin lasts (the server
// orders it first and sends pinnedUntil only while it is in the future; test-pinned-welcome.cjs covers that side).
// Checks at 360/390px: the first post is the welcome post with one "Pinned" label inside its header, its text is the one
// tight paragraph (no blank lines, says Tribe); a post whose pin has passed shows no label; no sideways scroll.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", official = "99999999-9999-4999-8999-999999999999";
const WELCOME = "Welcome to DanzStak! Connect with people, share your original photos, music videos and ideas, and build your scene. Start by finishing your profile, finding friends and joining a Tribe. What are you creating today?";
const day = 864e5;
const POSTS = [
  { postId: "aaaaaaaa-0000-4000-8000-000000000001", userId: official, authorMemberId: official, authorName: "DanzStak", content: WELCOME, createdAt: new Date(Date.now() - 20 * day).toISOString(), audience: "public", pinnedUntil: new Date(Date.now() + 30 * day).toISOString() },
  { postId: "aaaaaaaa-0000-4000-8000-000000000002", userId: me, authorMemberId: me, authorName: "Night Shift", content: "Doors at 8", createdAt: new Date(Date.now() - 3600e3).toISOString(), audience: "public", isOwner: true },
  { postId: "aaaaaaaa-0000-4000-8000-000000000003", userId: official, authorMemberId: official, authorName: "DanzStak", content: "An old announcement", createdAt: new Date(Date.now() - 40 * day).toISOString(), audience: "public", pinnedUntil: new Date(Date.now() - day).toISOString() }
];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390]) {
      const label = `${width}px Mix`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        const body = url.pathname === "/auth/session" ? { authenticated: true, user: { sub: me } }
          : url.pathname === "/profiles" ? { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } }
          : url.pathname === "/secure-posts" ? { posts: POSTS } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#feed article.post", { timeout: 8000 });
      await page.waitForTimeout(400);
      const state = await page.evaluate(() => {
        const posts = [...document.querySelectorAll("#feed > article.post")];
        return {
          first: posts[0]?.querySelector(".post-content")?.textContent || "",
          labels: posts.map(post => [...post.querySelectorAll(".post-pinned")].map(node => [node.textContent.trim(), Boolean(node.closest(".post-header"))])),
          firstPinned: posts[0]?.classList.contains("is-pinned"),
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      assert.equal(state.first, WELCOME, `${label}: the first post is the welcome post`);
      assert.match(state.first, /\bTribe\b/);
      assert.doesNotMatch(state.first, /\n|\bgroups?\b/i, `${label}: one tight paragraph that says Tribe`);
      assert.equal(state.firstPinned, true, `${label}: the welcome post is marked pinned`);
      assert.deepEqual(state.labels, [[["Pinned", true]], [], []], `${label}: one Pinned label, in the welcome post's header; an expired pin shows none`);
      assert.equal(state.overflow, false, `${label}: no sideways scroll`);
      assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Pinned welcome checks passed at 360 and 390px: the welcome post is first with one Pinned label in its header and its tight Tribe text; an expired pin shows no label.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
