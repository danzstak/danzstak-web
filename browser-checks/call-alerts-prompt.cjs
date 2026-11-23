"use strict";
// L4 (owner 2026-11-20: "When app is closed it doesn't ring. Only rings when on sync"): a registered phone that can't ring
// with SYNC closed is never silent about it. SYNC shows one line saying why:
// - notifications blocked for danzstak.com → how to allow them (no button: the browser won't ask again), ✕ closes it;
// - notifications allowed but the subscription is saved unlinked on the server → "Fix" (centre tap) saves it again; while
//   the server still says unlinked the line says so, once linked it goes and "Call alerts are on for this phone." shows.
// Real SYNC page with a registered device in IndexedDB, the API mocked, Italian and English, 320/360/390/430px.
//   node scripts/static-server.cjs 8153, then: DANZSTAK_BASE_URL=http://127.0.0.1:8153 node browser-checks/call-alerts-prompt.cjs
//   (DANZSTAK_BROWSER_CHANNEL= for Playwright Chromium instead of Edge)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8153").replace(/\/$/, "");
const widths = (process.env.DANZSTAK_WIDTHS || "320,360,390,430").split(",").map(Number);
const output = path.resolve("docs/screenshots/call-alerts-prompt");
fs.mkdirSync(output, { recursive: true });
const ME = "11111111-1111-4111-8111-111111111111";
const DEVICE = "44444444-4444-4444-8444-444444444444", TOKEN = "T".repeat(43);

async function centreTap(page, locator) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, "44px tap target");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return el?.closest("button")?.textContent || el?.tagName; }, [x, y]);
  assert.equal(hit, await locator.textContent(), "the centre of the button is the button");
  await page.touchscreen.tap(x, y);
}

(async () => {
  // CI runs Edge (its runner has no Playwright Chromium); DANZSTAK_BROWSER_CHANNEL= (empty) uses Playwright's own Chromium.
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch({ ...(channel ? { channel } : {}) });
  const failures = [];
  try {
    for (const width of widths) for (const [reason, lang] of [["blocked", width === 360 ? "it-IT" : "en-US"], ["unlinked", width === 390 ? "it-IT" : "en-US"]]) {
      const label = `${width}px ${reason} ${lang}`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: lang });
      try {
        await context.addInitScript(([state]) => {
          try { localStorage.setItem("danzstak_language", navigator.language.slice(0, 2)); } catch {}
          Object.defineProperty(Notification, "permission", { configurable: true, get: () => state === "blocked" ? "denied" : "granted" });
          const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/test-phone", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "p", auth: "a" } }; } };
          const registration = { pushManager: { getSubscription: async () => sub, subscribe: async () => sub }, showNotification: async () => {} };
          Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve(registration), register: async () => registration, getRegistration: async () => registration, addEventListener() {}, removeEventListener() {}, controller: null } });
        }, [reason]);
        const page = await context.newPage(), errors = [];
        page.on("pageerror", error => errors.push(error.message));
        let linkNow = false, subscribes = 0;
        const cors = { "access-control-allow-origin": new URL(baseUrl).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
        await page.route("https://api.danzstak.com/**", async route => {
          const request = route.request(), url = new URL(request.url());
          if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
          const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
          if (url.pathname === "/auth/session") return reply({ authenticated: true, user: { sub: ME, email: "me@danzstak.invalid" } });
          if (url.pathname === "/profiles") return reply({ profile: { memberId: ME, name: "Phone Owner", handle: "phoneowner" } });
          if (url.pathname === "/calls/devices") { const headers = await request.allHeaders(), mine = headers["x-danzstak-device-id"] === DEVICE; return reply({ currentDeviceRegistered: mine, devices: mine ? [{ deviceId: DEVICE, name: "Test phone", allowCalls: true, current: true }] : [] }); }
          if (url.pathname === "/push/key") return reply({ publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" });
          if (url.pathname === "/push/subscribe") { subscribes++; const headers = await request.allHeaders(); assert.equal(headers["x-danzstak-device-id"], DEVICE, "the subscription is saved with this device's headers"); return reply({ subscribed: true, callingDeviceLinked: linkNow }, 201); }
          if (url.pathname === "/conversations") return reply({ conversations: [] });
          if (url.pathname === "/friends") return reply({ friends: [], incoming: [], outgoing: [] });
          if (url.pathname === "/calls/inbox") return reply({ events: [] });
          return reply({});
        });
        await page.goto(`${baseUrl}/privacy.html`, { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.evaluate(([deviceId, deviceToken]) => new Promise((resolve, reject) => {
          const request = indexedDB.open("danzstak-call-device", 1);
          request.onupgradeneeded = () => request.result.createObjectStore("credentials");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => { const db = request.result, tx = db.transaction("credentials", "readwrite"); tx.objectStore("credentials").put({ deviceId, deviceToken }, "current"); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
        }), [DEVICE, TOKEN]);
        await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
        const bar = page.locator(`.call-alerts-prompt[data-reason="${reason}"]`);
        await bar.waitFor({ state: "visible", timeout: 15000 });
        const italian = lang.startsWith("it");
        const text = await bar.locator("span").textContent();
        if (reason === "blocked") assert.match(text, italian ? /notifiche di DanzStak sono bloccate/ : /notifications are blocked for DanzStak/, `${label}: says why`);
        else assert.match(text, italian ? /non squilla ancora con SYNC chiuso/ : /won't ring when SYNC is closed yet/, `${label}: says why`);
        const box = await bar.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${label}: inside the screen`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `${label}: no horizontal overflow`);
        await page.screenshot({ path: path.join(output, `${reason}-${width}.png`) });
        if (reason === "blocked") {
          assert.equal(await bar.locator("button.primary").count(), 0, `${label}: no button the browser would ignore`);
          await centreTap(page, bar.locator(".call-alerts-close"));
          await bar.waitFor({ state: "detached", timeout: 3000 });
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForTimeout(3500);
          assert.equal(await page.locator(".call-alerts-prompt").count(), 0, `${label}: said once`);
        } else {
          const fix = bar.locator("button.primary");
          assert.equal(await fix.textContent(), italian ? "Sistema" : "Fix");
          const before = subscribes;
          await centreTap(page, fix);
          await page.waitForFunction(() => /set up to ring|pronto a squillare/.test(document.querySelector(".call-alerts-prompt span")?.textContent || ""), null, { timeout: 5000 });
          assert.ok(subscribes > before, `${label}: Fix saves the subscription again`);
          linkNow = true;
          await centreTap(page, fix);
          await bar.waitFor({ state: "detached", timeout: 5000 });
          assert.match(await page.locator(".call-alerts-note").textContent(), italian ? /avvisi di chiamata sono attivi/ : /Call alerts are on for this phone/, `${label}: confirms`);
          await page.screenshot({ path: path.join(output, `unlinked-fixed-${width}.png`) });
        }
        assert.deepEqual(errors, [], `${label}: no page errors`);
        console.log(`ok ${label}`);
      } catch (error) { failures.push(`${label}: ${error.message}`); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Call alerts prompt check passed: blocked and unlinked phones are told once why calls won't ring with SYNC closed; Fix links them.");
})();
