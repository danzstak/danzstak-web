"use strict";
// Directive F15f (owner 2026-11-19, screenshot with three Eroticon items in a row): "these products should be jumbled
// up and switched around every time you come in, different items for sale in different places and not the same shop
// in a row so it's a variety". Root cause: real items were mixed only among themselves and the examples were appended
// after them, so the one real shop's items sat together at the top.
// Checks at 360/390px with one real shop of 5 items plus the pre-launch examples: in the grid as laid out, no card
// shares a shop with its neighbour to the left/right or above/below; two visits give different orders; a search still
// returns plain results (real items only, no examples).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/bazaar-mix");
const me = "11111111-1111-4111-8111-111111111111";
const svg = colour => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="${colour}"/></svg>`;
const REAL = ["Tour tee", "Live LP", "Patch", "Poster", "Tote"].map((title, index) => ({ id: `0000000${index}-0000-4000-8000-000000000000`, title, priceCents: 1500 + index * 100, currency: "usd", imageUrl: `${base}/__real${index}.svg`, shopName: "Night Shift Merch", memberId: me, shippingCents: 0 }));

async function visit(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], queries = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/__real*.svg`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("#ef6c20") }));
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname === "/auth/session") body = { authenticated: true, user: { sub: me } };
    else if (url.pathname === "/profiles") body = { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } };
    else if (url.pathname === "/marketplace/bazaar") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      queries.push(q);
      body = { products: q ? REAL.filter(item => item.title.toLowerCase().includes(q)) : REAL, total: q ? undefined : REAL.length };
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/bazaar.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".bazaar-card").length >= 10, null, { timeout: 8000 });
  return { context, page, errors, queries };
}

// Each card's shop and grid position, and every pair of grid neighbours that share a shop.
const grid = page => page.evaluate(() => {
  const cards = [...document.querySelectorAll(".bazaar-card")].map(card => {
    const box = card.getBoundingClientRect();
    return { shop: card.querySelector(".bazaar-seller")?.textContent.trim(), title: card.querySelector(".bazaar-title")?.textContent.trim(), x: Math.round(box.left), y: Math.round(box.top), example: card.matches(".bazaar-example") };
  });
  const columns = [...new Set(cards.map(card => card.x))].sort((a, b) => a - b), rows = [...new Set(cards.map(card => card.y))].sort((a, b) => a - b);
  const at = new Map(cards.map(card => [`${rows.indexOf(card.y)},${columns.indexOf(card.x)}`, card]));
  const clashes = [];
  for (const [key, card] of at) {
    const [row, column] = key.split(",").map(Number);
    for (const [label, neighbour] of [["right", at.get(`${row},${column + 1}`)], ["below", at.get(`${row + 1},${column}`)]])
      if (neighbour && neighbour.shop === card.shop) clashes.push(`${card.title} / ${neighbour.title} (${label}, ${card.shop})`);
  }
  return { order: cards.map(card => card.title), columns: columns.length, real: cards.filter(card => !card.example).length, clashes };
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390]) {
      const label = `${width}px Bazaar`;
      const first = await visit(browser, width), second = await visit(browser, width);
      const a = await grid(first.page), b = await grid(second.page);
      assert.equal(a.columns, 2, `${label}: the phone grid has 2 columns`);
      assert.equal(a.real, REAL.length, `${label}: every real item shows`);
      assert.deepEqual(a.clashes, [], `${label}: no shop next to itself (left/right or above/below)`);
      assert.deepEqual(b.clashes, [], `${label}: no shop next to itself on the second visit either`);
      assert.notDeepEqual(a.order, b.order, `${label}: two visits give different orders`);
      if (width === 390) await first.page.screenshot({ path: path.join(output, "after-390.png"), fullPage: true });
      // A search returns plain results: the matching real item, no examples.
      const box = await first.page.locator("header .ds-top-search-field").boundingBox();
      await first.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await first.page.keyboard.type("tee");
      await first.page.keyboard.press("Enter");
      await first.page.waitForFunction(() => document.querySelectorAll(".bazaar-card").length === 1, null, { timeout: 5000 }).catch(() => {});
      assert.deepEqual((await grid(first.page)).order, ["Tour tee"], `${label}: a search returns plain results`);
      for (const run of [first, second]) { assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`); await run.context.close(); }
    }
    console.log("Bazaar mix checks passed at 360 and 390px: one real shop plus examples, no shop next to itself in the grid, a new order each visit, plain search results.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
