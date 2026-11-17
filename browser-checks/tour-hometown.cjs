"use strict";
// Task 15-C (+15-D): the Tour Manager wears the band's hometown as accents (page wrap, header stripe, eyebrows,
// day-sheet header, Out of <town>, origin badge on Keep going / Tour so far); every count opens what it counts;
// labels stay on one line at 320px. Edge at 320/375/430/768/1366, light and dark colour-scheme.
// Run with a local server: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/tour-hometown.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/tour-hometown");
const widths = [320, 375, 430, 768, 1366];
const share = { venueKey: "bbbbbbbbbbbbbbbbbbbb", openCount: 3, revoked: false };
const base = { categories: ["live music", "punk"], websites: ["https://example.com/room"], discoveredAt: "2026-11-09T00:00:00.000Z" };
const venue = (key, name, booking) => ({ ...base, venueKey: key, name, address: `${name} St, Sacramento, CA`, booking: { feeCurrency: "USD", ...booking } });
const workspace = hometown => ({
  venues: [
    venue("aaaaaaaaaaaaaaaaaaaa", "Found Room", { status: "Not contacted" }),
    venue("bbbbbbbbbbbbbbbbbbbb", "Pitched Hall", { status: "Reply received", pipeline: { stage: "replied", pitchedAt: "2026-11-01T10:00:00.000Z" } }),
    venue("cccccccccccccccccccc", "Offer Club", { status: "Date proposed", pipeline: { pitchedAt: "2026-11-02T10:00:00.000Z" } }),
    venue("dddddddddddddddddddd", "Booked Basement", { status: "Confirmed", showDate: "2027-02-13", confirmationEvidence: "Promoter confirmed by email." })
  ],
  artist: { name: "Ghost Rider", genre: "Punk", hometown, epk: "https://danzstak.com/epk.html?id=x", pitch: "Loud." },
  tour: { currency: "USD", people: 3, contingencyPercent: 10 }, revision: "rev-1",
  estimate: { total: 0, confirmedRevenue: 0, potentialProfit: 0, breakEvenRevenue: 0, bookingEmailsUsd: 0 },
  epk: { ready: true, published: true, done: 6, total: 6, missing: [] },
  stats: { sent: 25, delivered: 23, bounced: 2, opened: 14, replied: 9, booked: 4, replyRate: 36, bookedRate: 16 }
});
const route = {
  route: { start: { label: "Tacoma, Washington", position: [-122.44, 47.25] }, end: { label: "Los Angeles, California", position: [-118.24, 34.05] }, stops: [{ label: "Portland, Oregon", position: [-122.68, 45.52] }, { label: "San Francisco, California", position: [-122.42, 37.77] }],
    itineraryMarkets: ["Tacoma, Washington", "Portland, Oregon", "San Francisco, California", "Los Angeles, California"], distanceMiles: 1140, durationHours: 18, minimumDrivingDays: 3, requestedDays: 8, requestedShows: 6, departOn: "2027-03-01", returnBy: "2027-03-08", oneWay: true, local: false },
  candidates: [{ stop: "Portland, Oregon", position: [-122.68, 45.52], venues: [{ venueKey: "pdx-club", name: "Portland Test Club", address: "1 Burnside, Portland, OR", position: [-122.68, 45.52], categories: ["Live music venue"], websites: ["https://example.com/pdx"], emails: [], phones: [], sources: [{ name: "Official venue website", url: "https://example.com/pdx" }], activityEvidence: "Current events", discoveredAt: "2026-11-06T00:00:00Z", bookingSuitability: "needs-research" }], hotels: [], vanStops: [], recordStores: [] }]
};
function api(page, { epk, hometown = "Tacoma, WA" }) {
  return page.route("https://api.danzstak.com/**", r => {
    const p = new URL(r.request().url()).pathname;
    let body = {};
    if (p === "/auth/session") body = { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } };
    else if (p === "/epk") body = epk === null ? {} : { kit: epk, published: true };
    else if (p === "/booking-pipeline") body = workspace(hometown);
    else if (p === "/tour-manager/credits") body = { bookingEmailCredits: 7, purchasedCredits: 20, sentEmails: 13, reservedCredits: 0, activity: [{ type: "purchase", credits: 20, description: "20 booking email credits purchased", at: "2026-11-10T00:00:00Z" }] };
    else if (p === "/tour-manager/outreach") body = { messages: [{ id: "t1", venueKey: "bbbbbbbbbbbbbbbbbbbb", venueName: "Pitched Hall", status: "delivered" }, { id: "t2", venueKey: "cccccccccccccccccccc", venueName: "Offer Club", status: "sent" }], replies: [] };
    else if (p === "/epk/outreach-share") body = { shares: [share] };
    else if (p === "/tour/route") body = route;
    else if (p === "/venues/search") body = { venues: [], page: 0, hasMore: false };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}
// Count tiles stack the number over a one-line word, so the word is checked, not the tile.
const ONE_LINE = "h1,h2,h3,summary,legend,button:not(.tour-stat):not(.tour-leg-option),.tour-leg-option strong,.eyebrow,.tour-stat span,.pipeline-chip";
const wrapped = page => page.evaluate(selector => {
  const visible = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !n.closest("[hidden],details:not([open]) > :not(summary)"); };
  const lines = n => { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), tops = []; for (let t = w.nextNode(); t; t = w.nextNode()) { if (!t.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(t); for (const b of r.getClientRects()) if (b.width > 1) tops.push(b.top); } tops.sort((a, b) => a - b); return tops.reduce((c, top, i) => c + (i && top - tops[i - 1] > 6 ? 1 : 0), tops.length ? 1 : 0); };
  // The artist's own words (club names, cities, notes) may wrap; interface labels may not.
  return [...document.querySelectorAll(selector)].filter(visible).filter(n => n.textContent.trim() && !n.closest(".venue-card h2,.place-card,.tour-calendar")).map(n => ({ text: n.textContent.trim().replace(/\s+/g, " ").slice(0, 50), lines: lines(n) })).filter(r => r.lines > 1);
}, ONE_LINE);
const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const scheme of ["light", "dark"]) for (const width of widths) {
      // ---- Pipeline page (booking-selections.html) ----
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", colorScheme: scheme, reducedMotion: "reduce" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await api(page, { epk: { artistName: "Ghost Rider", hometown: "Tacoma, WA", hometownSkin: { mode: "auto" } } });
      await page.goto(`${origin}/booking-selections.html`, { waitUntil: "domcontentloaded" });
      await page.locator('.venue-card[data-venue-key="dddddddddddddddddddd"]').waitFor();
      await page.waitForFunction(() => document.body.dataset.tourHometown === "tacoma");
      await page.waitForLoadState("load");
      const look = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundImage, eyebrow: getComputedStyle(document.querySelector(".eyebrow")).color, page: getComputedStyle(document.body).backgroundColor }));
      assert.ok(look.bg.includes("linear-gradient") && look.bg.includes("data:image/svg+xml"), `${width}px the hometown stripe and motif wrap the page`);
      await page.waitForFunction(() => /0px -6px 0px 0px inset/.test(getComputedStyle(document.querySelector("body > header")).boxShadow), null, { timeout: 5000 }); // header accent stripe
      assert.ok(ratio(look.eyebrow, "rgb(255, 255, 255)") >= 4.5, `${width}px eyebrow accent contrast ${ratio(look.eyebrow, "rgb(255, 255, 255)").toFixed(2)}`);
      // Counts: one-line label, an accessible name saying what is counted, and a tap opens exactly those clubs.
      await page.waitForFunction(() => document.getElementById("tmReplies")?.closest("button")?.getAttribute("aria-label")?.includes("replied"));
      assert.equal(await page.locator("#tmReplies").textContent(), "3");
      assert.equal(await page.locator("#tmReplies").locator("xpath=..").getAttribute("aria-label"), "3 clubs replied. Show them.");
      await page.locator("#tmReplies").locator("xpath=..").click();
      await page.locator("#metricFilterBanner").waitFor();
      assert.equal(await page.locator(".venue-card").count(), 3, "Replies opens the three clubs that replied");
      assert.equal(await page.locator("#metricFilterBanner").getAttribute("aria-label"), "3 clubs replied on this list");
      if ([320, 375, 430, 768, 1366].includes(width) && scheme === "light") await page.screenshot({ path: path.join(output, `pipeline-filtered-${width}.png`), animations: "disabled" });
      await page.locator("#metricFilterBanner button").click();
      assert.equal(await page.locator(".venue-card").count(), 4, "Show all");
      await page.locator(".pitch-stats").waitFor();
      await page.waitForFunction(() => document.getElementById("psOpened")?.textContent === "14");
      assert.equal(await page.locator("#psOpened").locator("xpath=..").getAttribute("aria-label"), "14 venues opened your private EPK. Show them.");
      await page.locator("#psOpened").locator("xpath=..").click();
      assert.equal(await page.locator(".venue-card").count(), 1, "Opened shows the club whose private EPK was opened");
      await page.locator("#metricFilterBanner button").click();
      await page.locator("#bookingCreditBalance").locator("xpath=..").click();
      assert.equal(await page.locator("#creditActivitySummary").locator("xpath=..").getAttribute("open"), "", "the credits number opens credit activity");
      assert.equal(await page.locator("#bookingCreditBalance").locator("xpath=..").getAttribute("aria-label"), "7 booking-email credits ready to send. Show credit activity.");
      // One fluid page, no boxes inside boxes.
      const flat = await page.evaluate(() => ["credit-panel", "tour-manager-dashboard", "tour-calendar-panel", "venue-card"].map(c => { const s = getComputedStyle(document.querySelector(`.${c}`)); return [c, s.borderLeftWidth, s.borderTopLeftRadius]; }));
      for (const [name, left, radius] of flat) assert.deepEqual([left, radius], ["0px", "0px"], `${width}px ${name} is a section with a hairline, not a box`);
      if (width === 320) assert.deepEqual(await wrapped(page), [], "pipeline labels on two lines at 320px");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px pipeline overflows`);
      if (width <= 430) {
        const small = await page.evaluate(() => [...document.querySelectorAll(".tour-stat")].filter(n => n.getBoundingClientRect().height > 0).map(n => n.getBoundingClientRect().height).filter(h => h < 44));
        assert.deepEqual(small, [], `${width}px count buttons under 44px`);
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `pipeline-${scheme}-${width}.png`), animations: "disabled" });
      assert.deepEqual(errors, [], `${width}px pipeline errors`);
      await context.close();

      // ---- Route planner (booking.html): Out of <town>, day-sheet header, counts, Keep going badge ----
      const ctx2 = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", colorScheme: scheme, reducedMotion: "reduce" });
      await ctx2.addInitScript(() => { try { localStorage.setItem("danzstak_tour_legs", JSON.stringify([{ start: "Seattle, Washington", end: "Tacoma, Washington" }])); } catch {} });
      const tab = await ctx2.newPage(), errs = [];
      tab.on("pageerror", e => errs.push(e.message));
      await api(tab, { epk: { artistName: "Ghost Rider", hometown: "Bologna", hometownSkin: { mode: "city", city: "tacoma" } } });
      await tab.goto(`${origin}/booking.html`, { waitUntil: "domcontentloaded" });
      await tab.waitForFunction(() => document.body.dataset.tourHometown === "tacoma", null, { timeout: 15000 });
      await tab.waitForLoadState("load"); // stylesheets applied before measuring the stripe
      await tab.waitForFunction(() => /0px -6px 0px 0px inset/.test(getComputedStyle(document.querySelector("header.tool-header")).boxShadow), null, { timeout: 5000 }); // route planner header stripe
      await tab.locator("#startCity").fill("Tacoma, Washington");
      await tab.locator("#bookingBrief").fill("Punk. Tacoma to Los Angeles one way. 8 days. 6 shows.");
      await tab.locator("#bookingBriefForm button[type=submit]").click();
      await tab.locator(".tour-day-sheet").waitFor({ timeout: 20000 });
      await tab.locator(".tour-out-of-line").waitFor();
      assert.equal((await tab.locator(".tour-out-of-line").textContent()).trim(), "Out of Tacoma", "the route says where the band is from (EPK picked Tacoma)");
      assert.equal((await tab.locator(".tour-day-sheet-head").textContent()).trim(), "Out of Tacoma", "day-sheet header");
      const days = tab.locator('.tour-stat[data-metric="days"]'), shows = tab.locator('.tour-stat[data-metric="shows"]');
      assert.match(await days.getAttribute("aria-label"), /^8 days on the day sheet\. Show every day\.$/);
      const visibleRows = () => tab.evaluate(() => [...document.querySelectorAll(".tour-calendar tbody tr")].filter(r => r.getBoundingClientRect().height > 0).length);
      const showCount = Number((await shows.locator("strong").textContent()).trim());
      if (showCount > 0) { await shows.click(); assert.equal(await visibleRows(), showCount, "Shows opens only the show days"); }
      else assert.equal(await shows.isDisabled(), true, "a count of 0 opens nothing, so it is not a live button");
      await days.click();
      assert.equal(await visibleRows(), 8, "Days opens every day of the day sheet");
      await tab.locator(".tour-keep-going").waitFor();
      assert.equal((await tab.locator(".tour-keep-going > h3 .tour-origin-badge").textContent()).trim(), "Out of Tacoma", "Keep going shows the tour origin");
      const legs = tab.locator('.tour-stat[data-metric="legs"]');
      assert.equal(await legs.getAttribute("aria-label"), "2 legs on this tour so far. Show the list.");
      await legs.click(); assert.equal(await tab.locator(".tour-legs-so-far").isHidden(), true); await legs.click(); assert.equal(await tab.locator(".tour-legs-so-far").isVisible(), true, "Legs opens the leg list");
      // Forms, buttons and the map keep the DanzStak frame.
      const frame = await tab.evaluate(() => { const probe = document.createElement("i"); probe.style.color = getComputedStyle(document.body).getPropertyValue("--tour-accent"); document.body.append(probe); const accent = getComputedStyle(probe).color; probe.remove(); return { button: getComputedStyle(document.querySelector("#bookingBriefForm button[type=submit]")).backgroundColor, accent }; });
      assert.notEqual(frame.button, frame.accent, "buttons keep the DanzStak frame, not the hometown accent");
      if (width === 320) assert.deepEqual(await wrapped(tab), [], "route planner labels on two lines at 320px");
      if (width <= 430) { const row = await tab.evaluate(() => { const r = document.querySelector(".tour-calendar tbody tr"), td = r.querySelector("td"); return [getComputedStyle(r).borderLeftWidth, getComputedStyle(r).borderTopLeftRadius, getComputedStyle(td).backgroundColor]; }); assert.deepEqual(row, ["0px", "0px", "rgba(0, 0, 0, 0)"], `${width}px day sheet rows are lines, not cards in cards`); }
      const legsLook = await tab.evaluate(() => { const b = document.querySelector('.tour-stat[data-metric="legs"]'); b.focus(); const s = getComputedStyle(b); return s.backgroundColor; });
      assert.equal(legsLook, "rgba(0, 0, 0, 0)", "a count is a number on the page, not a filled button");
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px route planner overflows`);
      await tab.locator(".tour-day-sheet").evaluate(n => { n.scrollIntoView({ block: "start" }); scrollBy(0, -120); });
      await tab.screenshot({ path: path.join(output, `daysheet-${scheme}-${width}.png`), animations: "disabled" });
      await tab.locator(".tour-keep-going").scrollIntoViewIfNeeded();
      await tab.screenshot({ path: path.join(output, `keepgoing-${scheme}-${width}.png`), animations: "disabled" });
      assert.deepEqual(errs, [], `${width}px route planner errors`);
      await ctx2.close();
    }

    // Fallbacks: no EPK -> the booking workspace's home town; EPK set to off -> no skin.
    for (const [label, epk, expected] of [["no EPK", null, "town-sacramento"], ["off", { artistName: "X", hometown: "Tacoma", hometownSkin: { mode: "off" } }, undefined]]) {
      const context = await browser.newContext({ viewport: { width: 375, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      await api(page, { epk, hometown: "Sacramento, CA" });
      await page.goto(`${origin}/booking-selections.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".venue-card").first().waitFor();
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => document.body.dataset.tourHometown), expected, label);
      await context.close();
    }
    console.log(`Tour Manager hometown checks passed at ${widths.join(", ")}px in light and dark: page wrap, eyebrows, day-sheet header, Out of <town>, Keep going origin badge, counts that open what they count with one-line labels and spoken names, no boxes in boxes, fallbacks.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
