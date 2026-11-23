// Directive L1 (owner 2026-11-19): "The SYNC registration screen shows the real reason (signed out, texts unavailable,
// number refused) instead of nothing", and never a dead registration screen. Signed out is #700's sheet
// (session-guard.cjs); texts unavailable and a refused number are covered by registration-short-screen.cjs. This
// check covers the rest, at 320/360/390/430px in English and Italian:
//   - no connection: one translated line ("No connection…", never the browser's "Failed to fetch") and Try again;
//   - a failure on our side (5xx): the translated "our side" line, Try again still there;
//   - Try again (centre tap, 44px) reaches the number form once the server answers;
//   - when the phone gets its connection back, the screen checks again by itself.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const widths = [320, 360, 390, 430];
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const text = {
  en: { offline: "No connection. Check your internet, then try again.", ours: "Something went wrong on our side. Try again in a minute.", retry: "Try again" },
  it: { offline: "Nessuna connessione. Controlla internet e riprova.", ours: "Qualcosa non ha funzionato da parte nostra. Riprova tra un minuto.", retry: "Riprova" }
};

async function centreTap(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.height >= 44 && box.width >= 44, `${selector} is smaller than 44px: ${JSON.stringify(box)}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await page.evaluate(([px, py, sel]) => { const node = document.elementFromPoint(px, py); return node && node.closest(sel) ? true : (node ? `${node.tagName}#${node.id}` : "nothing"); }, [x, y, selector]);
  assert.equal(hit, true, `the centre of ${selector} is covered by ${hit}`);
  await page.mouse.click(x, y);
}

async function run(browser, width, lang) {
  const italian = lang === "it", words = text[lang], tag = `${width}px ${lang}`;
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: italian ? "it-IT" : "en-US", serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  if (italian) await page.addInitScript(() => { try { localStorage.setItem("danzstak_language", "it"); } catch {} });
  const server = { mode: "offline" };
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "reasons@danzstak.test", sub: "44444444-4444-4444-8444-444444444444" } }));
    if (p === "/phone-verification" && method === "GET") {
      if (server.mode === "offline") return route.abort("internetdisconnected");
      if (server.mode === "ours") return route.fulfill(json({ error: "Service unavailable" }, 503));
      return route.fulfill(json({ configured: true, state: "none", verified: false, maskedNumber: "", providerAvailable: true, deviceOtpRequired: true }));
    }
    if (p === "/calls/devices" && method === "GET") return route.fulfill(json({ currentDeviceRegistered: false, devices: [] }));
    if (p === "/calls/inbox") return route.fulfill(json({ code: "CALL_DEVICE_REGISTRATION_REQUIRED" }, 403));
    if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
    return route.fulfill(json({}));
  });
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === "function" && window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakOpenCallingDevices());
  await page.locator("#callingDevicesDialog").waitFor({ state: "visible" });

  const status = page.locator("#syncPhoneStatus"), retry = page.locator("#syncPhoneRetry");
  const screen = async () => (await page.locator("#callingDevicesDialog").textContent()).replace(/\s+/g, " ");

  // No connection: the reason in the visitor's language, and a way forward.
  await retry.waitFor({ state: "visible", timeout: 10000 });
  assert.equal((await status.textContent()).trim(), words.offline, `${tag}: the no-connection line`);
  assert.equal(await status.isVisible(), true, `${tag}: the reason is on screen`);
  assert.equal((await retry.textContent()).trim(), words.retry, `${tag}: Try again in the visitor's language`);
  assert.doesNotMatch(await screen(), /Failed to fetch|Load failed|NetworkError|TypeError/, `${tag}: the browser's own error text is on screen`);
  if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `registration-offline-${lang}-${width}.png`) }); }

  // Our side fails: the translated "our side" line, Try again stays.
  server.mode = "ours";
  await centreTap(page, "#syncPhoneRetry");
  await page.waitForFunction(expected => document.getElementById("syncPhoneStatus").textContent.trim() === expected, words.ours, { timeout: 10000 });
  assert.equal(await retry.isVisible(), true, `${tag}: Try again stays after a failure on our side`);
  assert.doesNotMatch(await screen(), /Service unavailable/, `${tag}: the server's raw English line is on screen`);

  // The server answers: Try again reaches the number form.
  server.mode = "ok";
  await centreTap(page, "#syncPhoneRetry");
  await page.locator("#syncPhoneNumberForm").waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await retry.isVisible(), false, `${tag}: Try again goes away once the screen works`);
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

async function runOnline(browser) {
  // Offline at first, then the phone gets its connection back: no tap needed.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  let online = false;
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "online@danzstak.test", sub: "55555555-5555-4555-8555-555555555555" } }));
    if (p === "/phone-verification" && method === "GET") return online ? route.fulfill(json({ configured: true, state: "none", verified: false, maskedNumber: "", providerAvailable: true, deviceOtpRequired: true })) : route.abort("internetdisconnected");
    if (p === "/calls/devices" && method === "GET") return route.fulfill(json({ currentDeviceRegistered: false, devices: [] }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
    return route.fulfill(json({}));
  });
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === "function" && window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakOpenCallingDevices());
  await page.locator("#syncPhoneRetry").waitFor({ state: "visible", timeout: 10000 });
  online = true;
  await context.setOffline(true);
  await context.setOffline(false); // the browser's "online" event
  await page.locator("#syncPhoneNumberForm").waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await page.locator("#syncPhoneRetry").isVisible(), false, "back online: the screen checked again by itself");
  await context.close();
}

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: "msedge", headless: true }); }
  catch { browser = await chromium.launch({ headless: true }); }
  try {
    for (const width of widths) for (const lang of ["en", "it"]) await run(browser, width, lang);
    await runOnline(browser);
  } finally { await browser.close(); }
  console.log("Registration reasons checks passed at 320/360/390/430px in English and Italian: no connection and our-side failures say why in the visitor's language, Try again (centre tap, 44px) reaches the number form, and the screen checks again by itself when the phone is back online.");
})().catch(error => { console.error(error); process.exit(1); });
