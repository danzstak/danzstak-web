"use strict";
// Directive F15a (owner 2026-11-19, phone): "When I horizontally swipe on the Dailies the icons go above my profile
// picture and the video goes behind my profile picture. The icons really shouldn't be there and they should swipe behind
// my profile picture." And: "take those icons away and just click on the video and it plays".
// Root cause: each video tile got the shared sound button (z-index 8) and a CSS ▶ circle, the tiles were not stacking
// contexts, and your pinned tile sits at z-index 3, so a scrolled tile's icons and name painted over it. Photo Dailies
// could show bars; video tiles carried a SCENE/TAKE slate the photo tiles didn't.
// Checks at 360/390px with friends' photo and video Dailies, swiping the strip with real touch:
// - no button with a bin, sound or play icon inside the strip, and no ▶ pseudo-element on any tile;
// - every friend tile has the same parts: the picture or poster filling the tile, a small time label, the name;
// - while scrolled to several positions, every point of your own tile is your own tile (nothing paints over it);
// - your clapper and any tile's name never intersect; tapping a video tile opens it full screen.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = "https://review.danzstak.test"; // served from this checkout under a non-local name
const output = path.resolve("docs/screenshots/dailies-strip-clean");
const me = "11111111-1111-4111-8111-111111111111";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const svg = (w, h, colour) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${colour}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#fff"/></svg>`;
const friends = ["#1d6fdb", "#2b7a3d", "#8e44ad", "#c0392b", "#16a085", "#f1c40f"].map((colour, index) => ({
  storyId: `f${index}`, memberId: `2222222${index}-2222-4222-8222-222222222222`, displayName: index === 1 ? "Dachshund Records" : `Friend ${index}`,
  mediaType: index % 2 ? "video" : "image", mediaUrl: index % 2 ? `${base}/__clip${index}.webm` : `${base}/__photo${index}.svg`,
  colour, createdAt: new Date(Date.now() - (index + 1) * 3600e3).toISOString(), isOwner: false, caption: ""
}));

// A 2-second WebM recorded in the browser, so no binary lives in the repository.
async function recordClip(browser) {
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.setContent('<canvas id="frame" width="360" height="640"></canvas>');
    const bytes = await page.evaluate(async () => {
      const canvas = document.querySelector("#frame"), paint = canvas.getContext("2d");
      const stream = canvas.captureStream(15), recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" }), chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      for (let frame = 0; frame < 30; frame += 1) { paint.fillStyle = "#ff5a1f"; paint.fillRect(0, 0, 360, 640); await new Promise(resolve => setTimeout(resolve, 66)); }
      recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
      return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
    });
    return Buffer.from(bytes);
  } finally { await context.close(); }
}

async function open(browser, width, clip) {
  // Reduced motion: no entrance animation, so no transform gives the tiles a stacking context by accident; the check
  // sees the stacking the CSS really declares (the live bug showed with no transform).
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/**`, route => {
    const url = new URL(route.request().url());
    const photo = url.pathname.match(/^\/__photo(\d)\.svg$/);
    if (photo) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(800, 400, friends[Number(photo[1])].colour) });
    if (/^\/__clip\d\.webm$/.test(url.pathname)) return route.fulfill({ status: 200, contentType: "video/webm", body: clip });
    if (url.pathname === "/__me.svg") return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(400, 400, "#0b0b0c") });
    const file = path.join(process.cwd(), decodeURIComponent(url.pathname));
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type" };
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = url.pathname === "/auth/session" ? { authenticated: true, user: { sub: me } }
      : url.pathname === "/profiles" ? { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true, picture: `${base}/__me.svg` } }
      : url.pathname === "/stories" ? { stories: friends, reels: [], dailyTakeCount: 3 } : url.pathname === "/secure-posts" ? { posts: [] } : {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#storiesRail .story[data-story-id]").length >= 6, null, { timeout: 8000 });
  await page.waitForFunction(() => [...document.querySelectorAll("#storiesRail .story[data-story-id] video")].every(video => video.readyState >= 1), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('#storiesRail .story[data-media-type="image"]')].every(tile => /url\(/.test(getComputedStyle(tile).backgroundImage)), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"), null, { timeout: 3000 }).catch(() => {});
  return { context, page, errors };
}

async function touchSwipe(page, fromX, toX, y) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y }] });
  for (let step = 1; step <= 10; step += 1) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + (toX - fromX) * step / 10, y }] }); await new Promise(resolve => setTimeout(resolve, 16)); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(400);
}

const stripState = page => page.evaluate(() => {
  const rail = document.getElementById("storiesRail"), own = rail.querySelector(".story-create"), ownBox = own.getBoundingClientRect();
  const iconButtons = [...rail.querySelectorAll("button, [role=button]")].filter(node => !node.matches(".story-open, .story-create, .story-name-more") && node.getClientRects().length).map(node => node.className || node.getAttribute("aria-label"));
  const pseudo = [...rail.querySelectorAll(".story")].filter(tile => ["::before", "::after"].some(part => { const content = getComputedStyle(tile, part).content; return content && content !== "none" && content !== "normal" && content !== '""'; })).map(tile => tile.dataset.storyId || tile.className);
  const tiles = [...rail.querySelectorAll(".story[data-story-id]")].map(tile => {
    const box = tile.getBoundingClientRect(), video = tile.querySelector("video"), videoBox = video?.getBoundingClientRect();
    return { id: tile.dataset.storyId, time: Boolean(tile.querySelector("time.story-time")?.textContent.trim()), name: tile.querySelector(".story-author-link, .story-card-copy strong:not([hidden])")?.textContent.trim() || "", slate: Boolean(tile.querySelector(".story-video-slate")),
      fills: video ? Math.abs(videoBox.width - box.width) <= 1 && Math.abs(videoBox.height - box.height) <= 1 && getComputedStyle(video).objectFit === "cover" : /url\(/.test(getComputedStyle(tile).backgroundImage) && /^cover(, cover)*$/.test(getComputedStyle(tile).backgroundSize), size: getComputedStyle(tile).backgroundSize };
  });
  const foreign = [];
  for (let x = ownBox.left + 2; x < ownBox.right - 2; x += 6) for (let y = ownBox.top + 2; y < ownBox.bottom - 2; y += 6) {
    const hit = document.elementFromPoint(x, y);
    if (hit && !own.contains(hit)) foreign.push(`${String(hit.className || hit.tagName).split(" ")[0]}@${Math.round(x)},${Math.round(y)}`);
  }
  const clapper = own.querySelector(".daily-clapper")?.getBoundingClientRect();
  const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const names = [...rail.querySelectorAll(".story[data-story-id] .story-author-link")].map(node => node.getBoundingClientRect());
  const nameOverClapper = names.some(box => overlap(box, clapper) && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest?.(".story-author-link"));
  return { iconButtons, pseudo, tiles, foreign: foreign.slice(0, 5), nameOverClapper, scroll: rail.scrollLeft, room: rail.scrollWidth - rail.clientWidth, y: ownBox.top + ownBox.height / 2 };
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const clip = await recordClip(browser);
    for (const width of [360, 390]) {
      const label = `${width}px Dailies strip`;
      const { context, page, errors } = await open(browser, width, clip);
      let state = await stripState(page);
      assert.deepEqual(state.iconButtons, [], `${label}: no bin, sound or play buttons in the strip`);
      assert.deepEqual(state.pseudo, [], `${label}: no ▶ drawn on any tile`);
      for (const tile of state.tiles) {
        assert.deepEqual([tile.time, Boolean(tile.name), tile.slate], [true, true, false], `${label} ${tile.id}: picture, small time label and name, nothing else ${JSON.stringify(tile)}`);
        assert.equal(tile.fills, true, `${label} ${tile.id}: the picture or video fills its tile ${JSON.stringify(tile)}`);
      }
      assert.ok(state.room > 100, `${label}: six friends' Dailies overflow the strip (room ${state.room})`);
      if (width === 390) await page.locator("#storiesRail").screenshot({ path: path.join(output, "rest-390.png") });
      for (let swipe = 0; swipe < 4 && state.scroll < state.room - 2; swipe += 1) {
        await touchSwipe(page, width - 40, width - 150, state.y);
        state = await stripState(page);
        assert.deepEqual(state.foreign, [], `${label}: after a swipe to ${state.scroll}px nothing paints over your own tile`);
        assert.equal(state.nameOverClapper, false, `${label}: no name is drawn over your clapper at ${state.scroll}px`);
        if (width === 390 && swipe === 0) await page.locator("#storiesRail").screenshot({ path: path.join(output, "scrolled-390.png") });
      }
      assert.ok(state.scroll > 100, `${label}: the strip scrolled under a finger (${state.scroll}px)`);
      // Tap a video tile: it plays full screen. The visit's shuffle can put it off screen, so bring it into view first and
      // wait for the strip to stop moving (a tap during a swipe's momentum only stops the scroll, on phones too).
      await page.evaluate(() => document.querySelector('#storiesRail .story[data-media-type="video"]').scrollIntoView({ block: "nearest", inline: "center" }));
      await page.waitForFunction(() => new Promise(resolve => { const rail = document.getElementById("storiesRail"), before = rail.scrollLeft; setTimeout(() => resolve(rail.scrollLeft === before), 250); }), null, { timeout: 5000, polling: 300 });
      const box = await page.locator('#storiesRail .story[data-media-type="video"] .story-open').first().boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, `${label}: the video tile is on screen before the tap ${JSON.stringify(box)}`);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => document.getElementById("storyViewer")?.open, null, { timeout: 5000 });
      assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Dailies strip checks passed at 360 and 390px: no bin, sound or play icons; every tile is picture + time + name filling its tile; swiped tiles slide behind your own tile and no name covers your clapper; tapping a video tile plays it full screen.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
