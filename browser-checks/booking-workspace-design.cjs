"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const origin = String(process.env.DANZSTAK_BOOKING_ORIGIN || "http://127.0.0.1:8027").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/issue-55-booking-workspace");
const widths = [320, 360, 390, 430, 768, 1366];
fs.mkdirSync(output, { recursive: true });

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } };
  if (pathname === "/booking-pipeline") return { venues: [], artist: { name: "The Test Rats", hometown: "Tacoma, WA, United States" }, tour: {}, revision: "revision-1" };
  if (pathname === "/epk") return { kit: { artistName: "The Test Rats", hometown: "Tacoma, WA, United States" } };
  if (pathname === "/profiles") return { profile: { name: "The Test Rats", location: "Tacoma, WA, United States" } };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const requestUrl = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(requestUrl.pathname)) });
      });

      await page.goto(`${origin}/booking.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("bookingIdentityStatus")?.textContent.includes("loaded"));
      await page.waitForTimeout(80);

      const geometry = await page.evaluate(() => {
        const rect = selector => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        };
        const actionBoxes = [...document.querySelectorAll(".booking-brief-actions button")].map(button => button.getBoundingClientRect());
        const visibleTargets = [...document.querySelectorAll(".tool-header a, .booking-start button")]
          .map(element => element.getBoundingClientRect())
          .filter(box => box.width > 0 && box.height > 0);
        return {
          documentWidth: document.documentElement.scrollWidth,
          header: rect(".tool-header"),
          headerStyle: {
            padding: getComputedStyle(document.querySelector(".tool-header")).padding,
            minHeight: getComputedStyle(document.querySelector(".tool-header")).minHeight,
            boxSizing: getComputedStyle(document.querySelector(".tool-header")).boxSizing
          },
          start: rect(".booking-start"),
          identity: rect(".booking-identity"),
          brief: rect(".booking-brief"),
          finder: rect(".venue-quick-search"),
          samePlanningCard: document.querySelector(".booking-identity").closest(".booking-start") === document.querySelector(".booking-start") && document.querySelector(".booking-brief").closest(".booking-start") === document.querySelector(".booking-start"),
          actionsShareRow: Math.abs(actionBoxes[0].top - actionBoxes[1].top) <= 1,
          minimumTarget: Math.min(...visibleTargets.map(box => box.height)),
          mapClosed: !document.querySelector(".booking-tools").open,
          optionsClosed: !document.querySelector(".planner-drawer").open,
          primaryStatus: document.getElementById("bookingBriefStatus").textContent.trim()
        };
      });

      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
      assert.ok(geometry.documentWidth <= width + 1, `${width}px horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.header.height <= 64, `${width}px header too tall: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.samePlanningCard, true, `${width}px planning controls must share one card`);
      assert.equal(geometry.actionsShareRow, true, `${width}px primary and example actions must share one row`);
      assert.ok(geometry.minimumTarget >= 44, `${width}px touch target below 44px: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.start.width <= width && geometry.start.left >= 0 && geometry.start.right <= width + 1, `${width}px planning card does not fit`);
      assert.ok(geometry.identity.top > geometry.start.top && geometry.brief.top > geometry.identity.top, `${width}px planning order is incorrect`);
      assert.ok(width >= 700 || geometry.finder.top < 844, `${width}px club finder should begin within the first phone viewport`);
      assert.equal(geometry.mapClosed, true);
      assert.equal(geometry.optionsClosed, true);
      assert.equal(geometry.primaryStatus, "", `${width}px should not show an advanced-form warning before the user starts`);

      await page.locator("#bookingBriefExample").click();
      assert.match(await page.locator("#bookingBrief").inputValue(), /DIY punk/i);
      await page.screenshot({ path: path.join(output, `booking-${width}.png`), fullPage: true });
      await context.close();
    }
    console.log(`Booking workspace browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
