"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "artist@danzstak.invalid" } };
  if (pathname === "/settings/presence") return { onlineVisible: true, allowTags: true, callAlerts: true, messageAlerts: true, activityAlerts: false, darkMode: false, reduceMotion: false, dataSaver: false, language: "en" };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Test Artist", username: "testartist" } };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/settings/posts") return { hidden: [], pinned: [], saved: [], muted: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      let savedSettings = null;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === "/settings/presence" && request.method() === "POST") {
          savedSettings = request.postDataJSON();
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedSettings) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
      });
      await page.goto(`${baseUrl}/feed.html#settings`, { waitUntil: "domcontentloaded" });
      const activity = page.getByLabel("Notify me about activity on my posts");
      await activity.waitFor({ state: "visible" });
      assert.equal(await activity.isChecked(), false, `${width}px activity alerts must start off without explicit consent`);
      const control = await activity.evaluate(element => {
        const row = element.closest(".setting-row") || element.parentElement;
        const rectangle = row.getBoundingClientRect();
        return { left: rectangle.left, right: rectangle.right, width: rectangle.width, label: row.textContent.trim() };
      });
      assert.match(control.label, /Activity on my posts/, `${width}px activity-alert label is missing`);
      assert.ok(control.left >= 0 && control.right <= width + 1, `${width}px activity setting overflows: ${JSON.stringify(control)}`);
      await activity.check();
      await page.getByRole("button", { name: "Save Settings" }).click();
      await page.waitForFunction(() => document.body.textContent.includes("Settings saved to your DanzStak account."));
      assert.equal(savedSettings?.activityAlerts, true, `${width}px explicit activity-alert consent was not saved`);
      const geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.ok(geometry.scrollWidth <= width && geometry.bodyWidth <= width, `${width}px Settings overflow: ${JSON.stringify(geometry)}`);
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(captureDir, `activity-push-settings-${width}.png`), fullPage: true });
      }
      await context.close();
    }
    console.log(`Activity phone-alert Settings browser checks passed at ${widths.length} widths.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
