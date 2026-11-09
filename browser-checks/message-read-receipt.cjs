"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017";
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const screenshots = path.join("docs", "screenshots", "message-read-receipt");
const originalId = "1762516800000#11111111-1111-4111-8111-111111111111";
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      let recipientRead = false;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname;
        if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "artist@example.test" } });
        if (endpoint === "/conversations") return json(route, { conversations: [{ contactEmail: "booker@example.test", memberId: "00000000-0000-4000-8000-000000000002", name: "The Booker", preview: "The room is held for Friday.", updatedAt: "2026-11-07T12:00:00.000Z", unread: 0, canContact: true }] });
        if (endpoint === "/friends") return json(route, { friends: [] });
        if (endpoint === "/calls/directory") return json(route, { users: [] });
        if (endpoint === "/messages" && request.method() === "GET") return json(route, { messages: [{ messageId: originalId, senderEmail: "artist@example.test", recipientEmail: "booker@example.test", content: "The room is held for Friday.", createdAt: "2026-11-07T12:00:00.000Z", read: recipientRead }], canContact: true });
        if (endpoint === "/messages" && request.method() === "POST") {
          const body = JSON.parse(request.postData() || "{}");
          return json(route, { message: { messageId: body.clientMessageId, senderEmail: "artist@example.test", recipientEmail: body.recipientEmail, content: body.content, createdAt: new Date(Number(body.clientMessageId.slice(0, 13))).toISOString(), read: false } }, 201);
        }
        if (endpoint === "/calls/presence") return json(route, { ok: true });
        if (endpoint === "/calls/devices") return json(route, { devices: [] });
        if (endpoint === "/calls/inbox") return json(route, { events: [] });
        if (endpoint.startsWith("/notifications") || endpoint.startsWith("/push")) return json(route, {});
        return json(route, {});
      });

      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof currentEmail !== "undefined" && currentEmail === "artist@example.test");
      await page.locator(".conversation-user").first().click();
      const original = page.locator(`.message[data-message-id="${originalId}"]`);
      await original.waitFor();
      const initialReceipt = original.locator(".message-receipt");
      assert.equal(await initialReceipt.getAttribute("aria-label"), "Sent", `${width}px unread receipt must not claim recipient delivery`);
      assert.equal((await initialReceipt.textContent()).trim(), "✓", `${width}px sent receipt must use one check`);
      assert.equal(await initialReceipt.evaluate(node => node.classList.contains("is-read")), false, `${width}px sent receipt must not use read styling`);
      await original.evaluate(node => { window.__danzstakReceiptMessage = node; });

      recipientRead = true;
      await page.evaluate(() => loadDirectMessages());
      await page.waitForFunction(id => document.querySelector(`.message[data-message-id="${id}"] .message-receipt`)?.getAttribute("aria-label") === "Read", originalId);
      const refreshed = await original.evaluate(node => ({ sameNode: node === window.__danzstakReceiptMessage, text: node.querySelector(".message-receipt")?.textContent, readClass: node.querySelector(".message-receipt")?.classList.contains("is-read") }));
      assert.deepEqual(refreshed, { sameNode: true, text: "✓✓", readClass: true }, `${width}px existing message must update in place when the recipient reads it`);

      await page.locator("#messageInput").fill("I will send the stage plot next.");
      await page.locator("#messageForm").evaluate(form => form.requestSubmit());
      await page.locator(".message.mine", { hasText: "I will send the stage plot next." }).waitFor();
      assert.equal((await page.locator("#callStatus").textContent()).trim(), "Sent", `${width}px server acceptance must be described as sent, not delivered`);
      assert.equal(await page.locator(".message.mine", { hasText: "I will send the stage plot next." }).locator(".message-receipt").getAttribute("aria-label"), "Sent", `${width}px new outgoing message receipt must be truthful`);

      const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      assert.ok(layout.scrollWidth <= layout.clientWidth, `${width}px receipt update must not overflow: ${JSON.stringify(layout)}`);
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      if (width === 390 || width === 1366) await page.screenshot({ path: path.join(screenshots, `${width}-read.png`), fullPage: true });
      await context.close();
    }
    console.log(`Live message read-receipt verification passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
