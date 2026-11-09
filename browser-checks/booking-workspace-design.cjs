"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const origin = String(process.env.DANZSTAK_BOOKING_ORIGIN || "http://127.0.0.1:8027").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/issue-55-booking-workspace");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
fs.mkdirSync(output, { recursive: true });

let venueFixture = 0;
function fixture(pathname, populated = true) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } };
  if (pathname === "/booking-pipeline") return { venues: [], artist: populated ? { name: "The Test Rats", hometown: "Tacoma, WA, United States" } : {}, tour: {}, revision: "revision-1" };
  if (pathname === "/epk") return { kit: populated ? { artistName: "The Test Rats", hometown: "Tacoma, WA, United States" } : {} };
  if (pathname === "/profiles") return { profile: populated ? { name: "The Test Rats", location: "Tacoma, WA, United States" } : {} };
  if (pathname === "/tour/route") return {
    route: {
      start: { label: "Seattle, Washington", position: [-122.3321, 47.6062] },
      end: { label: "Seattle, Washington", position: [-122.3321, 47.6062] },
      turnaround: { label: "San Francisco, California", position: [-122.4194, 37.7749] },
      stops: [
        { label: "Tacoma, Washington", position: [-122.4443, 47.2529] },
        { label: "Portland, Oregon", position: [-122.6765, 45.5231] },
        { label: "Medford, Oregon", position: [-122.8756, 42.3265] },
        { label: "San Francisco, California", position: [-122.4194, 37.7749] }
      ],
      itineraryMarkets: ["Seattle, Washington", "Tacoma, Washington", "Portland, Oregon", "Medford, Oregon", "San Francisco, California"],
      distanceMiles: 1660, durationHours: 30.5, minimumDrivingDays: 4,
      requestedDays: 10, requestedShows: 8, departOn: "", returnBy: "", direction: "south", local: false
    },
    candidates: [{ stop: "Seattle, Washington", position: [-122.3321, 47.6062], venues: [{
      venueKey: "fixture-seattle-club", name: "Seattle Test Club", address: "100 Test Ave, Seattle, WA",
      position: [-122.33, 47.61], categories: ["Live music venue"], websites: ["https://example.com/seattle"],
      emails: [], phones: [], sources: [{ name: "Official venue website", url: "https://example.com/seattle" }],
      activityEvidence: "Current events listed", discoveredAt: "2026-11-06T00:00:00Z", bookingSuitability: "needs-research"
    }], hotels: [], vanStops: [], recordStores: [] }]
  };
  if (pathname === "/venues/search") return { venues: [{
    venueKey: `fixture-researched-club-${++venueFixture}`, name: "Researched Route Club", address: "200 Route St",
    position: [-122.5, 45.5], categories: ["Live music venue"], websites: ["https://example.com/route-club"],
    emails: ["booking@example.com"], phones: [], sources: [{ name: "Official venue website", url: "https://example.com/route-club" }],
    activityEvidence: "Current calendar found", discoveredAt: "2026-11-06T00:00:00Z", bookingSuitability: "contact-found"
  }], page: 0, radiusMiles: 25, hasMore: false, canExpand: false };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const requestUrl = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(requestUrl.pathname, true)) });
      });

      await page.goto(`${origin}/booking.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("bookingIdentityStatus")?.textContent.trim() === "Saved.");
      await page.waitForTimeout(80);

      const geometry = await page.evaluate(() => {
        const rect = selector => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        };
        const actionBoxes = [...document.querySelectorAll(".booking-brief-actions button")].map(button => button.getBoundingClientRect());
        const finderButton = document.querySelector("#venueQuickForm button");
        const finderButtonBox = finderButton.getBoundingClientRect();
        const finderHit = document.elementFromPoint(finderButtonBox.left + finderButtonBox.width / 2, finderButtonBox.top + finderButtonBox.height / 2);
        const visibleTargets = [...document.querySelectorAll(".tool-header a, .booking-start button")]
          .map(element => element.getBoundingClientRect())
          .filter(box => box.width > 0 && box.height > 0);
        return {
          documentWidth: document.documentElement.scrollWidth,
          header: rect(".tool-header"),
          headerStyle: {
            padding: getComputedStyle(document.querySelector(".tool-header")).padding,
            minHeight: getComputedStyle(document.querySelector(".tool-header")).minHeight,
            boxSizing: getComputedStyle(document.querySelector(".tool-header")).boxSizing
          },
          start: rect(".booking-start"),
          identity: rect(".booking-identity"),
          brief: rect(".booking-brief"),
          finder: rect(".venue-quick-search"),
          finderAction: rect("#venueQuickForm button"),
          mobileNav: rect(".ds-mobile-nav"),
          finderActionHitTestable: finderHit === finderButton || finderButton.contains(finderHit),
          samePlanningCard: document.querySelector(".booking-identity").closest(".booking-start") === document.querySelector(".booking-start") && document.querySelector(".booking-brief").closest(".booking-start") === document.querySelector(".booking-start"),
          actionsShareRow: Math.abs(actionBoxes[0].top - actionBoxes[1].top) <= 1,
          minimumTarget: Math.min(...visibleTargets.map(box => box.height)),
          mapClosed: !document.querySelector(".booking-tools").open,
          optionsClosed: !document.querySelector(".planner-drawer").open,
          primaryStatus: document.getElementById("bookingBriefStatus").textContent.trim()
        };
      });

      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
      assert.ok(geometry.documentWidth <= width + 1, `${width}px horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.header.height <= 64, `${width}px header too tall: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.samePlanningCard, true, `${width}px planning controls must share one card`);
      assert.equal(geometry.actionsShareRow, true, `${width}px primary and example actions must share one row`);
      assert.ok(geometry.minimumTarget >= 44, `${width}px touch target below 44px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.start.width <= width && geometry.start.left >= 0 && geometry.start.right <= width + 1, `${width}px planning card does not fit`);
      assert.ok(geometry.identity.top > geometry.start.top, `${width}px identity must follow the heading`);
      if (width < 700) assert.ok(geometry.brief.top >= geometry.identity.bottom - 1, `${width}px mobile planning order is incorrect`);
      else assert.ok(Math.abs(geometry.brief.top - geometry.identity.top) <= 1, `${width}px desktop identity and request should share a row`);
      assert.ok(width >= 700 || geometry.finderAction.bottom <= 844, `${width}px actionable club search should fit in the first phone viewport: ${JSON.stringify(geometry)}`);
      assert.ok(width >= 700 || geometry.finderAction.bottom <= geometry.mobileNav.top - 8, `${width}px Club Finder action must clear fixed navigation by 8px: ${JSON.stringify(geometry)}`);
      assert.ok(width >= 700 || geometry.finderActionHitTestable, `${width}px Club Finder action must win center-point hit testing`);
      assert.equal(geometry.mapClosed, true);
      assert.equal(geometry.optionsClosed, true);
      assert.equal(geometry.primaryStatus, "", `${width}px should not show an advanced-form warning before the user starts`);

      await page.locator("#bookingBriefExample").click();
      assert.match(await page.locator("#bookingBrief").inputValue(), /DIY punk/i);
      assert.match(await page.locator("#bookingBrief").inputValue(), /Tacoma, WA, United States/i);
      assert.doesNotMatch(await page.locator("#bookingBrief").inputValue(), /Momo|The Rats\./i);
      await page.locator("#startCity").fill("");
      await page.locator("#bookingBrief").fill("DIY punk. Travel south for 10 days and play 8 shows.");
      await page.locator("#bookingBriefForm button[type=submit]").click();
      assert.match(await page.locator("#bookingBriefStatus").textContent(), /press Plan my run again/i);
      await page.locator("#bandName").fill("The Test Rats");
      await page.locator("#startCity").fill("Tacoma, WA, United States");
      await page.locator("#bookingBriefExample").click();
      assert.equal((await page.locator("#bookingBriefStatus").textContent()).trim(), "", "Example should clear a stale validation error");
      await page.locator("#venueQuickQuery").fill("punk clubs in Tacoma");
      assert.equal(await page.locator("#venueQuickQuery").evaluate(element => document.activeElement === element), true, `${width}px query must remain usable with the keyboard focused`);
      await page.locator("#venueQuickForm button").click();
      const quickVenue = page.locator("#venueQuickResults article", { hasText: "Researched Route Club" }).first();
      await quickVenue.waitFor({ state: "visible" });
      const quickSelect = quickVenue.locator(".venue-quick-select");
      assert.ok(await quickSelect.evaluate(element => element.getBoundingClientRect().height >= 44), `${width}px quick venue selection must retain a 44px target`);
      assert.equal((await quickSelect.textContent()).trim(), "Add to booking list", `${width}px sourced venues need a direct selection action`);
      await quickSelect.click();
      assert.match(await page.locator("#selectedVenueCount").textContent(), /1 club selected/);
      assert.equal(await page.locator(".venue-quick-search > .venue-selection-bar").isVisible(), true, `${width}px selected-club review must stay in the primary finder`);
      assert.equal(await page.locator("#openVenueSelections").isEnabled(), true);
      assert.equal((await page.locator("#openVenueSelections").textContent()).trim(), "Review selected clubs");
      assert.equal((await quickSelect.textContent()).trim(), "Remove from booking list");
      await page.locator(".venue-quick-search").screenshot({ path: path.join(output, `venue-selection-${width}.png`) });
      await quickSelect.click();
      assert.match(await page.locator("#selectedVenueCount").textContent(), /0 clubs selected/);
      assert.equal(await page.locator(".venue-quick-search > .venue-selection-bar").isHidden(), true, `${width}px empty selection bar should not waste feed space`);
      if (width === 390) {
        await page.locator("#startCity").fill("Seattle, Washington");
        await page.locator("#bookingBrief").fill("Punk. Seattle to San Francisco and home. 10 days. 8 shows.");
        await page.locator("#bookingBriefForm button[type=submit]").click();
        await page.locator(".tour-day-sheet").waitFor();
        await page.locator(".place-card", { hasText: "Researched Route Club" }).first().waitFor({ state: "attached" });
        await page.waitForFunction(() => document.getElementById("routeSearchStatus")?.textContent.includes("Route research finished"));
        assert.ok(await page.locator(".route-market").count() >= 27, "the full Seattle–San Francisco corridor should remain visible");
        const marketText = await page.locator(".route-market > summary").allTextContents();
        for (const expected of ["Tacoma", "Olympia", "Portland", "Salem", "Eugene", "Medford", "Redding", "Sacramento"]) {
          assert.ok(marketText.some(value => value.includes(expected)), `${expected} must be included along the route`);
        }
        assert.equal(await page.locator(".tour-calendar tbody tr").count(), 10, "day sheet should cover the complete requested run");
        assert.match(await page.locator(".tour-calendar tbody tr").first().textContent(), /host or couch lead needed/i, "each road day needs an honest sleep plan");
        assert.match(await page.locator(".tour-calendar tbody tr").last().textContent(), /Home/, "the final return day should sleep at home");
        assert.doesNotMatch(await page.locator(".tour-calendar tbody tr").last().textContent(), /≈\d+ road mi/, "missing intermediate geometry must not become one false long return leg");
        assert.ok((await page.locator(".tour-calendar tbody tr").allTextContents()).some(text => /≈\d+ road mi/.test(text)), "the day sheet should expose estimated leg mileage");
        assert.match(await page.locator(".proposed-calendar > summary").textContent(), /8 proposed shows/);
        assert.ok(await page.locator(".tour-lead-status", { hasText: /Sourced lead|Contact found/ }).count() >= 1, "proposed clubs need a visible evidence status");
        assert.doesNotMatch(await page.locator('[data-route-cost="total"]').textContent(), /—/, "route cost must calculate");
        await page.locator('[data-route-budget-input="averageShowPay"]').fill("1000");
        await page.locator('[data-route-budget-input="averageMerchPerShow"]').fill("200");
        assert.equal(await page.locator('[data-route-cost="income"]').textContent(), "$9,600", "eight shows must project show pay plus merch income");
        assert.match(await page.locator('[data-route-cost-label="net"]').textContent(), /Projected profit/);
        assert.doesNotMatch(await page.locator('[data-route-cost="breakEven"]').textContent(), /—/, "break-even per show must calculate");
        assert.equal(await page.locator(".route-research-workspace").evaluate(element => element.open), false, "city-by-city research should not stretch the primary tour sheet");
        assert.match(await page.locator(".route-research-workspace > summary").textContent(), /Club research and contacts/);
        await page.locator(".route-research-workspace > summary").click();
        const firstMarket = page.locator(".route-market").first();
        await firstMarket.evaluate(element => {
          element.open = true;
          element.querySelectorAll("details").forEach(details => { details.open = true; });
        });
        const select = firstMarket.locator(".route-select-venue").first();
        await select.click();
        assert.match(await page.locator("#selectedVenueCount").textContent(), /1 club selected/);
        const tourGeometry = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          workspaceColumns: getComputedStyle(document.querySelector(".tour-sheet-workspace")).gridTemplateColumns,
          daySheetScrollable: document.querySelector(".tour-day-sheet").scrollWidth > document.querySelector(".tour-day-sheet").clientWidth + 1
        }));
        assert.ok(tourGeometry.documentWidth <= tourGeometry.viewportWidth + 1, `tour sheet overflow: ${JSON.stringify(tourGeometry)}`);
        assert.equal(tourGeometry.daySheetScrollable, false, "phone day sheet should read as cards without horizontal scrolling");
        await page.locator(".tour-sheet-workspace").screenshot({ path: path.join(output, "tour-sheet-390.png") });
      }
      await page.evaluate(() => {
        document.querySelector(".booking-tools").open = false;
        document.querySelector(".planner-drawer").open = false;
        document.activeElement?.blur();
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(50);
      await page.screenshot({ path: path.join(output, `booking-${width}.png`), fullPage: width >= 700 });
      if (width === 390) {
        await page.locator("#openVenueSelections").click();
        await page.waitForURL(url => url.pathname.endsWith("/booking-selections.html"));
      }
      assert.equal(errors.length, 0, `${width}px page errors after venue selection: ${errors.join(" | ")}`);
      await context.close();

      const emptyContext = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
      const emptyPage = await emptyContext.newPage();
      await emptyPage.route("https://api.danzstak.com/**", route => {
        const requestUrl = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(requestUrl.pathname, false)) });
      });
      await emptyPage.goto(`${origin}/booking.html`, { waitUntil: "domcontentloaded" });
      await emptyPage.waitForFunction(() => document.getElementById("bookingIdentityStatus")?.textContent.trim() === "Add your home city, then save.");
      const emptyState = await emptyPage.evaluate(() => ({
        act: document.getElementById("bandName").value,
        home: document.getElementById("startCity").value,
        brief: document.getElementById("bookingBrief").value,
        query: document.getElementById("venueQuickQuery").value,
        results: document.getElementById("venueQuickResults").children.length,
        status: document.getElementById("venueQuickStatus").textContent.trim()
      }));
      assert.deepEqual(emptyState, { act: "", home: "", brief: "", query: "", results: 0, status: "" }, `${width}px fresh empty context leaked populated state`);
      await emptyPage.screenshot({ path: path.join(output, `booking-empty-${width}.png`), fullPage: width >= 700 });
      await emptyContext.close();
    }
    console.log(`Booking workspace browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
