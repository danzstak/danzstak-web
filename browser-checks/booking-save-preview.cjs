"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const output = path.resolve("docs/screenshots/booking-save-preview");
const venueKey = "a".repeat(20);
const privateToken = "b".repeat(64);
const footerToken = "c".repeat(64);
fs.mkdirSync(output, { recursive:true });

const startingWorkspace = () => ({
  revision:"revision-1",
  artist:{
    name:"Road Test",
    genre:"Punk, Garage rock",
    hometown:"Tacoma, WA",
    epk:"https://danzstak.com/epk.html?id=road-test",
    pitch:"A direct live set for independent rooms."
  },
  tour:{ currency:"USD", people:1, contingencyPercent:10 },
  venues:[{
    venueKey,
    name:"Road Room",
    address:"100 Tour Ave, Tacoma, WA",
    position:[-122.44, 47.25],
    categories:["Live music venue", "Punk"],
    websites:["https://example.com/road-room"],
    emails:["booking@example.com"],
    phones:["+12535550100"],
    sources:[{ name:"Official venue website", url:"https://example.com/road-room" }],
    activityEvidence:"Current live calendar found",
    discoveredAt:"2026-11-09T00:00:00.000Z",
    booking:{ status:"Not contacted", feeCurrency:"USD" }
  }]
});

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:width < 700 ? 844 : 900 }, serviceWorkers:"block", reducedMotion:"reduce" });
      const page = await context.newPage();
      const errors = [];
      const order = [];
      let workspace = startingWorkspace();
      let saveCount = 0;
      let shareCount = 0;
      let sendCount = 0;
      let lastSend = null;
      let failNextSave = width === 390;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        let status = 200;
        let body = {};
        if (url.pathname === "/booking-pipeline" && method === "GET") body = workspace;
        else if (url.pathname === "/booking-pipeline" && method === "POST") {
          order.push("save");
          saveCount += 1;
          if (failNextSave) {
            failNextSave = false;
            status = 503;
            body = { error:"Controlled save failure. Try again." };
          } else {
            workspace = { ...request.postDataJSON(), revision:`revision-${saveCount + 1}`, estimate:null };
            body = { revision:workspace.revision, estimate:null };
          }
        } else if (url.pathname === "/tour-manager/credits") body = { bookingEmailCredits:1, purchasedCredits:1, sentEmails:0, reservedCredits:0, activity:[] };
        else if (url.pathname === "/tour-manager/outreach") body = { messages:lastSend ? [{ id:lastSend.idempotencyKey, venueKey, venueName:"Road Room", recipient:lastSend.to, subject:lastSend.subject, status:"sent", createdAt:"2026-11-09T00:00:00.000Z" }] : [], replies:[] };
        else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys:[venueKey] };
        else if (url.pathname === "/epk/outreach-share" && method === "GET") body = { shares:[] };
        else if (url.pathname === "/epk/outreach-share" && method === "POST") {
          const payload = request.postDataJSON();
          if (payload.action === "create") {
            order.push("share");
            shareCount += 1;
            body = { shareUrl:`https://danzstak.com/epk.html?outreach=${payload.outreachId}#token=${privateToken}` };
          } else body = { revoked:true };
        } else if (url.pathname === "/tour-manager/outreach/preflight") {
          order.push("preflight");
          body = { footer:`DanzStak LLC, 2063 Main St. #237, Oakley, CA 94561, USA\nReply or offer dates securely: https://danzstak.com/booking-reply.html#token=${footerToken}\nDon't want booking pitches through DanzStak? Opt out: https://danzstak.com/booking-opt-out.html#token=${footerToken}` };
        } else if (url.pathname === "/tour-manager/emails/send") {
          order.push("send");
          sendCount += 1;
          lastSend = request.postDataJSON();
          body = { status:"sent", accepted:true };
        }
        await route.fulfill({ status, contentType:"application/json", body:JSON.stringify(body) });
      });

      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      const card = page.locator("#selectedVenueCards article", { hasText:"Road Room" });
      await card.waitFor({ state:"visible" });
      await page.locator('input[aria-label="Proposed show date"]').fill("2027-01-10");
      await page.locator('input[aria-label="Proposed show date"]').dispatchEvent("change");
      const preview = page.getByRole("button", { name:"Preview exact email" });
      assert.equal(await preview.isEnabled(), true, `${width}px unlocked contact must allow pitch review`);
      assert.match(await card.locator(".outreach > small").first().textContent(), /saves your current pitch before review/i, `${width}px must explain the one-action save`);

      await preview.click();
      if (width === 390) {
        await page.locator("#bookingAccountStatus").filter({ hasText:"Controlled save failure" }).waitFor();
        assert.equal(shareCount, 0, "a failed workspace save must not create a private share");
        assert.equal(sendCount, 0, "a failed workspace save must not send email");
        await page.getByRole("button", { name:"Preview exact email" }).click();
      }

      const dialog = page.locator("dialog.booking-send-review");
      await dialog.waitFor({ state:"visible" });
      const exact = await dialog.locator("pre").textContent();
      assert.match(exact, new RegExp(`https://danzstak\\.com/epk\\.html\\?outreach=[a-f0-9]{32}#token=${privateToken}`), `${width}px review must contain the private venue EPK link`);
      assert.doesNotMatch(exact, /epk\.html\?id=road-test/, `${width}px review must replace the public EPK link`);
      assert.match(exact, /DanzStak LLC, 2063 Main St\. #237, Oakley, CA 94561, USA/, `${width}px review must contain the required postal footer`);
      assert.match(exact, /booking-opt-out\.html#token=/, `${width}px review must contain the opt-out link`);
      assert.match(await dialog.locator("dl").textContent(), /booking@example\.com[\s\S]*1 booking-email credit/, `${width}px review must show the exact recipient and cost`);
      const approve = dialog.getByRole("button", { name:"Approve and send · 1 credit" });
      assert.equal(await approve.isDisabled(), true, `${width}px send must remain disabled before approval`);
      const geometry = await dialog.evaluate(node => ({
        documentWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        dialogWidth:node.getBoundingClientRect().width,
        viewportWidth:innerWidth,
        targets:[...node.querySelectorAll("button, .booking-send-approval")].map(item => item.getBoundingClientRect().height)
      }));
      assert.ok(geometry.documentWidth <= geometry.clientWidth + 1, `${width}px pitch review overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.dialogWidth <= geometry.viewportWidth, `${width}px pitch review exceeds the viewport: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.targets.every(height => height >= 44), `${width}px pitch review targets must be 44px: ${JSON.stringify(geometry.targets)}`);
      await page.screenshot({ path:path.join(output, `pitch-review-${width}.png`), fullPage:true });

      await dialog.locator('input[type="checkbox"]').check();
      assert.equal(await approve.isEnabled(), true, `${width}px explicit approval must enable send`);
      await approve.click();
      await dialog.waitFor({ state:"detached" });
      await page.locator("#selectedVenueCards article", { hasText:"Email accepted by the provider" }).waitFor();
      assert.equal(sendCount, 1, `${width}px approved review must send exactly once`);
      assert.ok(saveCount >= 2, `${width}px must save before review and persist the sent status`);
      assert.ok(order.indexOf("save") < order.indexOf("share"), `${width}px workspace save must precede private-share creation: ${order.join(" → ")}`);
      assert.ok(order.indexOf("share") < order.indexOf("preflight") && order.indexOf("preflight") < order.indexOf("send"), `${width}px outreach order is unsafe: ${order.join(" → ")}`);
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      await context.close();
    }
    console.log(`Booking save-and-preview browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
