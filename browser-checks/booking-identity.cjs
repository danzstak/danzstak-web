"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const widths = [320, 360, 390, 430, 1024];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    if (captureDir) fs.mkdirSync(captureDir, { recursive: true });
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      let savedBody = null;
      await page.route("https://api.danzstak.com/**", async route => {
        const url = new URL(route.request().url());
        if (url.pathname === "/booking-pipeline/identity") {
          savedBody = JSON.parse(route.request().postData() || "{}");
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ revision: "revision-2" }) });
        }
        const body = url.pathname === "/booking-pipeline"
          ? { venues: [], artist: { name: "The Test Rats", hometown: "Tacoma, WA, United States" }, tour: {}, revision: "revision-1" }
          : url.pathname === "/epk" ? { kit: { artistName: "EPK Act", hometown: "EPK City" } }
          : url.pathname === "/profiles" ? { profile: { name: "Profile Name", location: "Profile City" } }
          : url.pathname === "/auth/session" ? { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } }
          : {};
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto(`${baseUrl}/booking.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".booking-identity.is-saved").waitFor();
      assert.equal(await page.locator("#bandName").inputValue(), "The Test Rats");
      assert.equal(await page.locator("#startCity").inputValue(), "Tacoma, WA, United States");
      assert.equal(await page.locator(".booking-identity").evaluate(node => Boolean(node.closest("details"))), false, `${width}px identity must not be buried in a disclosure`);
      const order = await page.evaluate(() => {
        const identity = document.querySelector(".booking-identity");
        const brief = document.querySelector(".booking-brief");
        return {
          identityTop: identity.getBoundingClientRect().top,
          briefTop: brief.getBoundingClientRect().top,
          identityPrecedesBrief: Boolean(identity.compareDocumentPosition(brief) & Node.DOCUMENT_POSITION_FOLLOWING)
        };
      });
      assert.equal(order.identityPrecedesBrief, true, `${width}px identity must precede the tour request in document order`);
      assert.ok(order.identityTop <= order.briefTop + 1, `${width}px identity must appear no lower than the tour request`);
      const geometry = await page.locator(".booking-identity").boundingBox();
      assert.ok(geometry.width <= width && geometry.x >= 0 && geometry.x + geometry.width <= width + 1, `${width}px identity must fit the viewport`);
      const identityContentBottom = await page.locator(".booking-identity-status").evaluate(node => node.getBoundingClientRect().bottom);
      const identityContentHeight = identityContentBottom - geometry.y;
      const maxIdentityHeight = width <= 600 ? 235 : 210;
      assert.ok(identityContentHeight <= maxIdentityHeight, `${width}px identity content must stay compact (received ${identityContentHeight}px)`);
      const saveBox = await page.locator("#saveBookingIdentity").boundingBox();
      assert.ok(saveBox.height >= 44, `${width}px save target must remain touchable`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}px page must not overflow horizontally`);
      if (captureDir) await page.screenshot({ path: path.join(captureDir, `booking-identity-${width}.png`), fullPage: false });
      await page.locator("#bandName").fill("Changed Act");
      await page.locator("#startCity").fill("Portland, OR, United States");
      await page.locator("#saveBookingIdentity").click();
      await page.waitForFunction(() => document.getElementById("bookingIdentityStatus")?.textContent.includes("Saved to"));
      assert.deepEqual(savedBody, { name: "Changed Act", hometown: "Portland, OR, United States", revision: "revision-1" });
      await context.close();
    }

    const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const fallbackPage = await fallbackContext.newPage();
    await fallbackPage.route("https://api.danzstak.com/**", route => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === "/booking-pipeline" ? { venues: [], artist: {}, tour: {}, revision: "" }
        : pathname === "/epk" ? { kit: { artistName: "Saved EPK Act", hometown: "Novara, Italy" } }
        : pathname === "/profiles" ? { profile: { name: "Fallback Profile", location: "Milan, Italy" } }
        : {};
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await fallbackPage.goto(`${baseUrl}/booking.html`, { waitUntil: "domcontentloaded" });
    await fallbackPage.waitForFunction(() => document.getElementById("bookingIdentityStatus")?.textContent.includes("Suggested"));
    assert.equal(await fallbackPage.locator("#bandName").inputValue(), "Saved EPK Act");
    assert.equal(await fallbackPage.locator("#startCity").inputValue(), "Novara, Italy");
    await fallbackContext.close();
    console.log("Booking identity browser checks passed at 320, 360, 390, 430, 1024px: top placement, saved/fallback identity, secure save, touch targets, and zero overflow.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
