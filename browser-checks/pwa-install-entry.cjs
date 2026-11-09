"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const evidence = path.join(__dirname, "..", "docs", "screenshots", "pwa-install-entry");

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/auth/session", route => route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false })
      }));
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });

      const android = page.locator('[data-app-platform="android"]');
      const apple = page.locator('[data-app-platform="apple"]');
      await android.click();
      await page.locator("#installHelp").waitFor({ state: "visible" });
      const result = await page.evaluate(() => {
        const rect = element => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height, right: box.right };
        };
        return {
          title: document.getElementById("installHelpTitle")?.textContent,
          text: document.getElementById("installHelpText")?.textContent,
          actionHidden: document.getElementById("installHelpAction")?.hidden,
          android: rect(document.querySelector('[data-app-platform="android"]')),
          apple: rect(document.querySelector('[data-app-platform="apple"]')),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      assert.equal(result.title, "Install DanzStak on Android", `${width}px Android install title is wrong`);
      assert.match(result.text, /Install app or Add to Home screen/, `${width}px Android install fallback is missing`);
      assert.equal(result.actionHidden, false, `${width}px Android install action is hidden`);
      assert.ok(result.android.height >= 44 && result.apple.height >= 44, `${width}px install choices are undersized`);
      assert.ok(result.android.right <= width + 1 && result.apple.right <= width + 1, `${width}px install choices overflow the viewport`);
      assert.ok(result.overflow <= 1, `${width}px homepage overflows by ${result.overflow}px`);
      await page.screenshot({ path: path.join(evidence, `pwa-install-${width}.png`), fullPage: true });

      await page.locator("#installHelpClose").click();
      await apple.click();
      const appleResult = await page.evaluate(() => ({
        title: document.getElementById("installHelpTitle")?.textContent,
        text: document.getElementById("installHelpText")?.textContent,
        actionHidden: document.getElementById("installHelpAction")?.hidden
      }));
      assert.equal(appleResult.title, "Install DanzStak on Apple", `${width}px Apple install title is wrong`);
      assert.match(appleResult.text, /Safari.*Share.*Add to Home Screen/, `${width}px Apple install guidance is incomplete`);
      assert.equal(appleResult.actionHidden, true, `${width}px Apple must not show an unsupported browser prompt action`);
      assert.deepEqual(errors, [], `${width}px homepage emitted browser errors`);
      await context.close();
    }

    const manifest = await (await fetch(`${baseUrl}/manifest.webmanifest`)).json();
    assert.equal(manifest.display, "standalone", "the installed PWA must open without browser chrome");
    assert.equal(manifest.start_url, "/", "the installed PWA must start at DanzStak");
    assert.ok(manifest.icons.some(icon => icon.sizes === "192x192"), "the manifest needs a 192px install icon");
    assert.ok(manifest.icons.some(icon => icon.sizes === "512x512"), "the manifest needs a 512px install icon");
    console.log(`PWA install-entry browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
