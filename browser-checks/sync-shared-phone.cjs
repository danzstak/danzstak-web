"use strict";
// One phone, several accounts (owner 2026-11-17), in Edge at phone widths: account B signs in on a device that already
// holds account A's SMS-verified SYNC registration. SYNC asks once, registers B without a new text, the device list
// says the device is shared, and removing it offers "this account" or "all my accounts on this device".
// The API is mocked; no text is sent. Run with a local server:
// DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-shared-phone.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-shared-phone");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const PHYSICAL = "77777777-7777-4777-8777-777777777777";
const A = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: PHYSICAL };
const B = { deviceId: "22222222-2222-4222-8222-222222222222", deviceToken: "b".repeat(43) };
const copy = {
  en: { title: "Use this phone for this account?", ending: "number ending 67", all: "Remove from all my accounts on this device", shared: "Also on 1 of your other accounts" },
  it: { title: "Usare questo telefono per questo account?", ending: "termina con 67", all: "Rimuovi da tutti i miei account su questo dispositivo", shared: "Anche su 1 dei tuoi altri account" },
  fr: { title: "Utiliser ce téléphone pour ce compte ?", ending: "se terminant par 67", all: "Retirer de tous mes comptes sur cet appareil", shared: "Aussi sur 1 de vos autres comptes" },
  es: { title: "¿Usar este teléfono para esta cuenta?", ending: "termina en 67", all: "Quitar de todas mis cuentas en este dispositivo", shared: "También en 1 de tus otras cuentas" }
};
const runs = [...[320, 360, 375, 390, 414, 430].map(width => ["en", width]), ["it", 375], ["fr", 375], ["es", 375]];

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
const readCredentials = page => page.evaluate(() => new Promise(resolve => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const request = open.result.transaction("credentials").objectStore("credentials").get("accounts"); request.onsuccess = () => { resolve(request.result || []); open.result.close(); }; }; }));
async function layout(page, selector, width, label) {
  const geometry = await page.evaluate(selector => ({ overflow: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll(`${selector} button`)].filter(node => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().height < 44).map(node => node.textContent.trim()), box: (() => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r ? { left: r.left, right: r.right } : null; })() }), selector);
  assert.equal(geometry.overflow, false, `${label}: sideways scroll`);
  assert.deepEqual(geometry.small, [], `${label}: buttons under 44px`);
  assert.ok(geometry.box && geometry.box.left >= 15 && geometry.box.right <= width - 15, `${label}: dialog keeps a 16px gutter (${JSON.stringify(geometry.box)})`);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const [lang, width] of runs) {
      const label = `${lang} ${width}px`, words = copy[lang];
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", locale: lang });
      await context.addInitScript(code => { try { localStorage.setItem("danzstak_language", code); } catch {} }, lang);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      let registered = false, previewBody = null, shareBody = null, deleteQuery = null;
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url()), p = url.pathname, deviceHeader = request.headers()["x-danzstak-device-id"] || "";
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "second@danzstak.test", sub: "33333333-3333-4333-8333-333333333333" } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { name: "Night Shift", isOwner: true } }));
        if (p === "/phone-verification" && request.method() === "GET") return route.fulfill(json({ configured: true, state: registered ? "verified" : "none", verified: registered, maskedNumber: registered ? "•••• 4567" : "", providerAvailable: true, deviceOtpRequired: true }));
        if (p === "/calls/devices" && request.method() === "GET") {
          assert.notEqual(deviceHeader, A.deviceId, "account A's token is never sent as account B");
          const mine = registered && deviceHeader === B.deviceId;
          return route.fulfill(json({ accountTag: "b".repeat(32), currentDeviceRegistered: mine, currentPhysicalDeviceId: mine ? PHYSICAL : "", devices: registered ? [{ deviceId: B.deviceId, name: "Night Shift", allowCalls: true, registeredAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), revokedAt: "", thisDevice: mine, sharedAccounts: 1 }] : [] }));
        }
        if (p === "/calls/devices/share/preview") { previewBody = request.postDataJSON(); return route.fulfill(json({ eligible: true, numberEnding: "67" })); }
        if (p === "/calls/devices/challenge") return route.fulfill(json({ challengeId: "44444444-4444-4444-8444-444444444444", challenge: "c".repeat(43) }, 201));
        if (p === "/calls/devices/share") { shareBody = request.postDataJSON(); registered = true; return route.fulfill(json({ ...B, name: "Night Shift", allowCalls: true, otpVerified: true, physicalDeviceId: PHYSICAL, accountTag: "b".repeat(32), shared: true }, 201)); }
        if (p === "/calls/devices" && request.method() === "DELETE") { deleteQuery = Object.fromEntries(url.searchParams); registered = false; return route.fulfill(json({ revoked: true, scope: deleteQuery.scope || "this", physicalDeviceId: PHYSICAL, revokedAccounts: 2 })); }
        if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
        if (p === "/calls/inbox") return route.fulfill(json({ error: "Register this device before using calls.", code: "CALL_DEVICE_REGISTRATION_REQUIRED" }, 403));
        return route.fulfill(json(p === "/messages" ? { messages: [], canContact: true } : p === "/friends" ? { friends: [] } : {}));
      });
      // This device already holds account A's SMS-verified registration.
      await page.goto(`${baseUrl}/manifest.webmanifest`);
      await page.evaluate(credential => new Promise((resolve, reject) => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const tx = open.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([credential], "accounts"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), A);

      // 1. SYNC asks once.
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      const offer = page.locator("#syncShareDialog");
      await offer.waitFor({ state: "visible", timeout: 15000 });
      assert.equal((await offer.locator("h2").textContent()).trim(), words.title, `${label}: offer title`);
      assert.match(await offer.textContent(), new RegExp(words.ending), `${label}: shows only the number's last two digits`);
      assert.deepEqual(previewBody.source, { physicalDeviceId: PHYSICAL, deviceId: A.deviceId, deviceToken: A.deviceToken }, `${label}: proof is this device's own registration`);
      await page.waitForTimeout(250);
      await layout(page, "#syncShareDialog", width, `${label} offer`);
      await shot(page, `${lang}-1-offer-${width}`);

      // 2. Yes: registered without a new text.
      await offer.locator("button.primary").click();
      await offer.waitFor({ state: "detached" });
      assert.equal(shareBody.challengeId, "44444444-4444-4444-8444-444444444444", `${label}: B's own device challenge`);
      assert.equal(shareBody.source.deviceToken, A.deviceToken);
      const stored = await readCredentials(page);
      assert.deepEqual(stored.map(item => item.accountTag).sort(), ["a".repeat(32), "b".repeat(32)], `${label}: one credential per account, A's kept`);
      assert.ok(!JSON.stringify(stored).includes("67\"") && !JSON.stringify(stored).includes("4567"), `${label}: no number digits stored`);
      await page.evaluate(() => window.danzstakOpenCallingDevices());
      await page.locator("#callingDevicesDialog").waitFor({ state: "visible" });
      await page.locator("#registeredDevices li").first().waitFor();
      assert.match(await page.locator("#registeredDevices").textContent(), new RegExp(words.shared), `${label}: the list says the device is shared`);
      await page.locator("#registeredDevices").scrollIntoViewIfNeeded();
      await shot(page, `${lang}-2-registered-${width}`);

      // 3. Remove: this account, or all my accounts on this device.
      await page.locator("#registeredDevices button.danger").first().click();
      const choice = page.locator("dialog.sync-device-choice");
      await choice.waitFor({ state: "visible" });
      assert.equal((await choice.locator("button.sync-remove-all").textContent()).trim(), words.all);
      await page.waitForTimeout(250);
      await layout(page, "dialog.sync-device-choice", width, `${label} remove choice`);
      await shot(page, `${lang}-3-remove-choice-${width}`);
      await choice.locator("button.sync-remove-all").click();
      await choice.waitFor({ state: "detached" });
      await page.waitForFunction(() => true);
      await page.waitForTimeout(300);
      assert.deepEqual(deleteQuery, { deviceId: B.deviceId, scope: "all" }, `${label}: revoke-all request`);
      assert.deepEqual(await readCredentials(page), [], `${label}: every account's credential for this device is cleared`);

      // 4. Asked once: a reload does not ask again.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      assert.equal(await page.locator("#syncShareDialog").count(), 0, `${label}: asked only once`);
      assert.deepEqual(errors, [], `${label}: page errors`);
      await context.close();
    }
    console.log(`Shared phone browser checks passed (${runs.map(([lang, width]) => `${lang} ${width}px`).join(", ")}): asked once, no new text, one credential per account, shared device listed, remove from all accounts.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
