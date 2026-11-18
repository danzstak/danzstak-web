"use strict";
// Queue 5a00 (spec docs/tasks/31-call-ringer.md): an incoming call while the browser still blocks sound shows
// "Tap to hear the ringer"; after one tap the <audio> ringtone plays and loops until Answer / Decline.
// Covers the global popup (feed.html) and SYNC's own call screen (messages.html).
//   python3 -m http.server 8132   (repo root), then: node browser-checks/call-ringer.cjs
// This is a desktop-browser simulation. Real ringing on a locked phone needs the owner's two-phone test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = (process.env.DANZSTAK_WIDTHS || "320,390,430,1024").split(",").map(Number);
const output = path.resolve("docs/screenshots/call-ringer");
fs.mkdirSync(output, { recursive: true });
const ME = "11111111-1111-4111-8111-111111111111", CALL = "22222222-2222-4222-8222-222222222222";
const DEVICE = "44444444-4444-4444-8444-444444444444", TOKEN = "T".repeat(43); // the shape call-devices.js accepts

(async () => {
  const browser = await chromium.launch({ ...(process.env.DANZSTAK_BROWSER_CHANNEL ? { channel: process.env.DANZSTAK_BROWSER_CHANNEL } : {}), args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  try {
    for (const width of widths) for (const screen of ["feed", "sync"]) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", hasTouch: width < 700, deviceScaleFactor: 1, permissions: ["camera", "microphone"] });
      // Sound stays blocked until a real tap, like a phone that has not been touched yet in this session.
      await context.addInitScript(() => {
        // Headless Chromium can report an activation without a tap, so the lock is a flag only a trusted tap opens.
        let unlocked = false;
        for (const type of ["pointerup", "touchend", "click", "keydown"]) addEventListener(type, event => { if (event.isTrusted) unlocked = true; }, { capture: true });
        const activated = () => unlocked;
        const realPlay = HTMLMediaElement.prototype.play;
        window.__ringerPlays = [];
        HTMLMediaElement.prototype.play = function () {
          if (!this.hasAttribute("data-danzstak-ringer")) return realPlay.call(this);
          if (!activated()) return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
          window.__ringer = this; window.__ringerPlays.push({ loop: this.loop, muted: this.muted });
          return realPlay.call(this);
        };
        class LockedAudioContext {
          constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
          async resume() { if (activated()) this.state = "running"; }
          createOscillator() { return { frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: node => node, start() {}, stop() {} }; }
          createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect: node => node, disconnect() {} }; }
        }
        Object.defineProperty(window, "AudioContext", { configurable: true, value: LockedAudioContext });
        Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: LockedAudioContext });
      });
      const page = await context.newPage(), errors = [];
      let offer = true;
      page.on("pageerror", error => errors.push(error.message));
      const cors = { "access-control-allow-origin": new URL(baseUrl).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const reply = body => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
        if (url.pathname === "/auth/session") return reply({ authenticated: true, user: { sub: ME, email: "callee@danzstak.invalid" } });
        if (url.pathname === "/profiles") return reply({ profile: { memberId: ME, name: "Callee Artist", handle: "callee" } });
        if (url.pathname === "/calls/inbox") return reply({ events: offer ? [{ eventId: "0000000000001#33333333-3333-4333-8333-333333333333", callId: CALL, signalType: "offer", senderEmail: "caller@danzstak.invalid", senderName: "Tour Friend", mode: "phone", payload: { type: "offer", sdp: "v=0\r\n" }, createdAt: new Date().toISOString() }] : [] });
        if (url.pathname === "/calls/devices") { const headers = await request.allHeaders(), mine = headers["x-danzstak-device-id"] === DEVICE; return reply({ currentDeviceRegistered: mine, devices: mine ? [{ deviceId: DEVICE, name: "Browser test phone", allowCalls: true, current: true }] : [] }); }
        if (url.pathname === "/calls/signal" || url.pathname === "/calls/ack") { offer = false; return reply({ accepted: true }); }
        if (url.pathname === "/friends") return reply({ friends: [{ memberId: "22222222-2222-4222-8222-222222222223", email: "caller@danzstak.invalid", name: "Tour Friend" }], incoming: [], outgoing: [] });
        if (url.pathname === "/conversations") return reply({ conversations: [] });
        if (url.pathname === "/secure-posts") return reply({ posts: [] });
        return reply({});
      });
      // A registered calling device on this browser (the incoming-call poll only answers registered devices).
      await page.goto(`${baseUrl}/privacy.html`, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.evaluate(([deviceId, deviceToken]) => new Promise((resolve, reject) => {
        const request = indexedDB.open("danzstak-call-device", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("credentials");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { const db = request.result, tx = db.transaction("credentials", "readwrite"); tx.objectStore("credentials").put({ deviceId, deviceToken }, "current"); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
      }), [DEVICE, TOKEN]);
      await page.goto(`${baseUrl}/${screen === "feed" ? "feed.html?view=feed" : "messages.html"}`, { waitUntil: "domcontentloaded" });
      const surface = page.locator(screen === "feed" ? ".global-incoming-call" : "#incomingCall");
      await surface.waitFor({ state: "visible", timeout: 15000 });

      // 1. Sound is blocked: the call screen pulses and offers one tap. Answer/Decline are there regardless.
      const tap = surface.locator(".call-ringer-tap");
      await tap.waitFor({ state: "visible", timeout: 5000 });
      assert.equal((await tap.innerText()).trim(), "Tap to hear the ringer");
      assert.equal(await page.evaluate(() => window.danzstakCallRinger.state()), "blocked");
      assert.equal(await surface.evaluate(element => element.classList.contains("is-ringer-blocked")), true);
      const box = await tap.boundingBox();
      assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1, `${width}px ${screen}: 44px tap target inside the screen`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `${width}px ${screen}: no horizontal overflow`);
      await page.screenshot({ path: path.join(output, `${screen}-blocked-${width}.png`) });

      // 2. One tap: the <audio> ringtone plays and loops.
      await tap.click();
      await page.waitForFunction(() => window.danzstakCallRinger.state() === "audio", null, { timeout: 5000 });
      await tap.waitFor({ state: "hidden" });
      await page.waitForTimeout(1500);
      const playing = await page.evaluate(() => ({ paused: window.__ringer?.paused, loop: window.__ringer?.loop, muted: window.__ringer?.muted, src: String(window.__ringer?.src || "").slice(0, 5), time: window.__ringer?.currentTime }));
      assert.deepEqual({ paused: playing.paused, loop: playing.loop, muted: playing.muted, src: playing.src }, { paused: false, loop: true, muted: false, src: "blob:" }, `${width}px ${screen}: the ringtone keeps playing`);
      assert.ok(playing.time > 0.5, `${width}px ${screen}: and time moves (${playing.time})`);

      // 3. Answer (SYNC) or Decline (popup): the ring stops at once.
      if (screen === "sync") await page.locator("#acceptCall").click(); else await surface.locator("[data-decline]").click();
      await page.waitForFunction(() => window.danzstakCallRinger.state() === "idle", null, { timeout: 3000 });
      assert.equal(await page.evaluate(() => window.__ringer.paused), true, `${width}px ${screen}: the ringtone stops on ${screen === "sync" ? "Answer" : "Decline"}`);
      assert.deepEqual(errors.filter(message => !/RTCPeerConnection|setRemoteDescription|SessionDescription|sdp/i.test(message)), [], `${width}px ${screen}: no page errors`);
      await context.close();
      console.log(`ok ${width}px ${screen}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
