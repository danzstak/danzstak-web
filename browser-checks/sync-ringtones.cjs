"use strict";
// SYNC ringtones (16-B2). Real Edge, API mocked, phones at 360 and 390. Web Audio is instrumented so the check can see
// which tone sounds (oscillator frequencies and how many tones are live):
// - SYNC settings → Ringtones: pick "Metal gallop" + message tone "Click", preview plays, only one tone at a time.
// - The chat's ⋮ → Ringtone: SFScoop gets "Techno pulse"; an incoming call from SFScoop rings with Techno (override wins),
//   and Decline stops it at once. A message tone never plays on top of a ringing call.
// - The choice survives a reload (localStorage, not the service-worker cache); no audio file is ever fetched.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8152 node browser-checks/sync-ringtones.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8152").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-ringtones");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "sfscoop@danzstak.test", FRIEND_ID = "44444444-4444-4444-8444-444444444444";
const PHYSICAL = "77777777-7777-4777-8777-777777777777";
const A = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: PHYSICAL };
const registeredDevices = { accountTag: A.accountTag, currentDeviceRegistered: true, currentPhysicalDeviceId: PHYSICAL, devices: [{ deviceId: A.deviceId, name: "Night Shift", allowCalls: true, current: true, otpVerified: true, lastUsedAt: new Date().toISOString() }] };
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }
async function seed(page) {
  await page.goto(`${baseUrl}/manifest.webmanifest`);
  await page.evaluate(credential => new Promise((resolve, reject) => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const tx = open.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([credential], "accounts"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), A);
}
// Records every oscillator start (frequency) per page; the tone ids are recognisable by their first frequencies.
const instrument = () => {
  window.__osc = [];
  const C = window.AudioContext; if (!C) return;
  const make = C.prototype.createOscillator;
  C.prototype.createOscillator = function () { const o = make.call(this); const start = o.start.bind(o); o.start = when => { window.__osc.push({ f: o.frequency.value, type: o.type, at: performance.now() }); return start(when); }; return o; };
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [], audioFiles = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => { if (/\.(mp3|wav|ogg|m4a|aac|flac|aiff?)(\?|$)/i.test(request.url())) audioFiles.push(request.url()); });
      let offerReady = false;
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: "33333333-3333-4333-8333-333333333333" } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", email: ME } }));
        if (p === "/calls/devices") return route.fulfill(json(registeredDevices));
        if (p === "/calls/inbox") return route.fulfill(json({ events: offerReady ? [{ eventId: "e-1", callId: "call-1", signalType: "offer", mode: "phone", senderEmail: FRIEND, senderName: "SFScoop", payload: { type: "offer", sdp: "v=0" }, createdAt: new Date().toISOString() }] : [] }));
        if (p === "/calls/ack" || p === "/calls/signal") return route.fulfill(json({ ok: true }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: FRIEND, memberId: FRIEND_ID, name: "SFScoop", preview: "Call me", updatedAt: new Date().toISOString(), unread: 0, canContact: true }] }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages: [], canContact: true, nextCursor: "" }));
        if (p === "/friends") return route.fulfill(json({ friends: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", status: "friends" }] }));
        if (p === "/calls/directory") return route.fulfill(json({ users: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", online: true }] }));
        return route.fulfill(json({}));
      });
      await seed(page);
      await page.addInitScript(instrument);
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await page.waitForFunction(() => window.danzstakSyncTones && document.getElementById("syncSettings"));
      // Settings → Ringtones
      await page.locator("#syncSettings").click();
      await page.locator('[data-settings-row="tones"]').click();
      await page.waitForFunction(() => document.querySelector(".sync-tones-dialog")?.open);
      const sheet = await page.evaluate(() => { const d = document.querySelector(".sync-tones-dialog"), r = d.getBoundingClientRect(); return { left: r.left, right: r.right, rings: d.querySelectorAll('[name="sync-ring"]').length, messages: d.querySelectorAll('[name="sync-message"]').length, note: d.querySelector("[data-note]").textContent, small: [...d.querySelectorAll("button,label")].filter(b => { const q = b.getBoundingClientRect(); return q.height > 0 && q.height < 43.5; }).map(b => b.textContent.trim() || b.getAttribute("aria-label")) }; });
      if (sheet.left < 0 || sheet.right > width + 0.5) failures.push(`${label}: ringtone sheet overflows`);
      if (sheet.rings + sheet.messages < 12) failures.push(`${label}: expected about 12 tones, found ${sheet.rings + sheet.messages}`);
      if (!/phone's own notification sound/.test(sheet.note)) failures.push(`${label}: the honest locked-phone note is missing`);
      if (sheet.small.length) failures.push(`${label}: targets under 44px: ${sheet.small.join(", ")}`);
      await shot(page, `1-ringtones-${width}`);
      // Preview two tones quickly: only one plays.
      await page.locator('.sync-tones-dialog [name="sync-ring"][value="punk-riff"]').locator("xpath=..").locator(".sync-tone-play").click();
      await page.locator('.sync-tones-dialog [name="sync-ring"][value="metal-gallop"]').locator("xpath=..").locator(".sync-tone-play").click();
      const playing = await page.evaluate(() => window.danzstakSyncTones.isPlaying());
      if (!playing) failures.push(`${label}: preview did not play`);
      await page.waitForTimeout(200);
      const recent = await page.evaluate(() => window.__osc.filter(o => performance.now() - o.at < 150).map(o => Math.round(o.f)));
      if (recent.some(f => f === 123 || f === 165)) failures.push(`${label}: the first preview kept playing under the second (${recent.join(",")})`);
      await page.locator('.sync-tones-dialog [name="sync-ring"][value="metal-gallop"]').check();
      await page.locator('.sync-tones-dialog [name="sync-message"][value="click"]').check();
      await page.locator(".sync-tones-dialog [data-done]").click();
      if (await page.evaluate(() => window.danzstakSyncTones.isPlaying())) failures.push(`${label}: closing the sheet did not stop the preview`);
      // Per-contact override from the chat's ⋮
      await page.locator(".conversation-user").first().click();
      await page.waitForTimeout(500);
      await page.locator("#conversationMore").click();
      await page.locator("#headerRingtoneMenu").click();
      await page.waitForFunction(() => document.querySelector(".sync-tones-dialog")?.open);
      if (!/This contact: SFScoop/.test(await page.locator(".sync-tones-dialog [data-scope]").textContent())) failures.push(`${label}: chat menu should edit this contact`);
      await page.locator('.sync-tones-dialog [name="sync-ring"][value="techno-pulse"]').check();
      await shot(page, `2-contact-override-${width}`);
      await page.locator(".sync-tones-dialog [data-done]").click();
      const pick = await page.evaluate(friend => ({ friend: window.danzstakSyncTones.toneFor("ring", friend), other: window.danzstakSyncTones.toneFor("ring", "someone@else.test"), raw: localStorage.getItem("danzstak_sync_tones") }), FRIEND);
      if (pick.friend !== "techno-pulse" || pick.other !== "metal-gallop") failures.push(`${label}: override/global wrong (${pick.friend}/${pick.other})`);
      if (/sfscoop/i.test(pick.raw || "")) failures.push(`${label}: the tone store contains the contact's address`);
      // Incoming call from SFScoop: rings with the override, Decline stops it.
      await page.evaluate(() => history.back()); await page.waitForTimeout(300);
      await page.mouse.click(5, 5); // a tap unlocks audio, as on a phone
      await page.evaluate(() => { window.__osc.length = 0; });
      offerReady = true;
      const rang = await page.waitForFunction(() => { const s = document.getElementById("incomingCall"); return s && !s.hidden; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
      if (!rang) failures.push(`${label}: incoming call did not ring`);
      await page.waitForTimeout(900);
      const ringing = await page.evaluate(() => ({ live: window.danzstakSyncTones.isPlaying(), freqs: [...new Set(window.__osc.map(o => Math.round(o.f)))] }));
      if (!ringing.live) failures.push(`${label}: no ringtone while ringing`);
      if (!ringing.freqs.includes(150)) failures.push(`${label}: SFScoop's Techno override did not ring (${ringing.freqs.join(",")})`);
      if (ringing.freqs.includes(82)) failures.push(`${label}: the global ringtone played instead of the contact override`);
      // A message tone must not play over the ring.
      const overlaid = await page.evaluate(friend => window.danzstakSyncTones.messageArrived(friend), FRIEND);
      if (overlaid) failures.push(`${label}: a message tone played on top of a ringing call`);
      await shot(page, `3-ringing-${width}`);
      offerReady = false;
      await page.locator("#declineCall").click().catch(() => {});
      await page.waitForTimeout(150);
      if (await page.evaluate(() => window.danzstakSyncTones.isPlaying())) failures.push(`${label}: the ringtone kept playing after Decline`);
      // Message tone when idle.
      const played = await page.evaluate(friend => window.danzstakSyncTones.messageArrived(friend), FRIEND);
      if (!played) failures.push(`${label}: message tone did not play when idle`);
      // Survives reload.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakSyncTones);
      const after = await page.evaluate(friend => [window.danzstakSyncTones.toneFor("ring", ""), window.danzstakSyncTones.toneFor("message", ""), window.danzstakSyncTones.toneFor("ring", friend)], FRIEND);
      if (after.join() !== "metal-gallop,click,techno-pulse") failures.push(`${label}: choices lost after reload (${after.join()})`);
      if (audioFiles.length) failures.push(`${label}: an audio file was fetched: ${audioFiles.join(", ")}`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC ringtones: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("SYNC ringtones checks passed (360, 390): 12 synthesized tones, previews one at a time, contact override rings, Decline stops it, no message tone over a ring, choices survive reload, no audio files.");
})().catch(error => { console.error(error); process.exitCode = 1; });
