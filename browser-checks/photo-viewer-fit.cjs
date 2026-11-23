"use strict";
// Owner 2026-11-23 (screenshot: a wide Mix photo opened on a phone, a black box far taller than the photo, with the top
// bar and tabs still showing): "Need to make the container fit the image"; he chose "box hugs the photo". A tapped
// photo opens in a frame its own shape, full width for a wide photo, over the page dimmed behind it (never a solid black
// box), and the top bar and tab bar hide while it is open. Videos keep the full-screen black player (F1a).
// Mix at 320/360/390/430px, a 16:9 photo and a 9:16 photo, centre tap on the photo:
// - the viewer's photo rect has the photo's own shape (within 2px); the 16:9 one is the full screen width;
// - the layer behind it is see-through (alpha < 0.9), not a black box;
// - the top bar and the bottom tabs are hidden; ✕ (44px, centre tap) closes it and they come back.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = "https://review.danzstak.test";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const output = path.resolve("docs/screenshots/photo-viewer-fit");
const me = "11111111-1111-4111-8111-111111111111";
const photos = [
  { name: "landscape", width: 2000, height: 1125, colour: "#2a6" },
  { name: "tall", width: 1080, height: 1920, colour: "#a3a" }
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
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge"; // CI runs Edge; DANZSTAK_BROWSER_CHANNEL= uses Playwright's Chromium
  const browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) for (const photo of photos) {
      const label = `Mix ${width}px ${photo.name}`;
      const { context, page, errors } = await open(browser, width, "feed.html?view=feed");
      try {
        const img = page.locator(`#feed .post > img.post-media[src$="__photo-${photo.name}.svg"]`);
        await img.waitFor({ state: "visible", timeout: 12000 });
        await page.waitForFunction(el => el.complete && el.naturalWidth > 0, await img.elementHandle());
        await img.scrollIntoViewIfNeeded();
        const box = await img.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        const shown = page.locator('.ds-media-viewer[data-kind="image"] .ds-media-viewer-slide[aria-hidden="false"] img');
        await shown.waitFor({ state: "visible", timeout: 5000 });
        await page.waitForTimeout(350);
        const state = await page.evaluate(() => {
          const root = document.querySelector(".ds-media-viewer"), img = root.querySelector('.ds-media-viewer-slide[aria-hidden="false"] img');
          const rect = img.getBoundingClientRect(), bg = getComputedStyle(root).backgroundColor;
          const alpha = /rgba?\(([^)]+)\)/.exec(bg)?.[1].split(/[ ,/]+/).filter(Boolean)[3];
          const hidden = sel => [...document.querySelectorAll(sel)].every(el => getComputedStyle(el).visibility === "hidden" || el.getBoundingClientRect().height === 0);
          return { src: img.src, width: rect.width, height: rect.height, top: rect.top, alpha: alpha === undefined ? 1 : Number(alpha), viewport: innerWidth, viewH: innerHeight,
            bar: hidden(".ds-app-bar, .ds-feed-bar"), tabs: hidden(".ds-mobile-nav") };
        });
        if (!state.src.endsWith(`__photo-${photo.name}.svg`)) failures.push(`${label}: the viewer opened another photo (${state.src})`);
        const ratio = photo.width / photo.height, want = Math.min(state.viewport, state.viewH * ratio);
        if (Math.abs(state.width - want) > 2 || Math.abs(state.height - want / ratio) > 2) failures.push(`${label}: the photo shows ${Math.round(state.width)}x${Math.round(state.height)}, expected ${Math.round(want)}x${Math.round(want / ratio)} (its own shape)`);
        if (state.alpha >= 0.9) failures.push(`${label}: the layer behind the photo is a solid box (alpha ${state.alpha}), not the page dimmed`);
        if (!state.bar) failures.push(`${label}: the top bar shows over the photo`);
        if (!state.tabs) failures.push(`${label}: the tab bar shows over the photo`);
        if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `${photo.name}-${width}.png`) });
        const close = await page.locator(".ds-media-viewer-close").boundingBox();
        if (!close || close.width < 44 || close.height < 44) failures.push(`${label}: ✕ is under 44px`);
        else await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
        await page.locator(".ds-media-viewer").waitFor({ state: "detached", timeout: 3000 }).catch(() => failures.push(`${label}: ✕ didn't close the photo`));
        const back = await page.evaluate(() => [...document.querySelectorAll(".ds-mobile-nav")].some(el => getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().height > 0));
        if (!back) failures.push(`${label}: the tab bar didn't come back after closing`);
        if (errors.length) failures.push(`${label}: script errors: ${errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${error.message.split("\n")[0]}`); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Photo viewer fit checks passed at 320/360/390/430px: a tapped Mix photo opens in a frame its own shape over the dimmed page, with the top bar and tabs hidden, and ✕ brings them back.");
})();
