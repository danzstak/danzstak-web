"use strict";
// Mix Dailies strip (fix-it 18, owner 2026-11-17): a horizontal strip, tiles a third of the screen — own tile first, then
// friends' — instead of one half-width tile with empty space beside it; clapper shows the member's Dailies count.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/mix-dailies-strip.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/mix-dailies-strip");
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const tile = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><rect width="90" height="160" fill="#1d2633"/><circle cx="45" cy="70" r="26" fill="#ff5a1f"/></svg>';
const friendStories = Array.from({ length: 4 }, (_, i) => ({ storyId: `s${i}`, memberId: `2222222${i}-2222-4222-8222-222222222222`, displayName: ["Tour Friend", "SFScoop", "Basement", "Night Owl"][i], mediaType: "image", mediaUrl: `${baseUrl}/__dailies/${i}.svg`, createdAt: new Date(Date.now() - i * 3600000).toISOString(), audience: "friends" }));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const withFriends of [false, true]) for (const width of [320, 360, 390, 430]) {
      const label = `${withFriends ? "with friends" : "own only"} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${baseUrl}/__dailies/*`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: tile }));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: ownerId, email: "a@example.test" } }
          : p === "/profiles" ? { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true } }
          : p === "/stories" ? { stories: withFriends ? friendStories : [], reels: [] }
          : p === "/secure-posts" ? { posts: [] } : p === "/settings/posts" ? { hiddenPostIds: [] } : {};
        route.fulfill(json(body));
      });
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
      // F15: friends' tiles slide in once per load; measure the strip after they settle.
      await page.evaluate(() => Promise.all([...document.querySelectorAll("#storiesRail .story-enter")].flatMap(tile => tile.getAnimations()).map(animation => animation.finished)));
      const strip = await page.evaluate(() => {
        const rail = document.getElementById("storiesRail"), r = rail.getBoundingClientRect();
        const tiles = [...rail.querySelectorAll(".story")].filter(n => n.getBoundingClientRect().width > 0 && n.id !== "storiesLoading").map(n => { const b = n.getBoundingClientRect(); return { own: n.classList.contains("story-create"), left: b.left, right: b.right, width: b.width }; });
        const take = rail.querySelector(".daily-clapper small");
        return { left: r.left, right: r.right, tiles, take: take && take.getBoundingClientRect().height > 0 ? take.textContent : "" };
      });
      if (Math.abs(strip.left) > 0.5 || Math.abs(strip.right - width) > 0.5) failures.push(`${label}: strip does not reach both edges (${Math.round(strip.left)}-${Math.round(strip.right)})`);
      if (!strip.tiles.length || !strip.tiles[0].own) failures.push(`${label}: own tile is not first`);
      // Owner 2026-11-18: tiles stay about a third of the screen, even when only the member's own tile is there.
      const third = (width - 4) / 3;
      if (strip.tiles.length && Math.abs(strip.tiles[0].width - third) > 3) failures.push(`${label}: own tile is not a third of the screen (${Math.round(strip.tiles[0].width)} vs ${Math.round(third)})`);
      if (withFriends) { const filled = strip.tiles.filter(t => t.left < width).reduce((max, t) => Math.max(max, Math.min(t.right, width)), 0); if (filled < width - 1) failures.push(`${label}: empty space beside the tiles with friends (${Math.round(width - filled)}px)`); }
      if (withFriends) {
        if (strip.tiles.length < 5) { failures.push(`${label}: friends' Dailies missing (${strip.tiles.length} tiles; errors: ${errors.join(' | ').slice(0, 200)})`); await context.close(); continue; }
        const expected = (width - 4) / 3;
        if (Math.abs(strip.tiles[1].width - expected) > 3) failures.push(`${label}: tiles are not about a third of the screen (${Math.round(strip.tiles[1].width)} vs ${Math.round(expected)})`);
      }
      if (!/^TAKE \d+$/.test(strip.take)) failures.push(`${label}: clapper does not show the member's Dailies count ("${strip.take}")`);
      if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-${withFriends ? "friends" : "own"}-${width}.png`), clip: { x: 0, y: 0, width, height: 360 } });
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`Mix Dailies strip: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log("Mix Dailies strip checks passed: full-width strip, own tile first then friends', tiles about a third of the screen, own tile pinned, clapper shows the Dailies count.");
})().catch(error => { console.error(error); process.exitCode = 1; });
