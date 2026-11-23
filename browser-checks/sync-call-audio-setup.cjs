"use strict";
// Call audio setup (owner 2026-11-17). Computers: a centered Audio & video check box before the first outgoing call and
// from a gear on the call screen; mic picker + level meter, speaker picker + test sound, camera picker + preview, ring
// volume + preview ring; choices saved on this device only; one × that always closes; works at 320px. Phones (360/390):
// no box and no gear, one line about the phone's own controls. Blocked microphone: Accept explains how to allow it in
// this browser and Try again answers the same call. API mocked.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-call-audio-setup.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-call-audio-setup");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "sfscoop@danzstak.test", FRIEND_ID = "44444444-4444-4444-8444-444444444444";
const PHYSICAL = "77777777-7777-4777-8777-777777777777";
const A = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: PHYSICAL };
const devices = { accountTag: A.accountTag, currentDeviceRegistered: true, currentPhysicalDeviceId: PHYSICAL, devices: [{ deviceId: A.deviceId, name: "Night Shift", allowCalls: true, current: true, otpVerified: true }] };

async function setup(browser, { width, height, phone, blockMic }) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", hasTouch: phone, isMobile: phone, deviceScaleFactor: 2, permissions: ["camera", "microphone"], ...(phone ? { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" } : {}) });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let offer = false;
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", email: ME } }));
    if (p === "/calls/devices") return route.fulfill(json(devices));
    if (p === "/calls/inbox") return route.fulfill(json({ events: offer ? [{ eventId: "e-1", callId: "call-1", signalType: "offer", mode: "phone", senderEmail: FRIEND, senderName: "SFScoop", payload: { type: "offer", sdp: "v=0" }, createdAt: new Date().toISOString() }] : [] }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: FRIEND, memberId: FRIEND_ID, name: "SFScoop", preview: "Call me", updatedAt: new Date().toISOString(), unread: 0, canContact: true }] }));
    if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages: [], canContact: true, nextCursor: "" }));
    if (p === "/friends") return route.fulfill(json({ friends: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", status: "friends" }] }));
    if (p === "/calls/directory") return route.fulfill(json({ users: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", online: true }] }));
    return route.fulfill(json({}));
  });
  await page.goto(`${baseUrl}/manifest.webmanifest`);
  await page.evaluate(credential => new Promise((resolve, reject) => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const tx = open.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([credential], "accounts"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), A);
  await page.addInitScript(block => {
    window.__gumCalls = 0;
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__blockMic = block;
    navigator.mediaDevices.getUserMedia = constraints => { window.__gumCalls++; window.__lastConstraints = constraints; return window.__blockMic ? Promise.reject(new DOMException("Permission denied", "NotAllowedError")) : real(constraints); };
  }, Boolean(blockMic));
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  return { page, context, errors, setOffer: value => { offer = value; } };
}
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const failures = [];
  try {
    // ---- Computers: 1280 and a narrow 320px window ----
    for (const [width, height] of [[1280, 800], [320, 640]]) {
      const label = `computer ${width}px`;
      const { page, context, errors } = await setup(browser, { width, height, phone: false });
      const info = await page.evaluate(() => ({ computer: window.danzstakCallSetup?.isComputer, first: window.danzstakCallSetup?.needsFirstCheck?.() }));
      if (!info.computer || !info.first) failures.push(`${label}: not treated as a computer needing a first check ${JSON.stringify(info)}`);
      // First outgoing call opens the box first.
      await page.locator(".conversation-user").first().evaluate(node => node.click());
      await page.waitForTimeout(700);
      await page.evaluate(() => { const b = document.getElementById("headerPhone"); if (b) { b.disabled = false; b.click(); } });
      await page.waitForTimeout(1500);
      const box = await page.evaluate(() => {
        const d = document.querySelector(".call-setup-dialog:not(.call-blocked-dialog)");
        if (!d?.open) return null;
        const r = d.getBoundingClientRect(), close = d.querySelector(".call-setup-close").getBoundingClientRect();
        const visible = s => { const n = d.querySelector(s); return n && !n.closest("[hidden]") && n.getBoundingClientRect().height > 0; };
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, left: r.left, right: r.right, close: [close.width, close.height], mic: visible(".call-setup-mic"), meter: visible(".call-setup-level"), speaker: visible(".call-setup-speaker"), test: visible(".call-setup-test"), camera: visible(".call-setup-camera"), preview: visible(".call-setup-preview"), ring: visible(".call-setup-ring"), ringTest: visible(".call-setup-ring-test"), previewInside: (() => { const v = d.querySelector(".call-setup-preview").getBoundingClientRect(); return v.right <= r.right - 1 && v.left >= r.left; })(), previewWrapped: Boolean(d.querySelector(".danzstak-audio-toggle")), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      if (!box) failures.push(`${label}: the first outgoing call did not open the Audio & video check`);
      else {
        if (Math.abs(box.cx - width / 2) > 2) failures.push(`${label}: box is not centered (${Math.round(box.cx)} vs ${width / 2})`);
        if (box.left < 0 || box.right > width) failures.push(`${label}: box is wider than the window`);
        if (box.close[0] < 44 || box.close[1] < 44) failures.push(`${label}: × is smaller than 44px`);
        if (!box.previewInside || box.previewWrapped) failures.push(`${label}: camera preview overflows the box or got a feed mute button`);
        for (const key of ["mic", "meter", "speaker", "test", "camera", "preview", "ring", "ringTest"]) if (!box[key]) failures.push(`${label}: box is missing ${key}`);
        await page.waitForTimeout(600);
        await shot(page, `computer-box-${width}`);
        // Choices stay on this device.
        await page.locator(".call-setup-ring").fill("0.75");
        const ringSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("danzstak_call_av") || "{}").ringVolume);
        if (ringSaved !== 0.75) failures.push(`${label}: ring volume not saved on the device (${ringSaved})`);
        if (await page.evaluate(() => window.danzstakCallSetup.ringVolume()) !== 0.75) failures.push(`${label}: ringers don't read the saved ring volume`);
        await page.locator(".call-setup-dialog:not(.call-blocked-dialog) .call-setup-close").click();
        await page.waitForTimeout(400);
        if (await page.evaluate(() => document.querySelector(".call-setup-dialog")?.open)) failures.push(`${label}: × did not close the box`);
        if (await page.evaluate(() => window.danzstakCallSetup.needsFirstCheck())) failures.push(`${label}: the box would open again before every call`);
      }
      const gear = await page.evaluate(() => { const g = document.getElementById("callAudioSettings"); return g ? { svg: !!g.querySelector("svg"), label: g.getAttribute("aria-label") } : null; });
      if (!gear?.svg || !gear.label) failures.push(`${label}: no gear on the call screen ${JSON.stringify(gear)}`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    // ---- Phones: no box, no gear, one line; blocked microphone explained on Accept ----
    for (const width of [360, 390]) {
      const label = `phone ${width}px`;
      const { page, context, errors, setOffer } = await setup(browser, { width, height: 800, phone: true, blockMic: true });
      const phone = await page.evaluate(() => ({ computer: window.danzstakCallSetup?.isComputer, first: window.danzstakCallSetup?.needsFirstCheck?.(), gear: Boolean(document.getElementById("callAudioSettings")), note: document.getElementById("callPhoneAudioNote")?.textContent || "" }));
      if (phone.computer || phone.first || phone.gear) failures.push(`${label}: a phone got the computer box or gear ${JSON.stringify(phone)}`);
      if (!/volume buttons/.test(phone.note)) failures.push(`${label}: no line about the phone's own controls`);
      if (await page.evaluate(() => { const n = document.getElementById("callPhoneAudioNote"); return n && n.getBoundingClientRect().height > 0; })) failures.push(`${label}: the phone note shows outside a call`);
      setOffer(true);
      const rang = await page.waitForFunction(() => { const s = document.getElementById("incomingCall"); return s && !s.hidden; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
      if (!rang) { failures.push(`${label}: no incoming call to accept`); await context.close(); continue; }
      await page.locator("#acceptCall").click();
      await page.waitForTimeout(800);
      const blocked = await page.evaluate(() => { const d = document.querySelector(".call-blocked-dialog"); if (!d?.open) return null; const r = d.getBoundingClientRect(); return { text: d.querySelector(".call-blocked-steps").textContent, retry: !d.querySelector(".call-blocked-retry").hidden, left: r.left, right: r.right, title: d.querySelector("h2").textContent }; });
      if (!blocked) failures.push(`${label}: Accept with a blocked microphone did nothing visible`);
      else {
        if (!/Permissions/.test(blocked.text)) failures.push(`${label}: blocked-mic steps are not browser-specific: "${blocked.text}"`);
        if (!blocked.retry) failures.push(`${label}: no Try again`);
        if (blocked.left < 0 || blocked.right > width) failures.push(`${label}: blocked dialog overflows`);
        await shot(page, `phone-blocked-${width}`);
        const before = await page.evaluate(() => window.__gumCalls);
        await page.evaluate(() => { window.__blockMic = false; });
        await page.locator(".call-blocked-retry").click();
        await page.waitForTimeout(1500);
        const after = await page.evaluate(() => window.__gumCalls);
        if (after <= before) failures.push(`${label}: Try again did not try to answer the call again`);
      }
      await shot(page, `phone-call-${width}`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Call audio setup: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("Call audio setup checks passed: centered box on computers (1280, 320) before the first call, pickers/meter/preview/ring, saved on device, × closes, gear; phones (360, 390) no box, own-controls note, blocked mic explained with Try again.");
})().catch(error => { console.error(error); process.exitCode = 1; });
