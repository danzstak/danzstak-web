// Directive L2 (owner 2026-11-19: "This needs to be easier to do"): the SYNC device registration screen is short,
// in the visitor's language, and never punishes the member for our failures.
// At 320/360/390/430px, in English and Italian (Edge in CI, Chromium elsewhere; DANZSTAK_WEBKIT=1 adds WebKit):
//   - one short line, no account-name box, no test-notification button before registration;
//   - the country is prefilled from the phone (Italian phone → Italia +39) and named in the visitor's language;
//   - a mocked 5xx send shows one translated line and Send works again at once (no resend used up);
//   - send → the code field, a live "Resend in 0:5x" countdown and "Wrong number? Change it";
//   - typing the 6th digit submits by itself → registered, in 3 taps plus typing the number;
//   - no raw server text on screen, every tapped target is 44px+ and hit at its centre, no sideways scroll.
const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const widths = [320, 360, 390, 430];
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

async function launchAll() {
  const engines = [];
  try { engines.push(["edge", await chromium.launch({ channel: "msedge", headless: true })]); }
  catch { engines.push(["chromium", await chromium.launch({ headless: true })]); }
  if (process.env.DANZSTAK_WEBKIT === "1") engines.push(["webkit", await webkit.launch({ headless: true })]);
  return engines;
}

async function tap(page, selector, counter) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.height >= 44 && box.width >= 44, `${selector} is smaller than 44px: ${JSON.stringify(box)}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await page.evaluate(([px, py, sel]) => { const node = document.elementFromPoint(px, py); return node && node.closest(sel) ? true : (node ? `${node.tagName}#${node.id}` : "nothing"); }, [x, y, selector]);
  assert.equal(hit, true, `the centre of ${selector} is covered by ${hit}`);
  await page.mouse.click(x, y);
  if (counter) counter.taps += 1;
}

async function run(browser, engine, width, lang) {
  const italian = lang === "it";
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: italian ? "it-IT" : "en-US", serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  if (italian) await page.addInitScript(() => { try { localStorage.setItem("danzstak_language", "it"); } catch {} });
  const server = { registered: false, sends: [], failNextSend: true };
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    const pending = server.sends.length > 0 && !server.failNextSend;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "short@danzstak.test", sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { name: "Tester", handle: "tester", isOwner: true } }));
    if (p === "/phone-verification" && method === "GET") return route.fulfill(json({ configured: true, state: "none", verified: false, maskedNumber: "", providerAvailable: true, deviceOtpRequired: true }));
    if (p === "/phone-verification/send") {
      server.sends.push(request.postDataJSON());
      if (server.failNextSend) { server.failNextSend = false; return route.fulfill(json({ error: "TwilioVerifyError arn:aws:lambda:us-west-1:123456789012 internal", code: "send_failed" }, 503)); }
      return route.fulfill(json({ configured: true, state: "pending", verified: false, maskedNumber: "•••• 4567", providerAvailable: true, deviceOtpRequired: true, resendAfter: new Date(Date.now() + 60000).toISOString() }, 202));
    }
    if (p === "/phone-verification/confirm") return route.fulfill(json({ configured: true, state: "verified", verified: true, maskedNumber: "•••• 4567", providerAvailable: true, deviceOtpRequired: true, deviceGrantId: "55555555-5555-4555-8555-555555555555", deviceGrantToken: "c".repeat(43) }));
    if (p === "/calls/devices/challenge") return route.fulfill(json({ challengeId: "22222222-2222-4222-8222-222222222222", challenge: "a".repeat(43), expiresAt: Math.floor(Date.now() / 1000) + 900 }, 201));
    if (p === "/calls/devices/register") { server.registered = true; return route.fulfill(json({ deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "b".repeat(43), name: "Tester", allowCalls: true }, 201)); }
    if (p === "/calls/devices" && method === "GET") return route.fulfill(json({ currentDeviceRegistered: server.registered, devices: server.registered ? [{ deviceId: "11111111-1111-4111-8111-111111111111", name: "Tester", allowCalls: true, thisDevice: true, registeredAt: "2026-11-20T10:00:00Z", lastUsedAt: "2026-11-20T10:00:00Z", revokedAt: "" }] : [] }));
    if (p === "/calls/inbox") return route.fulfill(json({ code: "CALL_DEVICE_REGISTRATION_REQUIRED" }, 403));
    if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
    return route.fulfill(json({}));
  });
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === "function" && window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakOpenCallingDevices());
  const dialog = page.locator("#callingDevicesDialog");
  await dialog.waitFor({ state: "visible" });
  await page.locator("#syncPhoneNumberForm").waitFor({ state: "visible" });
  const tag = `${engine} ${width}px ${lang}`, counter = { taps: 0 };

  // Short screen: one line, no clutter, the right keyboard.
  assert.equal(await page.locator(".calling-device-account").isVisible(), false, `${tag}: account-name box still shown`);
  assert.equal(await page.locator("#pushTestButton").isVisible(), false, `${tag}: test-notification button before registration`);
  assert.equal(await page.locator("#deviceStatus").isVisible(), false, `${tag}: a second explanation line is shown`);
  assert.equal(await page.locator("#syncPhoneStatus").isVisible(), false, `${tag}: a second explanation line above the number`);
  assert.equal(await page.locator("#syncPhoneNumber").getAttribute("inputmode"), "tel");
  const reason = (await page.locator("#callingDeviceReason").textContent()).trim();
  assert.equal(reason, italian ? "Chiamate e messaggi vocali richiedono questo telefono verificato. I messaggi di testo funzionano già." : "Calls and voice messages need this phone verified. Texting already works.", `${tag}: reason line`);
  // Country from the phone, named in the visitor's language.
  const selected = await page.locator("#syncPhoneCountryCode").evaluate(node => ({ value: node.value, text: node.selectedOptions[0].textContent }));
  if (italian) { assert.equal(selected.value, "+39", `${tag}: an Italian phone starts on +39`); assert.match(selected.text, /^Italia \+39$/, `${tag}: country named in Italian`); }
  else { assert.equal(selected.value, "+1", `${tag}: a US phone starts on +1`); assert.match(selected.text, /United States \+1/); }
  const sendLabel = (await page.locator("#syncPhoneSend").textContent()).trim();
  assert.equal(sendLabel, italian ? "Invia codice" : "Send code", `${tag}: the big button says Send code in the visitor's language`);
  if (captureDir) await page.screenshot({ path: path.join(captureDir, `registration-short-${engine}-${lang}-${width}.png`) });

  // A failure on our side: one translated line, Send works again at once, no raw server text.
  await page.locator("#syncPhoneNumber").fill(italian ? "333 123 4567" : "415 555 4567");
  await tap(page, "#syncPhoneSend", counter);
  await page.waitForFunction(() => document.getElementById("syncPhoneStatus").dataset.state === "error");
  const failure = (await page.locator("#syncPhoneStatus").textContent()).trim();
  assert.doesNotMatch(failure, /arn:|Twilio|internal|\d{12}/, `${tag}: raw server text on screen: ${failure}`);
  if (italian) assert.doesNotMatch(failure, /\bThe verification text\b/, `${tag}: untranslated error: ${failure}`);
  assert.equal(await page.locator("#syncPhoneSend").isDisabled(), false, `${tag}: Send stayed locked after our failure`);

  // Send again: the code field, the countdown and "Wrong number? Change it".
  await tap(page, "#syncPhoneSend", counter);
  await page.locator("#syncPhoneCode").waitFor({ state: "visible" });
  assert.equal(await page.locator("#syncPhoneCode").getAttribute("autocomplete"), "one-time-code");
  await page.waitForFunction(() => /\d:\d\d/.test(document.getElementById("syncPhoneResend").textContent));
  const resendLabel = (await page.locator("#syncPhoneResend").textContent()).trim();
  assert.match(resendLabel, italian ? /^Rinvia tra [01]:[0-5]\d$/ : /^Resend in [01]:[0-5]\d$/, `${tag}: live countdown, got "${resendLabel}"`);
  const codeLine = (await page.locator("#syncPhoneStatus").textContent()).trim();
  assert.equal(codeLine, italian ? "Inserisci il codice a sei cifre inviato a •••• 4567." : "Enter the six-digit code sent to •••• 4567.", `${tag}: the code line, in the visitor's language`);
  assert.equal(await page.locator("#deviceStatus").isVisible(), false, `${tag}: a "Starting secure device registration" line stayed on screen`);
  const change = (await page.locator("#syncPhoneChangeNumber").textContent()).trim();
  assert.equal(change, italian ? "Numero sbagliato? Cambialo" : "Wrong number? Change it", `${tag}: change-number link`);
  if (captureDir) await page.screenshot({ path: path.join(captureDir, `registration-code-${engine}-${lang}-${width}.png`) });

  // The 6th digit submits by itself.
  await page.locator("#syncPhoneCode").focus();
  await page.keyboard.type("123456");
  await page.locator("body.sync-device-registered").waitFor({ timeout: 8000 });
  assert.ok(counter.taps <= 3, `${tag}: took ${counter.taps} taps plus typing`);
  assert.equal(await page.locator("#pushTestButton").isVisible().catch(() => false) || !(await dialog.isVisible()), true, `${tag}: the test button appears once registered (or the dialog closed)`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `${tag}: horizontal overflow ${overflow}px`);
  assert.deepEqual(errors, [], `${tag}: page errors ${errors.join(" | ")}`);
  await context.close();
}

(async () => {
  if (captureDir) fs.mkdirSync(captureDir, { recursive: true });
  const engines = await launchAll();
  try {
    for (const [engine, browser] of engines) for (const lang of ["en", "it"]) for (const width of widths) await run(browser, engine, width, lang);
    console.log(`registration-short-screen: ${engines.map(([name]) => name).join(", ")} · en + it at ${widths.join("/")}px · short screen, country from the phone, 5xx keeps Send, countdown, autosubmit`);
  } finally { for (const [, browser] of engines) await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
