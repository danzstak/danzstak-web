"use strict";
// Owner 2026-11-19: "the call only rings when i am on sync when i am just in the app it wont let me answer". The call
// pop-up (incoming-calls.js) was only on Mix and the profile, and the profile lacked call-devices.js, so the inbox never
// answered it and Answer did nothing. Now every member page loads the device check, the ringer and the pop-up.
// Real browser, touch, a registered device and one incoming call in the inbox: on each page the pop-up shows, a tap at
// the centre of Answer reaches it, and SYNC opens on that call.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/incoming-call-everywhere.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
const CALL = "22222222-2222-4222-8222-222222222222";
const PAGES = [["feed.html", 360], ["profile.html", 360], ["bazaar.html", 390], ["epk.html", 360], ["booking.html", 390], ["record-stores.html", 360], ["store.html", 390], ["event.html", 360]];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const [page_, width] of PAGES) {
      const label = `${page_} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.goto(`${base}/manifest.webmanifest`);
      await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open("danzstak-call-device", 1); r.onupgradeneeded = () => r.result.createObjectStore("credentials"); r.onsuccess = () => { const tx = r.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([{ deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: "77777777-7777-4777-8777-777777777777" }], "accounts"); tx.oncomplete = () => { r.result.close(); resolve(); }; }; }));
      await page.route("https://api.danzstak.com/**", route => { const u = new URL(route.request().url()).pathname;
        if (u === "/auth/session") return json(route, { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@x.test" } });
        if (u === "/profiles") return json(route, { profile: { isOwner: true, name: "Night Shift", handle: "nightshift" } });
        if (u === "/calls/devices") return json(route, { accountTag: "a".repeat(32), currentDeviceRegistered: true, currentPhysicalDeviceId: "77777777-7777-4777-8777-777777777777", devices: [{ deviceId: "11111111-1111-4111-8111-111111111111", name: "Phone", allowCalls: true, otpVerified: true, current: true, lastUsedAt: new Date().toISOString() }] });
        if (u === "/calls/inbox") return json(route, { events: [{ eventId: "e1", signalType: "offer", callId: CALL, mode: "phone", senderEmail: "dee@x.test", senderName: "Dee", payload: { type: "offer", sdp: "v=0" }, createdAt: new Date().toISOString() }] });
        return json(route, {}); });
      await page.route(`${base}/messages.html**`, route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>SYNC</title>" }));
      await page.goto(`${base}/${page_}`, { waitUntil: "domcontentloaded" });
      const shown = await page.waitForFunction(() => { const pop = document.querySelector(".global-incoming-call"); return pop && !pop.hidden && pop.getBoundingClientRect().height > 0; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
      if (!shown) { failures.push(`${label}: the incoming call never showed`); await context.close(); continue; }
      const answer = await page.evaluate(() => { const a = document.querySelector(".global-incoming-call [data-answer]"), r = a.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: Boolean(document.elementFromPoint(x, y)?.closest("[data-answer]")), tall: r.height >= 44, fits: r.left >= 0 && r.right <= innerWidth }; });
      if (!answer.hit || !answer.tall || !answer.fits) failures.push(`${label}: Answer is covered, small or off screen (${JSON.stringify(answer)})`);
      await page.touchscreen.tap(answer.x, answer.y);
      const landed = await page.waitForURL(url => url.pathname.endsWith("/messages.html") && url.searchParams.get("callId") === CALL && url.searchParams.get("answer") === "1", { timeout: 8000 }).then(() => true).catch(() => false);
      if (!landed) failures.push(`${label}: Answer did not open SYNC on the call (${page.url()})`);
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log(`Incoming call checks passed on ${PAGES.length} member pages: the call shows, Answer is reachable at its centre (44px), and it opens SYNC on that call.`);
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
