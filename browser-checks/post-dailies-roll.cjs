"use strict";
// T0-A1 (owner 2026-11-18): every photo or video post goes into Dailies (24 h) and every video into The Roll,
// automatically — no checkboxes in the Mix composer. Real browser at 320, 360, 390, 414 and 430px:
// - the composer has no "Dailies" / "The Roll" boxes;
// - a video post sends reel: true;
// - when the server adds the Daily itself (dailyCreated: true) the composer does not upload the video a second time;
// - against an older server (no dailyCreated) the composer still adds the Daily itself, so nothing is lost.
// The page is served from this checkout under a non-local host name, so the composer runs its real (not
// local-development) path. No server needed: node browser-checks/post-dailies-roll.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const origin = "https://review.danzstak.test"; // https: the page CSP upgrades insecure requests
const output = path.resolve("docs/screenshots/post-dailies-roll");
const me = "11111111-1111-4111-8111-111111111111";
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function postVideo(browser, width, serverAddsDaily) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: 2 });
  const page = await context.newPage(), seen = { postBody: null, dailyUploads: 0, errors: [] };
  page.on("pageerror", e => seen.errors.push(e.message));
  // Serve the site from this checkout under the non-local host name (no DNS or network involved).
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/__upload/")) return route.fulfill({ status: 200, body: "" });
    const file = path.join(process.cwd(), decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" } });
    if (p === "/auth/session") return json(route, { authenticated: true, user: { sub: me, email: "artist@danzstak.invalid" } });
    if (p === "/profiles") return json(route, { profile: { memberId: me, name: "Night Shift", handle: "nightshift", cloudProfile: true, isOwner: true } });
    if (p === "/stories" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      if (body.contentType) return json(route, { uploadUrl: `${origin}/__upload/${Date.now()}`, mediaKey: `users/${"a".repeat(24)}/${"b".repeat(8)}-bbbb-4bbb-8bbb-${"b".repeat(12)}.mp4`, mediaType: "video" });
      if (body.dedicatedMedia === true) { seen.dailyUploads += 1; return json(route, { storyId: "s1" }, 201); }
      return json(route, {}, 201);
    }
    if (p === "/stories") return json(route, { stories: [], reels: [], dailyTakeCount: 0 });
    if (p === "/secure-posts" && method === "POST") {
      seen.postBody = JSON.parse(request.postData() || "{}");
      return json(route, { postId: "33333333-3333-4333-8333-333333333333", content: seen.postBody.content, createdAt: new Date().toISOString(), audience: seen.postBody.audience, mediaKey: seen.postBody.mediaKey, mediaType: seen.postBody.mediaType, reel: true, ...(serverAddsDaily ? { dailyCreated: true, daily: { storyId: "d1" } } : {}) }, 201);
    }
    if (p === "/secure-posts") return json(route, { posts: [] });
    return json(route, {});
  });
  await page.goto(`${origin}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.locator("#postText").click(); // opens the post box, as a member would
  await page.locator(".composer-media-video").waitFor({ timeout: 10000 });
  const boxes = await page.evaluate(() => ({ story: Boolean(document.getElementById("shareToStory")), roll: Boolean(document.getElementById("shareToReels")), labels: [...document.querySelectorAll("label")].map(l => l.textContent.trim()).filter(t => /^(Dailies|The Roll)$/.test(t)) }));
  await page.locator("#postText").fill("Set from last night");
  const input = page.locator(".composer-media-video + input[type=file]");
  await input.setInputFiles({ name: "set.mp4", mimeType: "video/mp4", buffer: Buffer.from("not a real video, typed as one") });
  await page.waitForFunction(() => window.danzstakSelectedMedia?.kind === "video", null, { timeout: 5000 });
  if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `composer-${serverAddsDaily ? "new" : "old"}-server-${width}.png`) });
  await page.evaluate(() => { const c = document.getElementById("originalContentCertification"); if (c && !c.checked) c.click(); });
  await page.locator("#publishBtn").click();
  await page.waitForFunction(() => document.querySelector("#feed .post"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  await context.close();
  return { boxes, ...seen };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 360, 390, 414, 430]) {
      const label = `${width}px`;
      let run = await postVideo(browser, width, true);
      assert.deepEqual(run.boxes, { story: false, roll: false, labels: [] }, `${label}: no Dailies / The Roll checkboxes in the composer`);
      assert.ok(run.postBody, `${label}: the post was sent`);
      assert.equal(run.postBody.mediaType, "video");
      assert.equal(run.postBody.reel, true, `${label}: every posted video goes to The Roll`);
      assert.equal(run.dailyUploads, 0, `${label}: the server added the Daily, so the video is not uploaded a second time`);
      assert.deepEqual(run.errors, [], `${label}: no page errors`);
      run = await postVideo(browser, width, false);
      assert.equal(run.dailyUploads, 1, `${label}: against an older server the composer still adds the Daily itself`);
      assert.deepEqual(run.errors, [], `${label}: no page errors`);
    }
  } finally { await browser.close(); }
  console.log("Post Dailies/Roll browser checks passed at 320, 360, 390, 414 and 430px: no Dailies / The Roll checkboxes, every video post sends reel, no second upload when the server adds the Daily, the old Daily upload still runs against an older server.");
})().catch(error => { console.error(error); process.exitCode = 1; });
