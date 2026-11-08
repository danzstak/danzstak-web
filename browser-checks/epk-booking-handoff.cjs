"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || process.env.DANZSTAK_EPK_ORIGIN || "http://127.0.0.1:8041";
const widths = [320, 360, 390, 414, 430, 1366];
const output = path.resolve("docs/screenshots/epk-booking-handoff");
fs.mkdirSync(output, { recursive:true });
const kit = {
  artistName:"Road Test",
  hometown:"Seattle",
  actType:"band",
  genres:["Punk"],
  look:"punk",
  shortPitch:"A direct live set for independent rooms.",
  shortBio:"Road Test arrives prepared with a concise EPK and a venue-ready live set.",
  musicLinks:[{ label:"Listen on Bandcamp", url:"https://example.com/music" }],
  videoLinks:[], socialLinks:[], lineup:[], releases:[], notableShows:[], achievements:[], pressQuotes:[], media:[], production:{ plotItems:[], inputs:[] }, publicDetails:{}
};

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:width < 700 ? 844 : 900 }, serviceWorkers:"block", reducedMotion:"reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status:200, contentType:"application/json", body:"{}" }));
      await page.route("https://api.danzstak.com/epk", route => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ kit, publicId:"road-test", published:true, privateShared:false }) }));
      await page.goto(`${origin}/epk.html`, { waitUntil:"domcontentloaded" });
      await page.locator("#epkStatus").filter({ hasText:"Published EPK loaded" }).waitFor();
      await page.locator("#epkBookingHandoff").scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const handoff = document.querySelector("#epkBookingHandoff"), primary = handoff.querySelector("a.primary"), secondary = handoff.querySelector('a[href="booking-selections.html"]');
        return {
          documentWidth:document.documentElement.scrollWidth,
          clientWidth:document.documentElement.clientWidth,
          visible:getComputedStyle(handoff).display !== "none",
          primaryHeight:primary.getBoundingClientRect().height,
          secondaryHeight:secondary.getBoundingClientRect().height,
          primaryHref:primary.getAttribute("href"),
          secondaryHref:secondary.getAttribute("href")
        };
      });
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.equal(geometry.visible, true, `${width}px published handoff should be visible`);
      assert.ok(geometry.documentWidth <= geometry.clientWidth + 1, `${width}px EPK handoff overflows: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.primaryHeight >= 44 && geometry.secondaryHeight >= 44, `${width}px actions must retain 44px touch targets`);
      assert.equal(geometry.primaryHref, "booking.html#venueQuickTitle");
      assert.equal(geometry.secondaryHref, "booking-selections.html");
      await page.screenshot({ path:path.join(output, `published-handoff-${width}.png`), fullPage:false });
      await context.close();
    }
    console.log(`EPK booking-handoff browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
