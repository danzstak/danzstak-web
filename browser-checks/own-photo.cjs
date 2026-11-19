"use strict";
// Audit 36 B5 (directive F6): your own photo, never "N", "Y" or the DanzStak "D", wherever you post from. Before: a post
// you had just published showed "You" with a "Y" circle and no link, and your own posts whose payload arrived without a
// picture showed your initial although your profile has a photo; the comment boxes started on a "D". On someone else's
// wall, a post by a third member without a picture borrowed the wall owner's photo and name.
// Checks at 320/360/390/430px, signed in with a profile photo:
// - Mix: your own post without authorPicture shows your photo; the composer, the comment box and a post you publish
//   show your photo and your name (not "You"), and the post's photo opens your profile;
// - Profile (yours): your post without authorPicture, the "What's on your mind?" row and the comment box show your photo;
// - Profile (a friend's): a wall post by someone else without a picture shows their initial, never the friend's photo.
// Taps the centre of the comment icon to open the comment box. The site is served from this checkout under a non-local
// host name (as in post-dailies-roll.cjs), so Mix publishes through its real path, not its 127.0.0.1 preview mode.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = "https://review.danzstak.test"; // https: the page CSP upgrades insecure requests
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const output = path.resolve("docs/screenshots/own-photo");
const me = "11111111-1111-4111-8111-111111111111", friend = "22222222-2222-4222-8222-222222222222", third = "55555555-5555-4555-8555-555555555555";
const myPhoto = `${base}/__me.svg`, friendPhoto = `${base}/__friend.svg`;
const svg = colour => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${colour}"/><circle cx="50" cy="40" r="20" fill="#fff"/></svg>`;
const NEW_POST = "66666666-6666-4666-8666-666666666666";

function fixture(url, method, wall) {
  const p = url.pathname;
  if (p === "/auth/session") return { authenticated: true, user: { sub: me, email: "me@danzstak.invalid" } };
  if (p === "/profiles" || p === "/profile") {
    const asked = url.searchParams.get("member") || url.searchParams.get("memberId");
    if (asked && asked !== me) return { profile: { memberId: friend, name: "Tour Friend", username: "tourfriend", handle: "tourfriend", picture: friendPhoto, isOwner: false, cloudProfile: true, friendStatus: "friends", canPostToProfile: true } };
    return { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", picture: myPhoto, isOwner: true, cloudProfile: true } };
  }
  if (p === "/secure-posts" && method === "POST") return { postId: NEW_POST, userId: me, content: "Doors at 8", audience: "public", createdAt: new Date().toISOString(), dailyCreated: false };
  if (p === "/secure-posts") {
    if (wall === "friend") return { posts: [{ postId: "77777777-7777-4777-8777-777777777777", userId: third, authorMemberId: third, profileOwnerMemberId: friend, authorName: "Bo Third", authorPicture: "", content: "Happy birthday!", createdAt: new Date(Date.now() - 36e5).toISOString(), audience: "public", isOwner: false }] };
    return { posts: [{ postId: "33333333-3333-4333-8333-333333333333", userId: me, authorName: "Night Shift", authorPicture: "", content: "Soundcheck done", createdAt: new Date(Date.now() - 2 * 864e5).toISOString(), audience: "public", isOwner: true, commentPolicy: "everyone" }] };
  }
  if (p === "/engagement") return { reactionCounts: {}, comments: [] };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  return {};
}

async function open(browser, width, pathName, wall = "mine") {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/**`, route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/__me.svg" || url.pathname === "/__friend.svg") return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(url.pathname === "/__me.svg" ? "#ef6c20" : "#1769e0") });
    const file = path.join(process.cwd(), decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: request.method() === "POST" && url.pathname === "/secure-posts" ? 201 : 200, contentType: "application/json", headers: cors, body: JSON.stringify(fixture(url, request.method(), wall)) });
  });
  await page.goto(`${base}/${pathName}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  return { context, page, errors };
}

// What a photo spot shows: "photo:<url>" for a loaded <img> or a background photo, otherwise its text.
const shows = (page, selector) => page.evaluate(selector => {
  const node = document.querySelector(selector);
  if (!node) return "missing";
  const image = node.matches("img") ? node : node.querySelector("img");
  if (image?.complete && image.naturalWidth > 0) return "photo:" + new URL(image.currentSrc || image.src).pathname;
  const background = getComputedStyle(node).backgroundImage;
  if (background && background !== "none") return "photo:" + new URL(background.replace(/^url\("?|"?\)$/g, "")).pathname;
  return "text:" + node.textContent.trim();
}, selector);

async function tapCentre(page, selector) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      // Mix
      let { context, page, errors } = await open(browser, width, "feed.html?view=feed");
      const own = '#feed article.post[data-post-id="33333333-3333-4333-8333-333333333333"]';
      await page.waitForFunction(selector => document.querySelector(selector + " .post-avatar img")?.complete, own, { timeout: 5000 }).catch(() => {});
      assert.equal(await shows(page, `${own} .post-avatar`), "photo:/__me.svg", `${width}px Mix: your own post shows your photo`);
      assert.equal(await shows(page, ".composer-avatar"), "photo:/__me.svg", `${width}px Mix: the composer shows your photo`);
      await tapCentre(page, `${own} .commentBtn .reaction-icon`);
      await page.waitForTimeout(400);
      assert.equal(await shows(page, `${own} .comment-composer-avatar`), "photo:/__me.svg", `${width}px Mix: the comment box shows your photo`);
      await tapCentre(page, "#postText"); // opens the post box, as a member would
      await page.locator("#postText").fill("Doors at 8");
      await page.evaluate(() => { const box = document.getElementById("originalContentCertification"); if (box) box.checked = true; });
      await tapCentre(page, "#publishBtn");
      const fresh = `#feed article.post[data-post-id="${NEW_POST}"]`;
      await page.waitForSelector(fresh, { timeout: 5000 });
      await page.waitForFunction(selector => document.querySelector(selector + " .post-avatar img")?.complete, fresh, { timeout: 5000 }).catch(() => {});
      const published = await page.evaluate(selector => {
        const post = document.querySelector(selector);
        return { name: post.querySelector(".post-author")?.textContent.trim(), avatarHref: post.querySelector(".post-avatar")?.getAttribute("href"), nameHref: post.querySelector(".post-author")?.getAttribute("href") };
      }, fresh);
      assert.deepEqual(published, { name: "Night Shift", avatarHref: "profile.html", nameHref: "profile.html" }, `${width}px Mix: the post you just published carries your name and opens your profile`);
      assert.equal(await shows(page, `${fresh} .post-avatar`), "photo:/__me.svg", `${width}px Mix: the post you just published shows your photo`);
      if (width === 390) await page.locator(fresh).screenshot({ path: path.join(output, "mix-published-390.png") });
      assert.deepEqual(errors, [], `${width}px Mix: page errors ${errors.join(" | ")}`);
      await context.close();

      // Your profile
      ({ context, page, errors } = await open(browser, width, "profile.html#posts"));
      const mine = '.profile-post-card[data-post-id="33333333-3333-4333-8333-333333333333"]';
      await page.waitForSelector(mine, { timeout: 5000 });
      await page.waitForTimeout(400);
      assert.equal(await shows(page, `${mine} .profile-post-avatar`), "photo:/__me.svg", `${width}px profile: your own post shows your photo`);
      assert.equal(await shows(page, ".profile-create-avatar"), "photo:/__me.svg", `${width}px profile: "What's on your mind?" shows your photo`);
      await tapCentre(page, `${mine} .profile-post-comment`);
      assert.equal(await shows(page, `${mine} .profile-comment-viewer-avatar`), "photo:/__me.svg", `${width}px profile: the comment box shows your photo`);
      if (width === 390) await page.locator(mine).screenshot({ path: path.join(output, "profile-own-post-390.png") });
      assert.deepEqual(errors, [], `${width}px profile: page errors ${errors.join(" | ")}`);
      await context.close();

      // A friend's profile: someone else's wall post without a picture never borrows the friend's face or name.
      ({ context, page, errors } = await open(browser, width, `profile.html?member=${friend}#posts`, "friend"));
      const theirs = '.profile-post-card[data-post-id="77777777-7777-4777-8777-777777777777"]';
      await page.waitForSelector(theirs, { timeout: 5000 });
      await page.waitForTimeout(400);
      assert.equal(await shows(page, `${theirs} .profile-post-avatar`), "text:B", `${width}px friend's profile: Bo's post shows Bo's initial, not the friend's photo`);
      assert.equal(await page.locator(`${theirs} .profile-post-author`).textContent(), "Bo Third", `${width}px friend's profile: Bo's post keeps Bo's name`);
      assert.deepEqual(errors, [], `${width}px friend's profile: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Own-photo checks passed at 320, 360, 390, 430px: Mix (own post without a picture, composer, comment box, a post you just published with your name and profile link), your profile (post, composer row, comment box), and a friend's wall keeps each author's own face.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
