"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132";
const output = path.resolve("docs/screenshots/booking-credit-return");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const purchased = 3;

function emptyWorkspace() {
  return {
    venues:[],
    artist:{ name:"Credit Return Test", genre:"", hometown:"", epk:"", pitch:"" },
    tour:{ currency:"USD", people:1, contingencyPercent:10 },
    revision:"revision_credit_1",
    estimate:{ total:0, confirmedRevenue:0, potentialProfit:0, breakEvenRevenue:0, bookingEmailsUsd:0 }
  };
}

function installApi(page) {
  const state = { creditPolls:0, returning:false };
  page.route("https://api.danzstak.com/**", async route => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname === "/tour-manager/credits") {
      state.creditPolls++;
      const settled = state.returning && state.creditPolls >= 2;
      body = {
        bookingEmailCredits:settled ? 5 : 2,
        purchasedCredits:settled ? 5 : 2,
        sentEmails:0,
        reservedCredits:0,
        activity:settled ? [{
          type:"purchase",
          credits:purchased,
          status:"settled",
          description:`${purchased} booking email credits purchased`,
          at:new Date().toISOString()
        }] : []
      };
    } else if (url.pathname === "/tour-manager/outreach") body = { messages:[], replies:[] };
    else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys:[] };
    else if (url.pathname === "/booking-pipeline") body = emptyWorkspace();
    else if (url.pathname === "/epk/outreach-share") body = { shares:[] };
    return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(body) });
  });
  return state;
}

(async () => {
  fs.mkdirSync(output, { recursive:true });
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, serviceWorkers:"block" });
      const page = await context.newPage(), pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      const state = installApi(page);
      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("bookingCreditBalance")?.textContent === "2");
      await page.evaluate(quantity => sessionStorage.setItem("danzstakBookingCreditCheckout", JSON.stringify({ quantity, startedAt:Date.now() })), purchased);
      state.returning = true;
      state.creditPolls = 0;
      await page.goto(`${origin}/booking-selections.html?credits=success`, { waitUntil:"domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("bookingCreditStatus")?.textContent.includes("Credits verified"), null, { timeout:10000 });

      assert.ok(state.creditPolls >= 2, `${width}px credit return did not wait for the webhook ledger entry`);
      assert.equal(await page.locator("#bookingCreditBalance").textContent(), "5", `${width}px credit balance did not update`);
      assert.equal(await page.locator("#bookingCreditStatus").textContent(), "Credits verified. 3 booking email credits are ready to send.", `${width}px verified-credit status is incorrect`);
      assert.equal(new URL(page.url()).searchParams.has("credits"), false, `${width}px completed credit result remained in the URL`);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("danzstakBookingCreditCheckout")), null, `${width}px credit Checkout marker was not cleared`);
      const geometry = await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
        targets:[...document.querySelectorAll("#buyBookingCredits input,#buyBookingCredits button,.credit-panel summary")].map(node => node.getBoundingClientRect().height)
      }));
      assert.ok(geometry.overflow <= 1, `${width}px credit workspace overflows by ${geometry.overflow}px`);
      if (width <= 430) assert.ok(Math.min(...geometry.targets) >= 43.5, `${width}px credit control is below the 44px mobile minimum`);
      assert.deepEqual(pageErrors, [], `${width}px page errors: ${pageErrors.join(" | ")}`);
      await page.screenshot({ path:path.join(output, `credits-verified-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });
      await context.close();
    }

    const context = await browser.newContext({ viewport:{ width:390, height:900 }, serviceWorkers:"block" });
    const page = await context.newPage(), state = installApi(page);
    await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
    await page.evaluate(() => sessionStorage.setItem("danzstakBookingCreditCheckout", JSON.stringify({ quantity:3, startedAt:Date.now() })));
    state.creditPolls = 0;
    await page.goto(`${origin}/booking-selections.html?credits=cancelled`, { waitUntil:"domcontentloaded" });
    await page.waitForFunction(() => document.getElementById("bookingCreditStatus")?.textContent.includes("No credits were added"));
    assert.equal(new URL(page.url()).searchParams.has("credits"), false, "cancelled credit result remained in the URL");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("danzstakBookingCreditCheckout")), null, "cancelled credit Checkout marker was not cleared");
    assert.equal(await page.locator("#bookingCreditStatus").textContent(), "Checkout cancelled. No credits were added.");
    await page.screenshot({ path:path.join(output, "credits-cancelled-390.png"), fullPage:false, animations:"disabled", caret:"hide" });
    await context.close();
    console.log(`Booking-credit return browser checks passed at ${widths.join(", ")}px, including cancellation cleanup.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
