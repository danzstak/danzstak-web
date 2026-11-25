"use strict";
// Notifications on the UI kit (docs/tasks/39-modern-look.md screen 1, CLAUDE.md F8 "Example, Notifications").
// Real browser, phone emulation with touch, at 320/360/390/430px, Day and Night, English and Italian:
// - New / Earlier sections: unread rows under New on the soft tint, read rows under Earlier;
// - each row: a 56px round avatar with a small type badge (an outline icon from assets/icons.svg), the name in bold
//   inside one sentence, a relative time ("2h", "3d", never "11/16/2026, 2:36:01 AM");
// - no "View post" / "Open chat" / "View profile" buttons: a tap at the row's centre opens the post (the whole row is the
//   target); a tap on the avatar opens that member's profile; friend requests keep Accept (green) and Decline;
// - every tap target is 44px or more, nothing overflows sideways;
// - while loading: shimmer rows, no "Loading…" text on screen.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/notifications-screen.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const PHOTO = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#7a4"/></svg>');
const ANA = "aaaaaaaa-1111-4111-8111-111111111111", BO = "bbbbbbbb-2222-4222-8222-222222222222";

function social() {
  return { notifications: [
    { type: "friend_request", email: "cleo@danzstak.test", createdAt: ago(30), unread: true }
  ] };
}
function engagement() {
  return { notifications: [
    { type: "reaction", preview: "Like", postId: "p1", memberId: ANA, name: "Ana Rivera", picture: PHOTO, createdAt: ago(120), unread: true },
    { type: "comment", preview: "See you at the show!", postId: "p2", memberId: BO, name: "Bo Kent", createdAt: ago(3 * 24 * 60), unread: false },
    { type: "tag", postId: "p3", memberId: ANA, name: "Ana Rivera", picture: PHOTO, createdAt: ago(5 * 24 * 60), unread: false }
  ] };
}

async function open(browser, width, { dark = false, italian = false, holdNotifications = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: dark ? "dark" : "light" });
  const page = await context.newPage(), errors = [], posts = [];
  page.on("pageerror", error => errors.push(error.message));
  if (italian) await page.addInitScript(() => { try { localStorage.setItem("danzstak_language", "it"); } catch {} });
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route("https://api.danzstak.com/**", async route => {
    const p = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST") posts.push(p);
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, cloudProfile: true, name: "Night Shift", handle: "nightshift" } }));
    if (p === "/notifications") { if (holdNotifications) await held; return route.fulfill(json(social())); }
    if (p === "/engagement-notifications") { if (holdNotifications) await held; return route.fulfill(json(engagement())); }
    if (p === "/calls/directory") return route.fulfill(json({ users: [{ email: "cleo@danzstak.test", name: "Cleo Park", memberId: "cccccccc-3333-4333-8333-333333333333" }] }));
    if (p === "/calls/devices") return route.fulfill(json({ accountTag: "a1", currentDeviceRegistered: true, devices: [] }));
    if (p === "/friends") return route.fulfill(json({ friends: [] }));
    return route.fulfill(json({}));
  });
  // This device holds a SYNC credential, so the "verify this device" row (its own check) stays out of the way.
  await page.addInitScript(() => {
    const request = indexedDB.open("danzstak-call-device", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("credentials");
    request.onsuccess = () => { const db = request.result, tx = db.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([{ deviceId: "d1d1d1d1-1111-4111-8111-111111111111", deviceToken: "t".repeat(43), accountTag: "a1", physicalDeviceId: "p1" }], "accounts"); tx.oncomplete = () => db.close(); };
  });
  await page.goto(`${base}/feed.html?view=notifications`, { waitUntil: "domcontentloaded" });
  return { context, page, errors, posts, release };
}
const ready = page => page.waitForFunction(() => [...document.querySelectorAll(".notification-list")].some(list => list.getAttribute("aria-busy") === "false" && list.querySelector(".ds-row:not(.ds-row--skeleton)") && list.getBoundingClientRect().height > 0), null, { timeout: 12000 });

const measure = page => page.evaluate(() => {
  const list = [...document.querySelectorAll(".notification-list")].find(l => l.getBoundingClientRect().height > 0);
  const sections = [...list.querySelectorAll(".ds-section")].map(section => ({
    title: section.querySelector(".ds-section__title")?.textContent.trim(),
    rows: [...section.querySelectorAll(".ds-row")].map(row => {
      const r = row.getBoundingClientRect(), photo = row.querySelector(".ds-row__photo").getBoundingClientRect(), badge = row.querySelector(".ds-row__badge");
      const target = row.querySelector(".ds-row__target"), tr = row.querySelector(".ds-row__text").getBoundingClientRect(), cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2;
      const hitCentre = document.elementFromPoint(cx, cy);
      return {
        kind: row.dataset.kind, unread: row.classList.contains("is-unread"), bg: getComputedStyle(row).backgroundColor,
        photo: [Math.round(photo.width), Math.round(photo.height), getComputedStyle(row.querySelector(".ds-row__photo")).borderRadius],
        badge: badge.querySelector("use")?.getAttribute("href") || "", badgeInside: badge.getBoundingClientRect().right <= photo.right + 6,
        bold: row.querySelector(".ds-row__text strong")?.textContent || "", text: row.querySelector(".ds-row__text").textContent,
        time: row.querySelector(".ds-row__time")?.textContent || "", height: r.height,
        centreIsTarget: hitCentre === target,
        href: target.getAttribute("href"), centre: [cx, cy],
        avatar: (() => { const a = row.querySelector("a.ds-row__avatar"); if (!a) return null; const ar = a.getBoundingClientRect(); return { href: a.getAttribute("href"), x: ar.left + ar.width / 2, y: ar.top + ar.height / 2 }; })(),
        buttons: [...row.querySelectorAll(".ds-row__actions button")].map(b => { const br = b.getBoundingClientRect(); return { text: b.textContent, bg: getComputedStyle(b).backgroundColor, w: br.width, h: br.height, x: br.left + br.width / 2, y: br.top + br.height / 2 }; })
      };
    })
  }));
  const targets = [...list.querySelectorAll("a,button")].filter(el => el.getBoundingClientRect().width > 0).map(el => { const r = el.getBoundingClientRect(); return [el.className, Math.round(r.width), Math.round(r.height)]; });
  return { sections, targets, overflow: document.documentElement.scrollWidth - innerWidth, listText: list.textContent };
});

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  fs.mkdirSync("docs/screenshots/launch", { recursive: true });
  try {
    for (const width of [320, 360, 390, 430]) for (const dark of [false, true]) {
      const label = `${width}px ${dark ? "Night" : "Day"}`;
      const run = await open(browser, width, { dark, holdNotifications: width === 360 && !dark });
      if (width === 360 && !dark) {
        await run.page.waitForSelector(".notification-list .ds-row--skeleton", { timeout: 12000 });
        const loading = await run.page.evaluate(() => { const list = document.querySelector(".notification-list"); return { ghosts: list.querySelectorAll(".ds-row--skeleton").length, visibleText: [...list.querySelectorAll("p")].filter(p => p.getBoundingClientRect().width > 1).map(p => p.textContent).join("") }; });
        assert.ok(loading.ghosts >= 3, `${label}: shimmer rows while loading`);
        assert.equal(loading.visibleText, "", `${label}: no "Loading…" text on screen`);
        run.release();
      }
      await ready(run.page);
      const m = await measure(run.page);
      assert.deepEqual(m.sections.map(s => s.title), ["New", "Earlier"], `${label}: New, then Earlier`);
      assert.deepEqual(m.sections.map(s => s.rows.map(r => r.kind)), [["friend_request", "reaction"], ["comment", "tag"]], `${label}: unread under New, read under Earlier, newest first`);
      const rows = m.sections.flatMap(s => s.rows);
      for (const row of rows) {
        assert.deepEqual(row.photo, [56, 56, "50%"], `${label} ${row.kind}: 56px round avatar`);
        assert.match(row.badge, /icons\.svg#[a-z-]+$/, `${label} ${row.kind}: type badge with a sprite icon`);
        assert.ok(row.badgeInside, `${label} ${row.kind}: badge sits on the avatar's corner`);
        assert.match(row.time, /^(now|\d+[mhdw]|[A-Z][a-z]{2} \d{1,2})$/, `${label} ${row.kind}: relative time, got "${row.time}"`);
        assert.ok(row.height >= 56, `${label} ${row.kind}: row tall enough`);
        assert.ok(row.centreIsTarget, `${label} ${row.kind}: a tap on the sentence lands on the row's own target`);
      }
      assert.equal(rows[1].bold, "Ana Rivera", `${label}: the name is bold inside the sentence`);
      assert.match(rows[1].text, /^Ana Rivera liked your post\.$/, `${label}: one running sentence`);
      assert.equal(rows[1].time, "2h", `${label}: 2 hours ago reads "2h"`);
      assert.equal(rows[2].time, "3d", `${label}: 3 days ago reads "3d"`);
      assert.notEqual(rows[0].bg, rows[2].bg, `${label}: unread rows are tinted, read rows are not`);
      assert.doesNotMatch(m.listText, /View post|Open chat|View profile|Loading/, `${label}: no "View post"-style buttons`);
      assert.deepEqual(rows[0].buttons.map(b => b.text), ["Accept", "Decline"], `${label}: a friend request keeps Accept and Decline`);
      assert.equal(rows[0].buttons[0].bg, "rgb(21, 128, 61)", `${label}: Accept is the green go button`);
      for (const [cls, w, h] of m.targets) assert.ok(w >= 44 && h >= 44, `${label}: ${cls} is ${w}x${h}, needs 44px`);
      assert.ok(m.overflow <= 0, `${label}: no sideways scroll (${m.overflow}px)`);
      if (width === 360 || width === 390) await run.page.screenshot({ path: `docs/screenshots/launch/notifications-${width}-${dark ? "night" : "day"}.png` });

      if (!dark) {
        // A tap on the avatar opens that member's profile; a tap on the sentence opens the post.
        assert.equal(rows[1].avatar.href, `profile.html?member=${ANA}`, `${label}: avatar links to the profile`);
        assert.equal(rows[1].href, "feed.html#post-p1", `${label}: the row opens the post`);
        await run.page.touchscreen.tap(rows[1].centre[0], rows[1].centre[1]);
        await run.page.waitForFunction(() => location.hash === "#post-p1", null, { timeout: 5000 });
        await run.page.goto(`${base}/feed.html?view=notifications`, { waitUntil: "domcontentloaded" });
        await ready(run.page);
        const again = await measure(run.page);
        const accept = again.sections[0].rows[0].buttons[0];
        await run.page.touchscreen.tap(accept.x, accept.y);
        await run.page.waitForFunction(() => !document.querySelector('.notification-list .ds-row[data-kind="friend_request"]'), null, { timeout: 5000 });
        assert.ok(run.posts.includes("/friends/respond"), `${label}: Accept answers the friend request`);
        const avatar = (await measure(run.page)).sections[0].rows[0].avatar;
        await run.page.touchscreen.tap(avatar.x, avatar.y);
        await run.page.waitForURL(/profile\.html\?member=/, { timeout: 5000 });
      }
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();
    }
    // Italian: the section titles and the sentences come from the translation layer.
    const it = await open(browser, 390, { italian: true });
    await ready(it.page);
    const m = await measure(it.page);
    assert.deepEqual(m.sections.map(s => s.title), ["Nuovo", "Precedenti"], "Italian: section titles translated");
    assert.doesNotMatch(m.listText, /liked your post|sent you a friend request|Earlier/, "Italian: no English sentences");
    await it.page.screenshot({ path: "docs/screenshots/launch/notifications-390-it.png" });
    assert.deepEqual(it.errors, [], `Italian: page errors ${it.errors.join(" | ")}`);
    await it.context.close();
    console.log("Notifications screen checks passed at 320/360/390/430px, Day and Night, and in Italian: New / Earlier, 56px avatars with type badges, bold names in one sentence, relative times, whole-row taps (post, profile), green Accept, shimmer while loading, no \"View post\" buttons, 44px targets, no sideways scroll.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
