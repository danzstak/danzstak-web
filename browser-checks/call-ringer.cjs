"use strict";
// Task 31 (owner 2026-11-18: "SYNC works but the ringer does not work"). An incoming call on Mix must ring without
// a prior tap when the browser allows sound; when sound is blocked it vibrates and shows "Tap to hear the ringer",
// and one tap starts the ringtone. Ringing and vibration stop on Decline.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/call-ringer.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";

async function run(browser, width, blocked) {
  let offer = false;
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true, isMobile: true });
  await context.addInitScript(blockedSound => {
    window.__tones = 0; window.__vibes = [];
    navigator.vibrate = pattern => { window.__vibes.push(pattern); return true; };
    class TestAudioContext {
      constructor() { this.state = blockedSound && !window.__unlocked ? "suspended" : "running"; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
      async resume() { if (blockedSound && !window.__unlocked) throw new Error("blocked"); this.state = "running"; }
      createOscillator() { return { type: "", frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(n) { return n; }, start() { window.__tones += 1; }, stop() {} }; }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect(n) { return n; }, disconnect() {} }; }
      createBiquadFilter() { return { type: "", frequency: { value: 0 }, connect(n) { return n; } }; }
      createBuffer() { return { getChannelData: () => new Float32Array(10) }; }
      createBufferSource() { return { connect(n) { return n; }, start() { window.__tones += 1; }, stop() {} }; }
      close() { return Promise.resolve(); }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: TestAudioContext });
    document.addEventListener("pointerdown", () => { window.__unlocked = true; }, true);
    // This device counts as SMS-registered for calls (the registration flow has its own checks).
    Object.defineProperty(window, "danzstakSyncDeviceRegistered", { configurable: true, get: () => () => true, set() {} });
  }, blocked);
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const cors = { "access-control-allow-origin": new URL(baseUrl).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
  await page.route("https://api.danzstak.com/**", route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const p = new URL(route.request().url()).pathname;
    let body = {};
    if (p === "/auth/session") body = { authenticated: true, user: { sub: me, email: "me@danzstak.invalid", name: "Night Shift" } };
    else if (p === "/calls/inbox") body = { events: offer ? [{ eventId: "e1", callId: "22222222-2222-4222-8222-222222222222", signalType: "offer", senderEmail: "caller@danzstak.invalid", senderName: "Mary", mode: "video", createdAt: new Date().toISOString(), payload: { type: "offer", sdp: "v=0" } }] : [] };
    else if (p === "/calls/devices") body = { currentDeviceRegistered: true, devices: [{ deviceId: "device-browser-test", allowCalls: true }] };
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  });
  if (process.env.DEBUG) page.on("response", r => { if (r.url().includes("/calls/")) console.log(r.status(), new URL(r.url()).pathname); });
  await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  offer = true;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const popup = page.locator(".global-incoming-call");
  await popup.waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(400);
  const label = `${width}px ${blocked ? "sound blocked" : "sound allowed"}`;
  if (blocked) {
    const tap = page.locator(".call-ringer-tap");
    await tap.waitFor({ state: "visible", timeout: 3000 });
    assert.equal(await page.evaluate(() => window.__tones), 0, `${label}: no tone before the tap`);
    assert.ok(await page.evaluate(() => window.__vibes.length > 0), `${label}: vibrates while sound is blocked`);
    const box = await tap.boundingBox();
    assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= width, `${label}: tap button is a 44px target on screen`);
    await tap.click();
    await page.waitForFunction(() => window.__tones > 0, null, { timeout: 3000 });
    assert.equal(await tap.count(), 0, `${label}: tap button goes away once ringing`);
  } else {
    await page.waitForFunction(() => window.__tones > 0, null, { timeout: 3000 });
    assert.equal(await page.locator(".call-ringer-tap").count(), 0, `${label}: no tap needed`);
  }
  if (width === 390) await page.screenshot({ path: `docs/screenshots/call-ringer-${blocked ? "blocked" : "allowed"}-390.png` });
  await popup.locator("[data-decline]").click();
  offer = false;
  await popup.waitFor({ state: "hidden" });
  assert.equal(await page.locator(".call-ringer-tap").count(), 0, `${label}: cleaned up after Decline`);
  assert.deepEqual(errors, [], `${label}: page errors`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 360, 390, 430]) { await run(browser, width, false); await run(browser, width, true); }
    console.log("Call ringer checks passed at 320/360/390/430px: rings without a tap when allowed; when blocked it vibrates, asks for one tap, then rings; Decline cleans up.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
