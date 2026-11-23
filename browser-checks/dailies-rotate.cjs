"use strict";
// Directive F15 (owner 2026-11-19): "Dailies should rotate each time the user comes back to the site. They should just
// bounce and settle." Checks at 360 and 390px with five friends' Dailies:
// - your own tile stays first; a new visit (a new app session, or coming back after more than 30 minutes) shows friends'
//   Dailies in a new order with a different friend first; a reload inside the same visit keeps the order;
// - the tiles slide in once per page load (400ms, 40ms apart) and settle in place; no motion with reduced motion.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = "https://review.danzstak.test"; // https: the page CSP upgrades insecure requests
const me = "11111111-1111-4111-8111-111111111111";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2" };
const colors = ["1d6fdb", "2b7a3d", "8e44ad", "c0392b", "16a085"];
const stories = colors.map((color, index) => ({
  storyId: `f${index + 1}`, memberId: `2222222${index + 1}-2222-4222-8222-222222222222`, displayName: `Friend ${index + 1}`, isOwner: false,
  content: `Clip ${index + 1}`, mediaType: "image", mediaUrl: `${origin}/__daily/${color}.svg`, createdAt: new Date(Date.now() - (index + 1) * 300000).toISOString()
}));
const art = color => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><rect width="90" height="160" fill="#${color}"/></svg>`;

async function newContext(browser, width, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", reducedMotion });
  await context.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/__daily/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: art(path.basename(url.pathname, ".svg")) });
    const file = path.join(process.cwd(), decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  await context.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" } });
    if (p === "/auth/session") return json({ authenticated: true, user: { sub: me, email: "artist@danzstak.invalid" } });
    if (p === "/profiles") return json({ profile: { memberId: me, name: "Night Shift", handle: "nightshift", cloudProfile: true, isOwner: true } });
    if (p === "/stories") return json({ stories, reels: [], dailyTakeCount: 2 });
    if (p === "/secure-posts") return json({ posts: [] });
    return json({});
  });
  return context;
}

async function visit(page, { url = `${origin}/feed.html?view=feed`, reload = false } = {}) {
  if (reload) await page.reload({ waitUntil: "domcontentloaded" }); else await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#storiesRail .story[data-story-id]").length >= 5, null, { timeout: 10000 });
  return page.evaluate(() => {
    const rail = document.getElementById("storiesRail");
    const tiles = [...rail.querySelectorAll(".story[data-story-id]")];
    const firstTile = [...rail.children].find(node => node.matches(".story-create, .story[data-story-id]"));
    return {
      order: tiles.map(tile => tile.dataset.storyId),
      ownFirst: Boolean(firstTile?.classList.contains("story-create")),
      motion: tiles.map(tile => { const style = getComputedStyle(tile); return { name: style.animationName, duration: style.animationDuration, delay: style.animationDelay }; })
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await newContext(browser, width);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));

      const first = await visit(page);
      assert.equal(first.ownFirst, true, `${label}: your own tile stays first`);
      assert.deepEqual([...first.order].sort(), ["f1", "f2", "f3", "f4", "f5"], `${label}: every friend's Daily is in the strip`);

      // The tiles bounce in: 400ms, 40ms apart, then settle with no offset.
      assert.ok(first.motion.every(item => item.name === "danzstak-daily-settle" && item.duration === "0.4s"), `${label}: the tiles slide in and settle: ${JSON.stringify(first.motion)}`);
      assert.deepEqual(first.motion.slice(0, 3).map(item => item.delay), ["0s", "0.04s", "0.08s"], `${label}: the tiles arrive 40ms apart`);
      await page.waitForTimeout(700);
      const settled = await page.evaluate(() => [...document.querySelectorAll("#storiesRail .story[data-story-id]")].map(tile => getComputedStyle(tile).transform));
      assert.ok(settled.every(value => value === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(value)), `${label}: the tiles settle in place: ${JSON.stringify(settled)}`);

      // Same visit: a reload keeps the order.
      const again = await visit(page, { reload: true });
      assert.deepEqual(again.order, first.order, `${label}: a reload inside the same visit keeps the order`);

      // A new visit (the app opened again: a fresh session) rotates, with a different friend first.
      await page.evaluate(() => sessionStorage.clear());
      const next = await visit(page, { reload: true });
      assert.equal(next.ownFirst, true, `${label}: your own tile stays first on the next visit`);
      assert.notDeepEqual(next.order, first.order, `${label}: a new visit shows a new order`);
      assert.notEqual(next.order[0], first.order[0], `${label}: never the same friend first twice in a row`);

      // Coming back after more than 30 minutes rotates again, in the same session.
      await page.evaluate(() => { const key = "danzstak_dailies_visit", visit = JSON.parse(localStorage.getItem(key)); visit.seen = Date.now() - 31 * 60 * 1000; localStorage.setItem(key, JSON.stringify(visit)); });
      const later = await visit(page, { reload: true });
      assert.notEqual(later.order[0], next.order[0], `${label}: coming back after 30 minutes shows a different friend first`);
      assert.deepEqual(errors, [], `${label}: no page errors`);
      await context.close();

      // Reduced motion: no bounce.
      const calm = await newContext(browser, width, "reduce");
      const calmPage = await calm.newPage();
      const still = await visit(calmPage);
      assert.ok(still.motion.every(item => item.name === "none"), `${label}: no motion with reduced motion: ${JSON.stringify(still.motion)}`);
      await calm.close();
    }
    console.log("Dailies rotation checks passed at 360 and 390px: each new visit (new session or back after 30 min) shows a new order with a different friend first and your tile pinned first, a reload keeps the order, the tiles bounce in 40ms apart and settle, and nothing moves with reduced motion.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
