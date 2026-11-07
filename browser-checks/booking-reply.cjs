"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const origin = process.argv[2] || "http://127.0.0.1:8037", output = path.resolve("docs/screenshots/booking-reply"), token = "a".repeat(64);
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 414, 430, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 850 }, deviceScaleFactor: 1 });
      const page = await context.newPage(); let submitted;
      await page.route("https://api.danzstak.com/tour-manager/reply", async route => {
        submitted = JSON.parse(route.request().postData() || "{}");
        assert.equal(route.request().url().includes(token), false, "The private token must not appear in the request URL");
        assert.equal(route.request().headers().cookie, undefined, "The accountless request must not send a session cookie");
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ received: true }) });
      });
      await page.goto(`${origin}/booking-reply.html#token=${token}`, { waitUntil: "domcontentloaded" });
      assert.equal(await page.evaluate(() => location.hash), "", "The fragment must be removed after it is read");
      await page.getByLabel("Response").selectOption("offer_date");
      await page.getByLabel("Proposed date").fill("2027-03-05");
      await page.getByLabel("Message").fill("We can offer March 5. What is your guarantee?");
      const geometry = await page.evaluate(() => { const button = document.querySelector("button[type=submit]").getBoundingClientRect(); return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, height: button.height, right: button.right }; });
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${width}px page overflows`); assert.ok(geometry.height >= 44, `${width}px submit target is too small`); assert.ok(geometry.right <= width + 1, `${width}px submit is clipped`);
      await page.getByRole("button", { name: "Send reply to artist" }).click();
      await page.getByText("Reply sent to the artist. You may close this page.").waitFor();
      assert.equal(submitted.token, token); assert.equal(submitted.action, "offer_date"); assert.equal(submitted.proposedDate, "2027-03-05"); assert.match(submitted.clientMessageId, /^[a-zA-Z0-9_-]{16,100}$/);
      await page.screenshot({ path: path.join(output, `booking-reply-${width}.png`), fullPage: false });
      await context.close();
    }
    console.log("Booking reply browser checks passed at 320, 360, 390, 414, 430, and 1366px.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
