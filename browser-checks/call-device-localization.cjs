"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];
const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8016").replace(/\/$/, "");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const language of languages) {
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, serviceWorkers: "block" });
      await context.addInitScript(value => localStorage.setItem("danzstak_language", value), language);
      const page = await context.newPage();
      let registered = false;
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        if(url.pathname === "/calls/devices/challenge")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({challengeId:"22222222-2222-4222-8222-222222222222",challenge:"a".repeat(43)})});
        if(url.pathname === "/calls/devices/register"){registered=true;return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({deviceId:"11111111-1111-4111-8111-111111111111",deviceToken:"b".repeat(43),name:"Studio tablet",allowCalls:true,registeredAt:new Date().toISOString()})});}
        const body = url.pathname === "/auth/session"
          ? { authenticated: true, user: { email: "localization@danzstak.test" } }
          : url.pathname === "/calls/devices"
            ? { devices: registered ? [{ deviceId: "11111111-1111-4111-8111-111111111111", name: "Studio tablet", allowCalls: true, registeredAt: "2026-11-04T12:00:00.000Z", lastUsedAt: "2026-11-04T12:30:00.000Z", revokedAt: "", thisDevice: true }] : [] }
            : url.pathname === "/calls/inbox" ? { events: [] } : {};
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#callingDevicesDialog").waitFor({state:"visible"});
      await page.locator("#deviceName").fill("Studio tablet");
      await page.locator("#registerThisDevice").click();
      await page.locator("#callingDevicesDialog").waitFor({state:"hidden"});
      await page.locator("#callingDevices").click();
      const dialog = page.locator("#callingDevicesDialog");
      await dialog.waitFor({ state: "visible" });
      await page.locator(".registered-devices li").waitFor();
      const result = await page.evaluate(() => {
        const dialog = document.querySelector("#callingDevicesDialog").getBoundingClientRect();
        const labels = [...document.querySelectorAll("#callingDevicesDialog button")].map(button => button.textContent.trim()).filter(Boolean);
        return { lang: document.documentElement.lang, dialogLeft: dialog.left, dialogRight: dialog.right, scrollWidth: document.documentElement.scrollWidth, labels, status: document.querySelector("#deviceStatus")?.textContent.trim() || "", heading: document.querySelector("#syncDeviceTitle")?.textContent.trim() || "", intro: document.querySelector(".sync-device-setup > p")?.textContent.trim() || "" };
      });
      assert.equal(result.lang, language, `${language} should remain selected`);
      assert.ok(result.dialogLeft >= 0 && result.dialogRight <= 320, `${language} dialog overflows horizontally`);
      assert.equal(result.scrollWidth, 320, `${language} page overflows horizontally`);
      assert.ok(result.status && result.status !== "This device is registered for SYNC.", `${language} status fell back to English`);
      assert.ok(result.heading && result.heading !== "Register this device to use SYNC", `${language} heading fell back to English`);
      assert.ok(result.intro && !result.intro.startsWith("Every phone"), `${language} explanation fell back to English`);
      for (const english of ["Rename", "Turn calls off", "Revoke"]) assert.ok(!result.labels.includes(english), `${language} action fell back to ${english}`);
      await context.close();
    }
    console.log("Calling-device browser localization passed at 320px for all 15 supported languages.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
