"use strict";
// Audit 36 C1 (directive F6, task 25, owner 2026-11-18: "things should have been handled before they get to the tour
// manager"). Before: the Tour Manager page opened with a standing paywall — "Tour Manager email credits", a quantity box
// and "Buy credits" — and called itself "Paid Tour Manager". Now booking-email credits are offered only when sending a
// pitch needs one (the venue card's prompt after the server says there is no credit); the page keeps a small count and,
// as OWNER-DIRECTIVES says, "Booking Agent → Refund an unused purchase".
// Checks at 320/360/390/430px with zero credits: no purchase form, no "Buy" button, no price and no "Paid" label anywhere
// on the page; no checkout request is made by opening it; the Tour Manager dashboard shows no credit count; the small
// count and the refund details are there; no sideways scroll.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/tour-manager-no-paywall");

function installApi(page, seen) {
  return page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    seen.push(`${route.request().method()} ${url.pathname}`);
    let body = {};
    if (url.pathname === "/auth/session") body = { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "band@danzstak.invalid" } };
    else if (url.pathname === "/tour-manager/credits") body = { bookingEmailCredits: 0, purchasedCredits: 0, sentEmails: 0, reservedCredits: 0, activity: [] };
    else if (url.pathname === "/tour-manager/refunds") body = { purchases: [] };
    else if (url.pathname === "/tour-manager/outreach") body = { messages: [], replies: [] };
    else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys: [] };
    else if (url.pathname === "/booking-pipeline") body = { venues: [], artist: { name: "No Paywall", genre: "", hometown: "", epk: "", pitch: "" }, tour: { currency: "USD", people: 1, contingencyPercent: 10 }, revision: "r1", estimate: { total: 0, confirmedRevenue: 0, potentialProfit: 0, breakEvenRevenue: 0, bookingEmailsUsd: 0 } };
    else if (url.pathname === "/epk/outreach-share") body = { shares: [] };
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const label = `${width}px Tour Manager`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [], seen = [];
      page.on("pageerror", error => errors.push(error.message));
      await installApi(page, seen);
      await page.goto(`${origin}/booking-selections.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("bookingCreditBalance")?.textContent === "0", null, { timeout: 8000 });
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => {
        const shown = element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden" && !element.closest("[hidden]");
        const text = document.body.innerText;
        const dashboard = document.querySelector(".tour-manager-dashboard")?.innerText || "";
        return {
          form: Boolean(document.querySelector("#buyBookingCredits, #bookingCreditQuantity")),
          buy: [...document.querySelectorAll("button, a")].filter(shown).map(node => node.textContent.trim()).filter(value => /\b(buy|unlock|purchase)\b/i.test(value)),
          prices: (text.match(/\$\s?\d+(?:\.\d{2})?/g) || []).filter(price => price !== "$0" && price !== "$0.00"),
          paid: /\bpaid tour manager\b/i.test(text),
          dashboardCredits: /\bcredits?\b/i.test(dashboard),
          count: document.getElementById("creditTitle")?.textContent.trim(),
          refunds: document.querySelector(".credit-panel details summary")?.textContent.trim(),
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      assert.equal(state.form, false, `${label}: no credit purchase form`);
      assert.deepEqual(state.buy, [], `${label}: no Buy / Unlock / Purchase button on the page`);
      assert.deepEqual(state.prices, [], `${label}: no prices on the page`);
      assert.equal(state.paid, false, `${label}: no "Paid Tour Manager" label`);
      assert.equal(state.dashboardCredits, false, `${label}: the Tour Manager dashboard shows no credit count`);
      assert.equal(state.count, "0 ready to send", `${label}: a small booking-email count stays`);
      assert.equal(state.refunds, "Refund an unused purchase", `${label}: unused purchases can still be refunded (OWNER-DIRECTIVES)`);
      assert.equal(state.overflow, false, `${label}: no sideways scroll`);
      assert.deepEqual(seen.filter(call => /^POST .*(checkout|unlock|refunds\/(quote|accept))/i.test(call)), [], `${label}: opening the page starts no checkout`);
      if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `after-${width}.png`) });
      assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Tour Manager paywall checks passed at 320, 360, 390, 430px: no purchase form, Buy button, price or \"Paid\" label, no checkout on open, no credit count in the dashboard; the small booking-email count and Refund an unused purchase stay.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
