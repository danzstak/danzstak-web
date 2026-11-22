"use strict";
// Owner 2026-11-22: "should be able to upload multiple photos at once", "set a limit of 20 photos". Before: the Mix
// photo picker took one photo, so three photos meant three posts. Now one post holds up to 20 photos, each also a Daily
// (server), swiped sideways on the post. Real browser at 360 and 390px, touch:
// - Mix composer: picking 3 photos shows 3 squares and "3 photos"; Post uploads each photo once and sends one post with
//   the first as mediaKey and the other 2 as moreMediaKeys; the new post shows them in one frame "1/3";
// - an Auth API from before this change (no moreMediaKeys in its answer): the 2 other photos become their own posts with
//   the same words, so nothing picked is lost;
// - picking 21 photos keeps the first 20 and says so;
// - Mix post with 3 photos: one full-width frame shaped like the first photo, "1/3"; a touch swipe left shows "2/3" and
//   the frame turns into the second photo's shape (square), the photo filling it;
//   tapping the centre of that photo opens it full screen at the same photo (the viewer has all 3);
// - profile: the same post shows the frame, and the Photos tab has a tile for each photo;
// - profile composer: picking 3 photos sends one post with 2 moreMediaKeys.
// The site is served from this checkout under a non-local host name (as in post-dailies-roll.cjs), so the composers run
// their real path. No server needed: node browser-checks/post-photos.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { chromium } = require("playwright");

const origin = "https://review.danzstak.test";
const output = path.resolve("docs/screenshots/post-photos");
const me = "11111111-1111-4111-8111-111111111111";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const cors = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };

// A solid-colour PNG (real, decodable), so the phone-size scaling step treats it like a camera photo.
function png(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buffer => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(height).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
}
const colours = [[34, 170, 102], [204, 102, 51], [51, 102, 204], [170, 51, 170]];
const photoFile = index => ({ name: `photo-${index + 1}.png`, mimeType: "image/png", buffer: png(index === 0 ? 320 : 240, index === 0 ? 180 : 240, colours[index % colours.length]) });
const svg = (width, height, colour) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${colour}"/></svg>`;
const shown = [[1600, 900, "#2a6"], [1080, 1080, "#c63"], [1080, 1350, "#36c"]];
const POST = "33333333-3333-4333-8333-333333333333";
const FILLER = "55555555-5555-4555-8555-555555555555";
// A photo posted without words carries the filler "Shared media" (owner 2026-11-22 screenshot): only the photo shows.
const fillerPost = { postId: FILLER, userId: me, authorMemberId: me, authorName: "Night Shift", authorPicture: "", content: "Shared media", createdAt: new Date(Date.now() - 2 * 864e5).toISOString(), audience: "public", isOwner: true, byProfileOwner: true, mediaType: "image", mediaUrl: `${origin}/__shown/1.svg?filler` };
const wallPost = { postId: POST, userId: me, authorMemberId: me, authorName: "Night Shift", authorPicture: "", content: "Three from the gig", createdAt: new Date(Date.now() - 864e5).toISOString(), audience: "public", isOwner: true, byProfileOwner: true, mediaType: "image", mediaUrl: `${origin}/__shown/0.svg`, moreMediaUrls: [`${origin}/__shown/1.svg`, `${origin}/__shown/2.svg`] };

async function open(browser, width, pathName, { oldServer = false, posts = [] } = {}) {
  // An Android phone's browser name, so the post counts as a phone upload ("Mobile uploads").
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A146U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" });
  const page = await context.newPage(), seen = { posts: [], tickets: 0, uploads: 0, discards: 0, errors: [] };
  page.on("pageerror", error => seen.errors.push(error.message));
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/__upload/")) { seen.uploads += 1; return route.fulfill({ status: 200, body: "" }); }
    const picture = url.pathname.match(/^\/__shown\/(\d)\.svg$/);
    if (picture) { const [w, h, colour] = shown[Number(picture[1])]; return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(w, h, colour) }); }
    const file = path.join(process.cwd(), decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (p === "/auth/session") return reply({ authenticated: true, user: { sub: me, email: "artist@danzstak.invalid" } });
    if (p === "/profiles" || p === "/profile") return reply({ profile: { memberId: me, name: "Night Shift", handle: "nightshift", username: "nightshift", cloudProfile: true, isOwner: true } });
    if (p === "/stories" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      if (body.action === "discard") { seen.discards += 1; return reply({}); }
      if (body.contentType) { seen.tickets += 1; return reply({ uploadUrl: `${origin}/__upload/${seen.tickets}`, mediaKey: `users/${"a".repeat(24)}/${String(seen.tickets).padStart(8, "0")}-bbbb-4bbb-8bbb-${"b".repeat(12)}.jpg`, mediaType: "image" }); }
      return reply({}, 201);
    }
    if (p === "/stories") return reply({ stories: [], reels: [], dailyTakeCount: 0 });
    if (p === "/secure-posts" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      seen.posts.push(body);
      const postId = `4444444${seen.posts.length}-4444-4444-8444-444444444444`;
      return reply({ postId, userId: me, content: body.content, createdAt: new Date().toISOString(), audience: body.audience || "public", mediaKey: body.mediaKey, mediaType: body.mediaType, dailyCreated: true, ...(oldServer ? {} : { moreMediaKeys: body.moreMediaKeys || [] }) }, 201);
    }
    if (p === "/secure-posts") return reply({ posts });
    if (p === "/albums" && method === "GET") return reply({ isOwner: true, albums: [{ albumId: "c".repeat(32), name: "Hellfest 2026", visibility: "public", photoCount: 3, videoCount: 0, cover: null }], automatic: { mobile: "Mobile uploads", computer: "Computer uploads" }, renamed: [] });
    if (p === "/engagement") return reply({ reactionCounts: {}, comments: [] });
    if (p === "/settings/posts") return reply({ hiddenPostIds: [] });
    return reply({});
  });
  await page.goto(`${origin}/${pathName}`, { waitUntil: "domcontentloaded" });
  return { context, page, seen };
}

async function swipeLeft(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  const cdp = await page.context().newCDPSession(page), y = box.y + box.height / 2, x = box.x + box.width * 0.8, dx = -box.width * 0.6;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step += 1) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * step / 8, y }] }); await new Promise(resolve => setTimeout(resolve, 16)); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(700);
}

async function postFromMix(browser, width, { oldServer = false, count = 3 } = {}) {
  const { context, page, seen } = await open(browser, width, "feed.html?view=feed", { oldServer });
  await page.waitForTimeout(1200);
  await page.locator("#postText").click();
  await page.locator(".composer-media-image").waitFor({ timeout: 10000 });
  await page.locator("#postText").fill("Three from the gig");
  await page.locator(".composer-media-image + input[type=file]").setInputFiles(Array.from({ length: count }, (_, index) => photoFile(index)));
  await page.waitForFunction(() => window.danzstakSelectedMedia?.kind === "image", null, { timeout: 8000 });
  const preview = await page.evaluate(() => ({ thumbs: document.querySelectorAll(".post-photos-picked img").length, count: document.querySelector(".post-photos-picked-count")?.textContent.trim() || "", feedback: document.body.innerText.includes("A post holds up to 20 photos"), chip: document.querySelector(".post-album-chip")?.textContent.trim() || "" }));
  if (count === 3 && (width === 360 || width === 390) && !oldServer) await page.screenshot({ path: path.join(output, `composer-${width}.png`) });
  if (count > 3) { await context.close(); return { preview, seen }; }
  await page.evaluate(() => { const box = document.getElementById("originalContentCertification"); if (box && !box.checked) box.click(); });
  await page.locator("#publishBtn").click();
  await page.waitForFunction(want => document.querySelectorAll("#feed .post").length >= want, oldServer ? 3 : 1, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const drawn = await page.evaluate(() => ({ frames: document.querySelectorAll("#feed .post > .post-photos").length, count: document.querySelector("#feed .post .post-photos-count")?.textContent.trim() || "", posts: document.querySelectorAll("#feed .post").length }));
  await context.close();
  return { preview, drawn, seen };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  try {
    for (const width of [360, 390]) {
      // Mix composer, current server.
      let run = await postFromMix(browser, width);
      check(run.preview.thumbs === 3 && run.preview.count === "3 photos", `${width}px: the composer did not show 3 photos (${JSON.stringify(run.preview)})`);
      check(run.preview.chip.startsWith("Album: Mobile uploads"), `${width}px: the Mix composer has no "Album: Mobile uploads" chip (${JSON.stringify(run.preview.chip)})`);
      check(run.seen.tickets === 3 && run.seen.uploads === 3, `${width}px: expected 3 uploads, got ${run.seen.tickets} tickets / ${run.seen.uploads} uploads`);
      check(run.seen.posts.length === 1, `${width}px: expected one post, sent ${run.seen.posts.length}`);
      const body = run.seen.posts[0] || {};
      check(body.mediaType === "image" && body.mediaKey && Array.isArray(body.moreMediaKeys) && body.moreMediaKeys.length === 2 && !body.moreMediaKeys.includes(body.mediaKey), `${width}px: the post did not carry the first photo + 2 more (${JSON.stringify(body)})`);
      check(run.drawn?.frames === 1 && run.drawn.count === "1/3", `${width}px: the new post did not show one 3-photo frame (${JSON.stringify(run.drawn)})`);
      check(body.uploadSource === "mobile" && body.albumId === undefined, `${width}px: a Mix post with no album chosen should go to Mobile uploads (${JSON.stringify({ uploadSource: body.uploadSource, albumId: body.albumId })})`);
      check(!run.seen.errors.length, `${width}px: script errors: ${run.seen.errors.join(" | ")}`);

      // Mix composer, Auth API from before multi-photo posts.
      run = await postFromMix(browser, width, { oldServer: true });
      check(run.seen.posts.length === 3 && run.seen.posts.every(post => post.content === "Three from the gig" && post.mediaType === "image"), `${width}px: an older server did not get each photo as its own post (${run.seen.posts.length} posts)`);
      check(new Set(run.seen.posts.map(post => post.mediaKey)).size === 3 && run.seen.discards === 0, `${width}px: older server: photos were not each posted once (${JSON.stringify(run.seen.posts.map(post => post.mediaKey))}, ${run.seen.discards} discarded)`);

      // 21 photos: the first 20.
      run = await postFromMix(browser, width, { count: 21 });
      check(run.preview.thumbs === 20 && run.preview.count === "20 photos" && run.preview.feedback, `${width}px: 21 photos did not keep 20 and say so (${JSON.stringify(run.preview)})`);

      // A Mix post with 3 photos: frame, swipe, tap → full screen at the same photo.
      {
        const { context, page, seen } = await open(browser, width, "feed.html?view=feed", { posts: [wallPost, fillerPost] });
        const frame = "#feed .post > .post-photos";
        await page.locator(frame).waitFor({ timeout: 12000 });
        await page.waitForFunction(selector => getComputedStyle(document.querySelector(selector)).getPropertyValue("--fit-ar").trim() !== "", frame, { timeout: 8000 }).catch(() => {});
        await page.locator(frame).scrollIntoViewIfNeeded();
        const geometry = await page.evaluate(selector => {
          const box = document.querySelector(selector).getBoundingClientRect(), post = document.querySelector(selector).closest(".post").getBoundingClientRect();
          const slide = document.querySelector(`${selector} .post-photos-slide img`).getBoundingClientRect();
          return { width: box.width, height: box.height, post: post.width, slide: [slide.width, slide.height], count: document.querySelector(`${selector} .post-photos-count`).textContent.trim(), overflow: document.documentElement.scrollWidth > innerWidth };
        }, frame);
        check(Math.abs(geometry.width - geometry.post) <= 1, `${width}px: the photo frame is not full width (${JSON.stringify(geometry)})`);
        check(Math.abs(geometry.height - geometry.width / (1600 / 900)) <= 2, `${width}px: the frame is not shaped like the first photo (16:9) (${JSON.stringify(geometry)})`);
        check(Math.abs(geometry.slide[0] - geometry.width) <= 1 && Math.abs(geometry.slide[1] - geometry.height) <= 1, `${width}px: the photo does not fill its frame (${JSON.stringify(geometry)})`);
        check(geometry.count === "1/3" && !geometry.overflow, `${width}px: frame count or page overflow (${JSON.stringify(geometry)})`);
        const filler = await page.evaluate(id => { const text = document.querySelector(`#feed .post[data-post-id="${id}"] .post-content`); return text ? text.getClientRects().length : -1; }, FILLER);
        check(filler === 0, `${width}px: Mix shows the "Shared media" filler on a photo posted without words (${filler})`);
        if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `mix-post-${width}.png`) });
        await swipeLeft(page, frame);
        const after = await page.evaluate(selector => document.querySelector(`${selector} .post-photos-count`).textContent.trim(), frame);
        check(after === "2/3", `${width}px: a swipe left did not move to the second photo (${after})`);
        // Owner 2026-11-22 ("Make the container the size of the image"): the frame turns into the shape of the photo on
        // show. The second photo is square, so the frame settles square and the photo fills it.
        await page.waitForFunction(selector => { const img = document.querySelector(`${selector} img[data-photo-index="1"]`); return img?.complete && img.naturalWidth > 0; }, frame, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(400);
        const square = await page.evaluate(selector => {
          const box = document.querySelector(selector).getBoundingClientRect(), img = document.querySelector(`${selector} img[data-photo-index="1"]`).getBoundingClientRect();
          return { width: box.width, height: box.height, img: [img.left - box.left, img.width, img.height] };
        }, frame);
        check(Math.abs(square.height - square.width) <= 2, `${width}px: on the square second photo the frame is not square (${JSON.stringify(square)})`);
        check(Math.abs(square.img[0]) <= 1 && Math.abs(square.img[1] - square.width) <= 1 && Math.abs(square.img[2] - square.height) <= 1, `${width}px: the second photo does not fill its frame (${JSON.stringify(square)})`);
        const second = await page.locator(`${frame} img[data-photo-index="1"]`).boundingBox();
        await page.touchscreen.tap(second.x + second.width / 2, second.y + second.height / 2);
        await page.waitForTimeout(500);
        const viewer = await page.evaluate(() => ({ open: globalThis.danzstakMediaViewer?.isOpen?.() === true, index: globalThis.danzstakMediaViewer?.index?.(), slides: document.querySelectorAll(".ds-media-viewer-slide").length }));
        check(viewer.open && viewer.index === 1 && viewer.slides === 4, `${width}px: tapping the second photo did not open it full screen among the member's 4 (${JSON.stringify(viewer)})`);
        check(!seen.errors.length, `${width}px Mix post: script errors: ${seen.errors.join(" | ")}`);
        await context.close();
      }

      // Profile: the frame on the post, and a Photos tile for each photo.
      {
        const { context, page, seen } = await open(browser, width, `profile.html?member=${me}`, { posts: [wallPost, fillerPost] });
        await page.locator(".post-photos").first().waitFor({ timeout: 12000 }).catch(() => {});
        const frames = await page.evaluate(() => ({ frames: document.querySelectorAll(".post-photos").length, count: document.querySelector(".post-photos-count")?.textContent.trim() || "", filler: [...document.querySelectorAll(".profile-post-content")].filter(text => text.textContent.trim() === "Shared media" && text.getClientRects().length).length }));
        check(frames.filler === 0, `${width}px profile: the "Shared media" filler shows on a photo posted without words`);
        check(frames.frames === 1 && frames.count === "1/3", `${width}px profile: the post did not show one 3-photo frame (${JSON.stringify(frames)})`);
        check(!seen.errors.length, `${width}px profile: script errors: ${seen.errors.join(" | ")}`);
        await context.close();
      }
      {
        const { context, page, seen } = await open(browser, width, `profile.html?member=${me}#photos`, { posts: [wallPost, fillerPost] });
        await page.waitForFunction(() => document.querySelectorAll(".profile-photo-grid .profile-video-tile").length >= 4, null, { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(500);
        const tiles = await page.evaluate(() => document.querySelectorAll(".profile-photo-grid .profile-video-tile").length);
        check(tiles === 4, `${width}px profile Photos: expected 4 tiles (3 photos in one post + 1), found ${tiles}`);
        if (width === 390) await page.screenshot({ path: path.join(output, `profile-photos-${width}.png`) });
        check(!seen.errors.length, `${width}px profile Photos: script errors: ${seen.errors.join(" | ")}`);
        await context.close();
      }

      // Profile composer.
      {
        const { context, page, seen } = await open(browser, width, `profile.html?member=${me}`);
        await page.locator(".profile-create-shortcut").first().waitFor({ timeout: 12000 });
        // The composer's photo/video input (the one beside its preview).
        await page.evaluate(() => { const box = document.querySelector(".profile-create-preview")?.closest("form")?.parentElement?.querySelector("input[type=file][multiple]") || [...document.querySelectorAll("input[type=file][multiple]")].find(item => item.accept.includes("video/mp4")); if (box) box.id = "profilePostMedia"; });
        await page.setInputFiles("#profilePostMedia", [photoFile(0), photoFile(1), photoFile(2)]);
        await page.waitForTimeout(800);
        const picked = await page.evaluate(() => document.querySelectorAll(".profile-create-preview .post-photos-picked img").length);
        check(picked === 3, `${width}px profile composer: expected 3 photos picked, saw ${picked}`);
        const text = page.locator(".profile-create-preview").locator("xpath=ancestor::form//textarea").first();
        if (await text.count()) await text.fill("Three from the gig");
        // Owner 2026-11-22: choose the album the photos go into ("Album: Mobile uploads" until the member picks one).
        const chip = page.locator(".profile-create-preview .post-album-chip");
        check((await chip.innerText()).includes("Mobile uploads"), `${width}px profile composer: the album chip does not say Mobile uploads (${await chip.innerText().catch(() => "missing")})`);
        await chip.scrollIntoViewIfNeeded();
        const chipBox = await chip.boundingBox();
        await page.touchscreen.tap(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2);
        await page.locator(".post-album-sheet .post-album-option", { hasText: "Hellfest 2026" }).click();
        await page.locator(".post-album-sheet").getByRole("button", { name: "Done" }).click();
        check((await chip.innerText()).includes("Hellfest 2026"), `${width}px profile composer: the chosen album does not show on the chip`);
        if (width === 390) await page.screenshot({ path: path.join(output, `profile-composer-album-${width}.png`) });
        await page.evaluate(() => { const form = document.querySelector(".profile-create-preview")?.closest("form"); form?.querySelectorAll("input[type=checkbox][required]").forEach(box => { box.checked = true; }); form?.requestSubmit(); });
        await page.waitForTimeout(2000);
        const body = seen.posts[0] || {};
        check(seen.posts.length === 1 && Array.isArray(body.moreMediaKeys) && body.moreMediaKeys.length === 2, `${width}px profile composer: expected one post with 2 more photos (${JSON.stringify(seen.posts)})`);
        check(body.albumId === "c".repeat(32) && body.uploadSource === "mobile", `${width}px profile composer: the post did not carry the chosen album and "mobile" (${JSON.stringify({ albumId: body.albumId, uploadSource: body.uploadSource })})`);
        check(!seen.errors.length, `${width}px profile composer: script errors: ${seen.errors.join(" | ")}`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Post photos checks passed at 360 and 390px: up to 20 photos in one post from the Mix and profile composers, older server fallback, swipeable frame shaped like the photo on show, full screen at the tapped photo, a Photos tile each.");
})();
