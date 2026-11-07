"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8019";
const widths = [320, 360, 390, 414, 430, 1366];
const screenshots = path.join("docs", "screenshots", "message-idempotent-retry");

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

(async () => {
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, isMobile: width < 700, serviceWorkers: "block" });
      const page = await context.newPage();
      const requests = [];
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname;
        if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "artist@example.test" } });
        if (endpoint === "/conversations") return json(route, { conversations: [{ contactEmail: "booker@example.test", memberId: "00000000-0000-4000-8000-000000000002", name: "The Booker", preview: "Send the EPK", updatedAt: "2026-11-07T12:00:00.000Z", unread: 0, canContact: true }] });
        if (endpoint === "/friends") return json(route, { friends: [] });
        if (endpoint === "/calls/directory") return json(route, { users: [] });
        if (endpoint === "/messages" && request.method() === "GET") return json(route, { messages: [], canContact: true });
        if (endpoint === "/messages" && request.method() === "POST") {
          const body = JSON.parse(request.postData() || "{}");
          requests.push(body);
          if (requests.length === 1) return route.abort("failed");
          return json(route, { message: { messageId: body.clientMessageId, senderEmail: "artist@example.test", recipientEmail: body.recipientEmail, content: body.content, createdAt: new Date(Number(body.clientMessageId.slice(0, 13))).toISOString() } }, 201);
        }
        if (endpoint === "/calls/presence") return json(route, { ok: true });
        if (endpoint === "/calls/devices") return json(route, { devices: [] });
        if (endpoint === "/calls/inbox") return json(route, { events: [] });
        if (endpoint.startsWith("/notifications") || endpoint.startsWith("/push")) return json(route, {});
        return json(route, {});
      });

      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().click();
      const sendHeightBefore = await page.locator("#messageForm .message-send").evaluate(node => node.getBoundingClientRect().height);
      await page.locator("#messageInput").fill("Can we hold Friday for the show?");
      await page.locator("#messageForm").evaluate(form => form.requestSubmit());
      await page.locator("#callStatus").getByText(/still in the composer/i).waitFor();
      assert.equal(await page.locator("#messageInput").inputValue(), "Can we hold Friday for the show?", `${width}px must restore the draft after an uncertain response`);
      if (width === 390) await page.screenshot({ path: path.join(screenshots, "390-retry-ready.png"), fullPage: true });

      await page.locator("#messageForm").evaluate(form => form.requestSubmit());
      await page.locator(".message.mine", { hasText: "Can we hold Friday for the show?" }).waitFor();
      assert.equal(requests.length, 2, `${width}px must perform exactly one explicit retry`);
      assert.match(requests[0].clientMessageId, /^\d{13}#[a-f0-9-]{36}$/);
      assert.equal(requests[1].clientMessageId, requests[0].clientMessageId, `${width}px retry must reuse its stable message ID`);
      assert.equal(await page.locator(".message.mine", { hasText: "Can we hold Friday for the show?" }).count(), 1, `${width}px must render one confirmed message`);
      assert.equal(await page.locator(".message.is-pending").count(), 0, `${width}px must not leave a duplicate pending bubble`);
      assert.equal((await page.locator("#callStatus").textContent()).trim(), "Delivered", `${width}px confirmed retry must clear stale connection and composer errors`);
      const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      assert.ok(layout.scrollWidth <= layout.clientWidth, `${width}px must not overflow horizontally: ${JSON.stringify(layout)}`);
      assert.ok(sendHeightBefore >= 44, `${width}px send control must retain a 44px touch target: ${sendHeightBefore}`);
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      if (width === 390 || width === 1366) await page.screenshot({ path: path.join(screenshots, `${width}-confirmed.png`), fullPage: true });
      await context.close();
    }
    console.log(`Idempotent message-retry browser verification passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
