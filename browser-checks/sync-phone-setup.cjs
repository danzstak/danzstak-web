"use strict";
// "Set up this phone" (16-B3 starter; fix-it: close the registration window on success and offer the setup flow).
// A device finishes SMS registration (challenge -> confirmed code -> register): the registration window must close and
// the setup sheet opens once, with Back / Skip, alerts, (computers) the audio check, Share your SYNC with an invite link
// that never contains a phone number, and Done. API mocked. Phones at 360/390 and a 1280 computer.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-phone-setup.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-phone-setup");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", MEMBER = "33333333-3333-4333-8333-333333333333";
const DEVICE = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: "77777777-7777-4777-8777-777777777777" };
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const failures = [];
  try {
    for (const [width, phone] of [[360, true], [390, true], [1280, false]]) {
      const label = `${phone ? "phone" : "computer"} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: phone ? 800 : 800 }, serviceWorkers: "block", hasTouch: phone, isMobile: phone, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write", "camera", "microphone"], ...(phone ? { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" } : {}) });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      let registered = false;
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: MEMBER } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, memberId: MEMBER, name: "Night Shift", handle: "nightshift", email: ME } }));
        if (p === "/phone-verification") return route.fulfill(json({ configured: true, state: "verified", verified: true, maskedNumber: "•••• 4567", providerAvailable: true, deviceOtpRequired: true }));
        if (p === "/calls/devices/challenge") return route.fulfill(json({ challengeId: "44444444-4444-4444-8444-444444444444", challenge: "c".repeat(43) }, 201));
        if (p === "/calls/devices/register") { registered = true; return route.fulfill(json({ ...DEVICE, name: "Night Shift", allowCalls: true, otpVerified: true }, 201)); }
        if (p === "/calls/devices") return route.fulfill(json({ accountTag: DEVICE.accountTag, currentDeviceRegistered: registered, currentPhysicalDeviceId: registered ? DEVICE.physicalDeviceId : "", devices: registered ? [{ deviceId: DEVICE.deviceId, name: "Night Shift", allowCalls: true, current: true, otpVerified: true }] : [] }));
        if (p === "/calls/devices/share/preview") return route.fulfill(json({ eligible: false }));
        if (p === "/calls/inbox") return route.fulfill(registered ? json({ events: [] }) : json({ error: "Register this device before using calls.", code: "CALL_DEVICE_REGISTRATION_REQUIRED" }, 403));
        if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
        return route.fulfill(json(p === "/friends" ? { friends: [] } : {}));
      });
      await page.addInitScript(() => { window.__shared = null; Object.defineProperty(navigator, "share", { configurable: true, value: async data => { window.__shared = data; } }); window.danzstakEnablePush = async () => {}; });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.danzstakBeginCallingDeviceEnrollment === "function", null, { timeout: 15000 });
      await page.waitForTimeout(1200);
      await page.evaluate(() => { window.danzstakEnablePush = async () => {}; }); // the real one waits for a browser permission prompt
      // Open registration, finish it as the SMS step does (challenge -> confirmed code).
      await page.evaluate(() => window.danzstakRequireCallingDevice?.({}));
      await page.waitForTimeout(400);
      if (!(await page.evaluate(() => document.getElementById("callingDevicesDialog").open))) failures.push(`${label}: registration window did not open`);
      await page.evaluate(async () => { await window.danzstakBeginCallingDeviceEnrollment(); window.dispatchEvent(new CustomEvent("danzstak:device-otp-confirmed", { detail: { deviceGrantId: "g-1", deviceGrantToken: "t".repeat(43) } })); });
      const opened = await page.waitForFunction(() => document.querySelector(".phone-setup-dialog")?.open, null, { timeout: 8000 }).then(() => true).catch(() => false);
      const regOpen = await page.evaluate(() => document.getElementById("callingDevicesDialog").open);
      if (regOpen) failures.push(`${label}: the registration window stayed open after success`);
      if (!opened) { failures.push(`${label}: "Set up this phone" did not open after registration`); await context.close(); continue; }
      const read = () => page.evaluate(() => { const d = document.querySelector(".phone-setup-dialog"); const r = d.getBoundingClientRect(); return { sheetTop: r.top, sheetBottom: r.bottom, vh: innerHeight, title: d.querySelector("h2").textContent, count: d.querySelector(".phone-setup-count").textContent, back: d.querySelector(".phone-setup-back").getBoundingClientRect().width > 0, skip: d.querySelector(".phone-setup-skip").getBoundingClientRect().width > 0, left: r.left, right: r.right, small: [...d.querySelectorAll("button")].filter(b => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim() || b.getAttribute("aria-label")) }; });
      let s = await read();
      const total = phone ? 3 : 4;
      if (!/alerts/i.test(s.title) || !new RegExp(`of ${total}$`).test(s.count)) failures.push(`${label}: first step is not alerts of ${total} (${s.title} / ${s.count})`);
      if (s.back || !s.skip) failures.push(`${label}: first step should have Skip and no Back`);
      if (s.left < 0 || s.right > width) failures.push(`${label}: setup sheet overflows`);
      if (phone && (Math.abs(s.sheetBottom - s.vh) > 1 || s.sheetTop < s.vh * 0.3)) failures.push(`${label}: setup is not a bottom sheet (top ${Math.round(s.sheetTop)}, bottom ${Math.round(s.sheetBottom)} of ${s.vh})`);
      if (s.small.length) failures.push(`${label}: buttons under 44px: ${s.small.join(", ")}`);
      await shot(page, `${phone ? "phone" : "computer"}-1-alerts-${width}`);
      await page.locator(".phone-setup-primary").click();
      await page.waitForTimeout(900);
      s = await read();
      if (!phone) {
        if (!/microphone/i.test(s.title)) failures.push(`${label}: computers get the audio check step (${s.title})`);
        await page.locator(".phone-setup-skip").click(); await page.waitForTimeout(200); s = await read();
      } else if (/microphone/i.test(s.title)) failures.push(`${label}: phones must not get the audio check step`);
      if (!/Share your SYNC/.test(s.title) || !s.back) failures.push(`${label}: Share step missing or no Back (${s.title})`);
      await shot(page, `${phone ? "phone" : "computer"}-2-share-${width}`);
      await page.locator(".phone-setup-primary").click();
      await page.waitForTimeout(900);
      const shared = await page.evaluate(() => window.__shared);
      if (!shared?.url || !shared.url.includes(`messageMember=${"33333333-3333-4333-8333-333333333333"}`)) failures.push(`${label}: invite link is not the member's SYNC link (${JSON.stringify(shared)})`);
      if (shared && /\d{6,}|4567/.test(shared.text.replace(/33333333-3333-4333-8333-333333333333/g, ""))) failures.push(`${label}: the share text could contain a phone number`);
      s = await read();
      if (!/You're set/.test(s.title) || s.skip) failures.push(`${label}: final step is not Done without Skip (${s.title})`);
      if (process.env.DEBUG) console.log(label, JSON.stringify(s), await page.evaluate(() => ({ disabled: document.querySelector(".phone-setup-primary").disabled, status: document.querySelector(".phone-setup-status").textContent, shared: window.__shared })));
      await page.locator(".phone-setup-primary").click();
      await page.waitForTimeout(300);
      if (await page.evaluate(() => document.querySelector(".phone-setup-dialog")?.open)) failures.push(`${label}: Done did not close setup`);
      // Once per device.
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("danzstak:call-device-registered")));
      await page.waitForTimeout(500);
      if (await page.evaluate(() => document.querySelector(".phone-setup-dialog")?.open)) failures.push(`${label}: setup opened a second time on the same device`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Set up this phone: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("Set up this phone checks passed (phone 360, 390; computer 1280): registration closes on success, setup opens once with Skip/Back, alerts, audio (computers), share link without a phone number, Done.");
})().catch(error => { console.error(error); process.exitCode = 1; });
