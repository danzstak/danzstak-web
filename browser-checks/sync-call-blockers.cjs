"use strict";
// Owner SYNC call test (2026-11-17, phone <-> computer, both registered). Reproduces each blocker with a mocked API:
// 1. a registered device whose /calls/devices answers 429 once must NOT be sent to registration;
// 2. "registration required" from the first /calls/inbox polls (credential still loading) must not stop the poller:
//    the ringing screen appears for a later offer without a reload, and the "Register this device" banner clears;
// 3. a call that comes back CALL_DEVICE_REGISTRATION_REQUIRED on a registered device shows the real error instead;
// 4. the registration panel is one line, DS numbers are out, rename is inline (no prompt()).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-call-blockers.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-call-blockers");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "sfscoop@danzstak.test", FRIEND_ID = "44444444-4444-4444-8444-444444444444";
const PHYSICAL = "77777777-7777-4777-8777-777777777777";
const A = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: PHYSICAL };
const registeredDevices = { accountTag: A.accountTag, currentDeviceRegistered: true, currentPhysicalDeviceId: PHYSICAL, devices: [{ deviceId: A.deviceId, name: "Night Shift", allowCalls: true, current: true, otpVerified: true, lastUsedAt: new Date().toISOString() }] };
const needRegistration = json({ error: "Register this device before using calls.", code: "CALL_DEVICE_REGISTRATION_REQUIRED" }, 403);

async function seed(page) {
  await page.goto(`${baseUrl}/manifest.webmanifest`);
  await page.evaluate(credential => new Promise((resolve, reject) => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const tx = open.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([credential], "accounts"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), A);
}
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2, permissions: ["camera", "microphone"] });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      let devicesCalls = 0, inboxCalls = 0, offerReady = false, patchBody = null;
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: "33333333-3333-4333-8333-333333333333" } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", email: ME } }));
        if (p === "/calls/devices" && request.method() === "PATCH") { patchBody = request.postDataJSON(); return route.fulfill(json({ updated: true })); }
        // Blocker 1: the first /calls/devices answer is a rate limit, not a verdict.
        if (p === "/calls/devices") return route.fulfill(++devicesCalls === 1 ? json({ error: "Too many requests" }, 429) : json(registeredDevices));
        // Blocker 2: the first polls say "registration required" (credential still loading); then a real offer arrives.
        if (p === "/calls/inbox") { inboxCalls++; if (inboxCalls <= 2) return route.fulfill(needRegistration); return route.fulfill(json({ events: offerReady ? [{ eventId: "e-1", callId: "call-1", signalType: "offer", mode: "video", senderEmail: FRIEND, senderName: "SFScoop", payload: { type: "offer", sdp: "v=0" }, createdAt: new Date().toISOString() }] : [] })); }
        if (p === "/calls/ack") return route.fulfill(json({ acknowledged: true }));
        // Blocker 3: the call itself is refused with the registration code although /calls/devices says registered.
        if (p.startsWith("/calls/turn") || p === "/calls/ice" || p === "/calls/signal") return route.fulfill(needRegistration);
        if (p === "/calls/devices/share/preview") return route.fulfill(json({ eligible: false }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: FRIEND, memberId: FRIEND_ID, name: "SFScoop", preview: "Call me", updatedAt: new Date().toISOString(), unread: 0, canContact: true }] }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages: [], canContact: true, nextCursor: "" }));
        if (p === "/friends") return route.fulfill(json({ friends: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", status: "friends" }] }));
        if (p === "/calls/directory") return route.fulfill(json({ users: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", online: true }] }));
        return route.fulfill(json({}));
      });
      await seed(page);
      await page.addInitScript(() => {
        window.__opened = [];
        const show = HTMLDialogElement.prototype.showModal;
        HTMLDialogElement.prototype.showModal = function () { window.__opened.push(this.id); return show.call(this); };
        window.__prompts = 0; window.prompt = () => { window.__prompts++; return null; };
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(3500); // poller sees two "registration required" answers, devices answers 429 then registered
      const early = await page.evaluate(() => ({ opened: window.__opened.slice(), status: document.getElementById("callStatus")?.textContent || "" }));
      if (early.opened.includes("callingDevicesDialog")) failures.push(`${label}: a registered device was sent to registration (startup 429 / registration-required race)`);
      if (/Register this device/.test(early.status)) failures.push(`${label}: "Register this device" banner on a registered device: "${early.status}"`);

      // Blocker 2: an offer now arrives; the ringing screen appears without a reload.
      offerReady = true;
      const rang = await page.waitForFunction(() => { const s = document.getElementById("incomingCall"); return s && !s.hidden; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
      if (!rang) failures.push(`${label}: incoming call did not ring without a reload (inbox polls: ${inboxCalls})`);
      await shot(page, `ringing-${width}`);
      if ((await page.evaluate(() => window.__opened.slice())).includes("callingDevicesDialog")) failures.push(`${label}: the registration window replaced the ringing screen`);
      await page.locator("#declineCall").click().catch(() => {});
      offerReady = false;
      await page.waitForTimeout(500);

      // Blocker 3: start a video call that the server refuses with the registration code.
      await page.locator(".conversation-user").first().evaluate(node => node.click());
      await page.waitForTimeout(800);
      await page.evaluate(() => { const b = document.getElementById("headerVideo"); if (b) { b.disabled = false; b.click(); } });
      await page.waitForTimeout(2500);
      const call = await page.evaluate(() => ({ opened: window.__opened.slice(), status: document.getElementById("callStatus")?.textContent || "" }));
      if (call.opened.includes("callingDevicesDialog")) failures.push(`${label}: a refused call on a registered device opened registration instead of the real error`);
      if (!/could not confirm it for this call/.test(call.status)) failures.push(`${label}: refused call did not explain itself: "${call.status}"`);
      await shot(page, `refused-call-${width}`);

      // 4. Panel: one line, no DS upsell, inline rename.
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.getElementById("callingDevices")?.click());
      await page.waitForTimeout(800);
      const panel = await page.evaluate(() => {
        const d = document.getElementById("callingDevicesDialog");
        const visible = node => node && node.getClientRects().length && getComputedStyle(node).display !== "none";
        const paragraphs = [...d.querySelectorAll("p")].filter(visible).map(node => node.textContent.trim()).filter(Boolean);
        return { open: d.open, paragraphs, sms: visible(d.querySelector(".sync-phone-verification")), title: document.getElementById("callingDevicesTitle").textContent.trim(), ds: visible(d.querySelector(".sync-network-number")), every: /Every calling device/.test(d.innerText) };
      });
      if (!panel.open) failures.push(`${label}: the devices panel did not open`);
      if (panel.ds) failures.push(`${label}: the DS-number upsell is still in the registration panel`);
      if (panel.every) failures.push(`${label}: SMS rules are still repeated in the panel`);
      if (panel.sms) failures.push(`${label}: a registered device is shown the SMS registration form again`);
      if (panel.title !== "Calls on this device") failures.push(`${label}: registered panel title "${panel.title}"`);
      await shot(page, `panel-${width}`);
      const rename = page.locator("#registeredDevices button", { hasText: /Rename/ }).first();
      if (await rename.count()) {
        await rename.click();
        const field = page.locator("#registeredDevices .device-rename input");
        if (!(await field.count())) failures.push(`${label}: Rename did not open an inline field`);
        else {
          await field.fill("Night Shift laptop");
          await shot(page, `rename-${width}`);
          await field.press("Enter");
          await page.waitForTimeout(500);
          if (patchBody?.name !== "Night Shift laptop") failures.push(`${label}: inline rename did not save (${JSON.stringify(patchBody)})`);
        }
        if (await page.evaluate(() => window.__prompts)) failures.push(`${label}: rename still uses prompt()`);
      } else failures.push(`${label}: no Rename button on the registered device`);
      await page.locator("#closeCallingDevices").click();
      await page.waitForTimeout(200);
      if (await page.evaluate(() => document.getElementById("callingDevicesDialog").open)) failures.push(`${label}: × did not close the panel`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC call blockers: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("SYNC call blocker checks passed at 360 and 390px: 429 and startup race don't force registration, ringing appears without reload, refused call explains itself, one-line panel, inline rename, × closes.");
})().catch(error => { console.error(error); process.exitCode = 1; });
