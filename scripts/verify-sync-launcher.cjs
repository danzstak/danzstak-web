"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8123";
const output = path.resolve("docs/screenshots/sync-launcher");
const widths = [320, 390, 430, 1024];
const executablePath = process.env.DANZSTAK_BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const capture = process.env.DANZSTAK_CAPTURE_SCREENSHOTS === "1";

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 768 }, hasTouch: width < 700, isMobile: width < 700 });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(350);
      const launcher = page.locator('.ds-mobile-nav a[data-launcher-label="SYNC"]');
      if (width < 700) {
        await launcher.waitFor({ state: "visible" });
        const metrics = await launcher.evaluate(node => {
          const box = node.getBoundingClientRect();
          const navBox = node.parentElement.getBoundingClientRect();
          return { width: box.width, height: box.height, navWidth: navBox.width, label: getComputedStyle(node, "::after").content };
        });
        console.log(`${width}px SYNC target`, metrics);
        if (capture) await page.screenshot({ path: path.join(output, `messages-${width}.png`), fullPage: false, animations: "disabled", timeout: 10_000 });
        assert.ok(metrics.width >= 44, `${width}px SYNC target must remain at least 44px wide`);
        assert.ok(metrics.height >= 44, `${width}px SYNC target must remain at least 44px high`);
        assert.equal(metrics.label, '"SYNC"', `${width}px SYNC caption must be visible`);
      } else {
        assert.equal(await launcher.isVisible(), false, "the phone bar must not duplicate desktop navigation");
      }
      assert.equal(await launcher.getAttribute("href"), "messages.html");
      assert.equal(await launcher.getAttribute("aria-label"), "SYNC — open chats");
      assert.equal(await page.locator("#messagesTitle").textContent(), "Chats", "the inbox heading must stay Chats");
      if (capture && width >= 700) await page.screenshot({ path: path.join(output, `messages-${width}.png`), fullPage: false, animations: "disabled", timeout: 10_000 });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`SYNC visual verification passed at ${widths.join(", ")}px${capture ? `; screenshots: ${output}` : ""}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
