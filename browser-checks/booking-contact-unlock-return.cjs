"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132";
const output = path.resolve("docs/screenshots/booking-contact-unlock-return");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const venueKey = "venue_contact_return_123";
const venue = {
  venueKey,
  name:"Road Room",
  address:"100 Tour Ave, Tacoma, WA",
  categories:["live music", "punk"],
  websites:["https://example.com/road-room"],
  emails:["booking@example.com"],
  phones:["+1 253 555 0100"],
  sourceEvidence:[{ name:"Official venue website", url:"https://example.com/road-room" }],
  activityEvidence:"Current live calendar found",
  discoveredAt:"2026-11-09T00:00:00.000Z",
  booking:{ status:"Not contacted", showDate:"2027-01-10", feeCurrency:"USD" }
};
const workspace = () => ({
  venues:[JSON.parse(JSON.stringify(venue))],
  artist:{ name:"Road Test", genre:"Punk, Garage rock", hometown:"Tacoma, WA", epk:"https://danzstak.com/epk.html?id=road-test", pitch:"A direct live set for independent rooms." },
  tour:{ currency:"USD", people:1, contingencyPercent:10 },
  revision:"revision_contact_1",
  estimate:{ total:0, confirmedRevenue:0, potentialProfit:0, breakEvenRevenue:0, bookingEmailsUsd:0 }
});

function installApi(page, mode) {
  const state = { order:[], saves:[], contactPolls:0, unlocked:false };
  page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    let body = {};
    if (url.pathname === "/booking-pipeline" && method === "GET") {
      if (mode === "return") await new Promise(resolve => setTimeout(resolve, 2500));
      body = workspace();
    }
    else if (url.pathname === "/booking-pipeline" && method === "POST") {
      const payload = JSON.parse(request.postData() || "{}");
      state.order.push("save"); state.saves.push(payload);
      body = { revision:"revision_contact_2", estimate:workspace().estimate };
    } else if (url.pathname === "/tour-manager/contact-unlocks") {
      state.contactPolls++;
      if (mode === "return" && state.contactPolls >= 2) state.unlocked = true;
      body = { venueKeys:state.unlocked ? [venueKey] : [] };
    } else if (url.pathname === "/tour-manager/contact-unlock/checkout") {
      state.order.push("checkout");
      const payload = JSON.parse(request.postData() || "{}");
      assert.equal(payload.venueKey, venueKey);
      state.unlocked = true;
      body = { unlocked:true };
    } else if (url.pathname === "/tour-manager/credits") body = { bookingEmailCredits:0, purchasedCredits:0, sentEmails:0, reservedCredits:0, activity:[] };
    else if (url.pathname === "/tour-manager/outreach") body = { messages:[], replies:[] };
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
      const state = installApi(page, "checkout");
      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      const card = page.locator(`.venue-card[data-venue-key="${venueKey}"]`);
      await card.waitFor({ state:"visible" });
      const date = card.locator('input[aria-label="Proposed show date"]');
      await date.fill("2027-02-02");
      await date.dispatchEvent("change");
      const unlock = card.locator(".unlock-contact");
      await unlock.click();
      await card.locator('a[href="mailto:booking@example.com"]').waitFor({ state:"visible" });
      assert.deepEqual(state.order, ["save", "checkout"], `${width}px contact Checkout did not save first`);
      assert.equal(state.saves[0]?.venues?.[0]?.booking?.showDate, "2027-02-02", `${width}px saved workspace missed the edited date`);
      const geometry = await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
        targets:[...document.querySelectorAll('.venue-links a,.venue-links button')].map(node => node.getBoundingClientRect().height)
      }));
      assert.ok(geometry.overflow <= 1, `${width}px contact workspace overflows by ${geometry.overflow}px`);
      if (width <= 430) assert.ok(Math.min(...geometry.targets) >= 43.5, `${width}px contact target is below the 44px mobile minimum`);
      assert.deepEqual(pageErrors, [], `${width}px page errors: ${pageErrors.join(" | ")}`);
      await page.screenshot({ path:path.join(output, `contact-unlocked-${width}.png`), fullPage:true, animations:"disabled", caret:"hide" });
      await context.close();
    }

    const context = await browser.newContext({ viewport:{ width:390, height:900 }, serviceWorkers:"block" });
    const page = await context.newPage(), state = installApi(page, "return");
    await page.goto(`${origin}/booking-selections.html?contact=success&venueKey=${encodeURIComponent(venueKey)}`, { waitUntil:"domcontentloaded" });
    await page.locator('a[href="mailto:booking@example.com"]').waitFor({ state:"visible", timeout:10000 });
    await page.waitForFunction(() => document.getElementById("bookingCreditStatus")?.textContent.includes("Booking contact unlocked"));
    await page.waitForFunction(() => document.activeElement?.matches('a[href^="mailto:"]'));
    assert.ok(state.contactPolls >= 2, "Checkout return did not wait for the webhook entitlement");
    const returnedUrl = new URL(page.url());
    assert.equal(returnedUrl.searchParams.has("contact"), false, "completed contact result remained in the URL");
    assert.equal(returnedUrl.searchParams.has("venueKey"), false, "completed venue key remained in the URL");
    await page.screenshot({ path:path.join(output, "contact-return-390.png"), fullPage:false, animations:"disabled", caret:"hide" });
    await context.close();
    console.log(`Booking contact Checkout browser checks passed at ${widths.join(", ")}px, including webhook return recovery.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
