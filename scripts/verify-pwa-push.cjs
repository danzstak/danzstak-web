"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");

const baseUrl = process.env.DANZSTAK_PUSH_BASE_URL || "http://127.0.0.1:8016";
const edgePath = process.env.DANZSTAK_EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

(async () => {
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    let subscription = null;
    let requests = 0;
    const notification = class NotificationMock {
      static permission = "default";
      static async requestPermission() {
        requests += 1;
        NotificationMock.permission = "granted";
        return "granted";
      }
    };
    const pushManager = {
      getSubscription: async () => subscription,
      subscribe: async () => {
        subscription = {
          endpoint: "https://updates.push.services.mozilla.com/wpush/v2/test-endpoint",
          keys: { p256dh: "test", auth: "test" },
          toJSON() { return { endpoint: this.endpoint, keys: this.keys }; },
          async unsubscribe() { subscription = null; return true; }
        };
        return subscription;
      }
    };
    const registration = { pushManager, active: { postMessage() {} }, waiting: null, update: async () => {} };
    Object.defineProperty(window, "Notification", { configurable: true, value: notification });
    Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManagerMock() {} });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(registration), controller: { postMessage() {} },
        addEventListener() {}, removeEventListener() {},
        register: async () => registration, getRegistration: async () => registration
      }
    });
    Object.defineProperty(window, "__pushPermissionRequests", { get: () => requests });
  });
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/auth/session") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, email: "push-test@danzstak.invalid", name: "Push Test", memberId: "11111111-1111-4111-8111-111111111111" }) });
    if (path === "/push/key") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ publicKey: "BEl6-kWtkxP4fXy7ZUVtKwDwMDV_tPxvZmkH3GH5mWzD7kZpYrcR-sKjLw7zYpxFQi2UsVk6b1lYcO8W7X1WJfA" }) });
    if (path === "/push/subscribe") return route.fulfill({ status: request.method() === "POST" ? 201 : 200, contentType: "application/json", body: JSON.stringify({ subscribed: request.method() === "POST" }) });
    const bodies = { "/posts": { posts: [] }, "/secure-posts": { posts: [] }, "/stories": { stories: [], reels: [] }, "/friends": { friends: [] }, "/calls/directory": { users: [] }, "/notifications": { notifications: [] }, "/engagement-notifications": { notifications: [] }, "/settings/presence": { onlineVisible: true, allowTags: true, callAlerts: true, messageAlerts: true, reduceMotion: false, dataSaver: false, language: "en" } };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bodies[path] || {}) });
  });
  await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.danzstakEnablePush === "function" && typeof window.danzstakOpenDeviceSettings === "function");
  await page.waitForTimeout(12500);
  assert.equal(await page.evaluate(() => window.__pushPermissionRequests), 0, "page load requested notification permission");
  assert.equal(await page.locator(".push-alert-prompt").count(), 0, "page load displayed an unsolicited notification prompt");

  await page.evaluate(() => window.danzstakOpenDeviceSettings(document.querySelector('[data-feature="Settings"]')));
  const dialog = page.locator(".device-settings-dialog");
  await dialog.waitFor({ state: "visible" });
  const button = dialog.locator("[data-notify]");
  assert.equal(await button.textContent(), "Enable alerts");
  await button.click();
  await page.waitForFunction(() => window.__pushPermissionRequests === 1);
  await page.waitForTimeout(250);
  const enabledState = { button: await button.textContent(), status: await dialog.locator("[data-status]").textContent() };
  assert.equal(enabledState.button, "Disable alerts", JSON.stringify(enabledState));
  assert.match(await dialog.locator("[data-status]").textContent(), /enabled/i);
  await button.click();
  assert.equal(await button.textContent(), "Enable alerts");
  assert.match(await dialog.locator("[data-status]").textContent(), /disabled/i);
  assert.deepEqual(errors, [], `browser errors: ${errors.join("; ")}`);
  await browser.close();
  console.log("PWA push browser checks passed: no unsolicited prompt, explicit enable, and working device-level disable at 390px.");
})().catch(error => { console.error(error); process.exitCode = 1; });
