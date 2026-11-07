"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || "http://127.0.0.1:8037", output = path.resolve("docs/screenshots/booking-opt-out"), token = "a".repeat(64);
fs.mkdirSync(output, { recursive:true });

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of [320,360,390,414,430,1366]) {
      const context = await browser.newContext({ viewport:{ width, height:850 }, deviceScaleFactor:1 });
      const page = await context.newPage(); let submitted = null;
      await page.route("https://api.danzstak.com/tour-manager/opt-out", async route => {
        submitted = JSON.parse(route.request().postData() || "{}");
        assert.equal(route.request().url().includes(token), false, "The private token must not appear in the request URL");
        await route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ optedOut:true, alreadyOptedOut:false }) });
      });
      await page.goto(`${origin}/booking-opt-out.html#token=${token}`, { waitUntil:"domcontentloaded" });
      await page.getByRole("button", { name:"Stop future booking pitches" }).waitFor();
      assert.equal(await page.evaluate(() => location.hash), "", "The fragment must be removed after the client reads it");
      const geometry = await page.evaluate(() => { const button=document.querySelector("#confirmOptOut"), rect=button.getBoundingClientRect(); return { scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, buttonHeight:rect.height, buttonRight:rect.right, viewport:innerWidth }; });
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${width}px opt-out page overflows`);
      assert.ok(geometry.buttonHeight >= 44, `${width}px opt-out button is too small`);
      assert.ok(geometry.buttonRight <= geometry.viewport + 1, `${width}px opt-out button is clipped`);
      await page.getByRole("button", { name:"Stop future booking pitches" }).click();
      await page.getByText("Done. No future DanzStak booking pitches will be sent to this address.").waitFor();
      assert.deepEqual(submitted, { token });
      await page.screenshot({ path:path.join(output, `booking-opt-out-${width}.png`), fullPage:false });
      await context.close();
    }
    console.log("Booking opt-out browser checks passed at 320, 360, 390, 414, 430, 1366px.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
