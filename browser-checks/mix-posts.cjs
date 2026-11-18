"use strict";
// Mix posts (fix-it 18, owner 2026-11-17):
// - link posts never show the raw (tracking-laden) URL and never jump: a fixed-size card holds the place until the
//   source preview arrives; under the card only the source name, never the link;
// - "N views" rides in the post header line instead of a row of its own;
// - no gradient placeholder avatars (initial on DanzStak colours).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/mix-posts.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/mix-posts");
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const LINK = "https://www.mixcloud.com/nightshift/warehouse-set/?utm_source=widget&utm_medium=web&utm_campaign=base_links&utm_term=resteasy";
const posts = [
  { postId: "33333333-3333-4333-8333-333333333331", userId: "22222222-2222-4222-8222-222222222222", authorName: "SFScoop", content: LINK, createdAt: "2026-11-16T21:30:00.000Z", audience: "public", isOwner: false, viewCount: 42 },
  { postId: "33333333-3333-4333-8333-333333333332", userId: "22222222-2222-4222-8222-222222222222", authorName: "SFScoop", content: "Doors at 9.", createdAt: "2026-11-15T21:30:00.000Z", audience: "public", isOwner: false, viewCount: 7 }
];
const art = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 628"><rect width="1200" height="628" fill="#0b0b0c"/><circle cx="600" cy="314" r="200" fill="#ff5a1f"/></svg>';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${baseUrl}/__preview/*`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: art }));
      let release; const previewGate = new Promise(resolve => { release = resolve; });
      await page.route("https://api.danzstak.com/**", async route => {
        const p = new URL(route.request().url()).pathname;
        if (p === "/link-preview") { await previewGate; return route.fulfill(json({ preview: { url: "https://www.mixcloud.com/nightshift/warehouse-set/", host: "www.mixcloud.com", title: "Warehouse Set by Night Shift", image: `${baseUrl}/__preview/1.svg` } })); }
        if (p === "/post-views") return route.fulfill(json({ viewCount: 7 }));
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: ownerId, email: "a@example.test" } }
          : p === "/profiles" ? { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true } }
          : p === "/secure-posts" ? { posts } : p === "/stories" ? { stories: [], reels: [] } : p === "/settings/posts" ? { hiddenPostIds: [] } : {};
        route.fulfill(json(body));
      });
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator("#feed .post").first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      const read = () => page.evaluate(link => {
        const post = document.querySelector("#feed .post[data-post-id$='331']");
        const card = post?.querySelector(".link-preview-card");
        const text = post?.innerText || "";
        return { raw: text.includes("utm_") || text.includes(link) || /mixcloud\.com\/nightshift/.test(text), card: card ? card.getBoundingClientRect().height : 0, under: card?.querySelector(".link-preview-url")?.textContent || "", img: Boolean(card?.querySelector("img")) };
      }, LINK);
      const before = await read();
      if (before.raw) failures.push(`${label}: the raw link shows while the preview loads`);
      if (!before.card) failures.push(`${label}: no placeholder card while the preview loads`);
      if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-loading-${width}.png`), clip: { x: 0, y: 0, width, height: 640 } });
      release();
      await page.waitForTimeout(900);
      const after = await read();
      if (after.raw) failures.push(`${label}: the raw link shows after the preview`);
      if (!after.img) failures.push(`${label}: the preview image did not arrive`);
      if (Math.abs(after.card - before.card) > 2) failures.push(`${label}: the post jumped when the preview arrived (${Math.round(before.card)} → ${Math.round(after.card)}px)`);
      if (after.under !== "mixcloud.com") failures.push(`${label}: under the card shows "${after.under}" instead of the source name`);
      const meta = await page.evaluate(() => {
        const post = document.querySelector("#feed .post[data-post-id$='332']");
        const views = post?.querySelector(".post-view-count"), audience = post?.querySelector(".post-audience");
        const avatar = post?.querySelector(".post-avatar");
        return { views: views?.textContent || "", sameRow: Boolean(views && audience && Math.abs(views.getBoundingClientRect().top - audience.getBoundingClientRect().top) < 6), bg: avatar ? getComputedStyle(avatar).backgroundImage : "", bgColor: avatar ? getComputedStyle(avatar).backgroundColor : "" };
      });
      if (!/7 views/.test(meta.views) || !meta.sameRow) failures.push(`${label}: views are not in the post header line ${JSON.stringify(meta)}`);
      if (/gradient/.test(meta.bg)) failures.push(`${label}: gradient placeholder avatar`);
      if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-loaded-${width}.png`), clip: { x: 0, y: 0, width, height: 900 } });
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`Mix posts: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log("Mix post checks passed: no raw link before or after the preview, no jump, source name only under the card, views in the header line, no gradient avatars.");
})().catch(error => { console.error(error); process.exitCode = 1; });
