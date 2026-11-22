"use strict";
// Owner 2026-11-22 (phone screenshot of a post's ⋯ menu): "Make the fonts a little smaller so it fits without the scroll
// and put delete post under edit post". Before: on a phone the sheet's 18px titles and 15px lines made it taller than the
// screen (Report post was cut off under the tab bar) and Delete post sat near the bottom. Checks Mix at 360x800 (the
// owner's phone), 390x844, 412x915 and 430x932, touch, on your own photo post and on someone else's post:
// - every option shows at once: the sheet doesn't scroll and nothing sits under the tab bar (the centre of each row is
//   the row itself);
// - Delete post comes right after Edit post (your post); someone else's post has Remove from My Mix and Report post;
// - each row is at least 44px tall and the text isn't clipped;
// - owner 2026-11-22 "when users hit back on their device it goes back to the mix" ("Currently it exits out of the app"):
//   the phone's Back closes the menu and stays on the Mix; a menu closed by tapping outside leaves no extra Back step.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = "https://review.danzstak.test";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const output = path.resolve("docs/screenshots/post-menu-fit");
const me = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const MINE = "33333333-3333-4333-8333-333333333333", THEIRS = "44444444-4444-4444-8444-444444444444";
const photo = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#2a6"/></svg>';
const posts = [
  { postId: MINE, userId: me, authorMemberId: me, authorName: "Night Shift", content: "Load-in", createdAt: new Date(Date.now() - 36e5).toISOString(), audience: "public", isOwner: true, mediaType: "image", mediaUrl: `${base}/__photo.svg` },
  { postId: THEIRS, userId: other, authorMemberId: other, authorName: "Tour Friend", content: "Doors at 8", createdAt: new Date(Date.now() - 72e5).toISOString(), audience: "public", isOwner: false }
];
function fixture(p) {
  if (p === "/auth/session") return { authenticated: true, user: { sub: me, email: "me@danzstak.invalid" } };
  if (p === "/profiles" || p === "/profile") return { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } };
  if (p === "/secure-posts") return { posts };
  if (p === "/engagement") return { reactionCounts: {}, comments: [] };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  if (p === "/stories") return { stories: [], reels: [], dailyTakeCount: 0 };
  return {};
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const [width, height] of [[360, 800], [390, 844], [412, 915], [430, 932]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${base}/**`, route => {
        const url = new URL(route.request().url());
        if (url.pathname === "/__photo.svg") return route.fulfill({ status: 200, contentType: "image/svg+xml", body: photo });
        const file = path.join(process.cwd(), decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
        if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
      });
      const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request();
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(fixture(new URL(request.url()).pathname)) });
      });
      await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      for (const [label, postId] of [["your post", MINE], ["someone else's post", THEIRS]]) {
        const name = `${width}x${height} ${label}`;
        const toggle = page.locator(`.post[data-post-id="${postId}"] .post-menu-toggle`);
        try { await toggle.waitFor({ timeout: 12000 }); } catch { failures.push(`${name}: no ⋯ button`); continue; }
        await toggle.scrollIntoViewIfNeeded();
        const box = await toggle.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(400);
        const sheet = await page.evaluate(id => {
          const menu = document.querySelector(`.post[data-post-id="${id}"] .post-options-menu`);
          if (!menu || menu.hidden) return null;
          const rows = [...menu.querySelectorAll(".post-option-row")];
          return {
            scrolls: menu.scrollHeight > menu.clientHeight + 1,
            titles: rows.map(row => row.querySelector("strong")?.textContent.trim()),
            rows: rows.map(row => {
              const r = row.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              const clipped = [...row.querySelectorAll("strong,small")].some(text => text.scrollWidth > text.clientWidth + 1);
              return { title: row.querySelector("strong")?.textContent.trim(), height: r.height, visible: Boolean(hit && row.contains(hit)), clipped };
            })
          };
        }, postId);
        if (!sheet) { failures.push(`${name}: the menu did not open`); continue; }
        if (sheet.scrolls) failures.push(`${name}: the menu needs a scroll`);
        for (const row of sheet.rows) {
          if (!row.visible) failures.push(`${name}: "${row.title}" isn't fully on screen (covered or off the bottom)`);
          if (row.height < 44) failures.push(`${name}: "${row.title}" is ${Math.round(row.height)}px tall (under 44)`);
          if (row.clipped) failures.push(`${name}: "${row.title}" text is cut off`);
        }
        if (postId === MINE) {
          const edit = sheet.titles.indexOf("Edit post");
          if (edit < 0 || sheet.titles[edit + 1] !== "Delete post") failures.push(`${name}: Delete post isn't right under Edit post (${sheet.titles.join(" / ")})`);
          if (sheet.titles.includes("Report post") || sheet.titles.includes("Remove from My Mix")) failures.push(`${name}: your own post shows the visitor options`);
        } else if (!sheet.titles.includes("Remove from My Mix") || !sheet.titles.includes("Report post") || sheet.titles.includes("Edit post")) {
          failures.push(`${name}: someone else's post doesn't show the visitor options (${sheet.titles.join(" / ")})`);
        }
        if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `${postId === MINE ? "own" : "other"}-${width}.png`) });
        if (postId === MINE) {
          // The phone's Back button: the menu closes and the Mix stays.
          await page.evaluate(() => history.back());
          await page.waitForTimeout(500);
          const after = await page.evaluate(id => ({ path: location.pathname, open: !document.querySelector(`.post[data-post-id="${id}"] .post-options-menu`)?.hidden, mix: Boolean(document.querySelector("#feed .post")?.getClientRects().length) }), postId);
          if (after.path !== "/feed.html" || after.open || !after.mix) failures.push(`${name}: Back did not just close the menu (${JSON.stringify(after)})`);
        } else {
          // Closed by tapping outside: no extra history step is left behind for Back.
          const depth = await page.evaluate(() => history.length);
          await page.touchscreen.tap(width / 2, 120);
          await page.waitForTimeout(500);
          const after = await page.evaluate(id => ({ open: !document.querySelector(`.post[data-post-id="${id}"] .post-options-menu`)?.hidden, menuStep: history.state?.danzstakPostMenu === true }), postId);
          if (after.open || after.menuStep) failures.push(`${name}: tapping outside didn't close the menu cleanly (${JSON.stringify(after)}, ${depth} history entries)`);
        }
      }
      if (errors.length) failures.push(`${width}px: script errors: ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Post menu checks passed at 360x800, 390x844, 412x915, 430x932: every option fits without scrolling above the tab bar, Delete post under Edit post, visitor options on others' posts.");
})();
