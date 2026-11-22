"use strict";
// Owner 2026-11-19: "users that don't verify their device should get a notification in danzstak that says to verify
// their device". Real browser at 360 and 390px, signed in, no other notifications:
// - this device has no SYNC credential → the bell counts 1, Notifications shows "Verify this device for SYNC calls" as
//   one tappable row (no separate button), and a tap at its centre opens SYNC's "verify your number";
// - once seen, the bell stops counting it (the row stays until the device is verified);
// - a verified device (a SYNC credential in this browser) → no row, no count.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/device-reminder.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });

async function open(browser, width, { verified = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, cloudProfile: true, name: "Night Shift", handle: "nightshift" } }));
    if (p === "/notifications" || p === "/engagement-notifications") return route.fulfill(json({ notifications: [] }));
    if (p === "/calls/directory") return route.fulfill(json({ users: [] }));
    // The server agrees with this browser: a verified device is registered, an unverified one isn't.
    if (p === "/calls/devices") return route.fulfill(json({ accountTag: "a1", currentDeviceRegistered: verified, devices: [] }));
    if (p === "/friends") return route.fulfill(json({ friends: [] }));
    return route.fulfill(json({}));
  });
  await page.route(`${base}/sync/**`, route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>SYNC</title><p>SYNC</p>" }));
  // The SYNC credential is written and committed before the app loads, in the format call-devices.js accepts (a UUID device
  // id). The old "d1" id was thrown out by call-devices.js as invalid, which emptied the store while the reminder was
  // reading it, so "verified" passed or failed by timing.
  if (verified) {
    await page.goto(`${base}/sync/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open("danzstak-call-device", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("credentials");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result, tx = db.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([{ deviceId: "d1d1d1d1-1111-4111-8111-111111111111", deviceToken: "t".repeat(43), accountTag: "a1", physicalDeviceId: "p1" }], "accounts"); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }));
  }
  await page.goto(`${base}/feed.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.danzstakDeviceReminder && document.querySelector('[data-feature="Notifications"]'), null, { timeout: 10000 });
  return { context, page, errors };
}
const bellCount = page => page.evaluate(() => {
  const badge = [...document.querySelectorAll('[data-feature="Notifications"] .nav-count')].find(b => b.getBoundingClientRect().width > 0);
  return badge && !badge.hidden ? badge.textContent.trim() : "";
});
async function openNotifications(page) {
  const bell = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-feature="Notifications"]')].find(el => el.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(bell.x, bell.y);
  // Phones open Notifications as its own screen (feed.html#notifications); wider screens use the drawer. Same list.
  await page.waitForFunction(() => [...document.querySelectorAll(".notification-list")].some(list => list.getAttribute("aria-busy") === "false" && list.getBoundingClientRect().height > 0), null, { timeout: 8000 });
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390]) {
      let label = `${width}px not verified`;
      let run = await open(browser, width);
      await run.page.waitForFunction(() => [...document.querySelectorAll('[data-feature="Notifications"] .nav-count')].some(b => !b.hidden && b.textContent.trim() === "1"), null, { timeout: 10000 });
      assert.equal(await bellCount(run.page), "1", `${label}: the bell counts the reminder`);
      await openNotifications(run.page);
      const row = await run.page.evaluate(() => {
        const link = document.querySelector(".notification-list .notification-row--device"); if (!link) return null;
        const r = link.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        return { tag: link.tagName, href: link.getAttribute("href"), title: link.querySelector("strong")?.textContent, line: link.querySelector("p span")?.textContent, buttons: link.querySelectorAll("button").length,
          tall: r.height >= 44, fits: r.left >= -0.5 && r.right <= innerWidth + 0.5, hit: Boolean(document.elementFromPoint(x, y)?.closest(".notification-row--device")), x, y, empty: [...document.querySelectorAll(".notification-list p.muted")].some(p => /No new notifications/.test(p.textContent)) };
      });
      assert.ok(row, `${label}: Notifications shows the reminder`);
      assert.deepEqual({ tag: row.tag, href: row.href, title: row.title, line: row.line, buttons: row.buttons }, { tag: "A", href: "/sync/?device=register", title: "Verify this device for SYNC calls", line: "Calls and voice messages need it. Texting already works.", buttons: 0 }, `${label}: one tappable row, no extra button`);
      assert.ok(row.tall && row.fits && row.hit, `${label}: 44px row on screen, its centre reachable (${JSON.stringify(row)})`);
      assert.equal(row.empty, false, `${label}: no "No new notifications" under the reminder`);
      // Owner 2026-11-19: "just offer it in the notification" — the DS number, for members who won't enter a phone number.
      const ds = await run.page.evaluate(() => { const a = document.querySelector(".notification-list .notification-ds-link"); if (!a) return null; const r = a.getBoundingClientRect(); return { href: a.getAttribute("href"), text: a.textContent, tall: r.height >= 44, fits: r.right <= innerWidth + 0.5, hit: Boolean(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".notification-ds-link")) }; });
      assert.deepEqual(ds, { href: "/sync/?device=register&ds=1", text: "No phone number? Get a DS number", tall: true, fits: true, hit: true }, `${label}: the DS number is offered under the reminder`);
      if (width === 390) await run.page.screenshot({ path: "docs/screenshots/device-reminder-390.png" });
      await run.page.touchscreen.tap(row.x, row.y);
      await run.page.waitForURL(/\/sync\/\?device=register$/, { timeout: 8000 });
      await run.page.goto(`${base}/feed.html`, { waitUntil: "domcontentloaded" });
      await run.page.waitForFunction(() => window.danzstakDeviceReminder, null, { timeout: 10000 });
      await run.page.waitForTimeout(2500);
      assert.equal(await bellCount(run.page), "", `${label}: once seen, the bell stops counting it`);
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();

      label = `${width}px verified`;
      run = await open(browser, width, { verified: true });
      await run.page.waitForTimeout(2500);
      assert.equal(await bellCount(run.page), "", `${label}: no count`);
      await openNotifications(run.page);
      assert.equal(await run.page.locator(".notification-list .notification-row--device").count(), 0, `${label}: no reminder`);
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();
    }
    console.log("Device reminder checks passed at 360 and 390px: an unverified device gets one Notifications row (bell count 1) whose centre tap opens SYNC's verification; once seen the bell stops counting it; a verified device gets none.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
