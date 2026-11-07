"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || process.env.DANZSTAK_EPK_ORIGIN || "http://127.0.0.1:8037";
const output = path.resolve("docs/screenshots/epk-outreach-share");
fs.mkdirSync(output, { recursive:true });
const shareId = "1234567890abcdef1234567890abcdef", token = "a".repeat(64);
const kit = { artistName:"Road Test", hometown:"Seattle", genres:["Punk"], shortPitch:"A direct live set for independent rooms.", shortBio:"Road Test makes fast independent music and arrives prepared.", bio:"", lineup:["Alex — vocals", "Sam — drums"], releases:["First Run — 2026"], achievements:[], notableShows:["Test Room — Portland"], pressQuotes:[], musicLinks:[{label:"Listen on Bandcamp",url:"https://example.com/music"}], videoLinks:[{label:"Live video",url:"https://example.com/video"}], socialLinks:[], media:[], stageRequirements:"Clear 12 × 10 ft stage", techRequirements:"Two vocal microphones", hospitalityRequirements:"", bookingName:"Road Test", bookingEmail:"booking@example.com", bookingPhone:"", website:"https://example.com" };

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of [320,360,390,414,430,1366]) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, deviceScaleFactor:1 });
      const page = await context.newPage(); const openIds = [];
      page.setDefaultTimeout(10000);
      page.on("requestfailed", request => console.error("EPK request failed", request.url(), request.failure()?.errorText));
      await page.route("https://api.danzstak.com/epk/outreach/**", async route => { const payload = JSON.parse(route.request().postData() || "{}"); openIds.push(payload.openId); await route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ kit, private:true, bookingShare:true, permissions:{allowPdf:false}, disclosure:"The artist can see that this venue link was opened and when. DanzStak does not store who viewed it.", expiresAt:"2027-01-01T00:00:00.000Z", updatedAt:"2026-11-07T00:00:00.000Z" }) }); });
      const url = `${origin}/epk.html?outreach=${shareId}#token=${token}`;
      await page.goto(url, { waitUntil:"domcontentloaded" });
      await page.locator("#publicEpkNotice").filter({ hasText:"does not store who viewed it" }).waitFor();
      assert.equal(await page.locator("#printEpk").isHidden(), true, "PDF action must respect the artist's per-link permission");
      assert.equal(await page.locator('a[href="https://example.com/music"]').getAttribute("href"), "https://example.com/music");
      const geometry = await page.evaluate(() => ({ scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, statusHeight:document.querySelector("#publicEpkNotice").getBoundingClientRect().height }));
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${width}px private EPK overflows`); assert.ok(geometry.statusHeight > 0);
      await page.reload({ waitUntil:"domcontentloaded" }); await page.locator("#publicEpkNotice").filter({ hasText:"does not store who viewed it" }).waitFor();
      assert.equal(openIds.length, 2); assert.equal(openIds[0], openIds[1], "reload in one browser session must reuse the open ID");
      await page.getByRole("heading", { name:"Road Test", exact:true }).waitFor();
      assert.equal(await page.locator('a[href="https://example.com/music"]').count(), 1);
      await page.screenshot({ path:path.join(output, `venue-epk-${width}.png`), fullPage:false });
      await context.close();
    }
    console.log("Venue EPK browser checks passed at 320, 360, 390, 414, 430, 1366px.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
