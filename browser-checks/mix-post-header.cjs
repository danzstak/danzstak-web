"use strict";
// UIKIT screen 5 part 1 (docs/tasks/39-modern-look.md "Post"): the Mix post header is the kit's. Before, five
// stylesheets (feed.html, feed-enhancements, mix-polish with 17 !important, mobile-design-system, danzstak-original)
// fought over it and the audience showed as an emoji plus an English-looking word ("🌎 Public"). Checks Mix at
// 320/360/390/430px, touch, in English and Italian:
// - the header is the kit block (.ds-post-head); the photo is a 40px circle beside the name; a member without a photo
//   shows their initial;
// - name and meta line sit right of the photo and never under the ⋯ button; nothing overflows the post sideways;
// - the meta line is one line "1h · (globe icon) · N views": the audience is an outline icon (no emoji in the header)
//   and its word is there for screen readers, in Italian for an Italian member ("Pubblico");
// - a Tribe post shows the Tribe on its own line with the people icon; a post with a place shows a map pin and the place
//   with no English "Location:" prefix;
// - a centre tap on the photo and on the name reaches the profile link (elementFromPoint).
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = "https://review.danzstak.test";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const output = path.resolve("docs/screenshots/mix-post-header");
const me = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const MINE = "33333333-3333-4333-8333-333333333333", THEIRS = "44444444-4444-4444-8444-444444444444", TRIBE = "55555555-5555-4555-8555-555555555555";
const face = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#c63"/></svg>';
const posts = [
  { postId: MINE, userId: me, authorMemberId: me, authorName: "Night Shift", authorPicture: `${base}/__face.svg`, content: "Load-in at six", createdAt: new Date(Date.now() - 36e5).toISOString(), audience: "public", isOwner: true, location: "Bimbo's 365, San Francisco" },
  { postId: THEIRS, userId: other, authorMemberId: other, authorName: "Bartholomew Longname-Featherstonehaugh and the Midnight Rehearsal Orchestra", content: "Doors at 8", createdAt: new Date(Date.now() - 72e5).toISOString(), audience: "friends", isOwner: false },
  { postId: TRIBE, userId: other, authorMemberId: other, authorName: "Tour Friend", content: "Who's driving?", createdAt: new Date(Date.now() - 9e6).toISOString(), audience: "private", isOwner: false, groupId: "tribe-1", groupName: "Bologna Techno Underground Collective" }
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
const launch = () => chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await launch();
  const failures = [];
  try {
    for (const lang of ["en-US", "it-IT"]) {
      for (const [width, height] of [[320, 700], [360, 800], [390, 844], [430, 932]]) {
        const name = `${lang} ${width}px`;
        const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, locale: lang, serviceWorkers: "block" });
        await context.addInitScript(l => { try { Object.defineProperty(navigator, "languages", { get: () => [l] }); } catch {} }, lang);
        const page = await context.newPage(), errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route(`${base}/**`, route => {
          const url = new URL(route.request().url());
          if (url.pathname === "/__face.svg") return route.fulfill({ status: 200, contentType: "image/svg+xml", body: face });
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
        try {
          await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
          await page.waitForSelector(`#post-${TRIBE} .post-header`, { timeout: 20000 });
          await page.waitForFunction(id => document.querySelector(`#post-${id} .post-avatar img`)?.complete && document.querySelector(`#post-${id} .post-menu-toggle`), MINE, { timeout: 10000 });
          await page.evaluate(() => document.fonts?.ready);
          await page.waitForTimeout(600);
          const data = await page.evaluate(ids => ids.map(id => {
            const post = document.getElementById("post-" + id), header = post.querySelector(".post-header");
            const r = el => { const b = el?.getBoundingClientRect(); return b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height } : null; };
            const avatar = header.querySelector(".post-avatar"), author = header.querySelector(".post-author"), meta = header.querySelector(".post-meta-line");
            const audience = header.querySelector(".post-audience"), menu = post.querySelector(".post-menu-toggle");
            const hits = el => { if (!el) return false; const b = el.getBoundingClientRect(); el.scrollIntoView({ block: "center" }); const c = el.getBoundingClientRect(); const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return Boolean(hit && (hit === el || el.contains(hit) || hit.closest("a") === el)); };
            const metaKids = [...meta.children].map(child => r(child));
            return {
              id, kit: header.classList.contains("ds-post-head"), avatar: r(avatar), avatarRadius: getComputedStyle(avatar).borderTopLeftRadius,
              avatarText: avatar.querySelector("img") ? "" : avatar.textContent.trim(), author: r(author), meta: r(meta), metaKids, menu: r(menu), post: r(post),
              headerText: header.textContent, audienceIcon: Boolean(audience?.querySelector("svg.ds-icon use")), audienceWord: audience?.querySelector(".ds-sr-only")?.textContent.trim(),
              audienceWordVisible: audience ? audience.querySelector(".ds-sr-only").getBoundingClientRect().width > 2 : true,
              views: Boolean(meta.querySelector(".post-view-count")), tribe: header.querySelector(".post-tribe-link")?.querySelector("svg.ds-icon") ? header.querySelector(".post-tribe-link").textContent.trim() : null,
              place: header.querySelector(".post-location") ? { icon: Boolean(header.querySelector(".post-location svg.ds-icon")), text: header.querySelector(".post-location").textContent.trim() } : null,
              overflow: [...header.querySelectorAll("*")].filter(el => el.getBoundingClientRect().width && (el.getBoundingClientRect().right > post.getBoundingClientRect().right + 0.5 || el.getBoundingClientRect().left < post.getBoundingClientRect().left - 0.5) && !el.closest(".ds-sr-only")).map(el => el.className.baseVal ?? el.className),
              avatarTap: avatar.tagName === "A" ? hits(avatar) : null, nameTap: author.tagName === "A" ? hits(author) : null
            };
          }), [MINE, THEIRS, TRIBE]);
          const it = lang === "it-IT";
          for (const d of data) {
            const where = `${name} post ${d.id.slice(0, 4)}`;
            try {
              assert.ok(d.kit, `${where}: the header is the kit block`);
              assert.ok(Math.abs(d.avatar.width - 40) < 1 && Math.abs(d.avatar.height - 40) < 1, `${where}: the photo is 40px (${d.avatar.width}x${d.avatar.height})`);
              assert.equal(d.avatarRadius, "50%", `${where}: the photo is round`);
              assert.ok(d.author.left >= d.avatar.right + 8, `${where}: the name sits right of the photo`);
              assert.ok(d.meta.left >= d.avatar.right + 8 && d.meta.top >= d.author.bottom - 1, `${where}: the meta line sits under the name`);
              assert.ok(d.author.right <= d.menu.left + 0.5 && d.meta.right <= d.menu.left + 0.5, `${where}: name and meta never under the ⋯ button (name right ${d.author.right}, ⋯ left ${d.menu.left})`);
              assert.ok(d.menu.width >= 44 && d.menu.height >= 44, `${where}: ⋯ is a 44px target`);
              const tops = new Set(d.metaKids.map(k => Math.round(k.top)));
              assert.ok(Math.max(...d.metaKids.map(k => k.bottom)) - Math.min(...d.metaKids.map(k => k.top)) < 24, `${where}: the meta line is one line (${[...tops]})`);
              assert.ok(d.views, `${where}: views ride in the meta line`);
              assert.ok(d.audienceIcon, `${where}: the audience is an outline icon`);
              assert.doesNotMatch(d.headerText, /[🌎👥🔒]/u, `${where}: no emoji in the header`);
              assert.doesNotMatch(d.headerText, /Location:/, `${where}: no English "Location:" prefix`);
              assert.equal(d.audienceWordVisible, false, `${where}: the audience word is for screen readers only`);
              const words = it ? { public: "Pubblico", friends: "Amici", private: "Solo io" } : { public: "Public", friends: "Friends", private: "Just me" };
              const expected = d.id === MINE ? words.public : d.id === THEIRS ? words.friends : words.private;
              assert.equal(d.audienceWord, expected, `${where}: the audience word is "${expected}"`);
              assert.deepEqual(d.overflow, [], `${where}: nothing in the header overflows the post sideways`);
              if (d.avatarTap !== null) assert.ok(d.avatarTap, `${where}: a centre tap on the photo reaches the profile link`);
              if (d.nameTap !== null) assert.ok(d.nameTap, `${where}: a centre tap on the name reaches the profile link`);
              if (d.id === THEIRS) assert.equal(d.avatarText, "B", `${where}: no photo → the initial`);
              if (d.id === TRIBE) assert.equal(d.tribe, "Bologna Techno Underground Collective", `${where}: the Tribe line with its icon`);
              if (d.id === MINE) assert.deepEqual(d.place, { icon: true, text: "Bimbo's 365, San Francisco" }, `${where}: the place with a map pin`);
            } catch (error) { failures.push(error.message); }
          }
          if (errors.length) failures.push(`${name}: page errors ${errors.join(" | ")}`);
          await page.evaluate(() => scrollTo(0, 0));
          await page.locator(`#post-${MINE}`).scrollIntoViewIfNeeded();
          if (width === 360 || width === 390) await page.locator(`#post-${MINE}`).screenshot({ path: path.join(output, `${lang.slice(0, 2)}-${width}.png`) });
        } catch (error) { failures.push(`${name}: ${error.message}`); }
        await context.close();
      }
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Mix post header checks passed at 320/360/390/430px in English and Italian: kit header, 40px round photo, one meta line with the audience icon (word for screen readers, translated), Tribe and place lines, nothing under ⋯, centre taps reach the profile.");
})();
