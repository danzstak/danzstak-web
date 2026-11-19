"use strict";
// Directive F15c (owner 2026-11-19: "take away that downward arrow when the user gets to the end of the page and just
// make the Mix flow. It scrolls as things are loaded"). Before: Mix drew 12 posts and a round ⌄ button for the next 12.
// Checks at 360/390px with 30 posts: no load-more/arrow button anywhere; scrolling down (no taps) brings in the next
// posts in order until all 30 are there; the feed then ends with one "You're caught up" line, last in the feed; no
// further post requests are made; nothing scrolls sideways.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", friend = "22222222-2222-4222-8222-222222222222";
const POSTS = Array.from({ length: 30 }, (_, index) => ({
  postId: `${String(index).padStart(8, "0")}-3333-4333-8333-333333333333`, userId: friend, authorMemberId: friend, authorName: "Tour Friend", authorPicture: "",
  content: `Post number ${index + 1}`, createdAt: new Date(Date.now() - (index + 1) * 3600e3).toISOString(), audience: "public", isOwner: false
}));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390]) {
      const label = `${width}px Mix`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      let postRequests = 0;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        if (url.pathname === "/secure-posts" && route.request().method() === "GET") postRequests += 1;
        const body = url.pathname === "/auth/session" ? { authenticated: true, user: { sub: me } }
          : url.pathname === "/profiles" ? { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } }
          : url.pathname === "/secure-posts" ? { posts: POSTS } : url.pathname === "/stories" ? { stories: [], reels: [] } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#feed article.post", { timeout: 8000 });
      const state = () => page.evaluate(() => ({
        posts: [...document.querySelectorAll("#feed > article.post")].map(post => post.querySelector(".post-content")?.textContent.trim()),
        buttons: [...document.querySelectorAll("#feed button, #feed [role=button]")].filter(node => !node.closest("article.post, .reels-rail") && node.getClientRects().length).map(node => node.className || node.getAttribute("aria-label")),
        loadMore: Boolean(document.querySelector(".load-more-posts")),
        end: document.querySelector("#feed > .feed-caught-up")?.textContent.trim() || "",
        last: document.querySelector("#feed")?.lastElementChild?.className || "",
        overflow: document.documentElement.scrollWidth > innerWidth
      }));
      let current = await state();
      assert.ok(current.posts.length < POSTS.length, `${label}: not every post is drawn at first (${current.posts.length})`);
      assert.deepEqual([current.loadMore, current.buttons], [false, []], `${label}: no load-more or arrow button`);
      assert.equal(current.end, "", `${label}: no caught-up line before the end`);
      const requestsAtStart = postRequests;
      // Scroll down like a member (wheel steps, no taps) until nothing new arrives.
      for (let step = 0; step < 60 && current.posts.length < POSTS.length; step += 1) {
        await page.mouse.wheel(0, 700);
        await page.waitForTimeout(120);
        current = await state();
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
      current = await state();
      assert.deepEqual(current.posts, POSTS.map(post => post.content), `${label}: scrolling brought in every post, in order, with no tap`);
      assert.equal(current.end, "You're caught up", `${label}: the feed ends with the caught-up line`);
      assert.equal(current.last, "feed-caught-up", `${label}: the caught-up line is the last thing in Mix`);
      assert.deepEqual([current.loadMore, current.buttons], [false, []], `${label}: still no load-more button`);
      assert.equal(postRequests, requestsAtStart, `${label}: reaching the end makes no further post requests`);
      assert.equal(current.overflow, false, `${label}: no sideways scroll`);
      assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Mix flow checks passed at 360 and 390px: no load-more button; scrolling brings in all 30 posts in order with no tap; the feed ends with \"You're caught up\" and makes no further requests.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
