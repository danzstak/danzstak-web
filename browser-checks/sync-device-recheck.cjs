"use strict";
// Owner 2026-11-24: "sometimes sync wants to reverify the device when the device is registered and you can see the last
// 4", "but removing the number and doing again works". The phone still held its device key; SYNC just hadn't been able
// to check it yet (the first checks failed: a phone waking up on a weak connection, a busy server). Until the check
// came back, about 25 s, SYNC treated the device as unregistered: "Your number is verified · ••••37. Send a code to
// finish on this device." and Phone/Video asked to verify again. Now a device holding its key says "Checking this
// device…" (or that it's trying again), never asks to verify meanwhile, and is ready as soon as SYNC answers. A device
// with no key, or one SYNC really doesn't know, still gets the "finish on this device" form. API mocked; 360/390px in
// English and Italian; the panel opens the way SYNC settings' "Phone and registered devices" row opens it.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/sync-device-recheck.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-device-recheck");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const TAG = "a".repeat(32), DEVICE = "11111111-2222-4333-8444-555555555555", TOKEN = "T".repeat(43);
const WORDS = {
  en: { checking: /Checking this device…|Couldn't reach SYNC to check this device\. Trying again…/, finish: /Send a code to finish on this device/, registered: /This device is registered for calls and voice messages/ },
  it: { checking: /Controllo di questo dispositivo…|Impossibile raggiungere SYNC per controllare questo dispositivo\. Nuovo tentativo…/, finish: /••••37/, registered: /./ }
};

async function open(browser, { width, locale, failFirst = 0, stored = true, known = true }) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, locale: locale === "it" ? "it-IT" : "en-US", serviceWorkers: "block", hasTouch: true, isMobile: true });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let deviceChecks = 0;
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, headers = request.headers();
    const withKey = known && headers["x-danzstak-device-id"] === DEVICE && headers["x-danzstak-device-token"] === TOKEN;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@x.test", sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
    if (p === "/calls/devices" && request.method() === "GET") {
      deviceChecks++;
      if (deviceChecks <= failFirst) return route.fulfill(json({ error: "Service busy" }, 503));
      return route.fulfill(json({ accountTag: TAG, currentDeviceRegistered: withKey, devices: withKey ? [{ deviceId: DEVICE, name: "Phone", thisDevice: true, allowCalls: true }] : [] }));
    }
    if (p === "/calls/inbox") return withKey ? route.fulfill(json({ events: [] })) : route.fulfill(json({ error: "Register this device to use SYNC.", code: "CALL_DEVICE_REGISTRATION_REQUIRED" }, 403));
    if (p === "/phone-verification") return route.fulfill(json({ state: "verified", verified: true, maskedNumber: "••••37", deviceOtpRequired: true, providerAvailable: true }));
    return route.fulfill(json({}));
  });
  await page.goto(`${base}/terms.html`, { waitUntil: "domcontentloaded" });
  if (stored) await page.evaluate(({ TAG, DEVICE, TOKEN }) => new Promise((resolve, reject) => {
    const request = indexedDB.open("danzstak-call-device", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("credentials");
    request.onsuccess = () => { const tx = request.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([{ deviceId: DEVICE, deviceToken: TOKEN, accountTag: TAG, physicalDeviceId: "" }], "accounts"); tx.oncomplete = () => { request.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }), { TAG, DEVICE, TOKEN });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

// SYNC settings → "Phone and registered devices" opens the panel through this (sync-settings.js).
async function openPanel(page) {
  await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === "function", null, { timeout: 15000 });
  await page.evaluate(() => window.danzstakOpenCallingDevices());
  await page.locator("#callingDevicesDialog").waitFor({ state: "visible", timeout: 5000 });
}

const screen = page => page.evaluate(() => {
  const dialog = document.getElementById("callingDevicesDialog"), verify = dialog?.querySelector(".sync-phone-verification");
  const form = document.getElementById("syncPhoneNumberForm");
  return {
    text: (dialog?.innerText || "").replace(/\s+/g, " "),
    verifyForm: Boolean(verify && !verify.hidden && form && !form.hidden && form.getClientRects().length),
    registered: window.danzstakSyncDeviceRegistered?.() === true
  };
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch(channel && channel !== "bundled" ? { channel, headless: true } : { headless: true });
  const failures = [];
  try {
    for (const locale of ["en", "it"]) for (const width of [360, 390]) {
      const label = `${locale} ${width}px`, words = WORDS[locale];
      // 1. A registered phone whose first checks fail (about 10 s of retries): checking, never "verify again".
      {
        const { context, page, errors } = await open(browser, { width, locale, failFirst: 4 });
        await openPanel(page);
        await page.waitForTimeout(2500);
        const during = await screen(page);
        if (during.verifyForm) failures.push(`${label} check failing: the "verify this device" form shows on a registered phone (${during.text.slice(0, 160)})`);
        if (!words.checking.test(during.text)) failures.push(`${label} check failing: no "checking this device" line (${during.text.slice(0, 160)})`);
        if (!during.registered) failures.push(`${label} check failing: Phone and Video would ask to verify again`);
        if (width === 390) await page.locator("#callingDevicesDialog").screenshot({ path: path.join(output, `checking-${locale}-${width}.png`) });
        await page.waitForFunction(() => document.body.classList.contains("sync-device-registered"), null, { timeout: 20000 }).catch(() => {});
        const after = await screen(page);
        if (after.verifyForm || !after.registered) failures.push(`${label} after SYNC answers: still not registered (${after.text.slice(0, 160)})`);
        if (locale === "en" && !words.registered.test(after.text)) failures.push(`${label} after SYNC answers: no "registered" line (${after.text.slice(0, 160)})`);
        const kept = await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open("danzstak-call-device", 1); r.onsuccess = () => { const g = r.result.transaction("credentials").objectStore("credentials").get("accounts"); g.onsuccess = () => resolve((g.result || []).length); }; }));
        if (kept !== 1) failures.push(`${label}: the device key was dropped (${kept} kept)`);
        if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
        await context.close();
      }
      // 2. A phone with no device key: the "finish on this device" form, without waiting.
      {
        const { context, page } = await open(browser, { width, locale, stored: false });
        await openPanel(page);
        await page.waitForTimeout(1200);
        const now = await screen(page);
        if (!now.verifyForm || !words.finish.test(now.text)) failures.push(`${label} no key: the "finish on this device" form didn't show (${now.text.slice(0, 160)})`);
        if (width === 390) await page.locator("#callingDevicesDialog").screenshot({ path: path.join(output, `no-key-${locale}-${width}.png`) });
        await context.close();
      }
      // 3. A key SYNC really doesn't know (removed on another device): the form, once SYNC has answered.
      {
        const { context, page } = await open(browser, { width, locale, known: false });
        await openPanel(page);
        await page.waitForTimeout(1500);
        const now = await screen(page);
        if (!now.verifyForm || now.registered) failures.push(`${label} unknown key: the "finish on this device" form didn't show (${now.text.slice(0, 160)})`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("SYNC device re-check passed at 360/390px in English and Italian: a registered phone whose first checks fail says it's checking, never shows the verify form or blocks calls, keeps its key and is ready when SYNC answers; a phone with no key, or a key SYNC doesn't know, gets the finish-on-this-device form.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
