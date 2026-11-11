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
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        const body = url.pathname === "/auth/session"
          ? { authenticated: true, user: { email: "localization@danzstak.test" } }
          : url.pathname === "/calls/devices"
            ? { currentDeviceRegistered: false, devices: [{ deviceId: "11111111-1111-4111-8111-111111111111", name: "Studio tablet", allowCalls: true, registeredAt: "2026-11-04T12:00:00.000Z", lastUsedAt: "2026-11-04T12:30:00.000Z", revokedAt: "", thisDevice: false }] }
            : url.pathname === "/phone-verification"
              ? { state: "none", providerAvailable: false, deviceOtpRequired: true }
            : url.pathname === "/calls/inbox" ? { events: [] } : {};
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      const dialog = page.locator("#callingDevicesDialog");
      await page.waitForFunction(() => typeof window.danzstakOpenCallingDevices === "function");
      await page.evaluate(() => window.danzstakOpenCallingDevices());
      await dialog.waitFor({ state: "visible" });
      await page.locator(".registered-devices li").waitFor();
      if(language === "it")await page.getByText("AWS non ha ancora approvato gli SMS di verifica SYNC",{exact:false}).waitFor();
      const result = await page.evaluate(() => {
        const dialog = document.querySelector("#callingDevicesDialog").getBoundingClientRect();
        const labels = [...document.querySelectorAll("#callingDevicesDialog button")].map(button => button.textContent.trim()).filter(Boolean);
        return { lang: document.documentElement.lang, dialogLeft: dialog.left, dialogRight: dialog.right, scrollWidth: document.documentElement.scrollWidth, labels, status: document.querySelector("#deviceStatus")?.textContent.trim() || "", heading: document.querySelector("#callingDevicesTitle")?.textContent.trim() || "", intro: document.querySelector("#callingDevicesDialog > p")?.textContent.trim() || "", phoneTitle: document.querySelector("#syncPhoneTitle")?.textContent.trim() || "", phoneStatus: document.querySelector("#syncPhoneStatus")?.textContent.trim() || "", countryLabel: document.querySelector("#syncPhoneCountryCode")?.closest("label")?.childNodes[0]?.textContent.trim() || "", numberLabel: document.querySelector("#syncPhoneNumber")?.closest("label")?.childNodes[0]?.textContent.trim() || "" };
      });
      assert.equal(result.lang, language, `${language} should remain selected`);
      assert.ok(result.dialogLeft >= 0 && result.dialogRight <= 320, `${language} dialog overflows horizontally`);
      assert.equal(result.scrollWidth, 320, `${language} page overflows horizontally`);
      assert.ok(result.status && result.status !== "This device is not registered for calls.", `${language} status fell back to English`);
      assert.ok(result.heading && result.heading !== "Registered devices", `${language} heading fell back to English`);
      assert.ok(result.intro && !result.intro.startsWith("Register each phone"), `${language} explanation fell back to English`);
      for (const english of ["Rename", "Turn calls off", "Revoke"]) assert.ok(!result.labels.includes(english), `${language} action fell back to ${english}`);
      if(language === "it"){
        assert.equal(result.intro,"Ogni dispositivo deve ricevere e confermare il proprio codice SMS privato prima di essere registrato per SYNC. Se il codice non viene inviato o confermato, il dispositivo resta non registrato.");
        assert.equal(result.phoneTitle,"Verifica privata del telefono");
        assert.match(result.phoneStatus,/AWS non ha ancora approvato gli SMS di verifica SYNC/);
        assert.equal(result.countryLabel,"Prefisso internazionale");
        assert.equal(result.numberLabel,"Numero di cellulare");
      }
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
