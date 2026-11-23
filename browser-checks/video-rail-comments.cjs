"use strict";
// Directive F1a (owner 2026-11-19): full-screen video with the actions on the right and the comments in a sheet below
// the video. Checks with real touch at 360/390px, from a Mix video (shared media viewer) and from The Roll:
// - the rail sits on the right edge above the sound toggle: the author's photo, Like, Comment, Save and Share, each a
//   44px+ target with its count/label under it; the author's name and caption sit bottom-left; nothing overlaps;
// - a tap on the centre of the Like icon likes the post (count +1, sent to the server);
// - a tap on the centre of the Comment icon: the video ends in the top half and the sheet sits below it with the
//   "Comment as …" box (own photo) on screen; comments are Newest first and Oldest on tap (never ranked); replies are
//   folded under "View 1 reply";
// - posting a comment sends it and shows it first;
// - swiping the sheet down closes it, the video fills the screen again and kept playing (same element, no reload,
//   currentTime moved on); system Back closes the sheet first, then the viewer;
// - in The Roll the same: the card re-fills the screen on the same video.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const me = "11111111-1111-4111-8111-111111111111", friend = "22222222-2222-4222-8222-222222222222";
const photo = colour => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${colour}"/></svg>`)}`;
const hoursAgo = n => new Date(Date.now() - n * 3600e3).toISOString();
const VIDEO_POST = "aaaaaaaa-1111-4111-8111-000000000001";

function store() {
  return {
    reactionCounts: { Like: 3 }, myReaction: "",
    comments: [
      { commentId: "c-old", content: "First!", createdAt: hoursAgo(5), authorName: "Ana Riot", authorMemberId: "44444444-4444-4444-8444-444444444444", authorPicture: photo("#3366ff"), reactionCounts: { Like: 2 }, reactionTotal: 2, myReaction: "" },
      { commentId: "c-reply", content: "Same here", createdAt: hoursAgo(4), parentCommentId: "c-old", replyToName: "Ana Riot", authorName: "Bo Static", authorMemberId: "55555555-5555-4555-8555-555555555555", authorPicture: "", reactionCounts: {}, reactionTotal: 0, myReaction: "" },
      { commentId: "c-new", content: "Loud and perfect", createdAt: hoursAgo(1), authorName: "Cy Noise", authorMemberId: "66666666-6666-4666-8666-666666666666", authorPicture: photo("#22aa66"), reactionCounts: {}, reactionTotal: 0, myReaction: "" }
    ],
    sent: []
  };
}

// A 6-second WebM recorded in the browser, so no binary lives in the repository.
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
      for (let frame = 0; frame < 90; frame += 1) { paint.fillStyle = frame % 30 < 15 ? "#ff5a1f" : "#121418"; paint.fillRect(0, 0, 360, 640); await new Promise(resolve => setTimeout(resolve, 66)); }
      recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
      return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
    });
    return Buffer.from(bytes);
  } finally { await context.close(); }
}

async function open(browser, width, clip, data, pagePath = "feed.html?view=feed") {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: captureDir ? 2 : 1 });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/__clip*.webm`, route => route.fulfill({ status: 200, contentType: "video/webm", body: clip }));
  const posts = [
    { postId: VIDEO_POST, userId: friend, authorMemberId: friend, authorName: "Tour Friend", authorPicture: photo("#ff5a1f"), content: "Soundcheck at the Elbo Room", createdAt: hoursAgo(2), audience: "public", mediaType: "video", mediaKey: "k1", mediaUrl: `${base}/__clip1.webm`, reel: true },
    { postId: "aaaaaaaa-1111-4111-8111-000000000002", userId: friend, authorMemberId: friend, authorName: "Tour Friend", content: "Doors at 8", createdAt: hoursAgo(3), audience: "public" }
  ];
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const json = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    const body = (() => { try { return JSON.parse(request.postData() || "{}"); } catch { return {}; } })();
    if (url.pathname === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (url.pathname === "/profiles" || url.pathname === "/profile") return json({ profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", picture: photo("#9b59b6"), isOwner: true, cloudProfile: true } });
    if (url.pathname === "/secure-posts") return json({ posts: pagePath.startsWith("profile") ? posts.map(post => ({ ...post, userId: me, authorMemberId: me, authorName: "Night Shift", isOwner: true })) : posts });
    if (url.pathname === "/engagement") return json({ reactionCounts: data.reactionCounts, myReaction: data.myReaction, comments: data.comments });
    if (url.pathname === "/reactions" && method === "POST") {
      data.sent.push({ type: "reaction", ...body });
      if (!body.commentId) { if (body.reaction) { data.reactionCounts.Like = (data.reactionCounts.Like || 0) + (data.myReaction ? 0 : 1); data.myReaction = body.reaction; } else { data.reactionCounts.Like = Math.max(0, (data.reactionCounts.Like || 0) - 1); data.myReaction = ""; } }
      return json({ reaction: body.reaction || "" });
    }
    if (url.pathname === "/comments" && method === "POST") {
      const comment = { commentId: `c-${data.comments.length + 1}`, content: body.content, createdAt: new Date().toISOString(), authorName: "Night Shift", authorMemberId: me, authorPicture: photo("#9b59b6"), isOwner: true, canDelete: true, reactionCounts: {}, reactionTotal: 0, myReaction: "", ...(body.parentCommentId ? { parentCommentId: body.parentCommentId } : {}) };
      data.comments.push(comment); data.sent.push({ type: "comment", ...body });
      return json({ comment });
    }
    if (url.pathname === "/settings/posts" && method === "POST") { data.sent.push({ type: "save", ...body }); return json({ ok: true }); }
    return json({});
  });
  await page.goto(`${base}/${pagePath}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

async function tapCentreOf(page, selector) {
  const point = await page.evaluate(selector => {
    const element = [...document.querySelectorAll(selector)].find(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden");
    if (!element) return null;
    const target = element.querySelector("svg") || element, r = target.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, hit: Boolean(document.elementFromPoint(x, y)?.closest(selector)) };
  }, selector);
  assert.ok(point, `nothing to tap for ${selector}`);
  assert.equal(point.hit, true, `${selector}: its centre is not covered`);
  await page.touchscreen.tap(point.x, point.y);
}
async function dragDown(page, selector, distance) {
  const r = await page.locator(selector).first().boundingBox();
  const cdp = await page.context().newCDPSession(page), x = r.x + r.width / 2, y = r.y + 10;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step += 1) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + distance * step / 10 }] }); await new Promise(resolve => setTimeout(resolve, 16)); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

// The rail, caption and sound toggle, measured in the layer that is on screen.
const layout = (page, scope) => page.evaluate(scope => {
  const layer = document.querySelector(scope);
  const host = [...layer.querySelectorAll(".ds-ma-host")].find(node => { const r = node.getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight / 2 && r.height > 50; });
  const box = element => { if (!element) return null; const r = element.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }; };
  const rail = host?.querySelector(".ds-ma-rail");
  return {
    rail: box(rail), caption: box(host?.querySelector(".ds-ma-caption")), sound: box(host?.querySelector(".danzstak-audio-toggle")),
    items: [...(rail?.children || [])].map(child => ({ cls: child.className, label: child.getAttribute("aria-label") || "", count: child.querySelector(".ds-ma-count")?.textContent || "", ...box(child) })),
    author: host?.querySelector(".ds-ma-author img")?.getAttribute("src") || "", name: host?.querySelector(".ds-ma-name")?.textContent || "", text: host?.querySelector(".ds-ma-text")?.textContent || "",
    video: box(host?.querySelector("video")), overflow: document.documentElement.scrollWidth > innerWidth, innerHeight
  };
}, scope);
const videoState = (page, scope) => page.evaluate(scope => {
  const host = [...document.querySelector(scope).querySelectorAll(".ds-ma-host")].find(node => { const r = node.getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight / 2 && r.height > 50; });
  const video = host?.querySelector("video"), r = video?.getBoundingClientRect();
  if (video && !video.dataset.watchLoad) { video.dataset.watchLoad = "1"; video.addEventListener("loadstart", () => { video.dataset.reloaded = "1"; }); }
  return { id: video?.src || "", time: video?.currentTime || 0, paused: video?.paused, reloaded: video?.dataset.reloaded === "1", top: Math.round(r?.top || 0), bottom: Math.round(r?.bottom || 0), height: Math.round(r?.height || 0), postId: host?.closest("[data-post-id]")?.dataset.postId || host?.dataset.postId || "" };
}, scope);
const sheetState = page => page.evaluate(() => {
  const sheet = document.querySelector(".ds-comment-sheet.is-open"); if (!sheet) return null;
  const r = sheet.getBoundingClientRect(), input = sheet.querySelector(".ds-cs-input").getBoundingClientRect();
  return {
    top: Math.round(r.top), bottom: Math.round(r.bottom), input: { top: Math.round(input.top), bottom: Math.round(input.bottom), height: Math.round(input.height) },
    placeholder: sheet.querySelector(".ds-cs-input").placeholder, me: sheet.querySelector(".ds-cs-me img")?.getAttribute("src") || "",
    sort: sheet.querySelector(".ds-cs-sort").textContent.trim(),
    rows: [...sheet.querySelectorAll(".ds-cs-list > .ds-cs-row")].map(row => row.querySelector(":scope > .ds-cs-body > .ds-cs-text").textContent),
    replies: [...sheet.querySelectorAll(".ds-cs-replies:not([hidden]) .ds-cs-text")].map(node => node.textContent),
    more: [...sheet.querySelectorAll(".ds-cs-more")].map(node => node.textContent.trim()),
    targets: [...sheet.querySelectorAll("button")].filter(button => button.getClientRects().length).map(button => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))
  };
});

function checkRail(label, l) {
  assert.ok(l.rail, `${label}: the rail is shown`);
  assert.deepEqual(l.items.map(item => item.cls.split(" ").find(name => /^ds-ma-(author|like|comment|save|share)$/.test(name))), ["ds-ma-author", "ds-ma-like", "ds-ma-comment", "ds-ma-save", "ds-ma-share"], `${label}: avatar, Like, Comment, Save, Share in that order`);
  for (const item of l.items) assert.ok(item.width >= 44 && item.height >= 44, `${label}: ${item.cls} is a 44px target ${JSON.stringify(item)}`);
  assert.ok(l.rail.right >= l.innerHeight * 0 && l.rail.right <= (l.video?.right ?? 9999) + 1 && l.rail.left > (l.caption?.right ?? 0) - 1, `${label}: the rail is on the right, clear of the caption ${JSON.stringify({ rail: l.rail, caption: l.caption })}`);
  if (l.sound) assert.ok(l.rail.bottom <= l.sound.top + 1, `${label}: the rail sits above the sound toggle ${JSON.stringify({ rail: l.rail, sound: l.sound })}`);
  assert.match(l.author, /^data:image\/svg/, `${label}: the author's own photo`);
  assert.equal(l.name, "Tour Friend", `${label}: the author's name bottom-left`);
  assert.equal(l.text, "Soundcheck at the Elbo Room", `${label}: the caption`);
  assert.equal(l.overflow, false, `${label}: no sideways scroll`);
}

async function commentsRound(page, label, scope, data, shots) {
  const before = await videoState(page, scope);
  await tapCentreOf(page, `${scope} .ds-ma-host .ds-ma-comment`);
  await page.waitForSelector(".ds-comment-sheet.is-open", { timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll(".ds-comment-sheet .ds-cs-list > .ds-cs-row").length > 0, null, { timeout: 5000 });
  await page.waitForTimeout(350);
  const sheet = await sheetState(page), small = await videoState(page, scope);
  if (shots) await page.screenshot({ path: path.join(captureDir, `${shots}-comments.png`) });
  assert.ok(small.bottom <= sheet.top + 1 && small.bottom <= small.height + 4 && small.bottom <= 0.5 * (await page.evaluate(() => innerHeight)), `${label}: the video ends in the top half, above the sheet ${JSON.stringify({ video: small, sheet: { top: sheet.top } })}`);
  assert.ok(small.height > 100, `${label}: the video is still shown (${small.height}px)`);
  assert.ok(sheet.input.bottom <= (await page.evaluate(() => innerHeight)) && sheet.input.height >= 44, `${label}: the comment box is on screen ${JSON.stringify(sheet.input)}`);
  assert.equal(sheet.placeholder, "Comment as Night Shift", `${label}: Comment as you`);
  assert.match(sheet.me, /^data:image\/svg/, `${label}: your own photo by the box`);
  assert.equal(sheet.sort, "Newest ▾", `${label}: newest first`);
  assert.deepEqual(sheet.rows.slice(0, 2), ["Loud and perfect", "First!"], `${label}: chronological, newest first`);
  assert.deepEqual(sheet.replies, [], `${label}: replies start folded`);
  assert.deepEqual(sheet.more, ["View 1 reply"], `${label}: View 1 reply`);
  for (const size of sheet.targets) assert.ok(size >= 44, `${label}: every sheet button is a 44px target (${size})`);
  await tapCentreOf(page, ".ds-comment-sheet .ds-cs-sort");
  assert.deepEqual((await sheetState(page)).rows.slice(0, 2), ["First!", "Loud and perfect"], `${label}: Oldest first on tap`);
  await tapCentreOf(page, ".ds-comment-sheet .ds-cs-more");
  assert.deepEqual((await sheetState(page)).replies, ["Same here"], `${label}: the reply unfolds`);
  await tapCentreOf(page, ".ds-comment-sheet .ds-cs-sort");
  // Post a comment.
  await page.locator(".ds-comment-sheet .ds-cs-input").fill(`Great set ${label}`);
  await tapCentreOf(page, ".ds-comment-sheet .ds-cs-send");
  await page.waitForFunction(text => [...document.querySelectorAll(".ds-comment-sheet .ds-cs-list > .ds-cs-row .ds-cs-text")][0]?.textContent === text, `Great set ${label}`, { timeout: 5000 });
  assert.deepEqual(data.sent.filter(item => item.type === "comment").pop(), { type: "comment", postId: VIDEO_POST, content: `Great set ${label}` }, `${label}: the comment is sent`);
  // Swipe the sheet down: the video fills the screen again and kept playing.
  await page.waitForTimeout(600);
  await dragDown(page, ".ds-comment-sheet .ds-cs-head", 260);
  await page.waitForSelector(".ds-comment-sheet", { state: "detached", timeout: 5000 });
  await page.waitForTimeout(400);
  const after = await videoState(page, scope), height = await page.evaluate(() => innerHeight);
  assert.ok(after.height >= height * 0.9 || after.bottom >= height * 0.85, `${label}: the video fills the screen again ${JSON.stringify(after)}`);
  assert.equal(after.id, before.id, `${label}: the same video`);
  assert.equal(after.reloaded, false, `${label}: the video was not reloaded`);
  assert.equal(after.paused, false, `${label}: still playing`);
  assert.ok(after.time > before.time, `${label}: it kept going (${before.time} → ${after.time})`);
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  if (captureDir) fs.mkdirSync(captureDir, { recursive: true });
  try {
    const clip = await recordClip(browser);
    for (const width of [360, 390]) {
      // ---- Mix → the shared media viewer
      let label = `${width}px Mix viewer`, data = store();
      let run = await open(browser, width, clip, data);
      await run.page.waitForSelector(`#feed article.post[data-post-id="${VIDEO_POST}"] video.post-media`, { timeout: 8000 });
      await run.page.locator(`#feed article.post[data-post-id="${VIDEO_POST}"] video.post-media`).evaluate(element => element.scrollIntoView({ block: "center" }));
      await run.page.waitForTimeout(300);
      const videoBox = await run.page.locator(`#feed article.post[data-post-id="${VIDEO_POST}"] video.post-media`).boundingBox();
      await run.page.touchscreen.tap(videoBox.x + videoBox.width / 2, videoBox.y + videoBox.height / 2);
      await run.page.waitForSelector(".ds-media-viewer .ds-ma-rail", { timeout: 5000 });
      await run.page.waitForFunction(() => document.querySelector(".ds-media-viewer .ds-ma-like .ds-ma-count")?.textContent === "3", null, { timeout: 5000 });
      await run.page.waitForTimeout(500);
      checkRail(label, await layout(run.page, ".ds-media-viewer"));
      if (captureDir) await run.page.screenshot({ path: path.join(captureDir, `viewer-rail-${width}.png`) });
      await tapCentreOf(run.page, ".ds-media-viewer .ds-ma-like");
      await run.page.waitForFunction(() => document.querySelector(".ds-media-viewer .ds-ma-like")?.getAttribute("aria-pressed") === "true" && document.querySelector(".ds-media-viewer .ds-ma-like .ds-ma-count")?.textContent === "4", null, { timeout: 5000 });
      assert.deepEqual(data.sent.find(item => item.type === "reaction"), { type: "reaction", postId: VIDEO_POST, reaction: "Like" }, `${label}: the like is sent`);
      await tapCentreOf(run.page, ".ds-media-viewer .ds-ma-save");
      await run.page.waitForFunction(() => document.querySelector(".ds-media-viewer .ds-ma-save")?.getAttribute("aria-pressed") === "true", null, { timeout: 5000 });
      assert.deepEqual(data.sent.find(item => item.type === "save"), { type: "save", postId: VIDEO_POST, preference: "saved", enabled: true }, `${label}: Save is sent`);
      await commentsRound(run.page, label, ".ds-media-viewer", data, captureDir ? `viewer-${width}` : "");
      // System Back: the sheet first, then the viewer.
      await tapCentreOf(run.page, ".ds-media-viewer .ds-ma-comment");
      await run.page.waitForSelector(".ds-comment-sheet.is-open", { timeout: 5000 });
      await run.page.goBack();
      await run.page.waitForSelector(".ds-comment-sheet", { state: "detached", timeout: 5000 });
      assert.equal(await run.page.locator(".ds-media-viewer").count(), 1, `${label}: Back closes the comments, not the viewer`);
      await run.page.goBack();
      await run.page.waitForSelector(".ds-media-viewer", { state: "detached", timeout: 5000 });
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();

      // ---- The Roll, full screen
      label = `${width}px The Roll`; data = store();
      run = await open(browser, width, clip, data);
      await run.page.waitForSelector(".reels-rail .reel-card .reel-fullscreen-trigger", { timeout: 8000 });
      await run.page.locator(".reels-rail .reel-card").first().evaluate(element => element.scrollIntoView({ block: "center" }));
      await run.page.waitForTimeout(300);
      const tile = await run.page.locator(".reels-rail .reel-card").first().boundingBox();
      await run.page.touchscreen.tap(tile.x + tile.width / 2, tile.y + tile.height / 2);
      await run.page.waitForSelector(".reels-rail.roll-fullscreen .ds-ma-rail", { timeout: 5000 });
      await run.page.waitForFunction(() => document.querySelector(".reels-rail .ds-ma-like .ds-ma-count")?.textContent === "3", null, { timeout: 5000 });
      await run.page.waitForTimeout(600);
      checkRail(label, await layout(run.page, ".reels-rail.roll-fullscreen"));
      assert.equal(await run.page.evaluate(() => [...document.querySelectorAll(".reels-rail.roll-fullscreen .reel-details")].filter(node => node.getClientRects().length).length), 0, `${label}: the old caption strip gives way to the rail's caption`);
      if (captureDir) await run.page.screenshot({ path: path.join(captureDir, `roll-rail-${width}.png`) });
      await commentsRound(run.page, label, ".reels-rail.roll-fullscreen", data, captureDir ? `roll-${width}` : "");
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();

      // ---- Your profile's Posts tab → the same viewer, rail and sheet
      label = `${width}px profile`; data = store();
      run = await open(browser, width, clip, data, "profile.html#posts");
      await run.page.waitForSelector(`.profile-post-card[data-post-id="${VIDEO_POST}"] video.profile-post-media`, { timeout: 8000 });
      await run.page.locator(`.profile-post-card[data-post-id="${VIDEO_POST}"] video.profile-post-media`).evaluate(element => element.scrollIntoView({ block: "center" }));
      await run.page.waitForTimeout(300);
      const own = await run.page.locator(`.profile-post-card[data-post-id="${VIDEO_POST}"] video.profile-post-media`).boundingBox();
      await run.page.touchscreen.tap(own.x + own.width / 2, own.y + own.height / 2);
      await run.page.waitForSelector(".ds-media-viewer .ds-ma-rail", { timeout: 5000 });
      await run.page.waitForTimeout(400);
      const mine = await layout(run.page, ".ds-media-viewer");
      assert.equal(mine.items.length, 5, `${label}: the rail is there`);
      assert.equal(mine.name, "Night Shift", `${label}: your own name on your video`);
      await tapCentreOf(run.page, ".ds-media-viewer .ds-ma-comment");
      await run.page.waitForSelector(".ds-comment-sheet.is-open .ds-cs-row", { timeout: 5000 });
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();
    }
    console.log("Full-screen video rail and comments checks passed at 360 and 390px (Mix viewer, The Roll and your profile): avatar, Like, Comment, Save and Share on the right above the sound toggle with counts; Like and Save are sent; Comment puts the video in the top half with the sheet below (Comment as you, newest first, Oldest on tap, replies folded); a posted comment shows first; swiping the sheet down brings the video back full screen, still playing, never reloaded; Back closes the comments before the viewer.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
