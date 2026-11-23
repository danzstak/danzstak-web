"use strict";
// Directive F15j (owner 2026-11-19, screenshot of the Mix header: "the Pivot button has gone from the top header").
// Checks at 320/360/390/430px, signed in, on Mix, Music HQ, Events, the Bazaar and the profile:
// - one Pivot icon in the top bar, 44px, orange, named "Pivot your data", between Search and the bell (the profile bar
//   has no bell: right of its search);
// - tapping the centre of its icon opens Moving Day (on the Bazaar it goes to Mix, which opens Moving Day once and
//   drops ?pivot=open from the address);
// - the bar stays one row with no sideways scroll, and the Menu keeps its Pivot item.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const PAGES = [["Mix", "feed.html?view=feed"], ["Music HQ", "feed.html?view=hq"], ["Events", "feed.html?view=events"], ["Bazaar", "bazaar.html"], ["profile", "profile.html"]];

async function open(browser, width, path) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === "/auth/session" ? { authenticated: true, user: { sub: me } }
      : (pathname === "/profiles" || pathname === "/profile") ? { profile: { memberId: me, name: "Night Shift", handle: "nightshift", username: "nightshift", isOwner: true, cloudProfile: true } } : {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}

const state = page => page.evaluate(() => {
  const shown = element => element && element.getClientRects().length && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden";
  const bar = [...document.querySelectorAll("header.ds-app-bar, header.topbar, header.profile-app-header")].find(shown);
  const pivots = [...(bar?.querySelectorAll(".ds-app-bar-pivot") || [])].filter(shown);
  const box = element => { if (!shown(element)) return null; const r = element.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }; };
  const pivot = pivots[0], icon = pivot?.querySelector("svg");
  const search = [...(bar?.querySelectorAll(".ds-top-search-button, .ds-top-search-field, input.search, .profile-search-toggle") || [])].find(shown);
  const bell = [...(bar?.querySelectorAll(".header-notifications, .ds-app-bar-bell") || [])].find(shown);
  const rows = new Set([...(bar?.children || [])].filter(shown).map(child => { const r = child.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 20); })).size; // by vertical centre
  return {
    count: pivots.length, pivot: box(pivot), icon: box(icon), search: box(search), bell: box(bell), bar: box(bar), rows,
    name: pivot?.getAttribute("aria-label") || "", colour: icon ? getComputedStyle(icon).color : "",
    overflow: document.documentElement.scrollWidth > innerWidth
  };
});

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      for (const [name, path] of PAGES) {
        const label = `${width}px ${name}`;
        const { context, page, errors } = await open(browser, width, path);
        const s = await state(page);
        assert.equal(s.count, 1, `${label}: one Pivot icon in the top bar`);
        assert.ok(s.pivot.width >= 44 && s.pivot.height >= 44, `${label}: a 44px target ${JSON.stringify(s.pivot)}`);
        assert.ok(s.icon && s.icon.width >= 20 && s.icon.width <= 26, `${label}: an icon, not a text pill ${JSON.stringify(s.icon)}`);
        assert.equal(s.colour, "rgb(255, 90, 31)", `${label}: DanzStak orange`);
        assert.equal(s.name, "Pivot your data", `${label}: its accessible name`);
        assert.ok(s.search && s.pivot.left >= s.search.right - 1, `${label}: right of Search ${JSON.stringify({ search: s.search, pivot: s.pivot })}`);
        if (s.bell) assert.ok(s.pivot.right <= s.bell.left + 1, `${label}: left of the bell ${JSON.stringify({ pivot: s.pivot, bell: s.bell })}`);
        assert.ok(s.pivot.top >= s.bar.top && s.pivot.bottom <= s.bar.bottom, `${label}: inside the bar`);
        assert.equal(s.rows, 1, `${label}: the bar is one row`);
        assert.equal(s.overflow, false, `${label}: no sideways scroll`);
        // Tap the centre of the icon (not the button box): Moving Day opens.
        const at = await page.evaluate(() => { const icon = [...document.querySelectorAll(".ds-app-bar-pivot svg")].find(node => node.getClientRects().length); const r = icon.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: Boolean(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".ds-app-bar-pivot")) }; });
        assert.equal(at.hit, true, `${label}: nothing covers the icon's centre`);
        await page.touchscreen.tap(at.x, at.y);
        await page.waitForSelector(".pivot-dialog[open]", { timeout: 8000 });
        const opened = await page.evaluate(() => ({ title: document.querySelector(".pivot-dialog[open] h2")?.textContent.trim(), url: location.pathname.split("/").pop() + location.search }));
        assert.equal(opened.title, "Moving Day", `${label}: Pivot opens Moving Day`);
        if (name === "Bazaar") assert.equal(opened.url, "feed.html?view=feed", `${label}: it lands on Mix and ?pivot=open leaves the address`);
        assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
        if (name === "Mix") {
          await page.keyboard.press("Escape");
          const menuItem = await page.evaluate(() => document.querySelector("#mobileNavMenu .menu-pivot .menu-label")?.textContent.trim());
          assert.equal(menuItem, "Pivot your data", `${label}: the Menu keeps its Pivot item`);
        }
        await context.close();
      }
    }
    console.log("Pivot header checks passed at 320, 360, 390, 430px on Mix, Music HQ, Events, the Bazaar and the profile: one 44px orange Pivot icon between Search and the bell, a centre tap opens Moving Day (from the Bazaar via Mix), one-row bar, no sideways scroll; the Menu keeps Pivot.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
