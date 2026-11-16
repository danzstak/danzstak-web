"use strict";

// Task 02 board: stage chips + filters, one-step status moves, a reply moving a card, and the
// 5-day "Follow up?" draft that only the artist sends. Phone widths first.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132";
const output = path.resolve("docs/screenshots/booking-pipeline-board");
const widths = [320, 360, 375, 390, 414, 430, 768, 1366];
const threadId = "pitchthread000000001";
const base = { categories:["live music", "punk"], websites:["https://example.com/room"], discoveredAt:"2026-11-09T00:00:00.000Z" };
const venue = (key, name, booking, extra = {}) => ({ ...base, venueKey:key, name, address:`${name} St, Sacramento, CA`, booking:{ feeCurrency:"USD", ...booking }, ...extra });
const readyEpk = { ready:true, published:true, done:6, total:6, missing:[] };
const gatedEpk = { ready:false, published:false, done:4, total:6, missing:["A bio", "A live video or photo"] };
const stats = { sent:25, delivered:23, bounced:2, opened:14, replied:9, booked:4, replyRate:36, bookedRate:16 };
const noStats = { sent:0, delivered:0, bounced:0, opened:0, replied:0, booked:0, replyRate:null, bookedRate:null };
const workspace = (replied, epk = readyEpk, pitchStats = stats) => ({
  venues:[
    venue("aaaaaaaaaaaaaaaaaaaa", "Found Room", { status:"Not contacted", showDate:"2027-02-10" }),
    venue("bbbbbbbbbbbbbbbbbbbb", "Pitched Hall", replied
      ? { status:"Reply received", showDate:"2027-02-11", followUp:"2026-11-06", pipeline:{ stage:"replied", pitchedAt:"2026-11-01T10:00:00.000Z", repliedAt:"2026-11-03T09:00:00.000Z", threadId } }
      : { status:"Email sent", showDate:"2027-02-11", followUp:"2026-11-06", pipeline:{ stage:"pitched", pitchedAt:"2026-11-01T10:00:00.000Z", repliedAt:"", threadId } }, { emails:["booking@example.com"] }),
    venue("cccccccccccccccccccc", "Offer Club", { status:"Date proposed", showDate:"2027-02-12" }),
    venue("dddddddddddddddddddd", "Booked Basement", { status:"Confirmed", showDate:"2027-02-13", confirmationEvidence:"Promoter confirmed by email." })
  ],
  artist:{ name:"Pipeline Test", genre:"Punk", hometown:"Sacramento, CA", epk:"https://danzstak.com/epk.html?id=pipeline-test", pitch:"Loud and on time." },
  tour:{ currency:"USD", people:3, contingencyPercent:10 },
  revision:"rev-1",
  estimate:{ total:0, confirmedRevenue:0, potentialProfit:0, breakEvenRevenue:0, bookingEmailsUsd:0 },
  epk,
  stats:pitchStats
});

function installApi(page, state) {
  return page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    let body = {};
    if (url.pathname === "/booking-pipeline" && method === "GET") body = workspace(state.replied, state.epk || readyEpk, state.stats || stats);
    else if (url.pathname === "/booking-pipeline" && method === "POST") { state.saves.push(JSON.parse(request.postData() || "{}")); body = { revision:"rev-2", estimate:workspace().estimate, statuses:{} }; }
    else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys:["bbbbbbbbbbbbbbbbbbbb"] };
    else if (url.pathname === "/tour-manager/credits") body = { bookingEmailCredits:2, purchasedCredits:2, sentEmails:1, reservedCredits:0, activity:[] };
    else if (url.pathname === "/tour-manager/outreach") body = { messages:[{ id:threadId, venueKey:"bbbbbbbbbbbbbbbbbbbb", venueName:"Pitched Hall", recipient:"booking@example.com", subject:"Pipeline Test booking enquiry", status:state.replied ? "replied" : "sent", createdAt:"2026-11-01T10:00:00.000Z", sentAt:"2026-11-01T10:00:00.000Z", repliedAt:state.replied ? "2026-11-03T09:00:00.000Z" : "", followUpTo:"" }], replies:[] };
    else if (url.pathname === "/tour-manager/emails/send" || url.pathname === "/tour-manager/outreach/preflight") state.sendCalls++;
    else if (url.pathname === "/epk/outreach-share") body = { shares:[] };
    return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(body) });
  });
}

(async () => {
  fs.mkdirSync(output, { recursive:true });
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, serviceWorkers:"block" });
      const page = await context.newPage(), pageErrors = [], state = { replied:false, saves:[], sendCalls:0 };
      page.on("pageerror", error => pageErrors.push(error.message));
      await installApi(page, state);
      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      const pitched = page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"]');
      await pitched.waitFor({ state:"visible" });

      // Chips and stage labels.
      const chips = await page.locator("#pipelineFilters .pipeline-chip").allTextContents();
      assert.deepEqual(chips, ["All 4", "Found 1", "Pitched 1", "Offer 1", "Confirmed 1"], `${width}px filter chips`);
      assert.equal((await pitched.locator(".pipeline-stage span").textContent()).trim(), "Pitched");
      assert.equal(await pitched.locator(".pipeline-thread").getAttribute("href"), `messages.html?section=bookings&outreach=${threadId}`);

      // One step at a time on the card.
      const foundOptions = await page.locator('.venue-card[data-venue-key="aaaaaaaaaaaaaaaaaaaa"] select[aria-label="Booking status"] option').allTextContents();
      assert.deepEqual(foundOptions, ["Not contacted", "Email prepared", "Email sent"], `${width}px found card offers only the next step`);
      const confirmedOptions = await page.locator('.venue-card[data-venue-key="dddddddddddddddddddd"] select[aria-label="Booking status"] option').allTextContents();
      assert.ok(!confirmedOptions.includes("Played"), `${width}px Played must wait for the show date`);
      assert.ok(!confirmedOptions.includes("Date proposed"), `${width}px confirmed card cannot slide back`);

      // Follow up? appears after 5 days with an editable draft; nothing sends on its own.
      const followUp = pitched.locator(".booking-follow-up");
      await followUp.waitFor({ state:"visible" });
      assert.match(await followUp.textContent(), /Follow up\? No reply in 5 days/);
      const draft = followUp.locator("textarea");
      assert.match(await draft.inputValue(), /https:\/\/danzstak\.com\/epk\.html\?id=pipeline-test/);
      await draft.fill(`${await draft.inputValue()}\nP.S. We can bring a local opener.`);
      await page.waitForTimeout(400);
      assert.equal(state.sendCalls, 0, `${width}px a follow-up must never send without the artist's click`);

      // Filter to one stage.
      await page.locator('#pipelineFilters [data-stage="confirmed"]').click();
      assert.equal(await page.locator(".venue-card").count(), 1, `${width}px confirmed filter`);
      assert.equal(await page.locator('#pipelineFilters [data-stage="confirmed"]').getAttribute("aria-pressed"), "true");
      await page.locator('#pipelineFilters [data-stage="all"]').click();
      assert.equal(await page.locator(".venue-card").count(), 4);

      const geometry = await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chipHeights:[...document.querySelectorAll("#pipelineFilters .pipeline-chip, .pipeline-thread")].map(node => node.getBoundingClientRect().height)
      }));
      assert.ok(geometry.overflow <= 1, `${width}px board overflows by ${geometry.overflow}px`);
      assert.ok(Math.min(...geometry.chipHeights) >= 43.5, `${width}px chip/thread target is below 44px`);
      await pitched.scrollIntoViewIfNeeded();
      await page.screenshot({ path:path.join(output, `board-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });

      // Artist stats (task 07-C): every first pitch, with reply and booked rates.
      const statsPanel = page.locator(".pitch-stats");
      await statsPanel.waitFor({ state:"visible" });
      assert.deepEqual(await statsPanel.locator(".tour-manager-stats strong").allTextContents(), ["25", "23", "14", "9", "4"], `${width}px pitch numbers`);
      assert.deepEqual(await statsPanel.locator(".tour-manager-stats span").allTextContents(), ["Pitched", "Delivered", "EPK opened", "Replied", "Booked"]);
      assert.equal((await page.locator("#pitchStatsRates").textContent()).trim(), "36% reply rate · 16% booked · 2 bounced");
      const statsBox = await statsPanel.evaluate(node => { const box = node.getBoundingClientRect(); return { left:box.left, right:box.right, tiles:[...node.querySelectorAll(".tour-manager-stats div")].map(tile => tile.getBoundingClientRect().right) }; });
      assert.ok(statsBox.left >= 0 && statsBox.right <= width + 1 && Math.max(...statsBox.tiles) <= width + 1, `${width}px stats panel stays on screen`);
      await statsPanel.scrollIntoViewIfNeeded();
      await page.screenshot({ path:path.join(output, `stats-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });

      // A venue reply arrives (server derives it from the reply bridge): reload moves the card to Replied.
      state.replied = true;
      await page.locator("#loadBookingAccount").click();
      const confirm = page.locator("dialog[open] button, .app-dialog button").filter({ hasText:/Reload records/ });
      if (await confirm.count()) await confirm.first().click();
      await page.waitForFunction(() => document.querySelector('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] .pipeline-stage span')?.textContent.trim() === "Replied");
      assert.match(await pitched.locator(".booking-follow-up").textContent(), /This venue replied/, `${width}px a reply replaces the follow-up`);
      assert.deepEqual(await page.locator("#pipelineFilters .pipeline-chip").allTextContents(), ["All 4", "Found 1", "Replied 1", "Offer 1", "Confirmed 1"]);
      assert.deepEqual(pageErrors, [], `${width}px page errors: ${pageErrors.join(" | ")}`);
      if ([360, 375, 430].includes(width)) await page.screenshot({ path:path.join(output, `replied-${width}.png`), fullPage:true, animations:"disabled", caret:"hide" });
      await context.close();
    }
    // EPK gate: no published EPK with the minimum, no pitching; searching and the board stay open.
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, serviceWorkers:"block" });
      const page = await context.newPage(), pageErrors = [], state = { replied:false, saves:[], sendCalls:0, epk:gatedEpk, stats:noStats };
      page.on("pageerror", error => pageErrors.push(error.message));
      await installApi(page, state);
      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      const gate = page.locator("#epkGateCard");
      await gate.waitFor({ state:"visible" });
      assert.equal((await gate.locator("h2").textContent()).trim(), "Finish your EPK to start booking");
      assert.match(await gate.textContent(), /4 of 6 done/);
      assert.deepEqual(await gate.locator("li").allTextContents(), ["A bio", "A live video or photo", "Publish your EPK"]);
      assert.equal(await gate.locator("a").getAttribute("href"), "epk.html");
      assert.equal(await page.locator(".venue-card").count(), 4, `${width}px browsing stays open behind the EPK gate`);
      assert.equal(await page.evaluate(() => Boolean(document.getElementById("epkGateCard").compareDocumentPosition(document.getElementById("pipelineFilters")) & Node.DOCUMENT_POSITION_FOLLOWING)), true, `${width}px EPK gate must sit above the board filters`);
      assert.equal(await page.locator("#pipelineFilters .pipeline-chip").count(), 5);
      for (const pitch of await page.getByRole("button", { name:"Preview exact email" }).all()) assert.equal(await pitch.isDisabled(), true, `${width}px pitch must wait for the EPK`);
      for (const follow of await page.getByRole("button", { name:"Review one follow-up · 1 credit" }).all()) assert.equal(await follow.isDisabled(), true, `${width}px follow-up must wait for the EPK`);
      assert.equal(state.sendCalls, 0);
      assert.equal(await page.locator(".pitch-stats").isHidden(), true, `${width}px no stats panel before the first pitch`);
      const geometry = await page.evaluate(() => ({ overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth, link:document.querySelector("#epkGateCard a").getBoundingClientRect().height }));
      assert.ok(geometry.overflow <= 1, `${width}px EPK gate overflows by ${geometry.overflow}px`);
      assert.ok(geometry.link >= 43.5, `${width}px EPK builder link is below 44px`);
      assert.deepEqual(pageErrors, [], `${width}px page errors: ${pageErrors.join(" | ")}`);
      await gate.scrollIntoViewIfNeeded();
      await page.screenshot({ path:path.join(output, `epk-gate-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });
      await context.close();
    }
    console.log(`Booking pipeline board browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
