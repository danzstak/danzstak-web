"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || process.env.DANZSTAK_BOOKING_ORIGIN || "http://127.0.0.1:8037";
const output = path.resolve("docs/screenshots/booking-pitch-review");
fs.mkdirSync(output, { recursive:true });
const venue = { venueKey:"1234567890abcdef1234", name:"Test Room", address:"100 Music Way, Portland, OR", categories:["live music", "punk"], websites:["https://example.com"], emails:["booking@example.com"], booking:{ status:"Not contacted", showDate:"2027-03-12", feeCurrency:"USD", outreachDraft:"" } };
const artist = { name:"Road Test", genre:"Punk", hometown:"Seattle", epk:"https://danzstak.com/epk.html?id=road-test", pitch:"A direct live set for independent rooms." };

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of [320,360,390,414,430,1366]) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, deviceScaleFactor:1 });
      const page = await context.newPage(); let sendPayload = null, revision = "revision-1";
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
        let body = {};
        if (pathname === "/booking-pipeline" && request.method() === "GET") body = { venues:[structuredClone(venue)], artist, tour:{ currency:"USD" }, revision };
        else if (pathname === "/booking-pipeline" && request.method() === "POST") { revision = "revision-2"; body = { revision, estimate:{} }; }
        else if (pathname === "/tour-manager/credits") body = { bookingEmailCredits:2, purchasedCredits:2, sentEmails:0, reservedCredits:0, activity:[] };
        else if (pathname === "/tour-manager/outreach") body = { messages:[] };
        else if (pathname === "/tour-manager/outreach/preflight") body = { footer:`DanzStak LLC, 2063 Main St. #237, Oakley, CA 94561, USA\nDon't want booking pitches through DanzStak? Opt out: https://danzstak.com/booking-opt-out.html#token=${"b".repeat(64)}`, suppressionChecked:true };
        else if (pathname === "/epk/outreach-share" && request.method() === "GET") body = { shares:[] };
        else if (pathname === "/epk/outreach-share" && request.method() === "POST") { const draft = JSON.parse(request.postData() || "{}"); body = draft.action === "revoke" ? { revoked:true } : { outreachId:draft.outreachId, venueKey:draft.venueKey, shareId:"1234567890abcdef1234567890abcdef", shareUrl:`https://danzstak.com/epk.html?outreach=1234567890abcdef1234567890abcdef#token=${"a".repeat(64)}`, permissions:{allowPdf:draft.allowPdf === true} }; }
        else if (pathname === "/tour-manager/contact-unlocks") body = { venueKeys:[venue.venueKey] };
        else if (pathname === "/tour-manager/emails/send") { sendPayload = JSON.parse(request.postData() || "{}"); body = { status:"sent", messageId:"browser-test-message" }; }
        else body = {};
        await route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(body) });
      });
      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      await page.locator("#bookingAccountStatus").filter({ hasText:"loaded" }).waitFor();
      const dimensions = await page.evaluate(() => ({ scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, minTarget:Math.min(...[...document.querySelectorAll(".outreach button,.outreach input:not([type=checkbox]),.outreach select,.pitch-permission")].filter(node => getComputedStyle(node).display !== "none").map(node => node.getBoundingClientRect().height)) }));
      assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${width}px booking workspace overflows`);
      if (width <= 430) assert.ok(dimensions.minTarget >= 43.5, `${width}px outreach target is ${dimensions.minTarget}px`);
      await page.getByLabel("Pitch type").selectOption("dj");
      await page.getByLabel("Expected crowd — artist supplied (optional)").fill("75");
      await page.getByLabel("Set or performance details (optional)").fill("75-minute vinyl and live-hardware set");
      await page.getByRole("button", { name:"Apply template to draft" }).click();
      await page.getByRole("button", { name:"Save to account" }).click();
      await page.locator("#bookingAccountStatus").filter({ hasText:"Saved privately" }).waitFor();
      await page.getByRole("button", { name:"Preview exact email" }).click();
      const dialog = page.locator(".booking-send-review"); await dialog.waitFor();
      assert.equal(await dialog.getByText("booking@example.com", { exact:true }).count(), 1);
      assert.match(await dialog.locator("pre").textContent(), /Artist-entered expected draw: 75 people/);
      assert.match(await dialog.locator("pre").textContent(), /DanzStak LLC, 2063 Main St\. #237, Oakley, CA 94561, USA/);
      assert.match(await dialog.locator("pre").textContent(), /booking-opt-out\.html#token=b{64}/);
      const confirm = dialog.getByRole("button", { name:"Approve and send · 1 credit" });
      assert.equal(await confirm.isDisabled(), true);
      await dialog.getByLabel("I reviewed this exact recipient and message and approve sending it.").check();
      assert.equal(await confirm.isEnabled(), true);
      if (width === 390) await page.screenshot({ path:path.join(output, "booking-email-review-390.png"), fullPage:false });
      const sentResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/tour-manager/emails/send");
      await confirm.click();
      await sentResponse;
      assert.equal(sendPayload?.artistApproved, true); assert.equal(sendPayload?.template, "dj"); assert.equal(sendPayload?.to, "booking@example.com"); assert.match(sendPayload?.message || "", /EPK: https:\/\/danzstak\.com\/epk\.html\?outreach=1234567890abcdef1234567890abcdef#token=/); assert.match(sendPayload?.message || "", /booking-opt-out\.html#token=b{64}/); assert.ok(/^[a-f0-9]{32}$/.test(sendPayload?.idempotencyKey || ""));
      await page.evaluate(() => window.scrollTo(0, document.querySelector(".outreach").getBoundingClientRect().top + window.scrollY - 10));
      await page.screenshot({ path:path.join(output, `booking-pitch-${width}.png`), fullPage:false });
      await context.close();
    }
    console.log("Booking pitch browser checks passed at 320, 360, 390, 414, 430, 1366px.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
