"use strict";
// T0-A2 (owner 2026-11-19): tapping the Dailies tile opened the phone's photo picker. Dailies come from posts, so:
// - your own tile opens your Dailies full screen (swipe left/right, ‹ ›, arrow keys), or the Mix post box when you have
//   none today; it never opens a file picker;
// - a friend's tile opens that friend's Daily;
// - your own Dailies are not repeated in the strip (it is your tile + friends'), and you can delete one from the viewer.
// Real Chromium at 320, 360, 390, 414 and 430px with real touch input (Chrome DevTools touch events, so the swipe is
// tested the way a phone sends it). Served from this checkout under a non-local host name, API mocked:
//   node browser-checks/dailies-tile-opens-dailies.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const origin = "https://review.danzstak.test"; // https: the page CSP upgrades insecure requests
const output = path.resolve("docs/screenshots/dailies-tile-opens-dailies");
const me = "11111111-1111-4111-8111-111111111111";
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const art = color => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><rect width="90" height="160" fill="${color}"/><circle cx="45" cy="70" r="26" fill="#fff"/></svg>`;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const story = (id, owner, caption, color, minutesAgo) => ({ storyId: id, memberId: owner ? me : `2222222${id.slice(-1)}-2222-4222-8222-222222222222`, displayName: owner ? "Night Shift" : `Friend ${id.slice(-1)}`, isOwner: owner, mediaType: "image", mediaUrl: `${origin}/__daily/${color}.svg`, content: caption, createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString() });
const friends = [story("f1", false, "Soundcheck", "1d6fdb", 5), story("f2", false, "Load-out", "2b7a3d", 30)];
const mine = [story("m1", true, "Doors at 8", "ff5a1f", 2), story("m2", true, "Merch table", "9e1b1b", 20), story("m3", true, "Last call", "5b3b8c", 60)];

async function openFeed(browser, width, stories) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: 2 });
  const page = await context.newPage(), seen = { pickers: 0, deletes: [], errors: [] };
  page.on("pageerror", error => seen.errors.push(error.message));
  page.on("filechooser", () => { seen.pickers += 1; });
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/__daily/")) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: art("#" + path.basename(url.pathname, ".svg")) });
    const file = path.join(process.cwd(), decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" } });
    if (p === "/auth/session") return json(route, { authenticated: true, user: { sub: me, email: "artist@danzstak.invalid" } });
    if (p === "/profiles") return json(route, { profile: { memberId: me, name: "Night Shift", handle: "nightshift", cloudProfile: true, isOwner: true } });
    if (p.startsWith("/stories/") && method === "DELETE") { seen.deletes.push(decodeURIComponent(p.slice(9))); return json(route, { deleted: true }); }
    if (p === "/stories") return json(route, { stories: stories.filter(s => !seen.deletes.includes(s.storyId)), reels: [], dailyTakeCount: 3 });
    if (p === "/secure-posts") return json(route, { posts: [] });
    return json(route, {});
  });
  await page.goto(`${origin}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#storiesRail .story-placeholder, #storiesRail .story[data-story-id]"), null, { timeout: 10000 });
  await page.waitForTimeout(400);
  return { context, page, seen };
}

const viewerState = page => page.evaluate(() => {
  const viewer = document.getElementById("storyViewer"), shown = selector => { const node = viewer?.querySelector(selector); return Boolean(node && !node.hidden && node.getBoundingClientRect().width > 0); };
  const sizes = [".story-viewer-close", ".story-viewer-delete", ".story-viewer-prev", ".story-viewer-next"].map(selector => viewer?.querySelector(selector)).filter(node => node && !node.hidden).map(node => { const r = node.getBoundingClientRect(); return Math.min(r.width, r.height); });
  return { open: Boolean(viewer?.open), caption: viewer?.querySelector(".story-viewer-caption")?.textContent || "", count: shown(".story-viewer-count") ? viewer.querySelector(".story-viewer-count").textContent : "", del: shown(".story-viewer-delete"), prev: shown(".story-viewer-prev"), next: shown(".story-viewer-next"), smallestTarget: sizes.length ? Math.min(...sizes) : 0 };
});

// A finger swipe at human speed (one move per 60 fps frame). An instant, zero-time swipe reads as a fling and Chrome
// then swallows the next tap, as a phone does when you tap during a fling; people do not swipe in zero time.
async function touchSwipe(page, fromX, toX, y) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y }] });
  for (let step = 1; step <= 10; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + (toX - fromX) * step / 10, y }] });
    await new Promise(resolve => setTimeout(resolve, 16));
  }
  await new Promise(resolve => setTimeout(resolve, 60));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(250);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 360, 390, 414, 430]) {
      const label = `${width}px`;

      // No Dailies of your own today: the tile opens the Mix post box, never a picker.
      let run = await openFeed(browser, width, friends);
      let tile = await run.page.evaluate(() => ({ label: document.querySelector(".story-create").getAttribute("aria-label"), own: document.querySelectorAll("#storiesRail .story[data-story-id]").length }));
      assert.equal(tile.label, "Post a photo or video to your Dailies", `${label}: own tile says what it does when you have no Dailies`);
      assert.equal(tile.own, 2, `${label}: the strip shows friends' Dailies`);
      await run.page.locator(".story-create").tap();
      await run.page.waitForTimeout(400);
      const composer = await run.page.evaluate(() => ({ focused: document.activeElement?.id, expanded: document.getElementById("postComposer")?.classList.contains("is-expanded"), viewer: Boolean(document.getElementById("storyViewer")?.open) }));
      assert.deepEqual(composer, { focused: "postText", expanded: true, viewer: false }, `${label}: with no Dailies the tile opens the Mix post box`);
      // A friend's tile opens that friend's Daily: no delete, no counter.
      await run.page.locator("#storiesRail .story[data-story-id] .story-open").first().tap();
      await run.page.waitForFunction(() => document.getElementById("storyViewer")?.open);
      let state = await viewerState(run.page);
      assert.equal(state.caption, "Soundcheck", `${label}: a friend's tile opens their Daily`);
      assert.deepEqual([state.del, state.count, state.prev, state.next], [false, "", false, false], `${label}: a friend's Daily has no delete or counter`);
      await run.page.locator(".story-viewer-close").tap();
      await run.page.locator(".composer-avatar").first().tap({ timeout: 3000 }).catch(() => {});
      assert.equal(run.seen.pickers, 0, `${label}: no tile or avatar opened a file picker`);
      assert.deepEqual(run.seen.errors, [], `${label}: no page errors`);
      await run.context.close();

      // Three Dailies of your own: the tile opens them as one run you swipe through.
      run = await openFeed(browser, width, [...mine.slice(0, 1), ...friends.slice(0, 1), ...mine.slice(1), ...friends.slice(1)]);
      tile = await run.page.evaluate(() => ({ label: document.querySelector(".story-create").getAttribute("aria-label"), ids: [...document.querySelectorAll("#storiesRail .story[data-story-id]")].map(n => n.dataset.storyId) }));
      assert.equal(tile.label, "Open your Dailies (3)", `${label}: own tile opens your Dailies`);
      assert.deepEqual(tile.ids, ["f1", "f2"], `${label}: your own Dailies are behind your tile, not repeated in the strip`);
      if (width === 360 || width === 390) await run.page.screenshot({ path: path.join(output, `strip-${width}.png`), clip: { x: 0, y: 0, width, height: 340 } });
      await run.page.locator(".story-create").tap();
      await run.page.waitForFunction(() => document.getElementById("storyViewer")?.open);
      await run.page.waitForFunction(() => document.querySelector("#storyViewer .story-viewer-media img")?.complete);
      state = await viewerState(run.page);
      assert.deepEqual([state.caption, state.count, state.del, state.prev, state.next], ["Doors at 8", "1 / 3", true, false, true], `${label}: opens your newest Daily first`);
      assert.ok(state.smallestTarget >= 44, `${label}: viewer buttons are at least 44px (${state.smallestTarget})`);
      if (width === 360 || width === 390) await run.page.screenshot({ path: path.join(output, `viewer-${width}.png`) });
      await touchSwipe(run.page, width * 0.8, width * 0.2, 400);
      state = await viewerState(run.page);
      assert.deepEqual([state.caption, state.count, state.open], ["Merch table", "2 / 3", true], `${label}: a finger swipe left goes to the next Daily`);
      await run.page.locator(".story-viewer-next").tap();
      state = await viewerState(run.page);
      assert.deepEqual([state.caption, state.count, state.next, state.prev], ["Last call", "3 / 3", false, true], `${label}: › goes to the last Daily`);
      await touchSwipe(run.page, width * 0.2, width * 0.8, 400);
      state = await viewerState(run.page);
      assert.deepEqual([state.caption, state.count], ["Merch table", "2 / 3"], `${label}: a finger swipe right goes back`);
      await run.page.keyboard.press("ArrowLeft");
      state = await viewerState(run.page);
      assert.equal(state.count, "1 / 3", `${label}: arrow keys move too`);
      // Delete your own Daily from the viewer: the next one shows and the tile count drops.
      await run.page.locator(".story-viewer-delete").tap();
      await run.page.locator(".danzstak-confirm-dialog button[value=confirm]").tap();
      await run.page.waitForFunction(() => document.querySelector("#storyViewer .story-viewer-count")?.textContent === "1 / 2");
      state = await viewerState(run.page);
      assert.deepEqual(run.seen.deletes, ["m1"], `${label}: the Daily was deleted on the server`);
      assert.equal(state.caption, "Merch table", `${label}: after delete the next Daily shows`);
      assert.equal(await run.page.locator(".story-create").getAttribute("aria-label"), "Open your Dailies (2)", `${label}: the tile count follows`);
      await run.page.locator(".story-viewer-close").tap();
      assert.equal(await run.page.evaluate(() => Boolean(document.getElementById("storyViewer")?.open)), false, `${label}: ✕ closes`);
      assert.equal(run.seen.pickers, 0, `${label}: no file picker opened`);
      assert.deepEqual(run.seen.errors, [], `${label}: no page errors`);
      await run.context.close();
    }
  } finally { await browser.close(); }
  console.log("Dailies tile checks passed at 320, 360, 390, 414 and 430px: own tile opens your Dailies (finger swipe, ‹ ›, arrows, delete) or the post box, friends' tiles open their Daily, own Dailies not repeated in the strip, no file picker anywhere.");
})().catch(error => { console.error(error); process.exitCode = 1; });
