"use strict";
// Owner 2026-11-25 (phone screenshot of Mix: a post's like/comment row, The Roll, the next post): "Make the spacing the
// same between posts and the roll the top is double spacing and the bottom is single make the bottom spacing".
// Real browser, touch, 320/360/390/430px: in Mix, the empty space between the post above and The Roll's title equals the
// empty space between the bottom of The Roll's videos and the next post (within 2px), and both are the single gap.
// Empty space = from the last thing drawn in the post above (its reaction row) to the first thing drawn in The Roll (its
// title), and from the last thing drawn in The Roll (its videos) to the first thing drawn in the next post (its author).
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = "https://review.danzstak.test";
const me = "11111111-1111-4111-8111-111111111111";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const cors = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
const at = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const textPost = (id, minutes) => ({ postId: `spacing-${id}`, userId: me, authorMemberId: me, authorName: "Eroticon", content: `Post ${id}`, createdAt: at(minutes), audience: "public", isOwner: true, reactionCounts: {} });
const videoPost = (id, minutes) => ({ ...textPost(id, minutes), mediaType: "video", mediaKey: `uploads/${id}.webm`, mediaUrl: `${origin}/__video/${id}.webm`, reel: true, mediaRatio: 0.5625 });
const posts = [textPost("a", 10), videoPost("v1", 20), textPost("b", 30), videoPost("v2", 40), textPost("c", 50), textPost("d", 60), textPost("e", 70)];

async function open(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/__video/")) return route.fulfill({ status: 404, body: "" });
    let file = path.join(process.cwd(), decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  await page.route(url => !url.href.startsWith(origin) && !url.href.startsWith("https://api.danzstak.com"), route => route.fulfill({ status: 204, body: "" }));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const reply = body => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (p === "/auth/session") return reply({ authenticated: true, user: { sub: me, email: "spacing@danzstak.invalid" } });
    if (p === "/profiles" || p === "/profile") return reply({ profile: { memberId: me, name: "Eroticon", handle: "eroticon", username: "eroticon", isOwner: true, onboarded: true } });
    if (p === "/secure-posts") return reply({ posts });
    if (p === "/stories") return reply({ stories: [], reels: [], dailyTakeCount: 0 });
    if (p === "/engagement") return reply({ reactionCounts: {}, comments: [] });
    return reply({});
  });
  await page.goto(`${origin}/feed.html`, { waitUntil: "load" });
  await page.locator(".reels-rail .reel-card").first().waitFor({ state: "attached", timeout: 20000 });
  await page.waitForTimeout(1200);
  return { context, page };
}

// What the eye sees: the ink, not the boxes. Text (its line boxes) and pictures (svg icons, photos, videos) count; a 44px
// button around a 24px icon does not, because its padding is blank on screen.
function measure() {
  const rail = document.querySelector("#feed .reels-rail, .reels-rail.post");
  if (!rail) return { error: "no Roll in Mix" };
  const shown = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (n.hidden || s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false; } return true; };
  const ink = root => {
    const rects = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim() || !shown(t.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(t);
      rects.push(...[...range.getClientRects()].filter(r => r.width > 1 && r.height > 1));
    }
    for (const el of root.querySelectorAll("svg, img, video, canvas, iframe, picture")) {
      if (!shown(el) || el.parentElement?.closest("svg")) continue;
      const r = el.getBoundingClientRect(); if (r.width > 2 && r.height > 2) rects.push(r);
    }
    return rects;
  };
  const siblings = [...rail.parentElement.children].filter(el => el !== rail && shown(el) && el.classList.contains("post"));
  const before = siblings.filter(el => el.getBoundingClientRect().bottom <= rail.getBoundingClientRect().top + 1).pop();
  const after = siblings.find(el => el.getBoundingClientRect().top >= rail.getBoundingClientRect().bottom - 1);
  if (!before || !after) return { error: `Roll not between posts (before ${Boolean(before)}, after ${Boolean(after)})` };
  const lowest = root => Math.max(...ink(root).map(r => r.bottom)), highest = root => Math.min(...ink(root).map(r => r.top));
  return { above: Math.round(highest(rail) - lowest(before)), below: Math.round(highest(after) - lowest(rail)) };
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      const { context, page } = await open(browser, width);
      try {
        const m = await page.evaluate(measure);
        console.log(`${width}px`, JSON.stringify(m));
        if (m.error) failures.push(`${width}px: ${m.error}`);
        else if (Math.abs(m.above - m.below) > 2) failures.push(`${width}px: ${m.above}px of space above The Roll but ${m.below}px below it`);
        if (process.env.DANZSTAK_CAPTURE_DIR) await page.locator(".reels-rail").first().screenshot({ path: path.join(process.env.DANZSTAK_CAPTURE_DIR, `roll-spacing-${width}.png`) }).catch(() => {});
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("The Roll has the same space above and below it in Mix at 320-430px.");
})().catch(error => { console.error(error); process.exit(1); });
