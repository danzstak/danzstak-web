"use strict";
// SHARE (owner 2026-11-21, spec 44): "When a user share their profile it should show just like the image I uploaded."
// Real browser, touch, own profile at 320/360/390/430px:
// - tapping the centre of Share opens the sheet with the card the link will show (cover, round photo, name, @username,
//   shop photos) and the switch "Show my photo and name in link previews", on by default;
// - the card is drawn in the browser as a 1200x630 JPEG under 300 KB, uploaded once, and saved with the card turned on;
//   the link becomes danzstak.com/@username;
// - a tap at the switch's centre turns it off: the card is deleted on the server and the link goes back to the plain
//   profile link; on again uploads a fresh card; opening the sheet again with an up-to-date card uploads nothing;
// - the sheet fits the screen (no sideways scroll, 44px switch row); Italian shows Italian;
// - a visitor sharing a member whose card is on gets the @username link and no switch.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/profile-share-card.cjs
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const root = path.join(__dirname, "..");
const file = name => fs.readFileSync(path.join(root, name));
// Media and uploads use the hosts the profile page's Content Security Policy allows (the CDN and the media bucket), so a
// policy that blocked them would fail here too.
const connect = /connect-src ([^;"]+)/.exec(fs.readFileSync(path.join(root, "profile.html"), "utf8"))[1].split(/\s+/);
const CDN = connect.find(host => /cloudfront\.net$/.test(host)), BUCKET = connect.find(host => /\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(host));
const MEDIA = { "/cover.jpg": ["image/jpeg", file("assets/danzstak-share-card.jpg")], "/face.png": ["image/png", file("assets/favicon-512.png")], "/item-1.png": ["image/png", file("assets/apple-touch-icon.png")], "/item-2.png": ["image/png", file("assets/favicon-192.png")] };
const jpegSize = bytes => { if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; let at = 2; while (at < bytes.length) { const marker = bytes[at + 1], length = bytes.readUInt16BE(at + 2); if (marker >= 0xc0 && marker <= 0xc2) return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) }; at += 2 + length; } return null; };

async function open(browser, width, { owner = true, language = "", visitorShareUrl = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  if (language) await context.addInitScript(lang => { try { localStorage.setItem("danzstak_language", lang); } catch {} }, language);
  const page = await context.newPage(), errors = [], saves = [], uploads = [];
  const state = { shareCard: undefined, shareCardSig: undefined };
  const profile = () => ({ memberId: me, name: "Night Shift Collective", handle: "nightshift", isOwner: owner, cloudProfile: true, bio: "Techno from the van.", picture: `${CDN}/face.png`, cover: `${CDN}/cover.jpg`, coverX: 50, coverY: 40, coverZoom: 1, avatarKey: "users/owner/a.jpg", coverKey: "users/owner/c.jpg",
    ...(owner ? { shareCard: state.shareCard, shareCardSig: state.shareCardSig, shareUrl: state.shareCard ? "https://danzstak.com/u/nightshift" : undefined } : { shareUrl: visitorShareUrl || undefined }) });
  page.on("pageerror", error => errors.push(error.message));
  const media = async route => {
    const request = route.request(), url = new URL(request.url()), cors = { "access-control-allow-origin": base };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET, PUT", "access-control-allow-headers": "content-type" } });
    if (request.method() === "PUT") { uploads.push({ key: url.pathname.slice(1), type: request.headers()["content-type"], bytes: request.postDataBuffer() }); return route.fulfill({ status: 200, headers: cors, body: "" }); }
    const found = MEDIA[url.pathname];
    return found ? route.fulfill({ status: 200, contentType: found[0], headers: cors, body: found[1] }) : route.fulfill({ status: 404, headers: cors, body: "" });
  };
  await page.route(`${CDN}/**`, media); await page.route(`${BUCKET}/**`, media);
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (p === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (p === "/profiles" && request.method() === "POST") {
      const body = JSON.parse(request.postData() || "{}"); saves.push(body);
      if (typeof body.shareCard === "boolean") state.shareCard = body.shareCard;
      if (body.shareCard === false) state.shareCardSig = undefined;
      if (body.shareCardSig) state.shareCardSig = body.shareCardSig;
      return json({ profile: profile() });
    }
    if (p === "/profiles" || p === "/profile") return json({ profile: profile() });
    if (p === "/stories" && request.method() === "POST") { const body = JSON.parse(request.postData() || "{}"); if (body.action === "discard") return json({ discarded: true }); const key = `users/owner/${String(uploads.length + 1).padStart(8, "0")}-1111-4111-a111-111111111111.jpg`; return json({ uploadUrl: `${BUCKET}/${key}?X-Amz-Signature=test`, mediaKey: key, mediaType: "image" }); }
    if (p === "/marketplace/shop") return json({ shop: { name: "Night Shift Merch", products: [{ id: "p1", available: true, imageUrl: `${CDN}/item-1.png` }, { id: "p2", available: true, imageUrl: `${CDN}/item-2.png` }, { id: "p3", available: false, imageUrl: `${CDN}/item-1.png` }] } });
    return json({});
  });
  await page.goto(`${base}/profile.html${owner ? "" : `?member=${me}`}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors, saves, uploads, state };
}
const centre = async (page, selector) => { const box = await page.locator(selector).first().boundingBox(); assert.ok(box, `${selector} is on screen`); return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }; };
async function tapShare(page) {
  await page.waitForFunction(() => { const b = document.querySelector('.profile-actions button[data-icon="share"]'); return b && !b.hidden && b.getBoundingClientRect().width > 0 && window.danzstakCurrentProfile?.memberId; }, null, { timeout: 20000, polling: 200 });
  const { x, y } = await centre(page, '.profile-actions button[data-icon="share"]');
  await page.touchscreen.tap(x, y);
  await page.waitForFunction(() => document.querySelector(".profile-share-dialog")?.open, null, { timeout: 5000 });
}
const linkValue = page => page.$eval(".profile-share-dialog input[type=url]", input => input.value);

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  const shots = path.join(root, "docs", "screenshots");
  try {
    for (const width of [320, 360, 390, 430]) {
      const label = `${width}px`, { context, page, errors, saves, uploads } = await open(browser, width);
      try {
        await tapShare(page);
        const ready = await page.waitForFunction(() => { const image = document.querySelector(".profile-share-preview img"); return image && !image.closest("figure").hidden && image.complete && image.naturalWidth === 1200 && document.querySelector(".profile-share-dialog input[type=url]").value.includes("/u/"); }, null, { timeout: 15000 }).then(() => true).catch(() => false);
        if (!ready) { failures.push(`${label}: the card preview and the @username link did not appear (${await page.$eval(".profile-share-dialog [role=status]", el => el.textContent).catch(() => "")})`); continue; }
        if (await linkValue(page) !== "https://danzstak.com/u/nightshift") failures.push(`${label}: link is ${await linkValue(page)}`);
        if (uploads.length !== 1) failures.push(`${label}: ${uploads.length} uploads, expected 1`);
        const card = uploads[0];
        if (card) {
          const size = jpegSize(card.bytes);
          if (card.type !== "image/jpeg" || !size || size.width !== 1200 || size.height !== 630) failures.push(`${label}: the card is ${card.type} ${JSON.stringify(size)}, expected a 1200x630 JPEG`);
          if (card.bytes.length >= 300 * 1024) failures.push(`${label}: the card is ${card.bytes.length} bytes (keep it under 300 KB)`);
          if (width === 390) fs.writeFileSync(path.join(shots, "profile-share-card-390.jpg"), card.bytes);
        }
        const on = saves.find(body => body.shareCard === true);
        if (!on || on.shareCardKey !== card?.key || !/^[a-f0-9]{32}$/.test(on.shareCardSig || "")) failures.push(`${label}: the save didn't turn the card on with its key and signature (${JSON.stringify(saves)})`);
        // The sheet fits: no sideways scroll, a 44px switch row whose centre is the switch, text in English.
        const layout = await page.evaluate(() => {
          const dialog = document.querySelector(".profile-share-dialog"), row = dialog.querySelector(".profile-share-toggle"), input = row.querySelector("input"), r = dialog.getBoundingClientRect(), t = row.getBoundingClientRect(), i = input.getBoundingClientRect();
          return { overflow: dialog.scrollWidth - dialog.clientWidth, left: r.left, right: r.right, vw: innerWidth, row: t.height, checked: input.checked, text: row.textContent.trim(), hit: document.elementFromPoint(i.left + i.width / 2, i.top + i.height / 2) === input };
        });
        if (layout.overflow > 1 || layout.left < 0 || layout.right > layout.vw + 0.5) failures.push(`${label}: the sheet doesn't fit (${JSON.stringify(layout)})`);
        if (layout.row < 44 || !layout.hit || !layout.checked) failures.push(`${label}: the switch row must be 44px, on, and tappable at its centre (${JSON.stringify(layout)})`);
        if (layout.text !== "Show my photo and name in link previews") failures.push(`${label}: switch says "${layout.text}"`);
        if (width === 390) await page.screenshot({ path: path.join(shots, "profile-share-sheet-390.png") });
        // Off: deleted on the server, the plain profile link, no preview.
        const sw = await centre(page, ".profile-share-toggle input");
        await page.touchscreen.tap(sw.x, sw.y);
        const off = await page.waitForFunction(member => document.querySelector(".profile-share-dialog input[type=url]").value.endsWith(`profile.html?member=${member}`) && document.querySelector(".profile-share-preview").hidden && !document.querySelector(".profile-share-toggle input").disabled, me, { timeout: 5000 }).then(() => true).catch(() => false);
        if (!off || saves.at(-1)?.shareCard !== false) failures.push(`${label}: turning it off didn't delete the card and restore the plain link (${JSON.stringify(saves.at(-1))})`);
        // Closed and opened again while off: still off, the plain link, nothing uploaded (no stale @ link).
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector(".profile-share-dialog")?.open, null, { timeout: 3000 });
        await tapShare(page);
        await page.waitForTimeout(400);
        const stillOff = await page.evaluate(() => ({ checked: document.querySelector(".profile-share-toggle input").checked, link: document.querySelector(".profile-share-dialog input[type=url]").value, hidden: document.querySelector(".profile-share-preview").hidden }));
        if (stillOff.checked || !stillOff.link.endsWith(`profile.html?member=${me}`) || !stillOff.hidden || uploads.length !== 1) failures.push(`${label}: reopened while off should stay off with the plain link (${JSON.stringify(stillOff)}, ${uploads.length} uploads)`);
        // On again: a fresh card (the switch moved up when the preview hid, so find it again).
        const swAgain = await centre(page, ".profile-share-toggle input");
        await page.touchscreen.tap(swAgain.x, swAgain.y);
        const again = await page.waitForFunction(() => document.querySelector(".profile-share-dialog input[type=url]").value.includes("/u/") && !document.querySelector(".profile-share-preview").hidden, null, { timeout: 15000 }).then(() => true).catch(() => false);
        if (!again || uploads.length !== 2 || saves.at(-1)?.shareCard !== true) failures.push(`${label}: turning it on again didn't upload a fresh card (${uploads.length} uploads)`);
        // Reopen with an up-to-date card: the preview, the @ link, and nothing uploaded.
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector(".profile-share-dialog")?.open, null, { timeout: 3000 });
        await tapShare(page);
        const reopened = await page.waitForFunction(() => { const image = document.querySelector(".profile-share-preview img"); return image && !image.closest("figure").hidden && image.naturalWidth === 1200; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
        if (!reopened || uploads.length !== 2 || await linkValue(page) !== "https://danzstak.com/u/nightshift") failures.push(`${label}: reopening with an up-to-date card should only show it (${uploads.length} uploads)`);
        if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      } finally { await context.close(); }
    }
    // Italian.
    {
      const { context, page } = await open(browser, 390, { language: "it" });
      try {
        await tapShare(page);
        await page.waitForSelector(".profile-share-toggle", { timeout: 5000 });
        await page.waitForTimeout(300);
        const text = await page.$eval(".profile-share-toggle", row => row.textContent.trim());
        if (text !== "Mostra la mia foto e il mio nome nelle anteprime dei link") failures.push(`it: switch says "${text}"`);
        const alt = await page.$eval(".profile-share-preview img", image => image.alt);
        if (alt !== "Anteprima del tuo link") failures.push(`it: preview alt "${alt}"`);
      } finally { await context.close(); }
    }
    // A visitor: the member's @username link, no switch, nothing uploaded.
    {
      const { context, page, uploads, saves } = await open(browser, 390, { owner: false, visitorShareUrl: "https://danzstak.com/u/nightshift" });
      try {
        // Visitors find Share in the profile's ⋯ menu.
        await page.waitForFunction(() => { const more = document.querySelector(".profile-actions .profile-more"); return more && more.getBoundingClientRect().width > 0 && window.danzstakCurrentProfile?.memberId; }, null, { timeout: 20000, polling: 200 });
        const more = await centre(page, ".profile-actions .profile-more");
        await page.touchscreen.tap(more.x, more.y);
        const item = await centre(page, '.profile-more-menu [role="menuitem"]');
        await page.touchscreen.tap(item.x, item.y);
        await page.waitForFunction(() => document.querySelector(".profile-share-dialog")?.open, null, { timeout: 5000 });
        await page.waitForTimeout(500);
        if (await linkValue(page) !== "https://danzstak.com/u/nightshift") failures.push(`visitor: link is ${await linkValue(page)}`);
        if (await page.$(".profile-share-toggle") || uploads.length || saves.length) failures.push("visitor: no switch, no upload, no save");
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("Profile share card checks passed at 320, 360, 390, 430px: the sheet shows the card and an on switch, the card is a 1200x630 JPEG under 300 KB uploaded once, the link is danzstak.com/@username; off deletes it and restores the plain link; on again uploads a fresh card; an up-to-date card isn't uploaded again; Italian; visitors get the @ link.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
