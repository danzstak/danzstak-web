"use strict";
// Directive F22 (owner 2026-11-22, "Sizing is off" + the original 2000x1125 photo): a post's photo frame takes the
// photo's own shape. Before: on phones (<=700px) Mix forced every photo to a 4:5 frame (height:125vw) and cut the sides
// off landscape photos.
// Then (owner 2026-11-22, a post of 720x1600 phone screenshots shown cut to 4:5): "Make the container the size of the
// image or the video", "So it looks like it's full". The frame is the photo's own shape, full column width, no bars and
// nothing cut off; only extremes are limited: 9:20 (a phone screenshot, shown whole) to 3:1.
// Checks Mix and your profile Posts at 320/360/390/430px with a landscape (16:9), square, 4:5, 9:16, 9:20 screenshot,
// 3:1 and a 4:1 panorama (cut to 3:1): the photo is full width and its height is width / ratio (within 2px).
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = "https://review.danzstak.test";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const output = path.resolve("docs/screenshots/photo-frame");
const me = "11111111-1111-4111-8111-111111111111";
const photos = [
  { name: "landscape", width: 2000, height: 1125, colour: "#2a6" },
  { name: "square", width: 1080, height: 1080, colour: "#c63" },
  { name: "portrait", width: 1080, height: 1350, colour: "#36c" },
  { name: "tall", width: 1080, height: 1920, colour: "#a3a" },
  { name: "screenshot", width: 720, height: 1600, colour: "#3aa" },
  { name: "wide", width: 3000, height: 1000, colour: "#aa3" },
  { name: "panorama", width: 4000, height: 1000, colour: "#633" }
];
const svg = photo => `<svg xmlns="http://www.w3.org/2000/svg" width="${photo.width}" height="${photo.height}" viewBox="0 0 ${photo.width} ${photo.height}"><rect width="100%" height="100%" fill="${photo.colour}"/><circle cx="${photo.width / 2}" cy="${photo.height / 2}" r="${Math.min(photo.width, photo.height) / 4}" fill="#fff"/></svg>`;
const day = 864e5;
const posts = photos.map((photo, index) => ({
  postId: `3333333${index}-3333-4333-8333-333333333333`, userId: me, authorMemberId: me, authorName: "Night Shift", authorPicture: "",
  content: `${photo.name} photo`, createdAt: new Date(Date.now() - (index + 1) * day).toISOString(), audience: "public", isOwner: true,
  mediaUrl: `${base}/__photo-${photo.name}.svg`, mediaType: "image"
}));

function fixture(url) {
  const p = url.pathname;
  if (p === "/auth/session") return { authenticated: true, user: { sub: me, email: "me@danzstak.invalid" } };
  if (p === "/profiles" || p === "/profile") return { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", picture: "", isOwner: true, cloudProfile: true } };
  if (p === "/secure-posts") return { posts };
  if (p === "/engagement") return { reactionCounts: {}, comments: [] };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  if (p === "/stories") return { stories: [], reels: [], dailyTakeCount: 0 };
  return {};
}

async function open(browser, width, pathName, { postsOverride = null, holdPhotos = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/**`, route => {
    const url = new URL(route.request().url());
    const photo = photos.find(item => url.pathname === `/__photo-${item.name}.svg`);
    if (photo && holdPhotos) return; // never answered: the photo is still on its way
    if (photo) return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(photo) });
    const file = path.join(process.cwd(), decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = url.pathname === "/secure-posts" && postsOverride ? { posts: postsOverride } : fixture(url);
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/${pathName}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const [surface, pathName, selector, column] of [
      ["Mix", "feed.html?view=feed", "#feed .post > img.post-media", "#feed .post"],
      ["profile", `profile.html?member=${me}`, "img.profile-post-media", "article"]
    ]) for (const width of [320, 360, 390, 430]) {
      const label = `${surface} ${width}px`;
      const { context, page, errors } = await open(browser, width, pathName);
      try {
        await page.waitForFunction(count => document.querySelectorAll(count.selector).length >= count.n
          && [...document.querySelectorAll(count.selector)].every(img => img.complete && img.naturalWidth > 0 && img.dataset.fit === "ready"),
        { selector, n: photos.length }, { timeout: 12000 });
      } catch {
        failures.push(`${label}: the ${photos.length} post photos did not load`);
        await context.close();
        continue;
      }
      const frames = await page.evaluate(({ selector, column }) => [...document.querySelectorAll(selector)].map(img => {
        const rect = img.getBoundingClientRect(), card = img.closest(column)?.getBoundingClientRect();
        return { name: new URL(img.currentSrc || img.src).pathname.replace(/^\/__photo-|\.svg$/g, ""), width: rect.width, height: rect.height, cardWidth: card?.width || 0 };
      }), { selector, column });
      for (const photo of photos) {
        const frame = frames.find(item => item.name === photo.name);
        if (!frame) { failures.push(`${label}: no frame for the ${photo.name} photo`); continue; }
        const ratio = Math.min(3, Math.max(0.45, photo.width / photo.height));
        const want = frame.width / ratio;
        if (Math.abs(frame.height - want) > 2) failures.push(`${label}: the ${photo.name} photo (${photo.width}x${photo.height}) shows in a ${Math.round(frame.width)}x${Math.round(frame.height)} frame, expected ${Math.round(frame.width)}x${Math.round(want)}`);
        if (frame.cardWidth && frame.width + 1 < frame.cardWidth) failures.push(`${label}: the ${photo.name} photo is ${Math.round(frame.width)}px wide in a ${Math.round(frame.cardWidth)}px post`);
      }
      if (width === 360 || width === 390) {
        await page.locator(selector).first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${surface.toLowerCase()}-${width}.png`) });
      }
      if (errors.length) failures.push(`${label}: script errors: ${errors.join(" | ")}`);
      await context.close();
    }
    // F22 "stored dimensions so nothing jumps": every post the app saves now carries its media's shape (mediaRatio), so
    // its frame has its final size before the photo arrives. Here the photos never arrive.
    const shaped = posts.map((post, index) => ({ ...post, mediaRatio: photos[index].width / photos[index].height }));
    for (const [surface, pathName, selector] of [["Mix", "feed.html?view=feed", "#feed .post > img.post-media"], ["profile", `profile.html?member=${me}`, "img.profile-post-media"]]) for (const width of [360, 390]) {
      const label = `${surface} ${width}px, photos still loading`;
      const { context, page } = await open(browser, width, pathName, { postsOverride: shaped, holdPhotos: true });
      try { await page.waitForFunction(count => document.querySelectorAll(count.selector).length >= count.n, { selector, n: photos.length }, { timeout: 12000 }); }
      catch { failures.push(`${label}: the posts did not show`); await context.close(); continue; }
      const frames = await page.evaluate(selector => [...document.querySelectorAll(selector)].map(img => ({ name: new URL(img.src).pathname.replace(/^\/__photo-|\.svg$/g, ""), loaded: img.complete && img.naturalWidth > 0, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height })), selector);
      for (const photo of photos) {
        const frame = frames.find(item => item.name === photo.name);
        const want = frame ? frame.width / Math.min(3, Math.max(0.45, photo.width / photo.height)) : 0;
        if (!frame || frame.loaded) failures.push(`${label}: the ${photo.name} photo should still be loading`);
        else if (Math.abs(frame.height - want) > 2) failures.push(`${label}: the ${photo.name} frame is ${Math.round(frame.height)}px tall before its photo arrives, expected ${Math.round(want)}px (it would jump when it loads)`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Photo frame checks passed: Mix and profile photos keep their own shape (9:20 to 3:1), full width, at 320-430px, and a post's stored shape sizes its frame before the photo arrives.");
})();
