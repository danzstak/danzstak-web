"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const origin = process.argv[2] || "http://127.0.0.1:8037", output = path.resolve("docs/screenshots/booking-sync");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 414, 430, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 850 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.route("https://api.danzstak.com/**", async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === "/tour-manager/outreach") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ messages: [{ id: "outreach_reply_test_123", venueName: "Test Venue", subject: "March 5 booking pitch", status: "replied", sentAt: "2026-11-07T10:00:00Z" }], replies: [{ outreachId: "outreach_reply_test_123", action: "offer_date", content: "We can offer March 5. What is your guarantee?", proposedDate: "2027-03-05", createdAt: "2026-11-07T12:00:00Z" }] }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      });
      await page.goto(`${origin}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.danzstakLoadBookingThreads === "function");
      await page.getByRole("tab", { name: "Bookings" }).click();
      await page.getByRole("button", { name: /Test Venue/ }).waitFor();
      const geometry = await page.evaluate(() => { const tabs = [...document.querySelectorAll("[data-chat-filter]")].map(node => node.getBoundingClientRect()); return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, tabHeights: tabs.map(rect => rect.height), tabRight: Math.max(...tabs.map(rect => rect.right)) }; });
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${width}px booking inbox overflows`); assert.ok(geometry.tabHeights.every(height => height >= 44), `${width}px has a small SYNC tab`); assert.ok(geometry.tabRight <= width + 1 || width > 760, `${width}px tabs are clipped`);
      await page.getByRole("button", { name: /Test Venue/ }).evaluate(button => button.click());
      const conversation = page.getByLabel("Conversation");
      await conversation.getByText("We can offer March 5. What is your guarantee?").waitFor();
      await conversation.getByText("Proposed date: 2027-03-05").waitFor();
      await conversation.getByText("sending email from SYNC is not enabled yet", { exact: false }).waitFor();
      assert.equal(await page.locator("#messageForm").isHidden(), true, "The personal composer must not pretend to send an external email");
      await page.screenshot({ path: path.join(output, `booking-sync-${width}.png`), fullPage: false });
      await context.close();
    }
    console.log("Booking reply SYNC browser checks passed at 320, 360, 390, 414, 430, and 1366px.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
