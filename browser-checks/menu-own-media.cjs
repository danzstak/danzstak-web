"use strict";

// Audit A10 (2026-11-19): "The Photos page (Menu -> Photos) shows other people's photos as text cards." Photos and
// Videos are the member's own media: opening them lands on the member's own profile at the Photos / Videos tab
// (3-column grid, full-screen viewer, albums with 5a2), never a gallery of other members' Mix posts. Back returns to
// where the member came from.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const viewports = [[320, 568], [360, 780], [390, 844], [430, 932], [1366, 900]];
const me = "11111111-1111-4111-8111-111111111111", friend = "22222222-2222-4222-8222-222222222222";
const post = (postId, userId, authorName, content, mediaType, mediaUrl, isOwner) => ({ postId, userId, authorName, content, createdAt: "2026-11-18T10:00:00.000Z", audience: "public", isOwner, mediaType, mediaUrl, commentPolicy: "everyone" });
const posts = [
  post("own-photo", me, "Night Shift", "My own gig photo", "image", `${base}/assets/danzstak-share-fb-v2.jpg`, true),
  post("friend-photo", friend, "Tour Friend", "Flyer for Friday", "image", `${base}/assets/danzstak-d-icon.png`, false),
  post("own-video", me, "Night Shift", "My soundcheck clip", "video", "https://media.example.invalid/own.webm", true),
  post("friend-video", friend, "Tour Friend", "Their tour vlog", "video", "https://media.example.invalid/friend.webm", false)
];
function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: me, email: "night@danzstak.invalid" } };
  if (pathname === "/profiles" || pathname === "/profile") return { profile: { memberId: me, name: "Night Shift", handle: "nightshift", isOwner: true } };
  if (pathname === "/secure-posts") return { posts };
  if (pathname === "/stories") return { dailyTakeCount: 0, stories: [], reels: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const [width, height] of viewports) {
      for (const [route, tab, mine, theirs] of [["photos", "Photos", "My own gig photo", "Flyer for Friday"], ["videos", "Videos", "My soundcheck clip", "Their tour vlog"]]) {
        const label = `${width}px ${tab}`;
        const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700, serviceWorkers: "block" });
        const page = await context.newPage(), errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://media.example.invalid/**", r => r.fulfill({ status: 404, body: "" }));
        await page.route("https://api.danzstak.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(r.request().url()).pathname)) }));
        await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
        await page.locator('.post[data-post-id="friend-photo"]').waitFor({ timeout: 15000 });
        await page.goto(`${base}/feed.html#${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForURL(url => url.pathname.endsWith("/profile.html") && url.hash === `#${route}`, { timeout: 10000 });
        // Owner 2026-11-22: the tab opens on album covers ("a few albums… not a lot of loose images"); "All photos" /
        // "All videos" holds every one.
        const all = page.locator(".profile-albums .profile-album-tile", { hasText: route === "photos" ? "All photos" : "All videos" });
        await all.waitFor({ timeout: 10000 });
        await all.click();
        const grid = page.locator(route === "photos" ? ".profile-photo-grid" : ".profile-video-grid:not(.profile-photo-grid)");
        await grid.waitFor({ timeout: 10000 });
        await page.waitForTimeout(400);
        const view = await page.evaluate(() => ({
          tab: document.querySelector("[data-profile-tab][aria-selected='true']")?.dataset.profileTab || "",
          labels: [...document.querySelectorAll(".profile-video-grid [role=listitem]")].map(tile => tile.getAttribute("aria-label") || ""),
          gallery: document.querySelectorAll(".feed-media-card").length,
          overflow: document.documentElement.scrollWidth > innerWidth
        }));
        assert.equal(view.tab, tab, `${label}: lands on your own profile's ${tab} tab`);
        assert.ok(view.labels.some(text => text.includes(mine)), `${label}: your own ${route} are listed: ${JSON.stringify(view.labels)}`);
        assert.ok(!view.labels.some(text => text.includes(theirs)), `${label}: another member's ${route} must not be listed: ${JSON.stringify(view.labels)}`);
        assert.equal(view.gallery, 0, `${label}: no text-card gallery of Mix posts`);
        assert.equal(view.overflow, false, `${label}: no sideways scroll`);
        // Back closes the album first (back to the covers), then returns to Mix.
        await page.goBack();
        await page.locator(".profile-albums").waitFor({ state: "visible", timeout: 10000 });
        await page.goBack();
        await page.waitForURL(url => url.pathname.endsWith("/feed.html") && !url.hash, { timeout: 10000 });
        assert.deepEqual(errors, [], `${label}: page errors: ${errors.join(" | ")}`);
        await context.close();
      }
    }
    console.log(`Own-media checks passed at ${viewports.map(([width]) => width).join(", ")}px: Photos and Videos open on your albums, All photos / All videos hold only your own, never other members' posts, and Back returns to the albums, then Mix.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
