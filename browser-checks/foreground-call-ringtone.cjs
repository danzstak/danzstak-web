"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      let offerActive = false;
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true });
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
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request();
        const url = new URL(request.url());
        let body = {};
        if (url.pathname === "/auth/session") body = { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "callee@danzstak.invalid" } };
        else if (url.pathname === "/profiles") body = { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Callee Artist", username: "callee" } };
        else if (url.pathname === "/calls/inbox") body = { events: offerActive ? [{ eventId: "offer-event", callId: "22222222-2222-4222-8222-222222222222", signalType: "offer", senderEmail: "caller@danzstak.invalid", senderName: "Tour Friend", mode: "phone" }] : [] };
        else if (url.pathname === "/secure-posts") body = { posts: [] };
        else if (url.pathname === "/friends") body = { friends: [], incoming: [], outgoing: [] };
        else if (url.pathname === "/calls/directory" || url.pathname === "/people") body = { users: [] };
        else if (url.pathname === "/notifications" || url.pathname === "/engagement-notifications") body = { notifications: [] };
        else if (url.pathname === "/stories") body = { stories: [], reels: [] };
        else if (url.pathname === "/groups") body = { groups: [] };
        else if (url.pathname === "/news") body = { articles: [] };
        else if (url.pathname === "/settings/presence") body = { visible: true };
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });

      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.mouse.click(width - 24, 24);
      offerActive = true;
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

      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, `foreground-call-${width}.png`) });
      }

      offerActive = false;
      await popup.locator("[data-decline]").click();
      await popup.waitFor({ state: "hidden" });
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
