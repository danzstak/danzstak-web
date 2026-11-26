"use strict";
// Owner 2026-11-25 (phone screenshot of a Mix post: "Replying to Dachshund Records" sat flush left like a new comment):
// "Need replies to comments under the comment that I am replying to", "Need to change the icons to something users will
// understand or just reply in the comment", "Give the replies to comments a bit of margin so users know it's a reply".
// Root cause: mix-polish.css set every Mix comment to margin:6px 0 !important, wiping the reply indent.
// Real browser, touch, 320/360/390/430px, English and Italian:
// - every reply sits right after its own comment, indented 40px (its avatar starts under the parent's name);
// - Reply is a word ("Reply" / "Rispondi"), never a bare arrow, and its centre is the button;
// - the post box's Photo and Video buttons show their word ("Foto" / "Video") inside a 44px button;
// - Reply left, like/dislike right; a reply starts with the name it answers; a thread line joins them;
// - tapping Reply opens the reply box right under that comment's thread, indented like the replies; Cancel puts it back
//   under the list.
// (harness from post-photos.cjs) Owner 2026-11-22: "should be able to upload multiple photos at once", "set a limit of 20 photos". Before: the Mix
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

async function open(browser, width, pathName, { oldServer = false, posts = [], lang = "en" } = {}) {
  // An Android phone's browser name, so the post counts as a phone upload ("Mobile uploads").
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "it" ? "it-IT" : "en-US", userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A146U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" });
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
    if (p === "/engagement") { const t = m => new Date(Date.now() - m * 60000).toISOString(); return reply({ reactionCounts: {}, comments: [
      { commentId: "c1", authorName: "Dachshund Records", authorMemberId: "22222222-2222-4222-8222-222222222222", content: "Non riesco a caricare video mang", createdAt: t(180), reactionCounts: {} },
      { commentId: "c2", parentCommentId: "c1", replyToName: "Dachshund Records", authorName: "Eroticon", authorMemberId: me, content: "Works for me", createdAt: t(1), reactionCounts: {}, canDelete: true },
      { commentId: "c3", authorName: "WillKill", content: "Yeeahh", createdAt: t(2880), reactionCounts: {} },
      { commentId: "c4", parentCommentId: "c3", replyToName: "WillKill", authorName: "Ana", content: "Same", createdAt: t(2000), reactionCounts: {} }] }); }
    if (p === "/settings/posts") return reply({ hiddenPostIds: [] });
    return reply({});
  });
  await page.goto(`${origin}/${pathName}`, { waitUntil: "domcontentloaded" });
  return { context, page, seen };
}


(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) for (const lang of width === 390 ? ["en", "it"] : ["en"]) {
      const label = `${width}px ${lang}`;
      const { page, context, seen } = await open(browser, width, "feed.html", { posts: [wallPost], lang });
      try {
        await page.locator('.comment[data-comment-id="c2"]').waitFor({ state: "attached", timeout: 15000 });
        await page.evaluate(() => { const more = document.querySelector(".comments-more"); if (more && more.getAttribute("aria-expanded") !== "true") more.click(); });
        await page.waitForTimeout(300);
        // The composer's Photo and Video say what they are (owner: "The picture and video icons need to change as well").
        const media = await page.evaluate(() => [...document.querySelectorAll(".post-composer .composer-media-button")].map(b => { const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), word = b.querySelector(".composer-media-word"), w = word?.getBoundingClientRect(); return { word: word?.textContent.trim() || "", wordShown: Boolean(w && w.width > 4 && w.height > 4 && w.right <= r.right + 1 && w.left >= r.left - 1), h: r.height, w: r.width, hit: Boolean(hit && b.contains(hit)), right: r.right }; }));
        const words = lang === "it" ? ["Foto", "Video"] : ["Photo", "Video"];
        if (media.map(m => m.word).join("|") !== words.join("|")) failures.push(`${label}: composer media buttons don't read ${words.join(" / ")} (${JSON.stringify(media.map(m => m.word))})`);
        media.forEach(m => { if (!m.wordShown || m.h < 44 || m.w < 44 || !m.hit || m.right > width + 1) failures.push(`${label}: the "${m.word}" button isn't a whole 44px button with its word showing (${JSON.stringify(m)})`); });
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) failures.push(`${label}: the page scrolls sideways`);
        if (process.env.CAPTURE && [320, 390].includes(width)) await page.locator(".post-composer").first().screenshot({ path: path.join(process.env.CAPTURE, `composer-media-${width}-${lang}.png`) });
        const rows = await page.evaluate(() => [...document.querySelectorAll(".commentList .comment")].map(c => ({ id: c.dataset.commentId, left: c.querySelector(".comment-avatar").getBoundingClientRect().left, name: c.querySelector(".comment-author").getBoundingClientRect().left })));
        const order = rows.map(r => r.id).join(",");
        if (order !== "c1,c2,c3,c4") failures.push(`${label}: replies don't follow their comment (${order})`);
        const at = id => rows.find(r => r.id === id) || {};
        for (const [reply, parent] of [["c2", "c1"], ["c4", "c3"]]) {
          const indent = at(reply).left - at(parent).left;
          if (indent < 36) failures.push(`${label}: reply ${reply} is indented ${Math.round(indent)}px, not under its comment`);
        }
        // Like the owner's reference: Reply on the left, like/dislike on the right; a reply starts with the name it
        // answers; a thread line joins replies to their comment.
        const look = await page.evaluate(() => { const c1 = document.querySelector('.comment[data-comment-id="c1"]'), c2 = document.querySelector('.comment[data-comment-id="c2"]'), row = c1.querySelector(".comment-action-row").getBoundingClientRect(), reply = c1.querySelector(".comment-reply-button").getBoundingClientRect(), like = c1.querySelector(".comment-like").getBoundingClientRect(); return { replyLeft: reply.left - row.left, likeRight: row.right - like.right, likeAfter: like.left > reply.right + 40, mention: c2.querySelector(".comment-content .comment-mention")?.textContent || "", oldLabel: Boolean(c2.querySelector(".comment-reply-context")), line: getComputedStyle(c1, "::after").borderLeftWidth, elbow: getComputedStyle(c2, "::before").borderBottomWidth }; });
        if (look.replyLeft > 12 || !look.likeAfter || look.likeRight > 80) failures.push(`${label}: Reply isn't left with like/dislike on the right (${JSON.stringify(look)})`);
        if (look.mention !== "Dachshund Records" || look.oldLabel) failures.push(`${label}: the reply doesn't start with the name it answers (${JSON.stringify(look)})`);
        // Owner 2026-11-25: "Make it a little tighter between the comment and the reply" (was 20px from the comment's
        // Reply row to the reply's name; the thread now keeps only the list's own gap).
        const gap = await page.evaluate(() => { const row = document.querySelector('.comment[data-comment-id="c1"] .comment-action-row').getBoundingClientRect(), name = document.querySelector('.comment[data-comment-id="c2"] .comment-author').getBoundingClientRect(), next = document.querySelector('.comment[data-comment-id="c3"] .comment-author').getBoundingClientRect(), last = document.querySelector('.comment[data-comment-id="c2"] .comment-action-row').getBoundingClientRect(); return { reply: Math.round(name.top - row.bottom), nextThread: Math.round(next.top - last.bottom) }; });
        if (gap.reply > 12) failures.push(`${label}: the reply sits ${gap.reply}px below its comment's Reply row (12px at most)`);
        // Owner 2026-11-25 (second screenshot): "the next reply must match the first 2", "Not double spacing it needs to
        // match": the next comment sits the same distance under a thread as a reply sits under its comment.
        if (Math.abs(gap.nextThread - gap.reply) > 2) failures.push(`${label}: the next comment is ${gap.nextThread}px below the thread but a reply is ${gap.reply}px below its comment: they must match (${JSON.stringify(gap)})`);
        if (look.line !== "2px" || look.elbow !== "2px") failures.push(`${label}: no thread line between the comment and its reply (${JSON.stringify(look)})`);
        const btn = page.locator('.comment[data-comment-id="c1"] .comment-reply-button');
        const info = await btn.evaluate(e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: e.textContent.trim(), svg: Boolean(e.querySelector("svg")), hit: Boolean(hit && e.contains(hit)), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        const word = lang === "it" ? "Rispondi" : "Reply";
        if (info.text !== word || info.svg) failures.push(`${label}: Reply is not the word "${word}" (${JSON.stringify(info)})`);
        await btn.scrollIntoViewIfNeeded();
        const box = await btn.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(400);
        const placed = await page.evaluate(() => { const sec = document.querySelector(".comments"), prev = sec.previousElementSibling, parent = document.querySelector('.comment[data-comment-id="c1"] .comment-avatar').getBoundingClientRect(), input = sec.querySelector("input").getBoundingClientRect(); return { after: prev?.dataset.commentId || prev?.className || "", indent: sec.getBoundingClientRect().left - parent.left, inputW: input.width, overflow: document.documentElement.scrollWidth > innerWidth + 1, focused: document.activeElement === sec.querySelector("input") }; });
        if (placed.after !== "c2") failures.push(`${label}: the reply box isn't under the thread it answers (after ${placed.after})`);
        if (placed.indent < 36) failures.push(`${label}: the reply box isn't indented like a reply (${Math.round(placed.indent)}px)`);
        if (placed.inputW < 120 || placed.overflow) failures.push(`${label}: the reply box doesn't fit (${JSON.stringify(placed)})`);
        if (!placed.focused) failures.push(`${label}: the reply box doesn't take the keyboard`);
        await page.locator(".comment-reply-cancel").click();
        await page.waitForTimeout(200);
        const back = await page.evaluate(() => { const sec = document.querySelector(".comments"); return { inline: sec.classList.contains("comments-inline-reply"), inList: Boolean(sec.closest(".commentList")) }; });
        if (back.inline || back.inList) failures.push(`${label}: Cancel leaves the reply box inside the thread`);
        if (process.env.CAPTURE && lang === "en" && [360, 390].includes(width)) { await page.locator('.comment[data-comment-id="c1"] .comment-reply-button').click(); await page.waitForTimeout(300); await page.locator(".commentList").screenshot({ path: path.join(process.env.CAPTURE, `comment-replies-${width}.png`) }); }
        if (seen.errors.length) failures.push(`${label}: page errors ${seen.errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${String(error.message || error).split("\n")[0]}`); }
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Comment replies: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log("Comment replies passed at 320/360/390/430px (English and Italian): Photo/Video say their word, replies follow their comment indented 40px, Reply is a word, the reply box opens under the thread and Cancel puts it back.");
})();
