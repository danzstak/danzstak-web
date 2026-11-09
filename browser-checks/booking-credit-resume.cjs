"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const output = path.resolve("docs/screenshots/booking-credit-resume");
const venueKey = "d".repeat(20);
const privateToken = "e".repeat(64);
const footerToken = "f".repeat(64);
fs.mkdirSync(output, { recursive:true });

const startingWorkspace = () => ({
  revision:"revision-1",
  artist:{
    name:"Credit Return Test",
    genre:"Punk",
    hometown:"Tacoma, WA",
    epk:"https://danzstak.com/epk.html?id=credit-return-test",
    pitch:"A direct live set for independent rooms."
  },
  tour:{ currency:"USD", people:1, contingencyPercent:10 },
  venues:[{
    venueKey,
    name:"Credit Room",
    address:"100 Tour Ave, Tacoma, WA",
    position:[-122.44, 47.25],
    categories:["Live music venue", "Punk"],
    websites:["https://example.com/credit-room"],
    emails:["booking@example.com"],
    phones:["+12535550100"],
    sources:[{ name:"Official venue website", url:"https://example.com/credit-room" }],
    activityEvidence:"Current live calendar found",
    discoveredAt:"2026-11-09T00:00:00.000Z",
    booking:{ status:"Not contacted", showDate:"2027-01-10", feeCurrency:"USD" }
  }]
});

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:width < 700 ? 844 : 900 }, serviceWorkers:"block", reducedMotion:"reduce" });
      const page = await context.newPage();
      const errors = [];
      let workspace = startingWorkspace();
      let checkoutPayload = null;
      let creditChecks = 0;
      let settlementStarted = false;
      let credits = 0;
      let sendAttempts = 0;
      let successfulSends = 0;
      let shareCreates = 0;
      let shareRevokes = 0;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://checkout.stripe.com/**", route => route.fulfill({ status:200, contentType:"text/html", body:"<!doctype html><title>Stripe test checkout</title><p>Controlled Stripe test page</p>" }));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        let status = 200;
        let body = {};
        if (url.pathname === "/booking-pipeline" && method === "GET") body = workspace;
        else if (url.pathname === "/booking-pipeline" && method === "POST") {
          workspace = { ...request.postDataJSON(), revision:"revision-saved", estimate:null };
          body = { revision:workspace.revision, estimate:null };
        } else if (url.pathname === "/tour-manager/credits") {
          if (settlementStarted) creditChecks += 1;
          if (creditChecks >= 2) credits = 1;
          body = {
            bookingEmailCredits:credits,
            purchasedCredits:credits,
            sentEmails:successfulSends,
            reservedCredits:0,
            activity:credits ? [{ type:"purchase", credits:1, status:"settled", description:"1 booking email credit purchased", at:new Date().toISOString() }] : []
          };
        } else if (url.pathname === "/tour-manager/checkout") {
          checkoutPayload = request.postDataJSON();
          body = { checkoutUrl:"https://checkout.stripe.com/c/pay/controlled-test", quantity:checkoutPayload.quantity };
        } else if (url.pathname === "/tour-manager/outreach") {
          body = { messages:successfulSends ? [{ id:"sent-outreach", venueKey, venueName:"Credit Room", recipient:"booking@example.com", subject:"Booking enquiry", status:"sent", createdAt:new Date().toISOString() }] : [], replies:[] };
        } else if (url.pathname === "/tour-manager/contact-unlocks") body = { venueKeys:[venueKey] };
        else if (url.pathname === "/epk/outreach-share" && method === "GET") body = { shares:[] };
        else if (url.pathname === "/epk/outreach-share" && method === "POST") {
          const payload = request.postDataJSON();
          if (payload.action === "create") {
            shareCreates += 1;
            body = { shareUrl:`https://danzstak.com/epk.html?outreach=${payload.outreachId}#token=${privateToken}` };
          } else {
            shareRevokes += 1;
            body = { revoked:true };
          }
        } else if (url.pathname === "/tour-manager/outreach/preflight") {
          body = { footer:`DanzStak LLC, 2063 Main St. #237, Oakley, CA 94561, USA\nReply or offer dates securely: https://danzstak.com/booking-reply.html#token=${footerToken}\nDon't want booking pitches through DanzStak? Opt out: https://danzstak.com/booking-opt-out.html#token=${footerToken}` };
        } else if (url.pathname === "/tour-manager/emails/send") {
          sendAttempts += 1;
          if (!credits) {
            status = 402;
            body = { error:"Not enough booking-email credits." };
          } else {
            credits -= 1;
            successfulSends += 1;
            body = { status:"sent", messageId:"controlled-message" };
          }
        }
        await route.fulfill({ status, contentType:"application/json", body:JSON.stringify(body) });
      });

      await page.goto(`${origin}/booking-selections.html`, { waitUntil:"domcontentloaded" });
      const card = page.locator('.venue-card[data-venue-key]', { hasText:"Credit Room" });
      await card.waitFor({ state:"visible" });
      const prompt = card.locator(".booking-credit-needed");
      await prompt.waitFor({ state:"visible" });
      assert.match(await prompt.textContent(), /No booking-email credit is ready[\s\S]*Buy 1 credit · \$1\.50/, `${width}px must explain the zero-credit next step`);

      await card.getByRole("button", { name:"Preview exact email" }).click();
      let dialog = page.locator("dialog.booking-send-review");
      await dialog.waitFor({ state:"visible" });
      await dialog.locator('input[type="checkbox"]').check();
      await dialog.getByRole("button", { name:"Approve and send · 1 credit" }).click();
      await dialog.waitFor({ state:"detached" });
      await page.waitForFunction(() => document.activeElement?.textContent?.includes("Buy 1 credit"));
      assert.equal(sendAttempts, 1, `${width}px zero-credit approval must make one guarded send attempt`);
      assert.equal(successfulSends, 0, `${width}px zero-credit approval must not send`);
      assert.equal(shareCreates, 1, `${width}px exact review must create one private share`);
      assert.equal(shareRevokes, 1, `${width}px unused private share must be revoked after the send is rejected`);
      assert.match(await prompt.textContent(), /Nothing sends automatically/, `${width}px must explain post-payment approval`);
      await page.screenshot({ path:path.join(output, `credit-needed-${width}.png`), fullPage:true, animations:"disabled", caret:"hide" });

      const buyButton = prompt.getByRole("button", { name:"Buy 1 credit · $1.50" });
      const buyHeight = await buyButton.evaluate(node => node.getBoundingClientRect().height);
      assert.ok(buyHeight >= 44, `${width}px credit purchase target is ${buyHeight}px`);
      await buyButton.click();
      await page.waitForURL("https://checkout.stripe.com/**");
      assert.deepEqual(checkoutPayload, { quantity:1 }, `${width}px venue recovery must buy exactly one email credit`);

      settlementStarted = true;
      await page.goto(`${origin}/booking-selections.html?credits=success`, { waitUntil:"domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("bookingCreditStatus")?.textContent.includes("Credits verified"), null, { timeout:20000 }).catch(async error => {
        throw new Error(`${width}px credit verification timed out: status=${JSON.stringify(await page.locator("#bookingCreditStatus").textContent())}; checks=${creditChecks}; browser=${errors.join(" | ")}; ${error.message}`);
      });
      await page.waitForFunction(key => document.activeElement?.textContent?.includes("Preview exact email") && document.activeElement.closest(".venue-card")?.dataset.venueKey === key, venueKey);
      assert.equal(new URL(page.url()).searchParams.has("credits"), false, `${width}px successful return must clear the Checkout result`);
      assert.equal(sendAttempts, 1, `${width}px verified payment must never auto-send the pitch`);
      const returnedCard = page.locator(`.venue-card[data-venue-key="${venueKey}"]`);
      assert.equal(await returnedCard.locator(".booking-credit-needed").isHidden(), true, `${width}px settled credit must remove the zero-credit prompt`);
      assert.match(await page.locator("[role=status]").filter({ hasText:"nothing was sent automatically" }).first().textContent(), /Review this venue's exact email again/, `${width}px must require a fresh review after payment`);
      const geometry = await returnedCard.evaluate(node => ({
        documentWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        cardWidth:node.getBoundingClientRect().width,
        viewportWidth:innerWidth
      }));
      assert.ok(geometry.documentWidth <= geometry.clientWidth + 1, `${width}px resumed booking overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.cardWidth <= geometry.viewportWidth, `${width}px resumed venue card exceeds viewport: ${JSON.stringify(geometry)}`);
      await page.screenshot({ path:path.join(output, `credit-resumed-${width}.png`), fullPage:true, animations:"disabled", caret:"hide" });

      await returnedCard.getByRole("button", { name:"Preview exact email" }).click();
      dialog = page.locator("dialog.booking-send-review");
      await dialog.waitFor({ state:"visible" });
      await dialog.locator('input[type="checkbox"]').check();
      await dialog.getByRole("button", { name:"Approve and send · 1 credit" }).click();
      await dialog.waitFor({ state:"detached" });
      await page.locator('.venue-card[data-venue-key]', { hasText:"Email accepted by the provider" }).waitFor();
      assert.equal(sendAttempts, 2, `${width}px fresh approval must make exactly one new send attempt`);
      assert.equal(successfulSends, 1, `${width}px paid credit must send exactly once after fresh approval`);
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      await context.close();
    }
    console.log(`Booking credit-resume browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
