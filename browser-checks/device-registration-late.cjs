// Directive L2 (owner 2026-11-19): device registration can always finish, however long the member takes.
// Root cause it guards: the device challenge was made on the first "Text me a code" and reused after a wait
// (a slow text, a resend, a 10-minute lockout), so a correct SMS code ended in 409 "Registration challenge expired".
// The page clock is injected, so "6 minutes later" is real time inside the page.
//   1. Send, wait 6 minutes, send again → a NEW challenge, and register uses it → registered.
//   2. Register answers 409 DEVICE_CHALLENGE_EXPIRED → one-tap restart (number kept) → registered.
//   3. Number verified but this device never registered → "Finish on this device" (centre tap) → code → registered.
// Engines: Edge in CI (like the other checks), Chromium here; DANZSTAK_WEBKIT=1 adds WebKit where it is installed.
const { chromium, webkit } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const widths = [320, 360, 390, 430];
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function launchAll() {
  const engines = [];
  try { engines.push(["edge", await chromium.launch({ channel: "msedge", headless: true })]); }
  catch { engines.push(["chromium", await chromium.launch({ headless: true })]); }
  if (process.env.DANZSTAK_WEBKIT === "1") engines.push(["webkit", await webkit.launch({ headless: true })]);
  return engines;
}

async function tapCentre(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${selector} is smaller than 44px: ${JSON.stringify(box)}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await page.evaluate(([px, py, sel]) => { const node = document.elementFromPoint(px, py); return node && node.closest(sel) ? true : (node ? `${node.tagName}#${node.id}.${node.className}` : "nothing"); }, [x, y, selector]);
  assert.ok(hit === true, `${hit}:`+ `the centre of ${selector} is covered by another element`);
  await page.mouse.click(x, y);
}

async function scenario(browser, engine, width, mode) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: false });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-11-19T19:00:00Z") });
  const server = { registered: false, verified: mode === "unfinished", challenges: [], sends: [], registers: 0, failNextRegister: mode === "expired" };
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname, method = request.method();
    const phone = () => ({ configured: true, state: server.verified ? "verified" : server.sends.length ? "pending" : "none", verified: server.verified, maskedNumber: server.verified || server.sends.length ? "•••• 1637" : "", providerAvailable: true, deviceOtpRequired: true, resendAfter: "" });
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "late@danzstak.test", sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { name: "Late Tester", handle: "late", isOwner: true } }));
    if (p === "/phone-verification" && method === "GET") return route.fulfill(json(phone()));
    if (p === "/phone-verification/send") { server.sends.push(request.postDataJSON()); server.verified = false; return route.fulfill({ ...json(phone()), status: 202 }); }
    if (p === "/phone-verification/confirm") { server.verified = true; const sent = server.sends.at(-1) || {}; return route.fulfill(json({ ...phone(), deviceGrantId: "55555555-5555-4555-8555-555555555555", deviceGrantToken: "c".repeat(43), boundTo: sent.deviceChallengeId })); }
    if (p === "/calls/devices/challenge") {
      const issuedAt = await page.evaluate(() => Date.now());
      const id = `22222222-2222-4222-8222-${String(222222222222 + server.challenges.length).padStart(12, "0")}`;
      server.challenges.push({ id, issuedAt });
      return route.fulfill({ ...json({ challengeId: id, challenge: "a".repeat(43), expiresAt: Math.floor(issuedAt / 1000) + 900 }), status: 201 });
    }
    if (p === "/calls/devices/register") {
      server.registers += 1;
      const body = request.postDataJSON(), now = await page.evaluate(() => Date.now()), challenge = server.challenges.find(item => item.id === body.challengeId), sent = server.sends.at(-1) || {};
      if (server.failNextRegister || !challenge || now - challenge.issuedAt > 900000) { server.failNextRegister = false; return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Registration challenge expired. Start again.", code: "DEVICE_CHALLENGE_EXPIRED" }) }); }
      if (sent.deviceChallengeId !== body.challengeId) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "SMS verification does not match this device. Request a new code.", code: "DEVICE_OTP_REQUIRED" }) });
      server.registered = true;
      return route.fulfill({ ...json({ deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "b".repeat(43), name: "Late Tester", allowCalls: true }), status: 201 });
    }
    if (p === "/calls/devices" && method === "GET") return route.fulfill(json({ currentDeviceRegistered: server.registered, devices: server.registered ? [{ deviceId: "11111111-1111-4111-8111-111111111111", name: "Late Tester", allowCalls: true, thisDevice: true, registeredAt: "2026-11-19T19:00:00Z", lastUsedAt: "2026-11-19T19:00:00Z", revokedAt: "" }] : [] }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
    if (p === "/calls/inbox") return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "CALL_DEVICE_REGISTRATION_REQUIRED" }) });
    return route.fulfill(json({}));
  });
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === "function" && window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakSyncDeviceReady);
  await page.evaluate(() => window.danzstakOpenCallingDevices());
  const dialog = page.locator("#callingDevicesDialog");
  await dialog.waitFor({ state: "visible" });
  const tag = `${engine} ${width}px ${mode}`;

  if (mode === "unfinished") {
    await page.locator("#syncPhoneFinish").waitFor({ state: "visible" });
    assert.equal(await page.locator("#syncPhoneNumberForm").isVisible(), false, `${tag}: number form shown before Finish`);
    if (captureDir) await page.screenshot({ path: path.join(captureDir, `device-registration-finish-${engine}-${width}.png`) });
    await tapCentre(page, "#syncPhoneFinish");
    await page.locator("#syncPhoneNumberForm").waitFor({ state: "visible" });
  }
  await page.locator("#syncPhoneNumber").fill("328 555 1637");
  await tapCentre(page, "#syncPhoneSend");
  await page.locator("#syncPhoneCode").waitFor({ state: "visible" });

  if (mode === "late") {
    // Six minutes pass: the text was slow, the member asked for another one.
    await page.clock.fastForward("06:00");
    await page.locator("#syncPhoneResend").evaluate(node => { node.disabled = false; });
    await tapCentre(page, "#syncPhoneResend");
    await page.locator("#syncPhoneNumberForm").waitFor({ state: "visible" });
    await tapCentre(page, "#syncPhoneSend");
    await page.locator("#syncPhoneCode").waitFor({ state: "visible" });
    assert.equal(server.sends.length, 2, `${tag}: second send did not go out`);
    assert.notEqual(server.sends[1].deviceChallengeId, server.sends[0].deviceChallengeId, `${tag}: the second send reused a 6-minute-old device challenge`);
  }

  await page.locator("#syncPhoneCode").fill("123456");
  await tapCentre(page, "#syncPhoneConfirm");

  if (mode === "expired") {
    // The server said the challenge ran out: one tap restarts, the number is still there.
    await page.locator("#syncPhoneNumberForm").waitFor({ state: "visible" });
    assert.match(await page.locator("#syncPhoneStatus").textContent(), /took a little long/i, `${tag}: no restart line`);
    assert.equal(await page.locator("#syncPhoneNumber").inputValue(), "328 555 1637", `${tag}: the number was lost on restart`);
    assert.equal(await dialog.isVisible(), true, `${tag}: dialog closed on a failed registration`);
    if (captureDir) await page.screenshot({ path: path.join(captureDir, `device-registration-restart-${engine}-${width}.png`) });
    await tapCentre(page, "#syncPhoneSend");
    await page.locator("#syncPhoneCode").waitFor({ state: "visible" });
    await page.locator("#syncPhoneCode").fill("654321");
    await tapCentre(page, "#syncPhoneConfirm");
  }

  await page.locator("body.sync-device-registered").waitFor({ timeout: 8000 });
  assert.equal(server.registered, true, `${tag}: device not registered`);
  const text = await page.locator("#callingDevicesDialog").evaluate(node => node.textContent);
  assert.doesNotMatch(text, /arn:|is not authorized|Registration challenge expired/i, `${tag}: raw server text on screen`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `${tag}: horizontal overflow ${overflow}px`);
  assert.deepEqual(errors, [], `${tag}: page errors ${errors.join(" | ")}`);
  await context.close();
}

(async () => {
  if (captureDir) fs.mkdirSync(captureDir, { recursive: true });
  const engines = await launchAll();
  try {
    for (const [engine, browser] of engines)
      for (const width of widths)
        for (const mode of ["late", "expired", "unfinished"]) await scenario(browser, engine, width, mode);
    console.log(`device-registration-late: ${engines.map(([name]) => name).join(", ")} at ${widths.join("/")}px · late send, expired challenge and unfinished device all register`);
  } finally { for (const [, browser] of engines) await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
