"use strict";
// Owner 2026-11-24: "if a user is using the sync in the app and then opens the sync app and calls the audio is 2 times … need to
// open only one version of sync at a time". Two SYNC windows on one phone (SYNC inside the DanzStak app, messages.html, and
// the SYNC app, /sync/), same account, registered for calls, API mocked. Real browser, 320–430px, centre taps:
//   1. the SYNC app opens: the SYNC in DanzStak stops checking for calls and, while on screen, says "SYNC is open in another
//      window." with "Use SYNC here" (44px, centre tap takes SYNC back; the SYNC app then stops checking);
//   2. phone-style switching (one window in front): the window brought to the front takes over with no cover;
//   3. a call ringing in one window stops ringing there when the other SYNC is brought to the front, and only that one rings;
//   4. a window in a call keeps it: the other says "You're in a call in your other SYNC window." (no button) and takes over
//      when the call ends;
//   5. a call answered in another window on the phone stops ringing here (call-ringer.js handled → every window).
// Run: node scripts/static-server.cjs 8150 . then DANZSTAK_BASE_URL=http://127.0.0.1:8150 node browser-checks/sync-one-window.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-one-window");
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", DEE = "dee@danzstak.test", DEE_ID = "44444444-4444-4444-8444-444444444444";
const PHYSICAL = "77777777-7777-4777-8777-777777777777";
const CREDENTIAL = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: PHYSICAL };
const DEVICES = { accountTag: CREDENTIAL.accountTag, currentDeviceRegistered: true, currentPhysicalDeviceId: PHYSICAL, devices: [{ deviceId: CREDENTIAL.deviceId, name: "Night Shift", allowCalls: true, current: true, otpVerified: true, lastUsedAt: new Date().toISOString() }] };
const offer = callId => ({ eventId: `${callId}#offer`, callId, senderEmail: DEE, senderName: "Dee", mode: "phone", signalType: "offer", payload: { type: "offer", sdp: "v=0\r\n" }, createdAt: new Date().toISOString() });

async function phone(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, userAgent: ANDROID, permissions: ["camera", "microphone"] });
  const state = { calls: [], polls: new Map() };
  await context.route("https://api.danzstak.com/**", (route, request) => {
    const p = new URL(request.url()).pathname, who = request.frame()?.page()?.__name || "?";
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", email: ME } }));
    if (p === "/calls/devices") return route.fulfill(json(DEVICES));
    if (p === "/calls/devices/share/preview") return route.fulfill(json({ eligible: false }));
    if (p === "/calls/inbox") { state.polls.set(who, (state.polls.get(who) || 0) + 1); return route.fulfill(json({ events: state.calls.map(offer) })); }
    if (p === "/calls/ice" || p.startsWith("/calls/turn")) return route.fulfill(json({ iceServers: [], expiresAt: Date.now() + 300000 }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: DEE, memberId: DEE_ID, name: "Dee", preview: "Call me", updatedAt: new Date().toISOString(), unread: 0, canContact: true }] }));
    if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages: [], canContact: true, nextCursor: "" }));
    return route.fulfill(json({}));
  });
  const seed = await context.newPage();
  await seed.goto(`${baseUrl}/manifest.webmanifest`);
  await seed.evaluate(credential => new Promise((resolve, reject) => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const tx = open.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([credential], "accounts"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), CREDENTIAL);
  await seed.close();
  return { context, state };
}
async function open(context, name, url) {
  const page = await context.newPage();
  page.__name = name; page.errors = [];
  page.on("pageerror", error => page.errors.push(error.message));
  await page.goto(`${baseUrl}${url}`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
  await page.waitForFunction(() => window.danzstakSyncDeviceRegistered?.() === true, null, { timeout: 15000 });
  return page;
}
// One window in front, as on a phone.
const front = (page, shown) => page.evaluate(shown => { Object.defineProperty(document, "hidden", { configurable: true, get: () => !shown }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => shown ? "visible" : "hidden" }); document.dispatchEvent(new Event("visibilitychange")); }, shown);
const cover = page => page.evaluate(() => { const c = document.querySelector(".sync-elsewhere"); if (!c || c.hidden) return null; const b = c.querySelector("button"), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { text: c.querySelector("p").textContent, button: b.hidden ? null : { text: b.textContent, height: r.height, hit: b.contains(document.elementFromPoint(x, y)), fits: r.left >= 0 && r.right <= innerWidth, x, y } }; });
const ringing = page => page.evaluate(() => !document.getElementById("incomingCall").hidden);
async function pollsDuring(state, name, ms, page) { const before = state.polls.get(name) || 0; await page.waitForTimeout(ms); return (state.polls.get(name) || 0) - before; }

async function run(browser, width) {
  const tag = `${width}px`, failures = [];
  const { context, state } = await phone(browser, width);
  const inApp = await open(context, "inApp", "/messages.html");
  // 1. The SYNC app opens (both on screen here, as on a computer): the SYNC in DanzStak steps aside and says so.
  const app = await open(context, "app", "/sync/?app=sync");
  await inApp.waitForFunction(() => document.querySelector(".sync-elsewhere:not([hidden])"), null, { timeout: 5000 }).catch(() => {});
  let seen = await cover(inApp);
  if (seen?.text !== "SYNC is open in another window." || seen?.button?.text !== "Use SYNC here") failures.push(`${tag}: SYNC in DanzStak should say SYNC is open in another window, with Use SYNC here (${JSON.stringify(seen)})`);
  else if (seen.button.height < 44 || !seen.button.hit || !seen.button.fits) failures.push(`${tag}: Use SYNC here must be a 44px button that a centre tap reaches (${JSON.stringify(seen.button)})`);
  if (await cover(app)) failures.push(`${tag}: the SYNC app that just opened must not be covered`);
  if (await pollsDuring(state, "inApp", 4500, inApp) > 0) failures.push(`${tag}: the SYNC in DanzStak kept checking for calls while the SYNC app was open`);
  if (await pollsDuring(state, "app", 4500, app) < 1) failures.push(`${tag}: the SYNC app isn't checking for calls`);
  if (width === 360 || width === 390) await inApp.screenshot({ path: path.join(output, `in-app-cover-${width}.png`) });
  // Use SYNC here (centre tap) takes it back; the SYNC app steps aside.
  if (seen?.button) await inApp.touchscreen.tap(seen.button.x, seen.button.y);
  await app.waitForFunction(() => document.querySelector(".sync-elsewhere:not([hidden])"), null, { timeout: 5000 }).catch(() => failures.push(`${tag}: Use SYNC here didn't move SYNC back`));
  if (await cover(inApp)) failures.push(`${tag}: the cover stayed after Use SYNC here`);
  if (await pollsDuring(state, "app", 4500, app) > 0) failures.push(`${tag}: the SYNC app kept checking for calls after Use SYNC here`);

  // 2. Phone-style: the window brought to the front takes over, with no cover.
  await front(inApp, false); await front(app, true);
  await app.waitForTimeout(400);
  if (await cover(app)) failures.push(`${tag}: the window in front was covered`);
  if (await pollsDuring(state, "inApp", 4500, app) > 0) failures.push(`${tag}: the window behind kept checking for calls`);

  // 3. A call rings in the window in front; switching to the other SYNC moves the ring there, never both.
  const CALL = "55555555-5555-4555-8555-555555555555";
  state.calls = [CALL];
  await app.waitForFunction(() => !document.getElementById("incomingCall").hidden, null, { timeout: 8000 }).catch(() => failures.push(`${tag}: the call didn't ring in the SYNC app`));
  await front(app, false); await front(inApp, true);
  await app.waitForFunction(() => document.getElementById("incomingCall").hidden, null, { timeout: 5000 }).catch(() => failures.push(`${tag}: the SYNC app kept ringing after the other SYNC took over`));
  await inApp.waitForFunction(() => !document.getElementById("incomingCall").hidden, null, { timeout: 8000 }).catch(() => failures.push(`${tag}: the call didn't move to the SYNC in front`));
  if (await ringing(app) && await ringing(inApp)) failures.push(`${tag}: both SYNC windows ring`);
  if (width === 360 || width === 390) await inApp.screenshot({ path: path.join(output, `ringing-in-front-${width}.png`) });

  // 5. Answered in another window on the phone (any page with the ringer): the ring stops here.
  const other = await context.newPage();
  await other.goto(`${baseUrl}/privacy.html`);
  await other.addScriptTag({ url: "/assets/call-ringer.js" });
  await other.evaluate(id => window.danzstakCallRinger.handled(id), CALL);
  state.calls = [];
  await inApp.waitForFunction(() => document.getElementById("incomingCall").hidden, null, { timeout: 5000 }).catch(() => failures.push(`${tag}: a call answered in another window kept ringing here`));
  await other.close();

  // 4. A window in a call keeps it: the other SYNC says so and takes over when the call ends.
  await inApp.evaluate(() => { /* eslint-disable no-undef */ callId = "66666666-6666-4666-8666-666666666666"; contact = "dee@danzstak.test"; peer = new RTCPeerConnection(); /* eslint-enable no-undef */ });
  await front(inApp, false); await front(app, true);
  await app.waitForFunction(() => document.querySelector(".sync-elsewhere:not([hidden])"), null, { timeout: 5000 }).catch(() => {});
  seen = await cover(app);
  if (seen?.text !== "You're in a call in your other SYNC window." || seen?.button) failures.push(`${tag}: the SYNC app should say you're in a call in the other SYNC window, with no button (${JSON.stringify(seen)})`);
  if (await inApp.evaluate(() => peer?.connectionState) === "closed") failures.push(`${tag}: opening the other SYNC dropped the call`); // eslint-disable-line no-undef
  if (width === 360 || width === 390) await app.screenshot({ path: path.join(output, `in-a-call-elsewhere-${width}.png`) });
  await inApp.evaluate(() => end(false)); // eslint-disable-line no-undef
  await app.waitForFunction(() => !document.querySelector(".sync-elsewhere:not([hidden])"), null, { timeout: 5000 }).catch(() => failures.push(`${tag}: the SYNC app didn't take over when the call ended`));
  if (await pollsDuring(state, "app", 4500, app) < 1) failures.push(`${tag}: the SYNC app isn't checking for calls after the other call ended`);

  for (const page of [inApp, app]) if (page.errors.length) failures.push(`${tag} ${page.__name}: page errors ${page.errors.join(" | ")}`);
  await context.close();
  return failures;
}

async function italian(browser) {
  const failures = [];
  const { context } = await phone(browser, 390);
  await context.addInitScript(() => { try { localStorage.setItem("danzstak_language", "it"); } catch {} });
  const inApp = await open(context, "inApp", "/messages.html");
  await open(context, "app", "/sync/?app=sync");
  await inApp.waitForFunction(() => document.querySelector(".sync-elsewhere:not([hidden])"), null, { timeout: 5000 }).catch(() => {});
  const seen = await cover(inApp);
  if (seen?.text !== "SYNC è aperto in un'altra finestra." || seen?.button?.text !== "Usa SYNC qui") failures.push(`390px it: ${JSON.stringify(seen)}`);
  await context.close();
  return failures;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch({ ...(channel && channel !== "bundled" ? { channel } : {}), headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) failures.push(...await run(browser, width));
    failures.push(...await italian(browser));
  } finally { await browser.close(); }
  if (failures.length) { console.error(`One SYNC window: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exitCode = 1; return; }
  console.log("One SYNC window checks passed (320–430px): with SYNC open in DanzStak and as the SYNC app, only one checks for calls and rings; the other says SYNC is open in another window (Use SYNC here, centre tap) or that you're in a call there, and takes over when the call ends; the window brought to the front takes over; a call answered in another window stops ringing here; Italian too.");
})().catch(error => { console.error(error); process.exitCode = 1; });
