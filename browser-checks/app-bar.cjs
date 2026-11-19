"use strict";
// Audit 36 B1 (directive F6): one top bar on every DanzStak page (SYNC and the full-screen viewers keep their own;
// Profile's cover header is F9's). Before: five different bars (Mix's search box; a bare search icon on the tool pages;
// Product's and Event's white "Bazaar / My Shop" and "Events / SYNC" buttons; Tour Manager's "← Back to venue map";
// Support's "Back to Settings" link; Mix's bar 1px shorter, 45px of dead space for a hidden install button).
// Checks at 320/360/390/430px, signed in:
// - every page has one bar: 59px, #121418, the same logo, a 44px search box (the Bazaar's searches the Bazaar, B10),
//   Pivot (F15j), bell and SYNC in the same place as on Mix (at 320px a page with ← drops the logo to keep the search readable);
// - pages that need Back show ← first and it goes back to where it should; no stray header links remain;
// - tapping the centre of the search box opens search; no sideways scroll;
// - Privacy and Terms keep their plain header for visitors who are signed out.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const PAGES = [
  ["feed.html?view=feed"], ["bazaar.html"], ["product.html?id=x"], ["store.html"], ["event.html?id=x"], ["epk.html"], ["booking.html"],
  ["booking-selections.html", "booking.html"], ["record-stores.html"], ["moving-day.html"], ["support.html", "feed.html?view=settings"],
  ["trusted-contacts.html", "booking.html"], ["privacy.html"], ["terms.html"]
];

async function open(browser, width, path, signedIn = true) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === "/auth/session" ? (signedIn ? { authenticated: true, user: { sub: me, email: "night@danzstak.invalid" } } : { authenticated: false })
      : (pathname === "/profiles" || pathname === "/profile") ? { profile: { memberId: me, name: "Night Shift", handle: "nightshift", username: "nightshift", isOwner: true, cloudProfile: true } } : {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}

const barState = page => page.evaluate(() => {
  const shown = element => element && element.getClientRects().length && getComputedStyle(element).display !== "none";
  const bars = [...document.querySelectorAll("header.ds-app-bar, header.topbar.ds-feed-bar")].filter(shown);
  const bar = bars[0];
  if (!bar) return { bars: 0 };
  const box = element => { if (!shown(element)) return null; const r = element.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }; };
  const logo = bar.querySelector(".ds-app-bar-brand img, .logo img"), search = bar.querySelector(".ds-top-search-button, .ds-top-search-field, input.search");
  const loose = [...bar.querySelectorAll(":scope > a")].filter(link => shown(link) && !link.matches(".ds-app-bar-brand, .ds-app-bar-back, .logo, .ds-app-bar-icon")).map(link => link.textContent.trim());
  return {
    bars: bars.length, top: Math.round(bar.getBoundingClientRect().top), height: Math.round(bar.getBoundingClientRect().height), background: getComputedStyle(bar).backgroundColor,
    first: bar.querySelector(":scope > :is(a,button,input):not([hidden])")?.matches(".ds-app-bar-back") ? "back" : "logo",
    logo: box(logo), search: box(search), bell: box(bar.querySelector(".header-notifications, .ds-app-bar-bell")), sync: box(bar.querySelector(".ds-app-bar-sync")),
    loose, boxyButtons: [...bar.querySelectorAll("nav a")].filter(shown).length, overflow: document.documentElement.scrollWidth > innerWidth
  };
});

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      let mix = null;
      for (const [path, backTo] of PAGES) {
        const label = `${width}px ${path}`;
        const { context, page, errors } = await open(browser, width, path);
        const state = await barState(page);
        assert.equal(state.bars, 1, `${label}: exactly one top bar`);
        assert.equal(state.top, 0, `${label}: the bar sits at the top`);
        assert.ok(Math.abs(state.height - 59) <= 1, `${label}: the bar is 59px tall (got ${state.height})`);
        assert.equal(state.background, "rgb(18, 20, 24)", `${label}: the bar is DanzStak ink`);
        // F15j: at 320px a page with ← and Pivot gives the logo's room to the search box.
        if (backTo && width < 360) assert.equal(state.logo, null, `${label}: the logo steps aside for the search box`);
        else assert.ok(state.logo && state.logo.width === 34, `${label}: the same 34px logo ${JSON.stringify(state.logo)}`);
        assert.ok(state.search && state.search.height === 44 && state.search.width >= 90, `${label}: a 44px search box ${JSON.stringify(state.search)}`);
        assert.ok(state.bell?.width === 44 && state.sync?.width === 44, `${label}: 44px bell and SYNC`);
        assert.deepEqual(state.loose, [], `${label}: no stray header links`);
        assert.equal(state.boxyButtons, 0, `${label}: no boxy link buttons in the bar`);
        assert.equal(state.overflow, false, `${label}: no sideways scroll`);
        assert.equal(state.first, backTo ? "back" : "logo", `${label}: ${backTo ? "← first" : "the logo first"}`);
        mix ||= state;
        assert.ok(Math.abs(state.bell.left - mix.bell.left) <= 1 && Math.abs(state.sync.left - mix.sync.left) <= 1, `${label}: bell and SYNC sit where they sit on Mix ${JSON.stringify({ here: [state.bell.left, state.sync.left], mix: [mix.bell.left, mix.sync.left] })}`);
        // Tap the centre of the search box: it opens search.
        const search = page.locator("header .ds-top-search-button, header .ds-top-search-field, header input.search").first();
        const box = await search.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(300);
        const opened = await page.evaluate(() => Boolean(document.querySelector("dialog.ds-top-search[open]")) || document.activeElement?.matches?.("input.search, dialog.ds-top-search input, .ds-top-search-field input"));
        assert.equal(opened, true, `${label}: tapping the search box opens search`);
        if (backTo) {
          await page.keyboard.press("Escape").catch(() => {});
          await page.goto(`${base}/${path}`, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(800);
          const back = await page.locator("header .ds-app-bar-back svg").boundingBox();
          await page.touchscreen.tap(back.x + back.width / 2, back.y + back.height / 2);
          await page.waitForURL(url => `${url.pathname.split("/").pop()}${url.search}` === backTo, { timeout: 8000 });
        }
        assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
        await context.close();
      }
      for (const path of ["privacy.html", "terms.html"]) {
        const { context, page } = await open(browser, width, path, false);
        const plain = await page.evaluate(() => ({ bar: Boolean(document.querySelector("header.ds-app-bar")), search: Boolean(document.querySelector(".ds-top-search-button")), home: Boolean(document.querySelector("header a.home")) }));
        assert.deepEqual(plain, { bar: false, search: false, home: true }, `${width}px ${path} signed out keeps its plain header`);
        await context.close();
      }
    }
    console.log(`App bar checks passed at 320, 360, 390, 430px on ${PAGES.length} pages: one 59px bar with the same logo, a 44px search box that opens search, bell and SYNC where they sit on Mix, ← first where a page needs Back; Privacy and Terms stay plain for visitors.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
