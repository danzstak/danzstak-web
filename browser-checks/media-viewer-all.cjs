"use strict";
// Directive F1 (owner 2026-11-19, phone, after the viewer went live): "When I click on a video it goes full screen. It
// should be able to vertically swipe to see the rest of the videos in that profile." The same for photos: from a photo,
// every photo of that member; from a video, every video, not only the ones drawn on the page (Mix draws 12 at a time).
// Checks at 360/390px with real touch: in Mix, a friend with 20 photo posts and 3 video posts (only the first 12 posts
// are drawn) opens on "1 / 20" from a photo and "1 / 3" from a video; two swipes up and one down move 1 → 3 → 2; another
// member's media never joins in. On the profile Posts tab the same: every photo the member posted (wall posts by
// others left out).
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", friend = "22222222-2222-4222-8222-222222222222", other = "33333333-3333-4333-8333-333333333333";
const svg = colour => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="${colour}"/></svg>`;
const id = n => `${String(n).padStart(8, "0")}-4444-4444-8444-444444444444`;
const at = n => new Date(Date.now() - n * 3600e3).toISOString();
function mixPosts() {
  const posts = [];
  for (let i = 0; i < 20; i++) posts.push({ postId: id(i), userId: friend, authorMemberId: friend, authorName: "Tour Friend", content: `Photo ${i + 1}`, createdAt: at(i * 2 + 1), audience: "public", mediaType: "image", mediaUrl: `${base}/__p${i}.svg` });
  for (let i = 0; i < 3; i++) posts.push({ postId: id(100 + i), userId: friend, authorMemberId: friend, authorName: "Tour Friend", content: `Video ${i + 1}`, createdAt: at(i * 2 + 2), audience: "public", mediaType: "video", mediaUrl: `${base}/__v${i}.webm` });
  for (let i = 0; i < 4; i++) posts.push({ postId: id(200 + i), userId: other, authorMemberId: other, authorName: "Someone Else", content: `Other ${i + 1}`, createdAt: at(i * 2 + 1.5), audience: "public", mediaType: "image", mediaUrl: `${base}/__o${i}.svg` });
  return posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function profilePosts() {
  const posts = [];
  for (let i = 0; i < 15; i++) posts.push({ postId: id(300 + i), userId: me, authorMemberId: me, authorName: "Night Shift", content: `Mine ${i + 1}`, createdAt: at(i + 1), audience: "public", isOwner: true, mediaType: "image", mediaUrl: `${base}/__m${i}.svg` });
  for (let i = 0; i < 2; i++) posts.push({ postId: id(400 + i), userId: other, authorMemberId: other, profileOwnerMemberId: me, authorName: "Someone Else", content: `Wall ${i + 1}`, createdAt: at(i + 1.5), audience: "public", mediaType: "image", mediaUrl: `${base}/__w${i}.svg` });
  return posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

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

async function open(browser, width, path, posts, clip) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/__*.svg`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("#ef6c20") }));
  await page.route(`${base}/__*.webm`, route => route.fulfill({ status: 200, contentType: "video/webm", body: clip }));
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    const body = url.pathname === "/auth/session" ? { authenticated: true, user: { sub: me } }
      : url.pathname === "/profiles" ? { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } }
      : url.pathname === "/secure-posts" ? { posts } : {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/${path}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

async function tapCentre(page, locator) {
  await locator.evaluate(element => element.scrollIntoView({ block: "center" })); // clear of the top bar and the tab bar
  await page.waitForTimeout(250);
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector(".ds-media-viewer", { timeout: 5000 });
  await page.waitForTimeout(300);
}
async function swipe(page, dy) {
  const cdp = await page.context().newCDPSession(page), x = 180, y = 420;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step += 1) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + dy * step / 8 }] }); await new Promise(resolve => setTimeout(resolve, 16)); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(450);
}
const count = page => page.evaluate(() => document.querySelector(".ds-media-viewer-count")?.textContent.trim() || "");
const shown = page => page.evaluate(() => { const slides = document.querySelectorAll(".ds-media-viewer-slide"), slide = slides[globalThis.danzstakMediaViewer.index()]; return (slide?.querySelector("img,video")?.getAttribute("src") || "").split("/").pop(); });

(async () => {
  const browser = await chromium.launch({ channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const clip = await recordClip(browser);
    for (const width of [360, 390]) {
      // Mix: 23 media posts by the friend, only 12 posts drawn.
      let label = `${width}px Mix`;
      let run = await open(browser, width, "feed.html?view=feed", mixPosts(), clip);
      await run.page.waitForSelector("#feed article.post img.post-media", { timeout: 8000 });
      const drawn = await run.page.evaluate(() => document.querySelectorAll("#feed > article.post").length);
      assert.ok(drawn < 27, `${label}: not every post is drawn (${drawn})`);
      await tapCentre(run.page, run.page.locator(`#feed article.post[data-post-id="${id(0)}"] img.post-media`));
      assert.equal(await count(run.page), "1 / 20", `${label}: a photo opens on every one of that member's 20 photos`);
      await swipe(run.page, -260); await swipe(run.page, -260);
      assert.equal(await count(run.page), "3 / 20", `${label}: two swipes up move two photos on`);
      await swipe(run.page, 260);
      assert.equal(await count(run.page), "2 / 20", `${label}: a swipe down goes back one`);
      assert.equal(await shown(run.page), "__p1.svg", `${label}: the second photo is that member's second photo`);
      await run.page.keyboard.press("Escape");
      await run.page.waitForSelector(".ds-media-viewer", { state: "detached", timeout: 5000 });
      // Owner 2026-11-25 (screenshot: two mute buttons on a Mix video, DanzStak's over the browser's ⋮): a Mix video has
      // no browser controls and exactly one mute button, in the video's lower-right corner, like profile videos.
      const vid = run.page.locator(`#feed article.post[data-post-id="${id(100)}"] video.post-media`);
      await vid.evaluate(element => element.scrollIntoView({ block: "center" }));
      await run.page.waitForTimeout(400);
      const mute = await vid.evaluate(video => { const post = video.closest("article.post"), toggles = post.querySelectorAll(".danzstak-audio-toggle"), r = video.getBoundingClientRect(), b = toggles[0]?.getBoundingClientRect(), hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { controls: video.controls || video.hasAttribute("controls"), toggles: toggles.length, bottom: b ? Math.round(r.bottom - b.bottom) : null, right: b ? Math.round(r.right - b.right) : null, hit: Boolean(hit && toggles[0].contains(hit)), focusable: video.tabIndex === 0 }; });
      assert.equal(mute.controls, false, `${label}: a Mix video shows no browser controls`);
      assert.equal(mute.toggles, 1, `${label}: a Mix video has exactly one mute button`);
      assert.ok(mute.bottom >= 0 && mute.bottom <= 16 && mute.right >= 0 && mute.right <= 16, `${label}: the mute button sits in the video's lower-right corner (${JSON.stringify(mute)})`);
      assert.ok(mute.hit, `${label}: a tap on the centre of the mute button reaches it`);
      assert.ok(mute.focusable, `${label}: the video can still be reached by keyboard`);
      // A video opens on that member's videos only.
      await tapCentre(run.page, run.page.locator(`#feed article.post[data-post-id="${id(100)}"] .post-media`).first());
      assert.equal(await count(run.page), "1 / 3", `${label}: a video opens on that member's 3 videos`);
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();

      // Profile Posts tab: the member's own 15 photos, not the 2 wall posts by someone else.
      label = `${width}px profile`;
      run = await open(browser, width, "profile.html#posts", profilePosts(), clip);
      await run.page.waitForSelector(".profile-post-card img.profile-post-media", { timeout: 8000 });
      await tapCentre(run.page, run.page.locator(`.profile-post-card[data-post-id="${id(300)}"] img.profile-post-media`));
      assert.equal(await count(run.page), "1 / 15", `${label}: a photo opens on every photo the member posted`);
      await swipe(run.page, -260); await swipe(run.page, -260); await swipe(run.page, 260);
      assert.equal(await count(run.page), "2 / 15", `${label}: up, up, down lands on the second photo`);
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();
    }
    console.log("Media viewer (all of a member's media) checks passed at 360 and 390px: Mix opens on all 20 photos / 3 videos of that member though only 12 posts are drawn; the profile Posts tab on all 15 of the member's photos; touch swipes up, up, down.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
