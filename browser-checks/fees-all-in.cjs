"use strict";
// Task 12 PR 3: every first price a buyer sees is the all-in total (price + 6% fee + $1 under $30).
// Run with a local server: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/fees-all-in.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const output = path.resolve("docs/screenshots/fees-all-in");
const eventId = "33333333-3333-4333-8333-333333333333";
const productId = "22222222-2222-4222-8222-222222222222";
const image = `${baseUrl}/assets/danzstak-share-fb-v2.jpg`;
const products = [
  { id: productId, title: "Signal tour shirt", description: "Black cotton tour shirt.", imageUrl: image, priceCents: 3000, shippingCents: 600, available: true, memberId: "11111111-1111-4111-8111-111111111111", shopName: "Night Circuit Shop" },
  { id: "44444444-4444-4444-8444-444444444444", title: "Crust patch", description: "Screen-printed patch.", imageUrl: image, priceCents: 500, shippingCents: 200, available: true, memberId: "11111111-1111-4111-8111-111111111111", shopName: "Night Circuit Shop" }
];
const event = {
  id: eventId, title: "Night Circuit at The Room", description: "Live electronic set.", venueName: "The Room", venueAddress: "1 Main Street, Seattle, WA",
  startsAt: "2027-01-06T04:00:00.000Z", endsAt: "2027-01-06T07:00:00.000Z", timezone: "America/Los_Angeles", status: "published", ticketSalesEnabled: true, namedTickets: false,
  tiers: [{ id: "general", name: "General admission", description: "Standing room.", priceCents: 1500, available: 80, status: "on_sale" }]
};
function payload(pathname) {
  if (pathname === "/marketplace/bazaar") return { products };
  if (pathname === `/marketplace/bazaar/${productId}`) return { product: products[0] };
  if (pathname === `/marketplace/events/${eventId}`) return { event };
  return {};
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width === 1366 ? 900 : 844 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload(new URL(route.request().url()).pathname)) }));
      const shot = async name => { if ([320, 390, 1366].includes(width)) await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true, animations: "disabled", caret: "hide" }); };
      const noOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px ${label} overflows`);

      await page.goto(`${baseUrl}/bazaar.html`, { waitUntil: "domcontentloaded" });
      await page.getByText("Signal tour shirt", { exact: true }).waitFor();
      const prices = await page.locator(".bazaar-price").allInnerTexts();
      assert.deepEqual(prices, ["$31.80", "$6.30"], `${width}px Bazaar cards lead with the all-in total`);
      assert.deepEqual(await page.locator(".bazaar-fee").allInnerTexts(), ["incl. $1.80 fees", "incl. $1.30 fees"], `${width}px Bazaar cards say the total includes fees`);
      await noOverflow("bazaar"); await shot("bazaar");

      await page.goto(`${baseUrl}/product.html?id=${productId}`, { waitUntil: "domcontentloaded" });
      await page.locator("#productFee").filter({ hasText: "incl." }).waitFor();
      assert.equal(await page.locator("#productPrice").innerText(), "$31.80", `${width}px product page leads with the all-in total`);
      assert.equal(await page.locator("#productFee").innerText(), "incl. $1.80 fees (6%), shipping not included");
      assert.match(await page.locator("#productShipping").innerText(), /\$6\.00/, "shipping stays separate and fee-free");
      await noOverflow("product"); await shot("product");

      await page.goto(`${baseUrl}/event.html?id=${eventId}`, { waitUntil: "domcontentloaded" });
      await page.locator(".ticket-total").waitFor();
      assert.equal(await page.locator(".ticket-price strong").first().innerText(), "$16.90 (incl. $1.90 fees)", `${width}px ticket tier all-in`);
      assert.equal(await page.locator(".ticket-total").innerText(), "Total $16.90 (incl. $1.90 fees) · the $1 processing fee drops off at $30");
      await page.locator(".ticket-buy select").selectOption("2");
      assert.equal(await page.locator(".ticket-total").innerText(), "Total $31.80 (incl. $1.80 fees)", `${width}px two tickets reach $30 and drop the $1`);
      await noOverflow("event"); await shot("event-tickets");

      await page.goto(`${baseUrl}/booking-selections.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#bookingCreditTotal").filter({ hasText: "emails" }).waitFor();
      assert.equal(await page.locator("#bookingCreditTotal").innerText(), "10 emails: $16.90 (incl. $1.90 fees)");
      await page.locator("#bookingCreditQuantity").fill("20");
      assert.equal(await page.locator("#bookingCreditTotal").innerText(), "20 emails: $31.80 (incl. $1.80 fees)");
      await page.locator("#bookingCreditQuantity").fill("10");
      await noOverflow("booking credits");
      await page.locator("#buyBookingCredits button[type=submit]").click();
      const total = page.locator("dialog .purchase-total");
      await total.waitFor();
      assert.equal(await total.innerText(), "Price $15.00 · DanzStak fee $1.90 (6% + $1 processing fee under $30) · Total $16.90 (USD)", `${width}px purchase dialog breaks out the fee`);
      await shot("purchase-dialog");
      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
      await context.close();
    }
    console.log(`All-in price browser checks passed at ${widths.join(", ")}px: Bazaar cards, product page, event tiers and ticket total, booking-email picker and purchase dialog.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
