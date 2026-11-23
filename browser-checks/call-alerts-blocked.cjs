"use strict";
// L4 (owner 2026-11-20: "When app is closed it doesn't ring. Only rings when on sync"). A phone with notifications
// blocked for DanzStak can't ring with SYNC closed, and no button on the page can change a browser block. SYNC must never
// be silent about it: one line says why and where to allow them, in the member's language, at 320/360/390/430px.
//   - English and Italian: the line sits above the chat list, wraps inside the screen, and has no "Turn on" button;
//   - Not now (centre tap, 44px) closes it and it stays closed after a reload;
//   - when notifications are allowed (default state), the usual "Turn on call alerts" line shows instead.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/call-alerts-blocked.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const ME = "11111111-1111-4111-8111-111111111111", DEVICE = "44444444-4444-4444-8444-444444444444", TOKEN = "T".repeat(43);
const words = {
  en: { blocked: "Calls can't ring when SYNC is closed: notifications are blocked. Allow them for danzstak.com in your browser's site settings.", ask: "Turn on call alerts so calls ring when SYNC is closed" },
  it: { blocked: "Le chiamate non possono squillare con SYNC chiuso: le notifiche sono bloccate. Consentile per danzstak.com nelle impostazioni del sito del browser.", ask: "Attiva gli avvisi di chiamata perché le chiamate squillino anche con SYNC chiuso" }
};

async function centreTap(page, locator, label) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${label} is smaller than 44px: ${JSON.stringify(box)}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const covered = await page.evaluate(([px, py]) => { const node = document.elementFromPoint(px, py); return node?.closest(".call-alerts-close") ? "" : `${node?.tagName}.${node?.className}`; }, [x, y]);
  assert.equal(covered, "", `${label}: the centre of Not now is covered by ${covered}`);
  await page.mouse.click(x, y);
}

async function open(browser, width, lang, permission) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, serviceWorkers: "block", locale: lang === "it" ? "it-IT" : "en-US" });
  await context.addInitScript(([state, language]) => {
    if (language === "it") { try { localStorage.setItem("danzstak_language", "it"); } catch {} }
    // The browser's own setting: "denied" when the member blocked notifications for the site.
    Object.defineProperty(Notification, "permission", { configurable: true, get: () => state });
  }, [permission, lang]);
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const cors = { "access-control-allow-origin": new URL(baseUrl).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const reply = body => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (p === "/auth/session") return reply({ authenticated: true, user: { sub: ME, email: "alerts@danzstak.invalid" } });
    if (p === "/profiles") return reply({ profile: { memberId: ME, name: "Alerts Check", handle: "alerts" } });
    if (p === "/calls/devices") { const headers = await request.allHeaders(), mine = headers["x-danzstak-device-id"] === DEVICE; return reply({ currentDeviceRegistered: mine, devices: mine ? [{ deviceId: DEVICE, name: "Test phone", allowCalls: true, thisDevice: true }] : [] }); }
    if (p === "/calls/inbox") return reply({ events: [] });
    if (p === "/conversations") return reply({ conversations: [] });
    if (p === "/phone-verification") return reply({ configured: true, state: "verified", verified: true, maskedNumber: "••••37", providerAvailable: true, deviceOtpRequired: true });
    return reply({});
  });
  // A registered calling device on this browser.
  await page.goto(`${baseUrl}/privacy.html`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.evaluate(([deviceId, deviceToken]) => new Promise((resolve, reject) => {
    const request = indexedDB.open("danzstak-call-device", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("credentials");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction("credentials", "readwrite"); tx.objectStore("credentials").put({ deviceId, deviceToken }, "current"); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }), [DEVICE, TOKEN]);
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

async function blockedRun(browser, width, lang) {
  const tag = `${width}px ${lang}`, { context, page, errors } = await open(browser, width, lang, "denied");
  const bar = page.locator(".call-alerts-prompt");
  await bar.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await bar.getAttribute("data-state"), "blocked", `${tag}: the blocked line`);
  assert.equal((await bar.locator("span").textContent()).trim(), words[lang].blocked, `${tag}: says why, in the member's language`);
  assert.equal(await bar.locator(".primary").count(), 0, `${tag}: no Turn on button that can't work`);
  const fits = await bar.evaluate(node => { const r = node.getBoundingClientRect(), text = node.querySelector("span").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && text.right <= r.right + 0.5 && document.documentElement.scrollWidth <= innerWidth; });
  assert.ok(fits, `${tag}: the line fits the screen`);
  if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `call-alerts-blocked-${lang}-${width}.png`) }); }
  await centreTap(page, bar.locator(".call-alerts-close"), tag);
  await bar.waitFor({ state: "detached", timeout: 5000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  assert.equal(await page.locator(".call-alerts-prompt").count(), 0, `${tag}: once closed, it stays closed`);
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

async function askRun(browser, width, lang) {
  const tag = `${width}px ${lang} not asked yet`, { context, page, errors } = await open(browser, width, lang, "default");
  const bar = page.locator(".call-alerts-prompt");
  await bar.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await bar.getAttribute("data-state"), null, `${tag}: the usual line`);
  assert.equal((await bar.locator("span").textContent()).trim(), words[lang].ask, `${tag}: asks to turn call alerts on`);
  assert.equal(await bar.locator(".primary").count(), 1, `${tag}: with Turn on`);
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) for (const lang of ["en", "it"]) await blockedRun(browser, width, lang);
    for (const lang of ["en", "it"]) await askRun(browser, 390, lang);
  } finally { await browser.close(); }
  console.log("Call alerts blocked checks passed at 320/360/390/430px in English and Italian: with notifications blocked, SYNC says calls can't ring when it's closed and where to allow them (no button that can't work), Not now (centre tap, 44px) closes it for good, and an unasked phone still gets Turn on.");
})().catch(error => { console.error(error); process.exit(1); });
