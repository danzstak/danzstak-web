"use strict";
// Owner 2026-11-24: "trying to get sync to ring the user from an off line app", "if the app is close it should still ring".
// The last test call went to a phone that couldn't ring with SYNC closed (registered, but never allowed notifications), and
// the caller just waited. Now call-signaling answers an offer with ringing:true/false (test-call-ring-reach.cjs), and the
// caller's call screen shows it, like a messenger:
//   - ringing:true  → the screen says "Ringing…";
//   - ringing:false → "Calling…", and one line: "Dee's phone can't ring while SYNC is closed." (Italian on an Italian phone);
//   - an older server that says nothing → "Calling…", no line.
// Real browser, a registered caller (credential seeded, API mocked), centre tap on the chat's phone icon, 320–430px.
// Run: node scripts/static-server.cjs 8150 . then DANZSTAK_BASE_URL=http://127.0.0.1:8150 node browser-checks/call-reach.cjs
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", DEE = "dee@danzstak.test", DEE_ID = "44444444-4444-4444-8444-444444444444";
const PHYSICAL = "77777777-7777-4777-8777-777777777777";
const CREDENTIAL = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: PHYSICAL };
const DEVICES = { accountTag: CREDENTIAL.accountTag, currentDeviceRegistered: true, currentPhysicalDeviceId: PHYSICAL, devices: [{ deviceId: CREDENTIAL.deviceId, name: "Night Shift", allowCalls: true, current: true, otpVerified: true, lastUsedAt: new Date().toISOString() }] };
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

async function run(browser, width, ringing, locale = "en-US") {
  const label = `${width}px ${locale} ringing:${ringing}`;
  const context = await browser.newContext({ viewport: { width, height: 800 }, locale, serviceWorkers: "block", hasTouch: true, isMobile: true, userAgent: ANDROID, permissions: ["camera", "microphone"] });
  const page = await context.newPage(), errors = [], offers = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", email: ME } }));
    if (p === "/calls/devices") return route.fulfill(json(DEVICES));
    if (p === "/calls/devices/share/preview") return route.fulfill(json({ eligible: false }));
    if (p === "/calls/inbox") return route.fulfill(json({ events: [] }));
    if (p === "/calls/ice" || p.startsWith("/calls/turn")) return route.fulfill(json({ iceServers: [], expiresAt: Date.now() + 300000 }));
    if (p === "/calls/signal") {
      const body = request.postDataJSON();
      if (body.signalType === "offer") { offers.push(body); return route.fulfill(json({ accepted: true, eventId: `${Date.now()}#x`, ...(ringing === undefined ? {} : { ringing }) }, 202)); }
      return route.fulfill(json({ accepted: true, eventId: `${Date.now()}#y` }, 202));
    }
    if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: DEE, memberId: DEE_ID, name: "Dee", preview: "Call me", updatedAt: new Date().toISOString(), unread: 0, canContact: true }] }));
    if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages: [], canContact: true, nextCursor: "" }));
    if (p === "/friends") return route.fulfill(json({ friends: [{ email: DEE, memberId: DEE_ID, name: "Dee", status: "friends" }] }));
    return route.fulfill(json({}));
  });
  // A registered calling device: the credential call-devices.js keeps in IndexedDB.
  await page.goto(`${baseUrl}/manifest.webmanifest`);
  await page.evaluate(credential => new Promise((resolve, reject) => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const tx = open.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([credential], "accounts"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), CREDENTIAL);
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
  await page.waitForFunction(() => window.danzstakSyncDeviceRegistered?.() === true, null, { timeout: 15000 });
  await page.locator(".conversation-user").first().click();
  await page.waitForFunction(() => { const b = document.getElementById("headerPhone"); return b && !b.disabled && b.getBoundingClientRect().width > 0; }, null, { timeout: 10000 });
  // Centre tap on the phone icon, not the button box.
  const spot = await page.evaluate(() => { const b = document.getElementById("headerPhone"), icon = b.querySelector("svg") || b, r = icon.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: b.contains(document.elementFromPoint(x, y)) }; });
  const failures = [];
  if (!spot.hit) failures.push(`${label}: the phone icon is covered`);
  await page.touchscreen.tap(spot.x, spot.y);
  await page.waitForFunction(() => document.body.dataset.callMode === "phone" && document.getElementById("toggleRingback") && !document.getElementById("toggleRingback").hidden, null, { timeout: 15000 }).catch(() => failures.push(`${label}: the call didn't start`));
  await page.waitForTimeout(400);
  const seen = await page.evaluate(() => ({ stage: document.querySelector("#callStage .ds-call-state")?.textContent?.trim() || "", status: document.getElementById("callStatus")?.textContent?.trim() || "", reach: document.body.dataset.callReach || "", statusShown: (() => { const s = document.getElementById("callStatus"); if (!s) return false; const r = s.getBoundingClientRect(), style = getComputedStyle(s); return r.height > 0 && style.visibility !== "hidden" && style.display !== "none" && !document.body.hasAttribute("data-call-status-echo"); })() }));
  if (offers.length !== 1) failures.push(`${label}: expected one offer, sent ${offers.length}`);
  const italian = locale.startsWith("it");
  if (ringing === true) {
    if (seen.stage !== (italian ? "Squilla…" : "Ringing…") && seen.stage !== "Ringing…") failures.push(`${label}: the screen should say Ringing… (${JSON.stringify(seen)})`);
    if (/can't ring|non può squillare/.test(seen.status)) failures.push(`${label}: a ringing phone must not get the can't-ring line`);
  } else if (ringing === false) {
    const line = italian ? "Il telefono di Dee non può squillare mentre SYNC è chiuso." : "Dee's phone can't ring while SYNC is closed.";
    if (seen.status !== line || !seen.statusShown) failures.push(`${label}: the caller should see "${line}" (${JSON.stringify(seen)})`);
    if (/Ringing|squill/.test(seen.stage)) failures.push(`${label}: a phone that can't ring must not say Ringing (${seen.stage})`);
  } else if (seen.reach || /can't ring/.test(seen.status) || /Ringing/.test(seen.stage)) failures.push(`${label}: an older server's answer changed the screen (${JSON.stringify(seen)})`);
  // Hanging up clears it.
  await page.evaluate(() => document.getElementById("hangUp")?.click());
  await page.waitForFunction(() => !document.body.dataset.callMode, null, { timeout: 8000 }).catch(() => {});
  if (await page.evaluate(() => document.body.dataset.callReach)) failures.push(`${label}: the ringing state stayed after hanging up`);
  await context.close();
  if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
  return failures;
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) for (const ringing of [true, false]) failures.push(...await run(browser, width, ringing));
    failures.push(...await run(browser, 390, undefined));
    failures.push(...await run(browser, 390, false, "it-IT"));
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Call reach: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exitCode = 1; return; }
  console.log("Call reach checks passed (320–430px): a ringing phone shows Ringing…, one that can't ring with SYNC closed shows Calling… and says so (English and Italian), an older server changes nothing, hanging up clears it.");
})().catch(error => { console.error(error); process.exitCode = 1; });
