"use strict";
// L1 (owner 2026-11-19): the Washington tester's MacBook "didn't ring" when called. Calls need a registered device, but a call
// to an unregistered one must never be silent. With no device credential, /calls/inbox answers 403 with who is calling:
//   - on a member page (Mix) the call shows "{name} is calling by video." with "Register this device to answer" and Decline,
//     at 1280px (a computer, window not in front: a desktop notification goes up) and at 320/360/390/430px, English and Italian;
//   - Decline (centre tap) refuses the call through /calls/decline (no device needed) and the pop-up and notification go away;
//   - "Register this device to answer" (centre tap) opens SYNC's device panel with the accept-the-call reason (from Mix, which
//     has no device panel, it used to do nothing);
//   - when the caller hangs up (the ringing list empties) the pop-up goes away by itself;
//   - in SYNC (messages.html) the device panel opens with the accept-the-call reason.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/unregistered-ring.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const CALL = "22222222-2222-4222-8222-222222222222";
const words = {
  en: { label: "Tour Friend is calling by video.", register: "Register this device to answer", notice: "Tour Friend is calling. Register this device to answer.", reason: "Register this device to accept the call or to listen to the voice message. Text messaging still works." },
  it: { label: "Tour Friend sta chiamando tramite video.", register: "Registra questo dispositivo per rispondere", notice: "Tour Friend ti sta chiamando. Registra questo dispositivo per rispondere.", reason: "Registra questo dispositivo per accettare la chiamata o ascoltare il messaggio vocale. I messaggi di testo continuano a funzionare." }
};

async function open(browser, { width, lang, page: target = "feed.html", focused = true }) {
  const desktop = width >= 1000;
  const context = await browser.newContext({ viewport: { width, height: desktop ? 800 : 844 }, isMobile: !desktop, hasTouch: !desktop, serviceWorkers: "block", locale: lang === "it" ? "it-IT" : "en-US" });
  await context.addInitScript(([language, hasFocus]) => {
    if (language === "it") { try { localStorage.setItem("danzstak_language", "it"); } catch {} }
    // The member allowed notifications; record what the page asks the service worker to show or close.
    window.__notes = []; window.__closed = [];
    Object.defineProperty(Notification, "permission", { configurable: true, get: () => "granted" });
    const registration = {
      showNotification: (title, options) => { window.__notes.push({ title, ...options }); return Promise.resolve(); },
      getNotifications: ({ tag } = {}) => Promise.resolve(window.__notes.filter(note => note.tag === tag).map(note => ({ close: () => window.__closed.push(note.tag) })))
    };
    Object.defineProperty(ServiceWorkerContainer.prototype, "ready", { configurable: true, get: () => Promise.resolve(registration) });
    if (!hasFocus) Document.prototype.hasFocus = () => false; // the window isn't in front
  }, [lang, focused]);
  const page = await context.newPage(), errors = [], declines = [];
  page.on("pageerror", error => errors.push(error.message));
  const state = { ringing: true };
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (p === "/auth/session") return reply({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "mac@danzstak.test" } });
    if (p === "/profiles") return reply({ profile: { isOwner: true, name: "Mac Tester", handle: "mactester" } });
    if (p === "/calls/devices") return reply({ accountTag: "b".repeat(32), currentDeviceRegistered: false, devices: [] });
    if (p === "/calls/inbox") return reply({ error: "Register this device to receive SYNC calls.", code: "CALL_DEVICE_REGISTRATION_REQUIRED", ringing: state.ringing ? [{ callId: CALL, mode: "video", senderName: "Tour Friend", createdAt: new Date().toISOString() }] : [] }, 403);
    if (p === "/calls/decline") { declines.push(request.postDataJSON()); state.ringing = false; return reply({ declined: true }, 202); }
    if (p === "/phone-verification") return reply({ configured: true, state: "none", verified: false, maskedNumber: "", providerAvailable: true, deviceOtpRequired: true });
    if (p === "/conversations") return reply({ conversations: [] });
    return reply({});
  });
  await page.goto(`${base}/${target}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors, declines, state };
}

async function centreTap(page, selector, label, touch) {
  const spot = await page.evaluate(sel => { const node = document.querySelector(sel), r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, w: r.width, h: r.height, hit: Boolean(document.elementFromPoint(x, y)?.closest(sel)), fits: r.left >= 0 && r.right <= innerWidth + 0.5 }; }, selector);
  assert.ok(spot.hit && spot.h >= 44 && spot.w >= 44 && spot.fits, `${label}: ${selector} is covered, small or off screen (${JSON.stringify(spot)})`);
  if (touch) await page.touchscreen.tap(spot.x, spot.y); else await page.mouse.click(spot.x, spot.y);
}

const popupShown = page => page.waitForFunction(() => { const pop = document.querySelector(".global-incoming-call"); return pop && !pop.hidden && pop.getBoundingClientRect().height > 0; }, null, { timeout: 15000 });
const popupGone = page => page.waitForFunction(() => document.querySelector(".global-incoming-call")?.hidden === true, null, { timeout: 10000 });

async function declineRun(browser, width, lang) {
  const desktop = width >= 1000, tag = `${width}px ${lang}`, w = words[lang];
  const { context, page, errors, declines } = await open(browser, { width, lang, focused: !desktop });
  await popupShown(page);
  assert.equal((await page.locator("#globalIncomingLabel").textContent()).trim(), w.label, `${tag}: says who is calling, in the member's language`);
  assert.equal((await page.locator(".global-incoming-call [data-answer]").textContent()).trim(), w.register, `${tag}: says how to answer`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, `${tag}: the page scrolls sideways`);
  if (desktop) {
    const notes = await page.evaluate(() => window.__notes);
    assert.equal(notes.length, 1, `${tag}: one desktop notification while the window isn't in front`);
    assert.equal(notes[0].body, w.notice);
    assert.equal(notes[0].tag, `call-${CALL}`);
  }
  if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `unregistered-ring-${lang}-${width}.png`) }); }
  await centreTap(page, ".global-incoming-call [data-decline]", tag, !desktop);
  await popupGone(page);
  assert.deepEqual(declines, [{ callId: CALL }], `${tag}: Decline refuses that call through /calls/decline`);
  if (desktop) assert.deepEqual(await page.evaluate(() => window.__closed), [`call-${CALL}`], `${tag}: the desktop notification closes`);
  await page.waitForTimeout(3500);
  assert.equal(await page.locator(".global-incoming-call").isHidden(), true, `${tag}: a declined call doesn't come back`);
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

async function registerRun(browser, width, lang) {
  const tag = `${width}px ${lang} register`, w = words[lang];
  const { context, page, errors } = await open(browser, { width, lang });
  await popupShown(page);
  await centreTap(page, ".global-incoming-call [data-answer]", tag, width < 1000);
  // Mix has no device panel: SYNC opens with it (it used to do nothing on every page but SYNC).
  await page.waitForURL(url => url.pathname.endsWith("/messages.html"), { timeout: 8000 });
  await page.locator("#callingDevicesDialog").waitFor({ state: "visible", timeout: 15000 });
  assert.equal((await page.locator("#callingDeviceReason").textContent()).trim(), w.reason, `${tag}: the device panel says why`);
  assert.equal(new URL(page.url()).searchParams.get("device"), null, `${tag}: the one-time ?device=answer is cleared from the address`);
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

async function hangUpRun(browser) {
  const { context, page, errors, state } = await open(browser, { width: 390, lang: "en" });
  await popupShown(page);
  state.ringing = false; // the caller hung up
  await popupGone(page);
  await context.close();
  assert.deepEqual(errors, [], "hang-up: page errors");
}

async function syncRun(browser, lang) {
  const w = words[lang];
  const { context, page, errors } = await open(browser, { width: 390, lang, page: "messages.html" });
  await page.locator("#callingDevicesDialog").waitFor({ state: "visible", timeout: 15000 });
  assert.equal((await page.locator("#callingDeviceReason").textContent()).trim(), w.reason, `SYNC ${lang}: the device panel opens with the accept-the-call reason`);
  await context.close();
  assert.deepEqual(errors, [], `SYNC ${lang}: page errors`);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [1280, 320, 360, 390, 430]) for (const lang of ["en", "it"]) await declineRun(browser, width, lang);
    await registerRun(browser, 1280, "en");
    await registerRun(browser, 390, "it");
    await hangUpRun(browser);
    for (const lang of ["en", "it"]) await syncRun(browser, lang);
  } finally { await browser.close(); }
  console.log("Unregistered ring checks passed: a call to an unregistered device shows who is calling with Register this device to answer (1280px with a desktop notification, 320-430px, English and Italian), Decline refuses it, Register opens the device panel with the reason, a hang-up clears it, and SYNC opens registration.");
})().catch(error => { console.error(error); process.exit(1); });
