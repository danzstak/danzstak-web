"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8021").replace(/\/$/, "");
const screenshotDir = String(process.env.DANZSTAK_SCREENSHOT_DIR || "").trim();

(async () => {
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: "msedge", headless: true });
  try {
    for (const width of [390, 1366]) {
      for (const authenticated of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/auth/session", route => route.fulfill({
          status: authenticated ? 200 : 401,
          contentType: "application/json",
          body: JSON.stringify(authenticated ? { authenticated: true } : { error: "Unauthorized" })
        }));
        await page.goto(`${baseUrl}/?signin=failed`, { waitUntil: "domcontentloaded" });
        await page.locator("#sessionStatus:not([hidden])").waitFor();
        const result = await page.evaluate(() => ({
          message: document.getElementById("sessionStatus")?.textContent?.trim(),
          loginVisible: !document.getElementById("loginBtn")?.hidden,
          logoutVisible: !document.getElementById("logoutBtn")?.hidden,
          exploreCount: document.querySelectorAll("#publicExploreBtn, #feedBtn").length,
          overflow: document.documentElement.scrollWidth > innerWidth
        }));
        assert.equal(errors.length, 0, `${width}px login page errors: ${errors.join(" | ")}`);
        assert.equal(result.overflow, false, `${width}px login error screen overflows horizontally`);
        assert.equal(result.exploreCount, 0, `${width}px landing page retained a misleading Explore control`);
        assert.match(result.message, /Email or password is incorrect/);
        if (authenticated) {
          assert.equal(result.loginVisible, false, `${width}px remembered session exposed a second login action`);
          assert.equal(result.logoutVisible, true, `${width}px remembered session did not expose logout`);
          assert.match(result.message, /Log out to use a different account/);
        } else {
          assert.equal(result.loginVisible, true, `${width}px signed-out failure did not expose login`);
          assert.equal(result.logoutVisible, false, `${width}px signed-out failure exposed logout`);
        }
        if (screenshotDir && !authenticated) {
          await page.screenshot({ path: path.join(screenshotDir, `login-failure-${width}.png`), fullPage: false });
        }
        await context.close();
      }
    }
    console.log("Login failure UI checks passed at 390px and 1366px: inline error, clean retry, remembered-session logout, and no misleading Explore control.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
