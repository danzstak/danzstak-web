"use strict";
// Screen titles and Back (fix-it 18, owner 2026-11-17): Music HQ, Events, the Menu and Notifications live inside
// feed.html, so the browser title used to stay "Your Mix". Each screen now has its own title, and Back behaves like a
// real screen change (title and screen go back together). Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/screen-titles.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/screen-titles");
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
function fixture(p) {
  if (p === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@example.test" } };
  if (p === "/profiles") return { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true } };
  if (p === "/secure-posts") return { posts: [] };
  if (p === "/stories") return { stories: [], reels: [] };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  return {};
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of (process.env.WIDTHS || "360,390").split(",").map(Number)) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill(json(fixture(new URL(route.request().url()).pathname))));
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      const title = () => page.title();
      const expect = async (want, where) => { const got = await title(); if (got !== `DanzStak | ${want}`) failures.push(`${label} ${where}: title "${got}", expected "DanzStak | ${want}"`); };
      await expect("Your Mix", "Mix");
      const tap = async feature => { await page.evaluate(f => { const c = [...document.querySelectorAll(`[data-feature='${f}']`)].find(n => n.getBoundingClientRect().width > 0) || document.querySelector(`[data-feature='${f}']`); c?.click(); }, feature); await page.waitForTimeout(700); };
      await tap("HQ"); await expect("Music HQ", "Music HQ");
      if (!/#hq$/.test(page.url())) failures.push(`${label}: Music HQ is not its own history entry (${page.url()})`);
      if (width === 390) await page.screenshot({ path: path.join(output, `${prefix}-hq-${width}.png`), clip: { x: 0, y: 0, width, height: 300 } });
      await tap("Events"); await expect("Events", "Events");
      await page.goBack(); await page.waitForTimeout(700); await expect("Music HQ", "Back from Events");
      if (!/#hq$/.test(page.url())) failures.push(`${label}: Back from Events did not return to Music HQ (${page.url()})`);
      await page.goBack(); await page.waitForTimeout(700); await expect("Your Mix", "Back to Mix");
      // Menu: its own title while open; Back closes it and restores the title.
      await page.evaluate(() => { const b = [...document.querySelectorAll("[aria-controls='mobileNavMenu']")].find(n => n.getBoundingClientRect().width > 0); b?.click(); });
      await page.waitForTimeout(500);
      if (await page.evaluate(() => document.body.classList.contains("mobile-menu-open"))) {
        await expect("Menu", "Menu");
        await page.goBack(); await page.waitForTimeout(600);
        await expect("Your Mix", "Back from Menu");
      } else failures.push(`${label}: Menu did not open`);
      // Notifications.
      await page.evaluate(() => { const b = [...document.querySelectorAll(".header-notifications, [data-feature='Notifications']")].find(n => n.getBoundingClientRect().width > 0); b?.click(); });
      await page.waitForTimeout(600);
      await expect("Notifications", "Notifications");
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`Screen titles: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log("Screen title checks passed at 360 and 390px: Mix, Music HQ, Events, Menu and Notifications each have their own title, and Back restores screen and title together.");
})().catch(error => { console.error(error); process.exitCode = 1; });
