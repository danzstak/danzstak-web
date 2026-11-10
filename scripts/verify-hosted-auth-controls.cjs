"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const loginUrl = String(process.env.DANZSTAK_AUTH_LOGIN_URL || "https://api.danzstak.com/auth/login");
const screenshotDir = String(process.env.DANZSTAK_SCREENSHOT_DIR || "").trim();
const browserOptions = process.env.DANZSTAK_BROWSER_CHANNEL === "bundled"
  ? { headless: true }
  : { channel: "msedge", headless: true };

async function visible(locator) {
  return locator.count().then(count => count > 0 && locator.first().isVisible()).catch(() => false);
}

(async () => {
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch(browserOptions);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block"
  });
  const page = await context.newPage();

  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assert.match(page.url(), /amazoncognito\.com\//, "DanzStak login did not reach Cognito managed login");

    const email = page.locator('input[type="email"], input[name="username"], input[autocomplete="username"]').first();
    await email.waitFor({ state: "visible", timeout: 10_000 });
    await email.fill("ui-check@danzstak.invalid");

    const next = page.getByRole("button", { name: /^(next|continue)$/i }).first();
    await next.click();

    const password = page.locator('input[type="password"], input[autocomplete="current-password"]').first();
    await password.waitFor({ state: "visible", timeout: 10_000 });

    const showPassword = page.getByText(/^show password$/i).first();
    const forgotPassword = page.getByText(/forgot (your )?password/i).first();
    const back = page.getByText(/^back$/i).first();
    assert.equal(await visible(showPassword), true, "Cognito password screen is missing Show password");
    assert.equal(await visible(forgotPassword), true, "Cognito password screen is missing password recovery");
    assert.equal(await visible(back), true, "Cognito password screen is missing Back navigation");

    await showPassword.click();
    await page.waitForFunction(() => {
      const field = document.querySelector('input[autocomplete="current-password"], input[name="password"]');
      return field?.type === "text";
    }, null, { timeout: 5_000 });

    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      passwordType: document.querySelector('input[autocomplete="current-password"], input[name="password"]')?.type || ""
    }));
    assert.equal(layout.overflow, false, "Cognito password screen overflows at 390px");
    assert.equal(layout.passwordType, "text", "Show password did not reveal the password field");

    if (screenshotDir) {
      await page.screenshot({ path: path.join(screenshotDir, "hosted-auth-password-controls-390.png"), fullPage: false });
    }
    console.log("Hosted auth controls passed at 390px: Show password, Forgot password, Back, and no horizontal overflow.");
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
