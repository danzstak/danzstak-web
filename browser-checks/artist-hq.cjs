"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.argv[2] || process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const waitingOutreachId = "outreach_hq_reply_123", answeredOutreachId = "outreach_hq_answered_456";
function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated:true, user:{ sub:"11111111-1111-4111-8111-111111111111", email:"artist@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile:{ memberId:"11111111-1111-4111-8111-111111111111", name:"Test Artist", username:"testartist" } };
  if (pathname === "/epk") return { kit:{ artistName:"Test Artist" }, published:true };
  if (pathname === "/tour-manager/outreach") return { messages:[
    { id:waitingOutreachId, venueName:"Test Venue", subject:"March 5 booking pitch", status:"replied", sentAt:"2026-11-07T08:00:00Z" },
    { id:answeredOutreachId, venueName:"Answered Venue", subject:"March 7 booking pitch", status:"replied", sentAt:"2026-11-07T08:30:00Z" }
  ], replies:[
    { id:"reply_hq_offer_123", outreachId:waitingOutreachId, direction:"inbound", action:"offer_date", content:"We can offer March 5. What is your guarantee?", proposedDate:"2027-03-05", createdAt:"2026-11-07T10:00:00Z" },
    { id:"reply_hq_answered_123", outreachId:answeredOutreachId, direction:"inbound", action:"reply", content:"Can you play March 7?", createdAt:"2026-11-07T09:00:00Z" },
    { id:"reply_hq_artist_123", outreachId:answeredOutreachId, direction:"outbound", action:"reply", content:"Yes, March 7 works for us.", createdAt:"2026-11-07T11:00:00Z" }
  ] };
  if (pathname === "/tour-manager/credits") return { balance:7 };
  if (pathname === "/secure-posts") return { posts:[] };
  if (pathname === "/friends") return { friends:[], incoming:[], outgoing:[] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users:[] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications:[] };
  if (pathname === "/stories") return { stories:[], reels:[] };
  if (pathname === "/groups") return { groups:[] };
  if (pathname === "/news") return { articles:[] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:844 }, serviceWorkers:"block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(fixture(url.pathname)) });
      });
      await page.goto(`${baseUrl}/feed.html?view=hq`, { waitUntil:"domcontentloaded" });
      await page.locator(".artist-hq-card").first().waitFor({ state:"visible" });
      assert.equal((await page.locator(".artist-hq-card").nth(0).locator(".artist-hq-metric").textContent()).trim(), "Published");
      assert.equal((await page.locator(".artist-hq-card").nth(1).locator(".artist-hq-metric").textContent()).trim(), "1");
      assert.equal((await page.locator(".artist-hq-card").nth(2).locator(".artist-hq-metric").textContent()).trim(), "7");
      const answer = page.getByRole("link", { name:"Answer venue", exact:true });
      assert.equal(await answer.getAttribute("href"), `messages.html?section=bookings&outreach=${waitingOutreachId}`, `${width}px HQ did not target the exact waiting booking thread`);
      const state = await page.evaluate(() => ({
        scrollWidth:document.documentElement.scrollWidth,
        bodyWidth:document.body.scrollWidth,
        targets:[...document.querySelectorAll(".artist-hq-action")].map(item => { const r=item.getBoundingClientRect(); return { width:r.width, height:r.height }; }),
        navs:[...document.querySelectorAll(".ds-mobile-nav")].filter(item => getComputedStyle(item).display !== "none").length
      }));
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.ok(state.scrollWidth <= width && state.bodyWidth <= width, `${width}px HQ overflow: ${JSON.stringify(state)}`);
      assert.ok(state.targets.every(item => item.width >= 44 && item.height >= 44), `${width}px HQ touch target failure: ${JSON.stringify(state.targets)}`);
      assert.ok(state.navs <= 1, `${width}px duplicate mobile navigation`);
      if (captureDir) { fs.mkdirSync(captureDir,{recursive:true}); await page.screenshot({ path:path.join(captureDir,`artist-hq-${width}.png`), fullPage:true }); }
      await answer.click();
      await page.locator("#bookingReplyForm:not([hidden])").waitFor({ state:"visible" });
      await page.waitForFunction(() => location.pathname.endsWith("/messages.html") && !location.search && document.body.dataset.syncScreen === "bookings");
      assert.equal((await page.locator("#conversationName").textContent()).trim(), "Test Venue", `${width}px HQ did not open the requested venue thread`);
      assert.match(await page.locator("#messageList").textContent(), /We can offer March 5/, `${width}px exact venue reply was not visible`);
      const handoffState = await page.evaluate(() => ({ scrollWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, composer:document.getElementById("bookingReplyForm")?.getBoundingClientRect() }));
      assert.ok(handoffState.scrollWidth <= width && handoffState.bodyWidth <= width, `${width}px HQ-to-SYNC handoff overflow: ${JSON.stringify(handoffState)}`);
      assert.ok(handoffState.composer?.height >= 44, `${width}px booking reply composer is not touch sized`);
      if (captureDir) await page.screenshot({ path:path.join(captureDir,`artist-hq-booking-${width}.png`), fullPage:false });
      await context.close();
    }
    console.log(`Artist HQ browser checks passed at ${widths.length} widths.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
