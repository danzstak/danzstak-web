"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR
  ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR)
  : path.resolve(__dirname, "..", "docs", "screenshots", "foreground-call-ringtone");
const ownerId = "11111111-1111-4111-8111-111111111111";
const postId = "33333333-3333-4333-8333-333333333333";

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      let offerActive = false;
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", hasTouch: width < 700 });
      await context.addInitScript(() => {
        window.__toneStarts = 0;
        class TestAudioContext {
          constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
          async resume() { this.state = "running"; }
          createOscillator() { return { frequency: { value: 0 }, connect(node) { return node; }, start() { window.__toneStarts += 1; }, stop() {} }; }
          createGain() { return { gain: { value: 0 }, connect(node) { return node; } }; }
        }
        Object.defineProperty(window, "AudioContext", { configurable: true, value: TestAudioContext });
      });
      const page = await context.newPage();
      const errors = [];
      const authenticatedCallRequests = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const corsHeaders = {
          "access-control-allow-origin": new URL(baseUrl).origin,
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS"
        };
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
        let body = {};
        if (url.pathname === "/auth/session") body = { authenticated: true, user: { sub: ownerId, email: "callee@danzstak.invalid" } };
        else if (url.pathname === "/profiles") body = { profile: { memberId: ownerId, name: "Callee Artist", handle: "callee", username: "callee", bio: "Independent artist testing a populated DanzStak feed.", picture: `${baseUrl}/assets/danzstak-d-icon.png` } };
        else if (url.pathname.startsWith("/calls/")) {
          const headers = await request.allHeaders();
          const authenticated = headers["x-danzstak-device-id"] === "device-browser-test" && headers["x-danzstak-device-token"] === "token-browser-test";
          authenticatedCallRequests.push({ path: url.pathname, authenticated });
          if (!authenticated) return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "CALL_DEVICE_REGISTRATION_REQUIRED" }) });
          if (url.pathname === "/calls/inbox") body = { events: offerActive ? [{ eventId: "offer-event", callId: "22222222-2222-4222-8222-222222222222", signalType: "offer", senderEmail: "caller@danzstak.invalid", senderName: "Tour Friend", mode: "phone" }] : [] };
          else if (url.pathname === "/calls/devices") body = { devices: [{ deviceId: "device-browser-test", name: "Browser test phone", allowCalls: true, lastUsedAt: "2026-11-09T10:00:00.000Z" }] };
        }
        else if (url.pathname === "/secure-posts") body = { posts: [{ postId, userId: ownerId, authorName: "Callee Artist", content: "West Coast dates are coming together. Rehearsal tonight, then the van heads north.", createdAt: "2026-11-07T18:30:00.000Z", audience: "public", isOwner: true, mediaType: "image", mediaUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`, viewCount: 42, commentPolicy: "everyone" }] };
        else if (url.pathname === "/engagement") body = { myReaction: "", reactionCounts: { Like: 8, Love: 4 }, comments: [] };
        else if (url.pathname === "/friends") body = { friends: [{ memberId: "22222222-2222-4222-8222-222222222222", email: "caller@danzstak.invalid", name: "Tour Friend", online: true }], incoming: [], outgoing: [] };
        else if (url.pathname === "/calls/directory" || url.pathname === "/people") body = { users: [{ memberId: "22222222-2222-4222-8222-222222222222", email: "caller@danzstak.invalid", name: "Tour Friend", online: true, friendStatus: "friends" }] };
        else if (url.pathname === "/notifications" || url.pathname === "/engagement-notifications") body = { notifications: [] };
        else if (url.pathname === "/stories") body = { stories: [], reels: [] };
        else if (url.pathname === "/groups") body = { groups: [] };
        else if (url.pathname === "/news") body = { articles: [] };
        else if (url.pathname === "/settings/presence") body = { visible: true };
        return route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders, body: JSON.stringify(body) });
      });

      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open("danzstak-call-device", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("credentials");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("credentials", "readwrite");
          transaction.objectStore("credentials").put({
            deviceId: "device-browser-test",
            deviceToken: "token-browser-test"
          }, "current");
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onerror = () => reject(transaction.error);
        };
      }));
      const registeredInbox = page.waitForResponse(response => (
        new URL(response.url()).pathname === "/calls/inbox" && response.status() === 200
      ), { timeout: 5000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await registeredInbox;
      await page.locator(`.post[data-post-id="${postId}"]`).waitFor({ state: "visible" });
      await page.locator(`.post[data-post-id="${postId}"] .post-content`).click();
      offerActive = true;
      const authenticatedInbox = page.waitForResponse(response => (
        new URL(response.url()).pathname === "/calls/inbox" && response.status() === 200
      ), { timeout: 5000 });
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await authenticatedInbox;
      const popup = page.locator(".global-incoming-call");
      await popup.waitFor({ state: "visible", timeout: 5000 });
      await page.waitForFunction(() => window.__toneStarts > 0, null, { timeout: 2000 });

      const geometry = await popup.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const nav = [...document.querySelectorAll(".ds-mobile-nav")].find(candidate => getComputedStyle(candidate).display !== "none");
        const navRect = nav?.getBoundingClientRect();
        const actions = [...element.querySelectorAll("button")].map(button => {
          const target = button.getBoundingClientRect();
          return { width: target.width, height: target.height };
        });
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, navTop: navRect?.top ?? innerHeight, actions };
      });
      assert.equal(errors.length, 0, `${width}px foreground call errors: ${errors.join(" | ")}`);
      assert.ok(geometry.left >= 0 && geometry.right <= width + 1, `${width}px incoming call escapes the viewport: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.bottom <= geometry.navTop - 8, `${width}px incoming call actions are covered by mobile navigation: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.actions.every(target => target.width >= 44 && target.height >= 44), `${width}px incoming actions must retain 44px touch targets: ${JSON.stringify(geometry.actions)}`);
      assert.match(await popup.textContent(), /Tour Friend/, `${width}px incoming call must identify the caller by display name`);
      assert.doesNotMatch(await popup.textContent(), /@/, `${width}px incoming call must not expose account email`);
      assert.ok(authenticatedCallRequests.some(request => request.path === "/calls/inbox" && request.authenticated), `${width}px incoming-call polling must use the registered device credential`);

      fs.mkdirSync(captureDir, { recursive: true });
      await page.screenshot({ path: path.join(captureDir, `foreground-call-${width}.png`), fullPage: true });

      offerActive = false;
      await popup.locator("[data-decline]").click();
      await popup.waitFor({ state: "hidden" });
      assert.ok(authenticatedCallRequests.some(request => request.path === "/calls/signal" && request.authenticated), `${width}px decline signaling must use the registered device credential`);
      await context.close();
    }
    console.log(`Foreground call ringtone browser checks passed: ${widths.length} viewport widths.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
