"use strict";
// One top bar on every page (fix-it 18, owner 2026-11-17): logo, search, bell, SYNC — the same slim bar on Mix, Music HQ,
// Events, Bazaar, Booking, EPK, Record shops, the shop and Moving Day. No Pivot and no orange install arrow in the bar;
// both live in the Menu. Bazaar / My Shop are tabs under the bar. API mocked.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/app-bar.cjs   (AUDIT_ONLY=1 SHOTS=before to report)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/app-bar");
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const pages = [["mix", "/feed.html?view=feed"], ["hq", "/feed.html?view=hq"], ["bazaar", "/bazaar.html"], ["booking", "/booking.html"], ["epk", "/epk.html"], ["record-stores", "/record-stores.html"], ["store", "/store.html?manage=1"]];
function fixture(p) {
  if (p === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@example.test" } };
  if (p === "/profiles") return { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true } };
  if (p === "/secure-posts") return { posts: [] };
  if (p === "/stories") return { stories: [], reels: [] };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  if (p === "/record-store-workspace") return { release: {}, stores: [], revision: "" };
  if (p === "/record-stores") return { stores: [] };
  return {};
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of (process.env.WIDTHS || "320,360,390,430").split(",").map(Number)) for (const [name, url] of pages) {
      const label = `${name} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill(json(fixture(new URL(route.request().url()).pathname))));
      await page.goto(baseUrl + url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      const bar = await page.evaluate(() => {
        const header = document.querySelector("body > header, header.topbar");
        if (!header) return null;
        const visible = node => { if (!node) return false; const r = node.getBoundingClientRect(), cs = getComputedStyle(node); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
        const r = header.getBoundingClientRect();
        const find = sel => [...header.querySelectorAll(sel)].find(visible) || null;
        const brand = find("a[href*='feed.html'] img, .logo img, .ds-app-bar-brand img");
        const search = find(".ds-top-search-button, .top-search-toggle, [data-top-search], input.search, input[type=search]");
        const bell = find(".header-notifications, .ds-app-bar-bell");
        const sync = find(".ds-app-bar-sync");
        const pivot = [...document.querySelectorAll("#pivotButton, .pivot-header-button")].some(visible);
        const install = [...document.querySelectorAll(".install-app-button")].some(visible);
        const iconSizes = [bell, sync, search?.matches?.("input") ? null : search].filter(Boolean).map(n => { const b = n.getBoundingClientRect(); return Math.min(b.width, b.height); });
        return { height: r.height, top: r.top, brand: Boolean(brand), search: Boolean(search), bell: Boolean(bell), sync: Boolean(sync), bellHref: bell?.getAttribute?.("href") || "", pivot, install, small: iconSizes.filter(s => s < 43.5).length, overflow: document.documentElement.scrollWidth > innerWidth, links: [...header.querySelectorAll("nav a")].filter(visible).map(a => a.textContent.trim()) };
      });
      if (!bar) { failures.push(`${label}: no top bar`); await context.close(); continue; }
      for (const part of ["brand", "search", "bell", "sync"]) if (!bar[part]) failures.push(`${label}: top bar has no ${part}`);
      if (bar.pivot) failures.push(`${label}: Pivot still takes header space`);
      if (bar.install) failures.push(`${label}: the orange install arrow is still on screen`);
      if (bar.height > 64) failures.push(`${label}: top bar is not slim (${Math.round(bar.height)}px)`);
      if (bar.small) failures.push(`${label}: ${bar.small} top-bar icon(s) under 44px`);
      if (bar.overflow) failures.push(`${label}: sideways overflow`);
      if (bar.links.length) failures.push(`${label}: old header links still shown (${bar.links.join(", ")})`);
      if (name === "bazaar") {
        const tabs = await page.evaluate(() => { const t = document.querySelector(".ds-app-tabs"); return t ? [...t.querySelectorAll("a")].map(a => a.textContent.trim()) : []; });
        if (tabs.join("|") !== "Bazaar|My Shop") failures.push(`${label}: Bazaar / My Shop are not tabs under the bar (${tabs.join("|")})`);
      }
      if (name === "mix") {
        await page.evaluate(() => { const b = [...document.querySelectorAll("[aria-controls='mobileNavMenu']")].find(n => n.getBoundingClientRect().width > 0); b?.click(); });
        await page.waitForTimeout(300);
        const menu = await page.evaluate(() => ({ pivot: Boolean(document.querySelector("#mobileNavMenu [data-pivot-trigger]")), install: document.querySelector("#mobileNavMenu .menu-install") }));
        if (!menu.pivot) failures.push(`${label}: Pivot is not in the Menu`);
        if (!menu.install) failures.push(`${label}: no Install entry in the Menu`);
        await page.keyboard.press("Escape");
      }
      if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-${name}-${width}.png`), clip: { x: 0, y: 0, width, height: 200 } }).catch(() => {});
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`App bar: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log("App bar checks passed: logo, search, bell and SYNC on every page, no Pivot or install arrow in the bar, slim, 44px icons, Bazaar tabs, Pivot and Install in the Menu.");
})().catch(error => { console.error(error); process.exitCode = 1; });
