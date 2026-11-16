"use strict";

// Task 07: freshness chips on discovery and selected venues, closed clubs hidden behind one tap,
// and the member "This club closed" report. Phone widths first.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132";
const output = path.resolve("docs/screenshots/booking-venue-freshness");
const widths = [320, 360, 375, 390, 414, 430, 768, 1366];
const fresh = (level, label, hidden = false) => ({ level, label, lastActivityAt: "", hidden });
const base = { categories: ["live music", "punk"], websites: ["https://example.com/room"], position: [-121.49, 38.58], discoveredAt: "2026-11-09T00:00:00.000Z", bookingSuitability: "contact-found" };
const results = [
  { ...base, venueKey: "osm-node-1001", name: "Active Room", address: "1 Active St, Sacramento, CA", distanceMiles: 1.2, freshness: fresh("active", "Active: replied to a pitch Oct 2026") },
  { ...base, venueKey: "osm-node-1002", name: "Quiet Hall", address: "2 Quiet St, Sacramento, CA", distanceMiles: 2.4, freshness: fresh("unverified", "Unverified — no recent activity on DanzStak") },
  { ...base, venueKey: "osm-node-1003", name: "Bounce Bar", address: "3 Bounce St, Sacramento, CA", distanceMiles: 3.1, freshness: fresh("bounced", "Booking address bounced — find a newer contact") },
  { ...base, venueKey: "osm-node-1004", name: "Gone Club", address: "4 Gone St, Sacramento, CA", distanceMiles: 4.0, freshness: fresh("closed", "Reported closed by 2 members", true) }
];
const workspace = {
  venues: [{ ...base, venueKey: "osm-node-1002", name: "Quiet Hall", address: "2 Quiet St, Sacramento, CA", booking: { status: "Not contacted", feeCurrency: "USD" }, freshness: fresh("unverified", "Unverified — no recent activity on DanzStak") }],
  artist: { name: "Freshness Test", genre: "Punk", hometown: "Sacramento, CA", epk: "https://danzstak.com/epk.html?id=fresh", pitch: "Loud." },
  tour: { currency: "USD", people: 3, contingencyPercent: 10 }, revision: "rev-1",
  estimate: { total: 0, confirmedRevenue: 0, potentialProfit: 0, breakEvenRevenue: 0, bookingEmailsUsd: 0 },
  epk: { ready: true, published: true, done: 6, total: 6, missing: [] }
};

function installApi(page, state) {
  return page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    let body = {}, status = 200;
    if (url.pathname === "/venues/search") body = { query: "punk venues in Sacramento", location: { label: "Sacramento, CA", position: [-121.49, 38.58] }, genre: "punk", venues: results, researchLeads: [], providers: [], coverage: "provider-complete" };
    else if (url.pathname === "/booking-pipeline" && method === "GET") body = workspace;
    else if (url.pathname === "/booking-pipeline" && method === "POST") {
      const data = JSON.parse(request.postData() || "{}");
      state.posts.push(data);
      if (data.action === "venue_report") { status = 201; body = { reported: true, alreadyReported: false, freshness: fresh("reported_closed", "A member reported this club closed — check before pitching") }; }
      else body = { revision: "rev-2", estimate: workspace.estimate, statuses: {} };
    } else if (url.pathname === "/tour-manager/credits") body = { bookingEmailCredits: 0, purchasedCredits: 0, sentEmails: 0, reservedCredits: 0, activity: [] };
    else if (url.pathname === "/tour-manager/outreach") body = { messages: [], replies: [] };
    else if (url.pathname === "/epk/outreach-share") body = { shares: [] };
    else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys: [] };
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function noHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `${label}: page scrolls sideways by ${overflow}px`);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage(), pageErrors = [], state = { posts: [] };
      page.on("pageerror", error => pageErrors.push(error.message));
      await installApi(page, state);

      // Discovery: chips on every live result, the closed club out of the way until asked for.
      await page.goto(`${origin}/booking.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#venueQuickQuery").fill("punk venues in Sacramento");
      await page.locator("#venueQuickForm").evaluate(form => form.requestSubmit());
      const quick = page.locator("#venueQuickResults");
      await quick.locator(".venue-freshness-active").first().waitFor({ state: "visible" });
      assert.equal(await quick.locator(".venue-freshness-active").first().textContent(), "Active: replied to a pitch Oct 2026");
      assert.match(await quick.locator(".venue-freshness-bounced").first().textContent(), /find a newer contact/);
      assert.equal(await quick.locator("article.venue-closed").isVisible(), false, `${width}px: closed club must be hidden by default`);
      const toggle = quick.locator(".venue-closed-toggle");
      assert.equal(await toggle.textContent(), "Show 1 closed club");
      const toggleBox = await toggle.boundingBox();
      assert.ok(toggleBox.height >= 44, `${width}px: show-closed button must be a 44px target`);
      await quick.screenshot({ path: path.join(output, `discovery-${width}.png`) });
      await toggle.click();
      assert.equal(await quick.locator("article.venue-closed").isVisible(), true);
      await noHorizontalOverflow(page, `${width}px discovery`);

      // Selected venue: freshness chip and the member report.
      await page.goto(`${origin}/booking-selections.html`, { waitUntil: "domcontentloaded" });
      const card = page.locator('.venue-card[data-venue-key="osm-node-1002"]');
      await card.waitFor({ state: "visible" });
      assert.match(await card.locator(".venue-freshness-unverified").textContent(), /^Unverified/);
      const report = card.locator(".venue-report");
      await report.locator("summary").click();
      await report.locator("button", { hasText: "This club closed" }).click();
      await report.locator('[role="status"]').filter({ hasText: "DanzStak reviews every report" }).waitFor();
      const sent = state.posts.find(item => item.action === "venue_report");
      assert.deepEqual(sent, { action: "venue_report", venueKey: "osm-node-1002", kind: "closed" }, "The report carries only the venue and what changed");
      for (const control of await report.locator("button, input, summary").all()) {
        const box = await control.boundingBox();
        if (box) assert.ok(box.height >= 44, `${width}px: report controls must be 44px targets`);
      }
      await card.screenshot({ path: path.join(output, `selected-card-${width}.png`) });
      await noHorizontalOverflow(page, `${width}px selected venues`);
      assert.deepEqual(pageErrors, [], `${width}px page errors`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log("Venue freshness browser checks passed at 320-1366px: chips, closed hidden behind one 44px tap, member report.");
})().catch(error => { console.error(error); process.exit(1); });
