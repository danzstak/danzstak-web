"use strict";
// Fix-it 18, Bazaar (owner 2026-11-17): one search, not two. The shared top-bar search finds Bazaar products and
// people in one sheet; "See all in the Bazaar" filters the grid through ?q= (device Back returns to the whole Bazaar);
// the empty Bazaar is one line plus "+ Sell something". API mocked.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/bazaar-one-search.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/bazaar-one-search");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const pixel = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#ff5a1f"/></svg>');
const catalog = [
  { id: "p1", title: "Signal tour shirt", shopName: "Night Shift", priceCents: 2500, shippingCents: 500, imageUrl: pixel },
  { id: "p2", title: "Hazard 12-inch", shopName: "Hazard Records", priceCents: 1800, shippingCents: 0, imageUrl: pixel },
  { id: "p3", title: "Crust patch", shopName: "Night Shift", priceCents: 600, shippingCents: 0, imageUrl: pixel }
];
const users = [{ memberId: "11111111-1111-4111-8111-111111111111", name: "Shirt Lord", handle: "shirtlord", friendStatus: "none", online: false, picture: "" }];

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
async function open(browser, width, products) {
  const ctx = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage(), state = { bazaarQueries: [], peopleQueries: [], errors: [] };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url()), p = url.pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "33333333-3333-4333-8333-333333333333", email: "me@danzstak.test" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift" } }));
    if (p === "/marketplace/bazaar") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      state.bazaarQueries.push(q);
      const found = products.filter(item => !q || `${item.title} ${item.shopName}`.toLowerCase().includes(q));
      return route.fulfill(json({ products: found, total: found.length, nextOffset: null }));
    }
    if (p === "/people") { state.peopleQueries.push(url.searchParams.get("query")); return route.fulfill(json({ users })); }
    return route.fulfill(json({}));
  });
  return { ctx, page, state };
}
const geometry = page => page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  bodySearchBoxes: [...document.querySelectorAll("main input")].length,
  small: [...document.querySelectorAll(".bazaar-sell, .bazaar-filter-clear, dialog[open] .bazaar-sheet-row, dialog[open] .bazaar-sheet-all, .ds-top-search-button")]
    .filter(node => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().height < 44).map(node => node.className)
}));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const widths = (process.env.WIDTHS || "320,360,390,430").split(",").map(Number);
  try {
    for (const width of widths) {
      // 1. Empty Bazaar: one line and one action, no second search box.
      {
        const label = `${width}px empty`;
        const { ctx, page, state } = await open(browser, width, []);
        await page.goto(`${baseUrl}/bazaar.html`, { waitUntil: "domcontentloaded" });
        const empty = page.locator(".bazaar-empty");
        await empty.waitFor({ timeout: 15000 });
        assert.equal((await empty.locator("p").textContent()).trim(), "Nothing for sale yet.", `${label}: one line`);
        assert.equal(await empty.locator("p").count(), 1, `${label}: one line only`);
        assert.equal(await empty.locator("a.bazaar-sell").getAttribute("href"), "store.html?manage=1", `${label}: Sell something opens My Shop`);
        assert.match((await empty.locator("a.bazaar-sell").textContent()).trim(), /^\+\s*Sell something$/, `${label}: + Sell something`);
        assert.equal((await page.locator("#bazaarStatus").textContent()).trim(), "", `${label}: no extra status line`);
        assert.equal(await page.locator(".bazaar-intro, .bazaar-search").count(), 0, `${label}: intro and body search are gone`);
        const g = await geometry(page);
        assert.equal(g.overflow, false, `${label}: sideways scroll`);
        assert.equal(g.bodySearchBoxes, 0, `${label}: one search (the top bar's)`);
        assert.deepEqual(g.small, [], `${label}: targets under 44px`);
        if ([360, 390].includes(width)) await shot(page, `1-empty-${width}`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // 2. The top-bar search finds products and people in one sheet; See all filters the page; Back returns.
      {
        const label = `${width}px search`;
        const { ctx, page, state } = await open(browser, width, catalog);
        await page.goto(`${baseUrl}/bazaar.html`, { waitUntil: "domcontentloaded" });
        await page.locator(".bazaar-card").first().waitFor({ timeout: 15000 });
        assert.equal(await page.locator(".bazaar-card").count(), 3, `${label}: whole Bazaar`);
        assert.equal(await page.locator("#bazaarFilter").isVisible(), false, `${label}: no chip without a search`);
        await page.locator(".ds-top-search-button").click();
        const sheet = page.locator("dialog.ds-top-search");
        await sheet.waitFor({ state: "visible" });
        assert.equal(await sheet.locator("input").getAttribute("placeholder"), "Search the Bazaar or people", `${label}: placeholder`);
        await sheet.locator("input").fill("shirt");
        await sheet.locator(".bazaar-sheet-row").first().waitFor();
        await sheet.locator(".person-row").first().waitFor();
        assert.equal(await sheet.locator(".bazaar-sheet-row").count(), 1, `${label}: one product row`);
        assert.equal((await sheet.locator(".bazaar-sheet-row strong").first().textContent()).trim(), "Signal tour shirt");
        assert.equal(await sheet.locator(".bazaar-sheet-row").first().getAttribute("href"), "product.html?id=p1");
        assert.ok(await sheet.locator(".bazaar-sheet-people").isVisible(), `${label}: People heading under the Bazaar rows`);
        const order = await sheet.evaluate(dialog => {
          const top = selector => dialog.querySelector(selector).getBoundingClientRect().top;
          return top(".bazaar-sheet") < top(".bazaar-sheet-people") && top(".bazaar-sheet-people") < top(".person-row");
        });
        assert.ok(order, `${label}: Bazaar first, then People`);
        assert.equal(state.bazaarQueries.at(-1), "shirt");
        assert.equal(state.peopleQueries.at(-1), "shirt");
        assert.deepEqual((await geometry(page)).small, [], `${label}: sheet targets under 44px`);
        if ([360, 390].includes(width)) await shot(page, `2-sheet-${width}`);

        await sheet.locator(".bazaar-sheet-all").click();
        await sheet.waitFor({ state: "hidden" });
        await page.waitForFunction(() => document.querySelectorAll(".bazaar-card").length === 1);
        assert.ok(page.url().endsWith("/bazaar.html?q=shirt"), `${label}: See all puts the search in the address (${page.url()})`);
        assert.equal((await page.locator(".bazaar-filter-term").textContent()).trim(), "“shirt”", `${label}: chip shows the search`);
        const g = await geometry(page);
        assert.equal(g.overflow, false, `${label}: sideways scroll`);
        assert.deepEqual(g.small, [], `${label}: targets under 44px`);
        if ([360, 390].includes(width)) await shot(page, `3-filtered-${width}`);

        // Device Back returns to the whole Bazaar, not to the sheet.
        await page.goBack();
        await page.waitForFunction(() => document.querySelectorAll(".bazaar-card").length === 3);
        assert.ok(page.url().endsWith("/bazaar.html"), `${label}: Back returns to the Bazaar (${page.url()})`);
        assert.equal(await page.locator("#bazaarFilter").isVisible(), false, `${label}: chip gone after Back`);
        assert.equal(await sheet.isVisible(), false, `${label}: sheet stays closed after Back`);

        // "@name" is a member search only.
        await page.locator(".ds-top-search-button").click();
        await sheet.waitFor({ state: "visible" });
        const before = state.bazaarQueries.length;
        await sheet.locator("input").fill("@shirtlord");
        await sheet.locator(".person-row").first().waitFor();
        await page.waitForTimeout(400);
        assert.equal(await sheet.locator(".bazaar-sheet").isVisible(), false, `${label}: @username skips the Bazaar`);
        assert.equal(state.bazaarQueries.length, before, `${label}: no Bazaar request for @username`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // 3. A shared ?q= link opens filtered; the chip's × clears it.
      {
        const label = `${width}px chip`;
        const { ctx, page, state } = await open(browser, width, catalog);
        await page.goto(`${baseUrl}/bazaar.html?q=night%20shift`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.querySelectorAll(".bazaar-card").length === 2, null, { timeout: 15000 });
        assert.equal((await page.locator(".bazaar-filter-term").textContent()).trim(), "“night shift”");
        await page.locator(".bazaar-filter-clear").click();
        await page.waitForFunction(() => document.querySelectorAll(".bazaar-card").length === 3);
        assert.ok(page.url().endsWith("/bazaar.html"), `${label}: clear drops ?q=`);
        assert.equal(await page.locator("#bazaarFilter").isVisible(), false, `${label}: chip hidden`);
        await page.goto(`${baseUrl}/bazaar.html?q=zzz`, { waitUntil: "domcontentloaded" });
        await page.locator(".bazaar-empty").waitFor({ timeout: 15000 });
        assert.equal((await page.locator(".bazaar-empty p").textContent()).trim(), "Nothing matches that search.");
        assert.equal(await page.locator(".bazaar-empty a.bazaar-sell").count(), 0, `${label}: no Sell button on a search miss`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`Bazaar one-search checks passed (${widths.join(", ")}px): one-line empty state with + Sell something, no body search box, top-bar sheet with Bazaar rows above People, See all filters through ?q=, Back returns, chip clears, @username skips the Bazaar.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
