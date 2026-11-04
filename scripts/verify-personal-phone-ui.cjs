"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const baseUrl = process.env.DANZSTAK_VISUAL_BASE_URL || "http://127.0.0.1:8013";
const outputDir = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/personal-phone-verification-local");
const edgePath = process.env.DANZSTAK_EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const widths = [320, 360, 390, 414, 430, 1366];
fs.mkdirSync(outputDir, { recursive: true });

async function fixtures(page) {
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    const body = url.pathname === "/auth/session"
      ? { authenticated: true, email: "phone-test@danzstak.invalid", name: "Phone Test Artist", memberId: "11111111-1111-4111-8111-111111111111" }
      : url.pathname === "/phone-verification"
        ? { configured: true, state: "none", verified: false, maskedNumber: "", providerAvailable: false }
        : url.pathname === "/messages/conversations" ? { conversations: [] } : {};
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

(async () => {
  assert.ok(fs.existsSync(edgePath), `Microsoft Edge not found at ${edgePath}`);
  const browser = await chromium.launch({ executablePath: edgePath, headless: true, args: ["--disable-gpu"] });
  try {
    for (const width of widths) {
      const height = width <= 430 ? 860 : 900;
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
      const page = await context.newPage();
      await fixtures(page);
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#phoneVerificationOpen").click();
      await page.waitForSelector("#phoneVerificationDialog[open]");
      await page.getByText("Verification texts are not enabled yet. No text will be sent.").waitFor();
      const geometry = await page.locator("#phoneVerificationDialog").evaluate(dialog => {
        const box = dialog.getBoundingClientRect();
        const send = dialog.querySelector("#phoneSendCode").getBoundingClientRect();
        const close = dialog.querySelector("#phoneVerificationClose").getBoundingClientRect();
        const inputs = [...dialog.querySelectorAll("input")]
          .filter(input => input.getBoundingClientRect().height > 0)
          .map(input => ({ fontSize: parseFloat(getComputedStyle(input).fontSize), height: input.getBoundingClientRect().height }));
        return { box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, send: { width: send.width, height: send.height }, close: { width: close.width, height: close.height }, inputs, bodyWidth: document.body.scrollWidth, viewportWidth: document.documentElement.clientWidth };
      });
      assert.ok(geometry.box.left >= -1 && geometry.box.right <= width + 1, `${width}px dialog horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.box.top >= -1 && geometry.box.bottom <= height + 1, `${width}px dialog vertical overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.bodyWidth <= geometry.viewportWidth + 1, `${width}px page horizontal overflow`);
      assert.ok(geometry.send.height >= 44 && geometry.close.height >= 44 && geometry.close.width >= 44, `${width}px touch targets are too small`);
      assert.ok(geometry.inputs.every(input => input.fontSize >= 16 && input.height >= 44), `${width}px inputs are not mobile-safe: ${JSON.stringify(geometry.inputs)}`);
      assert.equal(await page.locator("#phoneSendCode").isDisabled(), true, `${width}px unavailable provider must disable SMS send`);
      assert.match(await page.locator(".phone-privacy-note").innerText(), /not required for Chat, Friends, signup, or calls inside DanzStak/, `${width}px optional-use disclosure is missing`);
      assert.match(await page.locator(".ds-number-section").innerText(), /works only inside DANZSTAK/, `${width}px personal phone and DS alias are not distinguished`);
      await page.screenshot({ path: path.join(outputDir, `phone-verification-${width}.png`), animations: "disabled" });
      await page.locator("#phoneVerificationClose").click();
      assert.equal(await page.locator("#phoneVerificationDialog").getAttribute("open"), null, `${width}px dialog did not close`);
      await context.close();
    }
    console.log(`Personal phone browser checks passed at ${widths.join(", ")}px; screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
