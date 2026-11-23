"use strict";

// Task 07-D: "Dates they offered" on replied/offer cards and the route-aware date picker.
// Phone widths first. The picker only suggests; nothing is saved or sent from it.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132";
const output = path.resolve("docs/screenshots/booking-route-dates");
const widths = [320, 360, 375, 390, 414, 430, 768, 1366];
const base = { categories:["live music", "punk"], websites:["https://example.com/room"], discoveredAt:"2026-11-09T00:00:00.000Z" };
const venue = (key, name, position, booking) => ({ ...base, venueKey:key, name, address:`${name} St`, position, booking:{ feeCurrency:"USD", ...booking } });
const workspace = () => ({
  venues:[
    venue("aaaaaaaaaaaaaaaaaaaa", "Reno Room", [-119.81, 39.53], { status:"Date proposed", showDate:"2027-03-07", dateOptions:["2027-03-02", "2027-03-07"], pipeline:{ stage:"offer", repliedAt:"2026-11-01T00:00:00.000Z" } }),
    venue("bbbbbbbbbbbbbbbbbbbb", "SF Basement", [-122.42, 37.77], { status:"Reply received", dateOptions:["2027-03-02", "2027-03-03"], pipeline:{ stage:"replied", repliedAt:"2026-11-03T00:00:00.000Z", threadId:"sfthread000000000001" } }),
    venue("cccccccccccccccccccc", "Oakland Hall", [-122.27, 37.80], { status:"Confirmed", showDate:"2027-03-03", confirmationEvidence:"Promoter confirmed by email." }),
    venue("dddddddddddddddddddd", "Portland Pit", [-122.68, 45.52], { status:"Interested", dateOptions:["2027-03-04"], pipeline:{ stage:"replied", repliedAt:"2026-11-02T00:00:00.000Z" } }),
    { ...venue("eeeeeeeeeeeeeeeeeeee", "Waiting Room", [-121.30, 38.70], { status:"Date proposed", showDate:"2027-03-08", dateOptions:["2027-03-08"], acceptedDate:"2027-03-08", acceptedAt:"2026-11-01T00:00:00.000Z", pipeline:{ stage:"offer", repliedAt:"2026-10-30T00:00:00.000Z", threadId:"waitthread0000000001" } }), phones:["(916) 555-0100"] }
  ],
  artist:{ name:"Route Test", genre:"Punk", hometown:"Sacramento, CA", epk:"https://danzstak.com/epk.html?id=route-test", pitch:"Loud and on time." },
  tour:{ currency:"USD", people:3, contingencyPercent:10, departOn:"2027-03-01", returnBy:"2027-03-10" },
  revision:"rev-1",
  estimate:{ total:0, confirmedRevenue:0, potentialProfit:0, breakEvenRevenue:0, bookingEmailsUsd:0 },
  epk:{ ready:true, published:true, done:6, total:6, missing:[] },
  stats:{ sent:4, delivered:4, bounced:0, opened:3, replied:3, booked:1, replyRate:75, bookedRate:25 }
});
const routeDates = {
  settings:{ maxDriveHours:6, nightsInARow:5 }, window:{ start:"2027-03-01", end:"2027-03-10" }, home:{ name:"Sacramento, CA", position:[-121.49, 38.58] },
  plan:[
    { venueKey:"bbbbbbbbbbbbbbbbbbbb", name:"SF Basement", date:"2027-03-02", fixed:false, position:[-122.42, 37.77], driveMiles:87.4, driveHours:1.6 },
    { venueKey:"cccccccccccccccccccc", name:"Oakland Hall", date:"2027-03-03", fixed:true, position:[-122.27, 37.80], driveMiles:12.1, driveHours:0.4 },
    { venueKey:"aaaaaaaaaaaaaaaaaaaa", name:"Reno Room", date:"2027-03-07", fixed:false, position:[-119.81, 39.53], driveMiles:218.6, driveHours:3.5 }
  ],
  returnLeg:{ from:"Reno Room", to:"Home", miles:132.2, hours:2.2 },
  unplaced:[{ venueKey:"dddddddddddddddddddd", name:"Portland Pit", reason:"Too far: about 12.8 h from Oakland Hall, more than 6 h a day." }],
  conflicts:[{ kind:"long_drive", text:"7.1 h drive from Oakland Hall to Reno Room the day of the show." }],
  gaps:[{ after:"Oakland Hall", before:"Reno Room", from:"2027-03-04", to:"2027-03-06", nights:3, near:[-121, 38.7] }],
  totals:{ shows:3, miles:450.3, hours:7.7, baselineShows:3, baselineMiles:612.9, savedMiles:162.6, estimated:false }
};

function installApi(page, state) {
  return page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    let body = {};
    if (url.pathname === "/booking-pipeline" && method === "GET") body = workspace();
    else if (url.pathname === "/booking-pipeline" && method === "POST") {
      const data = JSON.parse(request.postData() || "{}");
      if (data.action === "route_dates") { state.routeCalls.push(data); body = { routeDates }; }
      else if (data.action === "accept_date") { state.accepts.push(data); body = { accepted:true, venueKey:data.venueKey, date:data.date, status:"Date proposed", revision:"rev-3" }; }
      else { state.saves.push(data); body = { revision:"rev-2", estimate:workspace().estimate, statuses:{} }; }
    }
    else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys:[] };
    else if (url.pathname === "/tour-manager/credits") body = { bookingEmailCredits:2, purchasedCredits:2, sentEmails:1, reservedCredits:0, activity:[] };
    else if (url.pathname === "/tour-manager/outreach") body = { messages:[], replies:[] };
    else if (url.pathname === "/tour-manager/outreach/reply") { state.replies.push(JSON.parse(request.postData() || "{}")); body = { status:"sent" }; }
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
      const page = await context.newPage(), pageErrors = [], state = { saves:[], routeCalls:[], sendCalls:0, accepts:[], replies:[] };
      page.on("pageerror", error => pageErrors.push(error.message));
      await installApi(page, state);
      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      await page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"]').waitFor({ state:"visible" });

      // Dates they offered: on replied/offer cards only.
      const sf = page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] .date-options');
      assert.deepEqual((await sf.locator(".date-option-list li").allTextContents()).map(text => text.replace("×", "")), ["2027-03-02", "2027-03-03"], `${width}px SF date options`);
      assert.equal(await page.locator('.venue-card[data-venue-key="cccccccccccccccccccc"] .date-options').count(), 0, `${width}px confirmed card has no date options`);

      // The picker: sends only settings and home base; shows the plan, conflicts, misses and gaps.
      const panel = page.locator(".route-dates");
      await panel.waitFor({ state:"visible" });
      assert.equal(await page.locator("#routeHome").inputValue(), "Sacramento, CA", `${width}px home base prefilled from home town`);
      await page.locator("#routeMaxDrive").fill("7");
      await page.locator("#routeDatesButton").click();
      await page.locator(".route-plan li").first().waitFor({ state:"visible" });
      assert.deepEqual(state.routeCalls, [{ action:"route_dates", home:"Sacramento, CA", settings:{ maxDriveHours:7, nightsInARow:5 } }]);
      assert.match(await page.locator(".route-summary").textContent(), /^3 shows · 450 mi round trip, about 8 h driving · 163 mi less driving than taking dates first-come$/);
      assert.equal(await page.locator(".route-plan li").count(), 4, `${width}px three shows and the drive home`);
      assert.match(await page.locator(".route-plan li").nth(1).textContent(), /Oakland Hall.*confirmed/);
      assert.match(await page.locator(".route-conflicts").textContent(), /7\.1 h drive from Oakland Hall to Reno Room/);
      assert.match(await page.locator(".route-unplaced").textContent(), /Portland Pit: Too far/);
      assert.match(await page.locator(".route-gaps").textContent(), /3 open nights between Oakland Hall and Reno Room/);
      assert.equal(state.saves.length, 0, `${width}px suggesting dates never saves`);
      assert.equal(state.sendCalls, 0, `${width}px suggesting dates never sends`);

      const geometry = await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
        targets:[...document.querySelectorAll(".route-dates-form input, .route-dates-form button, .route-gaps a, .date-option-remove, .date-option-add input, .date-option-add select, .date-option-add button")].filter(node => node.offsetParent).map(node => Math.round(node.getBoundingClientRect().height)),
        small:[...document.querySelectorAll(".route-dates-form input, .route-dates-form button, .route-gaps a, .date-option-remove, .date-option-add input, .date-option-add select, .date-option-add button")].filter(node => node.offsetParent && node.getBoundingClientRect().height < 44).map(node => `${node.tagName}.${node.className}[${node.getAttribute("aria-label") || node.textContent}]=${Math.round(node.getBoundingClientRect().height)}`)
      }));
      assert.ok(geometry.overflow <= 1, `${width}px page overflows by ${geometry.overflow}px`);
      assert.ok(Math.min(...geometry.targets) >= 44, `${width}px a picker or date control is below 44px: ${geometry.small.join(", ")}`);
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path:path.join(output, `picker-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });

      // 07-E: accept the dates. One editable confirmation per club; nothing sends before a tick and a click.
      const sfAccept = page.locator('.route-accept-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"]');
      assert.match(await sfAccept.locator("textarea").inputValue(), /lock in .*Mar 2, 2027 at SF Basement/);
      const sendConfirmation = sfAccept.getByRole("button", { name:"Send confirmation" });
      assert.equal(await sendConfirmation.isDisabled(), true, `${width}px confirmation waits for the artist's review`);
      assert.equal(await page.locator('.route-accept-card[data-venue-key="cccccccccccccccccccc"]').count(), 0, `${width}px a confirmed show needs no acceptance`);
      await sfAccept.getByRole("checkbox").check();
      await sendConfirmation.click();
      await page.locator('.route-accept-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"].route-accept-done').waitFor({ state:"visible" });
      assert.equal(state.replies.length, 1); assert.equal(state.replies[0].outreachId, "sfthread000000000001");
      assert.match(state.replies[0].content, /^Hello SF Basement booking team/);
      assert.deepEqual(state.accepts[0], { action:"accept_date", venueKey:"bbbbbbbbbbbbbbbbbbbb", date:"2027-03-02", sentReplyId:state.replies[0].clientMessageId });
      assert.match(await page.locator('.route-accept-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"]').textContent(), /Waiting for SF Basement to confirm/);
      assert.match(await page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] .date-accepted').textContent(), /You accepted 2027-03-02\. Waiting for the club to confirm in writing/);
      assert.equal(await page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] select[aria-label="Booking status"]').inputValue(), "Date proposed", `${width}px accepted, not Confirmed`);
      const renoAccept = page.locator('.route-accept-card[data-venue-key="aaaaaaaaaaaaaaaaaaaa"]');
      assert.match(await renoAccept.textContent(), /No DanzStak booking thread with this club/);
      await renoAccept.getByRole("button", { name:"Save date only" }).click();
      await page.locator('.route-accept-card[data-venue-key="aaaaaaaaaaaaaaaaaaaa"].route-accept-done').waitFor({ state:"visible" });
      assert.deepEqual(state.accepts[1], { action:"accept_date", venueKey:"aaaaaaaaaaaaaaaaaaaa", date:routeDates.plan[2].date });
      assert.equal(state.replies.length, 1, `${width}px saving a date only sends nothing`);
      assert.equal(state.sendCalls, 0, `${width}px confirmations never spend a credit`);
      await page.locator(".route-accept").scrollIntoViewIfNeeded();
      if ([320, 390, 1366].includes(width)) await page.screenshot({ path:path.join(output, `accept-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });

      // No written OK after 3 days: one follow-up (artist approves) and a call; a phone OK is recorded as evidence.
      const chase = page.locator('.venue-card[data-venue-key="eeeeeeeeeeeeeeeeeeee"] .confirm-chase');
      await chase.waitFor({ state:"visible" });
      assert.equal(await chase.locator('a[href^="tel:"]').getAttribute("href"), "tel:9165550100");
      const sendFollowUp = chase.getByRole("button", { name:"Send follow-up" });
      assert.equal(await sendFollowUp.isDisabled(), true);
      await chase.getByRole("checkbox").check();
      await sendFollowUp.click();
      await page.waitForFunction(() => /Follow-up sent/.test(document.querySelector('.venue-card[data-venue-key="eeeeeeeeeeeeeeeeeeee"] .confirm-chase')?.textContent || ""));
      assert.equal(state.replies.at(-1).outreachId, "waitthread0000000001");
      assert.ok(state.saves.at(-1).venues.find(item => item.venueKey === "eeeeeeeeeeeeeeeeeeee").booking.confirmFollowUpAt, `${width}px the follow-up is saved so it's sent once`);
      const chased = page.locator('.venue-card[data-venue-key="eeeeeeeeeeeeeeeeeeee"] .confirm-chase');
      assert.equal(await chased.getByRole("button", { name:"Send follow-up" }).count(), 0, `${width}px only one follow-up`);
      for (const control of await chased.locator("a, button, input:not([type=checkbox])").all()) assert.ok((await control.boundingBox()).height >= 43.5, `${width}px chase target below 44px`);
      await chased.scrollIntoViewIfNeeded();
      if ([320, 390, 1366].includes(width)) await page.screenshot({ path:path.join(output, `chase-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });
      await chased.getByRole("textbox", { name:"Who confirmed by phone" }).fill("Mo, booker");
      await chased.getByRole("button", { name:"They confirmed by phone" }).click();
      await page.waitForFunction(() => !document.querySelector('.venue-card[data-venue-key="eeeeeeeeeeeeeeeeeeee"] .confirm-chase'));
      const phoned = state.saves.at(-1).venues.find(item => item.venueKey === "eeeeeeeeeeeeeeeeeeee").booking;
      assert.equal(phoned.status, "Confirmed");
      assert.match(phoned.confirmationEvidence, /^Confirmed by phone with Mo, booker on \d{4}-\d{2}-\d{2} for 2027-03-08 \(recorded by the artist\)\.$/);

      // Add one date and a weekday run on the SF card; remove one. Unsaved edits block the picker.
      await sf.locator('input[aria-label="Date they offered"]').fill("2027-03-07");
      await sf.getByRole("button", { name:"Add date" }).click();
      const sfAfter = page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] .date-options');
      await sfAfter.locator('select[aria-label="Weekday they offered"]').selectOption("4");
      await sfAfter.locator('input[aria-label="From"]').fill("2027-03-01");
      await sfAfter.locator('input[aria-label="To"]').fill("2027-03-20");
      await sfAfter.getByRole("button", { name:"Add these" }).click();
      const sfRun = page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] .date-options');
      assert.deepEqual((await sfRun.locator(".date-option-list li").allTextContents()).map(text => text.replace("×", "")), ["2027-03-02", "2027-03-03", "2027-03-04", "2027-03-07", "2027-03-11", "2027-03-18"], `${width}px Thursdays added`);
      await sfRun.getByRole("button", { name:"Remove 2027-03-03" }).click();
      assert.equal(await page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] .date-option-list li').count(), 5);
      await page.locator("#routeDatesButton").click();
      await page.waitForTimeout(200);
      assert.equal(state.routeCalls.length, 1, `${width}px unsaved date edits must be saved before picking`);
      await page.locator('.venue-card[data-venue-key="bbbbbbbbbbbbbbbbbbbb"] .date-options').scrollIntoViewIfNeeded();
      if ([320, 390, 1366].includes(width)) await page.screenshot({ path:path.join(output, `date-options-${width}.png`), fullPage:false, animations:"disabled", caret:"hide" });
      assert.deepEqual(pageErrors, [], `${width}px page errors: ${pageErrors.join(" | ")}`);
      await context.close();
    }
    console.log(`Booking route date picker browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
