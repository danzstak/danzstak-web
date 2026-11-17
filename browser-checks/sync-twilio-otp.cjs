"use strict";
// SYNC device verification with Twilio Verify (owner 2026-11-17), in Edge at phone widths and desktop:
// enrollment screen, the phone's languages sent with "Text me a code", resend, Twilio error states shown in the
// member's language, and success. The API is mocked; no text is sent.
// Run with a local server: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/sync-twilio-otp.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-twilio-otp");
const widths = [320, 360, 375, 390, 414, 430, 768, 1366];
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function openEnrollment(page) {
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "commit" });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === "function");
  await page.locator(".conversation-user").first().waitFor();
  await page.locator(".conversation-user").first().evaluate(node => node.click());
  await page.locator("#headerPhone:not([disabled])").waitFor();
  await page.locator("#headerPhone").click();
  await page.locator("#callingDevicesDialog").waitFor({ state: "visible" });
  await page.locator("#syncPhoneNumber").waitFor({ state: "visible" });
}
async function shot(page, name, width) {
  if (![320, 375, 430, 768, 1366].includes(width)) return;
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}-${width}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const [lang, languages] of [["en", ["en-US", "en"]], ["it", ["it-IT", "it", "en"]]]) for (const width of widths) {
      if (lang === "it" && ![320, 375, 430].includes(width)) continue;
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", locale: languages[0] });
      await context.addInitScript(([langs, code]) => { Object.defineProperty(navigator, "languages", { get: () => langs }); try { localStorage.setItem("danzstak_language", code); } catch {} }, [languages, lang]);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      let sendBody = null, nextSend = "ok", nextConfirm = "wrong";
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "otp@danzstak.test", sub: "33333333-3333-4333-8333-333333333333" } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { name: "OTP Test", isOwner: true } }));
        if (p === "/phone-verification" && request.method() === "GET") return route.fulfill(json({ configured: true, state: "none", verified: false, maskedNumber: "", providerAvailable: true, deviceOtpRequired: true }));
        if (p === "/phone-verification/send") {
          sendBody = request.postDataJSON();
          if (nextSend === "geo") return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "SYNC can't send verification texts to this country yet.", code: "geo_blocked" }) });
          if (nextSend === "fraud") return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Texts to this number are blocked to prevent fraud. Use another mobile number.", code: "fraud_blocked" }) });
          return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ configured: true, state: "pending", verified: false, maskedNumber: "•••• 4567", providerAvailable: true, deviceOtpRequired: true, resendAfter: new Date(Date.now() + 3000).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() }) });
        }
        if (p === "/phone-verification/confirm") {
          if (nextConfirm === "wrong") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "That code is incorrect. Request a new code.", code: "invalid" }) });
          return route.fulfill(json({ configured: true, state: "verified", verified: true, maskedNumber: "•••• 4567", providerAvailable: true, deviceOtpRequired: true, deviceGrantId: "55555555-5555-4555-8555-555555555555", deviceGrantToken: "c".repeat(43), deviceGrantExpiresAt: new Date(Date.now() + 300000).toISOString() }));
        }
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: "friend@danzstak.test", memberId: "44444444-4444-4444-8444-444444444444", name: "Tour Friend", preview: "See you at load-in", updatedAt: new Date().toISOString() }] }));
        if (p === "/calls/devices" && request.method() === "GET") return route.fulfill(json({ currentDeviceRegistered: false, devices: [] }));
        if (p === "/calls/devices/challenge") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ challengeId: "22222222-2222-4222-8222-222222222222", challenge: "a".repeat(43) }) });
        if (p === "/calls/devices/register") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "b".repeat(43), name: "OTP Test", allowCalls: true, registeredAt: new Date().toISOString() }) });
        if (p === "/calls/inbox") return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Register this device before using calls.", code: "CALL_DEVICE_REGISTRATION_REQUIRED" }) });
        return route.fulfill(json(p === "/messages" ? { messages: [], canContact: true } : p === "/friends" ? { friends: [] } : {}));
      });
      await openEnrollment(page);
      const status = page.locator("#syncPhoneStatus");
      await page.locator(".sync-phone-verification").scrollIntoViewIfNeeded();
      await shot(page, `${lang}-1-enroll`, width);

      // Error: geo-blocked, in the member's language.
      nextSend = "geo";
      await page.locator("#syncPhoneCountryCode").fill("+39").catch(() => page.locator("#syncPhoneCountryCode").selectOption({ value: "+39" }).catch(() => {}));
      await page.locator("#syncPhoneNumber").fill("333 123 4567");
      await page.locator("#syncPhoneSend").click();
      await page.waitForFunction(() => document.getElementById("syncPhoneStatus").dataset.state === "error");
      assert.deepEqual(sendBody.languages, languages, `${width}px sends the phone's languages with Text me a code`);
      const geoText = (await status.textContent()).trim();
      assert.equal(geoText, lang === "it" ? "SYNC non può ancora inviare SMS di verifica in questo paese." : "SYNC can't send verification texts to this country yet.", `${lang} ${width}px geo-blocked message`);
      await shot(page, `${lang}-2-error-geo`, width);

      // Error: fraud-blocked.
      nextSend = "fraud";
      await page.locator("#syncPhoneSend").click();
      await page.waitForFunction(text => document.getElementById("syncPhoneStatus").textContent.trim() !== text, geoText);
      assert.match(await status.textContent(), lang === "it" ? /bloccati per prevenire frodi/ : /blocked to prevent fraud/);

      // Code sent, resend waits, wrong code, then success.
      nextSend = "ok";
      await page.locator("#syncPhoneSend").click();
      await page.locator("#syncPhoneCode").waitFor({ state: "visible" });
      assert.equal(await page.locator("#syncPhoneResend").isDisabled(), true, `${width}px resend waits for the cooldown`);
      await page.locator("#syncPhoneCode").scrollIntoViewIfNeeded();
      await shot(page, `${lang}-3-code-sent`, width);
      await page.waitForFunction(() => !document.getElementById("syncPhoneResend").disabled, null, { timeout: 6000 });
      await shot(page, `${lang}-4-resend-ready`, width);
      await page.locator("#syncPhoneCode").fill("111111");
      await page.locator("#syncPhoneConfirm").click();
      await page.waitForFunction(() => document.getElementById("syncPhoneStatus").dataset.state === "error");
      assert.equal((await status.textContent()).trim(), lang === "it" ? "Il codice non è corretto. Richiedi un nuovo codice." : "That code is incorrect. Request a new code.");
      // Rule 11: one wrong code ends that code; the member is back at "Text me a code".
      assert.equal(await page.locator("#syncPhoneNumberForm").isVisible(), true, `${width}px a wrong code returns to Text me a code`);
      assert.equal(await page.locator("#syncPhoneCodeForm").isHidden(), true);
      await shot(page, `${lang}-5-error-wrong-code`, width);
      nextConfirm = "ok";
      await page.locator("#syncPhoneSend").click();
      await page.locator("#syncPhoneCode").waitFor({ state: "visible" });
      await page.locator("#syncPhoneCode").fill("123456");
      await page.locator("#syncPhoneConfirm").click();
      await page.waitForFunction(() => document.getElementById("syncPhoneStatus").dataset.state === "verified");
      await page.waitForTimeout(400);
      await shot(page, `${lang}-6-success`, width);

      // Layout: no sideways scroll, controls at least 44px on phones.
      const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll(".sync-phone-verification :is(button,input,select)")].filter(n => n.getBoundingClientRect().height > 0).map(n => Math.round(n.getBoundingClientRect().height)).filter(h => h < 44) }));
      assert.equal(geometry.overflow, false, `${width}px overflows`);
      if (width <= 430) assert.deepEqual(geometry.small, [], `${width}px controls under 44px`);
      assert.deepEqual(errors, [], `${lang} ${width}px page errors`);
      await context.close();
    }
    console.log(`SYNC Twilio OTP browser checks passed at ${widths.join(", ")}px (English) and 320/375/430px (Italian): phone languages sent, geo and fraud errors, resend cooldown, wrong code, success.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
