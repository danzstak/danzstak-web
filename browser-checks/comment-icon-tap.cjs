"use strict";
// Audit 2026-11-19 E1: tapping the Comment icon in Mix did nothing. The button holds an icon span, so a real tap lands
// on the icon; the handler only looked at event.target. This check taps the CENTRE of the icon (not the button box).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/comment-icon-tap.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const post = (id, author) => ({ id, postId: id, memberId: author, authorId: author, authorName: "Scene Friend", content: "Show tonight", createdAt: new Date(Date.now() - 3600e3).toISOString(), reactions: {}, comments: [] });
const fixture = p => p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "artist@example.test" } }
  : p === "/profiles" ? { profile: { memberId: me, name: "Tour Artist", handle: "tourartist", cloudProfile: true, isOwner: true } }
  : p === "/secure-posts" || p === "/posts" ? { posts: [post("p1", other), post("p2", other)] }
  : p === "/stories" ? { stories: [], reels: [] } : p === "/friends" ? { friends: [] } : p === "/calls/inbox" ? { events: [] } : {};
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(fixture(new URL(route.request().url()).pathname)) }));
      await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      const button = page.locator(".post .commentBtn").first();
      await button.waitFor({ timeout: 10000 });
      await button.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const box = await button.boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const hit = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return { inButton: !!el?.closest(".commentBtn"), tag: el?.tagName }; }, { x, y });
      if (!hit.inButton) failures.push(`${width}px: the centre of Comment is covered by something else (${hit.tag})`);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => { const box = document.querySelector(".post .comments"); return { open: !!box && !box.hidden, focused: !!document.activeElement?.closest(".post .comments") }; });
      if (!state.open) failures.push(`${width}px: tapping the Comment icon (${hit.tag}) does not open the comments`);
      else if (!state.focused) failures.push(`${width}px: comments opened but the comment field is not focused`);
      if (errors.length) failures.push(`${width}px: script errors: ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Comment icon tap checks passed at 360 and 390px: a tap on the icon opens and focuses the comment box.");
})();
