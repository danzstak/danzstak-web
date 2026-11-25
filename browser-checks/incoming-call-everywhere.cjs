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
const PAGES = [["feed.html", 320], ["profile.html", 360], ["bazaar.html", 390], ["epk.html", 430], ["booking.html", 390], ["record-stores.html", 360], ["store.html", 390], ["event.html", 360], ["feed.html", 1280]];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const [page_, width] of PAGES) {
      const label = `${page_} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 800 : 780 }, isMobile: width < 1000, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: process.env.DANZSTAK_SCREENSHOTS ? 2 : 1 });
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
      // Owner 2026-11-25: "full screen like the phone ringing … answering decline". The call covers the whole screen (every
      // corner and the middle hit the call, never the page), Decline sits left of Answer, both are round 72px buttons with their
      // words under them, the caller's name is big, and nothing is wider than the screen.
      await page.waitForTimeout(300);
      const screen = await page.evaluate(() => {
        const pop = document.querySelector(".global-incoming-call"), r = pop.getBoundingClientRect();
        const points = [[2, 2], [innerWidth - 3, 2], [2, innerHeight - 3], [innerWidth - 3, innerHeight - 3], [innerWidth / 2, innerHeight / 2]];
        const covered = points.every(([x, y]) => pop.contains(document.elementFromPoint(x, y)));
        const a = pop.querySelector("[data-answer] .gic-circle").getBoundingClientRect(), d = pop.querySelector("[data-decline] .gic-circle").getBoundingClientRect();
        const name = pop.querySelector(".gic-name");
        return { full: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight, covered, order: d.right <= a.left, round: a.width >= 64 && Math.abs(a.width - a.height) < 1 && d.width >= 64,
          inView: a.bottom <= innerHeight && d.bottom <= innerHeight, name: name.textContent, nameSize: parseFloat(getComputedStyle(name).fontSize), wide: document.documentElement.scrollWidth > innerWidth || [...pop.querySelectorAll("*")].some(n => n.getBoundingClientRect().right > innerWidth + 0.5 && !n.closest(".gic-bg")),
          words: [...pop.querySelectorAll(".global-call-actions button")].map(b => b.textContent.trim()) };
      });
      if (!screen.full || !screen.covered) failures.push(`${label}: the call isn't full screen (${JSON.stringify(screen)})`);
      if (!screen.order || !screen.round || !screen.inView) failures.push(`${label}: Decline/Answer aren't round, side by side and on screen (${JSON.stringify(screen)})`);
      if (screen.name !== "Dee" || screen.nameSize < 26) failures.push(`${label}: the caller's name isn't big (${screen.name}, ${screen.nameSize}px)`);
      if (screen.wide) failures.push(`${label}: something is wider than the screen`);
      if (screen.words.join("|") !== "Answer|Decline") failures.push(`${label}: button words ${screen.words.join("|")}`);
      if (process.env.DANZSTAK_SCREENSHOTS && (width === 390 || width === 1280)) await page.screenshot({ path: `docs/screenshots/incoming-call-full-${width}.png` });
      const answer = await page.evaluate(() => { const a = document.querySelector(".global-incoming-call [data-answer]"), r = a.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: Boolean(document.elementFromPoint(x, y)?.closest("[data-answer]")), tall: r.height >= 44, fits: r.left >= 0 && r.right <= innerWidth }; });
      if (!answer.hit || !answer.tall || !answer.fits) failures.push(`${label}: Answer is covered, small or off screen (${JSON.stringify(answer)})`);
      await page.touchscreen.tap(answer.x, answer.y);
      // A computer answers in Mix's own chat drawer when the page has one; phones open SYNC on the call.
      const landed = await Promise.race([
        page.waitForURL(url => url.pathname.endsWith("/messages.html") && url.searchParams.get("callId") === CALL && url.searchParams.get("answer") === "1", { timeout: 8000 }).then(() => true),
        width > 1000 ? page.waitForFunction(() => document.querySelector(".global-incoming-call")?.hidden === true && typeof window.openMessageDrawer === "function", null, { timeout: 8000 }).then(() => true) : new Promise(() => {})
      ]).catch(() => false);
      if (!landed) failures.push(`${label}: Answer did not open SYNC on the call (${page.url()})`);
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log(`Incoming call checks passed on ${PAGES.length} member pages (320–1280px): the call fills the screen like a phone ringing (Decline left, Answer right, round, the name big), the call shows, Answer is reachable at its centre (44px), and it opens SYNC on that call.`);
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
