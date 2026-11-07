"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated:true, user:{ sub:"11111111-1111-4111-8111-111111111111", email:"artist@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile:{ memberId:"11111111-1111-4111-8111-111111111111", name:"Test Artist", username:"testartist" } };
  if (pathname === "/epk") return { kit:{ artistName:"Test Artist" }, published:true };
  if (pathname === "/tour-manager/outreach") return { messages:[{ id:"pitch-1" },{ id:"pitch-2" }], replies:[
    { outreachId:"pitch-1", direction:"inbound", action:"offer_date", createdAt:"2026-11-07T10:00:00Z" },
    { outreachId:"pitch-2", direction:"inbound", action:"reply", createdAt:"2026-11-07T09:00:00Z" },
    { outreachId:"pitch-2", direction:"outbound", action:"reply", createdAt:"2026-11-07T11:00:00Z" }
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
      await context.close();
    }
    console.log(`Artist HQ browser checks passed at ${widths.length} widths.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
