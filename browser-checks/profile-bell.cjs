"use strict";
// Owner 2026-11-23 (his profile on the phone, top bar: back, name, search, Pivot): "There should be a notification icon on
// this page as well". Real browser, own profile and a visitor's view, at 320/360/390/430px (touch) and 1280px:
//   - the bell is in the top bar, after Pivot, a 44px target, on screen, not covered and not overlapping the other icons;
//   - it carries the count of what's new (2 friend notices + 1 unread reaction = 3; a read one doesn't count), and its
//     name says so;
//   - the bar stays one row and the page doesn't scroll sideways;
//   - a tap at its centre opens Notifications in Mix (feed.html#notifications).
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/profile-bell.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const me = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";

async function run(browser, width, visitor) {
  const desktop = width >= 1000, tag = `${width}px${visitor ? " visitor" : ""}`;
  const context = await browser.newContext({ viewport: { width, height: desktop ? 800 : 844 }, isMobile: !desktop, hasTouch: !desktop, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (p === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (p === "/profiles" || p === "/profile") return json({ profile: visitor ? { memberId: other, name: "Eroticon", username: "eroticon", handle: "eroticon", isOwner: false, cloudProfile: true } : { memberId: me, name: "Eroticon", username: "eroticon", handle: "eroticon", isOwner: true, cloudProfile: true } });
    if (p === "/notifications") return json({ notifications: [{ id: "a", type: "friend_request" }, { id: "b", type: "friend_accepted" }] });
    if (p === "/engagement-notifications") return json({ notifications: [{ id: "c", unread: true }, { id: "d", unread: false }] });
    return json({});
  });
  await page.route(`${base}/feed.html*`, route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Mix</title><p>Mix</p>" }));
  await page.goto(`${base}/profile.html${visitor ? `?member=${other}` : ""}`, { waitUntil: "domcontentloaded" });
  const bell = page.locator("header.profile-app-header .profile-bell");
  await bell.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction(() => document.querySelector(".profile-bell .nav-count")?.hidden === false, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  const layout = await page.evaluate(() => {
    const header = document.querySelector("header.profile-app-header"), bell = header.querySelector(".profile-bell");
    const box = el => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
    const b = box(bell), x = b.l + b.w / 2, y = b.t + b.h / 2;
    const icons = [...header.children].filter(el => el !== bell && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none").map(el => ({ name: el.className, ...box(el) }));
    const pivot = header.querySelector(".ds-app-bar-pivot");
    return {
      bell: b, hit: Boolean(document.elementFromPoint(x, y)?.closest(".profile-bell")), icon: Boolean(bell.querySelector("svg")),
      count: bell.querySelector(".nav-count")?.hidden ? "" : bell.querySelector(".nav-count")?.textContent, label: bell.getAttribute("aria-label"),
      overlaps: icons.filter(o => o.l < b.r - 0.5 && o.r > b.l + 0.5 && o.t < b.b - 0.5 && o.b > b.t + 0.5).map(o => o.name),
      afterPivot: pivot ? box(pivot).r <= b.l + 0.5 : false, header: box(header), rows: new Set(icons.map(o => Math.round((o.t + o.b) / 2))).size,
      sideways: document.documentElement.scrollWidth > innerWidth, vw: innerWidth
    };
  });
  assert.ok(layout.icon, `${tag}: the bell draws its icon`);
  assert.ok(layout.bell.w >= 44 && layout.bell.h >= 44, `${tag}: the bell is a 44px target (${layout.bell.w}x${layout.bell.h})`);
  assert.ok(layout.bell.l >= 0 && layout.bell.r <= layout.vw + 0.5, `${tag}: the bell is on screen`);
  assert.ok(layout.hit, `${tag}: nothing covers the bell's centre`);
  assert.deepEqual(layout.overlaps, [], `${tag}: the bell overlaps another part of the bar`);
  assert.ok(layout.afterPivot, `${tag}: the bell sits after Pivot`);
  assert.equal(layout.rows, 1, `${tag}: the bar wrapped onto ${layout.rows} rows`);
  assert.equal(layout.sideways, false, `${tag}: the page scrolls sideways`);
  assert.equal(layout.count, "3", `${tag}: the bell counts what's new (got "${layout.count}")`);
  assert.equal(layout.label, "Notifications, 3 new notifications", `${tag}: the bell's name`);
  if (captureDir && !visitor) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `profile-bell-${width}.png`), clip: { x: 0, y: 0, width, height: 120 } }); }
  const x = layout.bell.l + layout.bell.w / 2, y = layout.bell.t + layout.bell.h / 2;
  if (desktop) await page.mouse.click(x, y); else await page.touchscreen.tap(x, y);
  await page.waitForURL(url => url.pathname.endsWith("/feed.html") && url.hash === "#notifications", { timeout: 8000 });
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430, 1280]) await run(browser, width, false);
    await run(browser, 390, true);
  } finally { await browser.close(); }
  console.log("Profile bell checks passed: the profile's top bar has the bell after Pivot with the count of what's new, on one row with no overlap at 320-430px and 1280px, own profile and a visitor's, and a centre tap opens Notifications in Mix.");
})().catch(error => { console.error(error); process.exit(1); });
