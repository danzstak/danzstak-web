"use strict";
// Spec 47 part 2 ("Send with", owner 2026-11-24: "artist might send a different to different venues or festivals").
// An artist with several published EPKs picks which one a pitch carries, on the venue card, at 320–430px and desktop:
// - the picker shows only with more than one published EPK, defaults to the EPK this venue got last time;
// - an EPK that isn't ready blocks Preview and says why; picking a ready one opens it again;
// - the venue link is made with the chosen EPK; the card says which EPK the venue got;
// - Italian: the words are Italian; centre taps reach the picker and the button.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || process.env.DANZSTAK_BOOKING_ORIGIN || "http://127.0.0.1:8037";
const output = path.resolve("docs/screenshots/booking-send-with");
fs.mkdirSync(output, { recursive:true });
const venue = { venueKey:"1234567890abcdef1234", name:"Test Room", address:"100 Music Way, Portland, OR", categories:["live music", "punk"], websites:["https://example.com"], emails:["booking@example.com"], booking:{ status:"Not contacted", showDate:"2027-03-12", followUp:"2027-03-01", feeCurrency:"USD", outreachDraft:"" } };
const artist = { name:"Road Test", genre:"Punk", hometown:"Seattle", epk:"https://danzstak.com/epk.html?id=road-test", pitch:"A direct live set for independent rooms." };
const epks = [
  { epkId:"main", label:"", artistName:"Road Test", ready:true },
  { epkId:"abcdef0123", label:"DJ set", artistName:"Road Test", ready:true },
  { epkId:"0123456789", label:"Festival", artistName:"Road Test", ready:false }
];

async function centreHits(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.height >= 43.5, `target is ${box && box.height}px tall`);
  const handle = await locator.elementHandle();
  return page.evaluate(([node, x, y]) => { const hit = document.elementFromPoint(x, y); return Boolean(hit && (hit === node || node.contains(hit))); }, [handle, box.x + box.width / 2, box.y + box.height / 2]);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless:true } : { channel:process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless:true });
  try {
    for (const [width, locale] of [[320, "en-US"], [360, "en-US"], [390, "en-US"], [430, "en-US"], [1280, "en-US"], [390, "it-IT"]]) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, deviceScaleFactor:1, locale });
      const page = await context.newPage(); const shareBodies = []; let shares = [{ outreachId:"oldpitchxxxxxxxx0001", venueKey:venue.venueKey, venueName:venue.name, shareId:"a".repeat(32), openCount:0, expiresAt:"2027-01-01T00:00:00.000Z", epkId:"abcdef0123" }];
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), pathname = new URL(request.url()).pathname;
        let body = {};
        if (pathname === "/booking-pipeline" && request.method() === "GET") body = { venues:[structuredClone(venue)], artist, tour:{ currency:"USD" }, revision:"r1", epk:{ ready:true, published:true, done:6, total:6, missing:[] }, epks };
        else if (pathname === "/booking-pipeline" && request.method() === "POST") body = { revision:"r2", estimate:{} };
        else if (pathname === "/tour-manager/credits") body = { bookingEmailCredits:2, purchasedCredits:2, sentEmails:0, reservedCredits:0, activity:[] };
        else if (pathname === "/tour-manager/outreach") body = { messages:[], replies:[] };
        else if (pathname === "/tour-manager/outreach/preflight") body = { footer:`DanzStak LLC, 2063 Main St. #237, Oakley, CA 94561, USA\nDon't want booking pitches through DanzStak? Opt out: https://danzstak.com/booking-opt-out.html#token=${"b".repeat(64)}` };
        else if (pathname === "/epk/outreach-share" && request.method() === "GET") body = { shares };
        else if (pathname === "/epk/outreach-share" && request.method() === "POST") { const draft = JSON.parse(request.postData() || "{}"); shareBodies.push(draft); body = draft.action === "revoke" ? { revoked:true } : { outreachId:draft.outreachId, venueKey:draft.venueKey, epkId:draft.epkId, shareId:"1".repeat(32), shareUrl:`https://danzstak.com/epk.html?outreach=${"1".repeat(32)}#token=${"c".repeat(64)}`, expiresAt:"2027-02-01T00:00:00.000Z" }; }
        else if (pathname === "/tour-manager/contact-unlocks") body = { venueKeys:[venue.venueKey] };
        await route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(body) });
      });
      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      const picker = page.locator(".booking-send-with select");
      await picker.waitFor({ timeout:15000 });
      const it = locale === "it-IT";
      // The card says which EPK the venue got last time, and the picker starts there.
      const sentLine = page.locator(".booking-sent-with");
      assert.match(await sentLine.textContent(), it ? /Inviato con\s+Road Test · DJ set/ : /Sent with\s+Road Test · DJ set/);
      assert.equal(await picker.inputValue(), "abcdef0123", "the default is the EPK this venue got last time");
      assert.match(await page.locator(".booking-send-with").textContent(), it ? /Invia con/ : /Send with/);
      assert.deepEqual(await picker.locator("option").allTextContents(), ["Road Test", "Road Test · DJ set", "Road Test · Festival"]);
      assert.ok(await centreHits(page, picker), `${width}px: a centre tap reaches the picker`);
      const preview = page.locator(".outreach > button").filter({ hasText:it ? /./ : "Preview exact email" }).first();
      // An EPK that isn't ready blocks Preview and says why.
      await picker.selectOption("0123456789");
      assert.equal(await preview.isDisabled(), true, "an unready EPK can't be sent");
      assert.match(await page.locator(".outreach small").last().textContent(), it ? /non è pronto/ : /isn't ready to send/);
      await picker.selectOption("main");
      assert.equal(await preview.isEnabled(), true);
      assert.ok(await centreHits(page, preview), `${width}px: a centre tap reaches Preview`);
      const layout = await page.evaluate(() => ({ scroll:document.documentElement.scrollWidth, client:document.documentElement.clientWidth }));
      assert.ok(layout.scroll <= layout.client + 1, `${width}px overflows sideways`);
      if (width === 390) { await picker.scrollIntoViewIfNeeded(); await page.screenshot({ path:path.join(output, `send-with-${locale}-390.png`) }); }
      if (!it) {
        // The pitch's venue link is made with the EPK picked: the original one.
        await page.getByRole("button", { name:"Apply template to draft" }).click();
        await preview.click();
        const dialog = page.locator(".booking-send-review"); await dialog.waitFor();
        assert.equal(shareBodies.at(-1).epkId, "main", "the venue link carries the chosen EPK");
        const revoked = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/epk/outreach-share") && /"revoke"/.test(request.postData() || ""));
        await dialog.getByRole("button", { name:"Keep editing" }).click();
        await revoked;
        await page.waitForFunction(() => !document.querySelector(".booking-send-review") && !document.querySelector(".outreach > button[disabled]"));
        // Picking the DJ set sends the DJ set.
        await picker.selectOption("abcdef0123");
        await preview.click(); await page.locator(".booking-send-review").waitFor();
        assert.equal(shareBodies.filter(item => item.action === "create").at(-1).epkId, "abcdef0123");
      }
      await context.close();
    }
    // One published EPK: no picker.
    const context = await browser.newContext({ viewport:{ width:390, height:900 } }), page = await context.newPage();
    await page.route("https://api.danzstak.com/**", route => { const p = new URL(route.request().url()).pathname; route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(p === "/booking-pipeline" ? { venues:[structuredClone(venue)], artist, tour:{ currency:"USD" }, revision:"r1", epk:{ ready:true, published:true, done:6, total:6, missing:[] }, epks:[epks[0]] } : p === "/tour-manager/contact-unlocks" ? { venueKeys:[venue.venueKey] } : p === "/epk/outreach-share" ? { shares:[] } : {}) }); });
    await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
    await page.locator(".outreach").first().waitFor();
    await page.waitForTimeout(500);
    assert.equal(await page.locator(".booking-send-with").count(), 0, "one EPK, no picker");
    await context.close();
    console.log("Booking Send with browser checks passed at 320, 360, 390, 430, 1280px and in Italian.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
