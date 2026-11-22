"use strict";
// Owner 2026-11-22: "link goes to the sign in, I think it should go to the store. And the user that clicks the link can
// only see the eroticon shop or exit out"; "when a non signed in user exits a members shop it goes to the landing page".
// Real browser, touch, signed out, at 320/360/390/430px:
// - a shared profile link (profile.html?member=…) opened signed out lands on shop.html for that member, not the sign-in
//   page: shop name, cover and only the items for sale; no app bar, tabs or links into the rest of DanzStak;
// - a tap at the centre of an item opens it (photo, title, price, shipping, checkout not open yet) and its ✕ closes it;
// - a tap at the centre of the shop's ✕ goes to the landing page;
// - nothing is wider than the screen; Italian shows Italian;
// - a member without an open shop still sends the visitor to the landing page.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8133 node browser-checks/public-shop.cjs
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8133").replace(/\/$/, "");
const root = path.join(__dirname, "..");
const seller = "22222222-2222-4222-8222-222222222222", nobody = "33333333-3333-4333-8333-333333333333";
const CDN = /img-src ([^;"]+)/.exec(fs.readFileSync(path.join(root, "shop.html"), "utf8"))[1].split(/\s+/).find(host => /cloudfront\.net$/.test(host));
const image = fs.readFileSync(path.join(root, "assets/apple-touch-icon.png"));
const shop = { memberId: seller, name: "Sleeping Dragon Records", description: "Vinyl, tees and slipmats from the crew.", coverUrl: `${CDN}/cover.png`, products: [
  { id: "aaaaaaaa-0000-4000-8000-000000000001", title: "Eroticon 6 (vinyl)", description: "Full dance mixes, not online.", imageUrl: `${CDN}/one.png`, priceCents: 2500, shippingCents: 600, available: true },
  { id: "aaaaaaaa-0000-4000-8000-000000000002", title: "Robot tee", description: "", imageUrl: `${CDN}/two.png`, priceCents: 2200, shippingCents: 0, available: true },
  { id: "aaaaaaaa-0000-4000-8000-000000000003", title: "Slipmats", description: "Pair.", imageUrl: `${CDN}/three.png`, priceCents: 1800, shippingCents: 400, available: true },
  { id: "aaaaaaaa-0000-4000-8000-000000000004", title: "Sold out cap", description: "", imageUrl: `${CDN}/four.png`, priceCents: 1500, shippingCents: 0, available: false }
] };

async function open(browser, width, { member = seller, language = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  if (language) await context.addInitScript(lang => { try { localStorage.setItem("danzstak_language", lang); } catch {} }, language);
  const page = await context.newPage(), errors = [], calls = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${CDN}/**`, route => route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: image }));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), url = new URL(request.url()), cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" };
    calls.push(`${request.method()} ${url.pathname}`);
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-headers": "content-type" } });
    if (url.pathname === `/marketplace/shop/${seller}`) return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ shop }) });
    if (url.pathname.startsWith("/marketplace/shop/")) return route.fulfill({ status: 404, contentType: "application/json", headers: cors, body: '{"error":"Shop not found."}' });
    return route.fulfill({ status: 401, contentType: "application/json", headers: cors, body: '{"error":"Authentication required."}' });
  });
  await page.goto(`${base}/profile.html?member=${member}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors, calls };
}

// A touch tap at the visual centre of an element; the centre must belong to that element.
async function tapCentre(page, target) {
  const locator = typeof target === "string" ? page.locator(target) : target, box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${target} is a 44px target (${box && `${box.width}x${box.height}`})`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  assert.ok(await locator.evaluate((node, [px, py]) => { const hit = document.elementFromPoint(px, py); return !!hit && node.contains(hit); }, [x, y]), `the centre of ${target} is not covered`);
  await page.touchscreen.tap(x, y);
}

async function checkWidth(browser, width) {
  const { context, page, errors, calls } = await open(browser, width);
  await page.waitForURL(url => url.pathname.endsWith("/shop.html"), { timeout: 15000 });
  assert.equal(new URL(page.url()).searchParams.get("member"), seller, "the shop page is for the shared member");
  await page.locator(".shop-public-card").first().waitFor();
  assert.equal(await page.locator("#shopName").textContent(), shop.name);
  assert.equal(await page.locator(".shop-public-card").count(), 3, "only items for sale show");
  assert.equal(await page.locator(".shop-public-cover img").count(), 1, "the shop cover shows");
  assert.match(await page.locator(".shop-public-card").first().innerText(), /\+\$6\.00 shipping[\s\S]*\$25\.00/);
  assert.equal(await page.locator(".ds-mobile-nav, .app-bar, .app-tabs, nav").count(), 0, "no navigation into the rest of DanzStak");
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href"))), ["./"], "the only link is ✕ to the landing page");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll at ${width}px`);
  const tiles = await page.locator(".shop-public-image").evaluateAll(nodes => nodes.map(node => { const a = node.getBoundingClientRect(), b = node.querySelector("img").getBoundingClientRect(); return [a.width, a.height, b.width, b.height]; }));
  for (const [w, h, iw, ih] of tiles) assert.ok(Math.abs(w - h) < 1 && Math.abs(iw - w) < 1 && Math.abs(ih - h) < 1, "item photos fill square tiles");
  if (process.env.DANZSTAK_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.DANZSTAK_SCREENSHOTS, `public-shop-${width}.png`) });

  await tapCentre(page, page.locator(".shop-public-card").first());
  await page.locator("#shopItem[open]").waitFor();
  assert.equal(await page.locator("#shopItemTitle").textContent(), "Eroticon 6 (vinyl)");
  assert.equal(await page.locator("#shopItemPrice").textContent(), "$25.00");
  assert.equal(await page.locator("#shopItemShipping").textContent(), "+$6.00 shipping");
  assert.equal(await page.locator(".shop-public-checkout").isDisabled(), true, "checkout is not open yet");
  const sheet = await page.locator("#shopItem").boundingBox();
  assert.ok(sheet.x >= 0 && sheet.x + sheet.width <= width + 0.5 && sheet.y + sheet.height <= 800.5, "the item sheet fits the screen");
  if (process.env.DANZSTAK_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.DANZSTAK_SCREENSHOTS, `public-shop-item-${width}.png`) });
  await tapCentre(page, "#shopItemClose");
  await page.locator("#shopItem:not([open])").waitFor({ state: "attached" });

  await tapCentre(page, ".shop-public-exit");
  await page.waitForURL(url => url.pathname === "/" || url.pathname.endsWith("/index.html"), { timeout: 10000 });
  assert.ok(!calls.some(call => /^(POST|PUT|PATCH|DELETE) \/marketplace/.test(call)), "the visitor changed nothing");
  assert.deepEqual(errors, [], `no page errors at ${width}px`);
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) { await checkWidth(browser, width); console.log(`signed-out shop link at ${width}px: shop only, item opens and closes, ✕ goes to the landing page`); }

    const missing = await open(browser, 390, { member: nobody });
    await missing.page.waitForURL(url => url.pathname === "/" || url.pathname.endsWith("/index.html"), { timeout: 15000 });
    await missing.context.close();
    console.log("a member without an open shop: the landing page");

    const italian = await open(browser, 390, { language: "it" });
    await italian.page.waitForURL(url => url.pathname.endsWith("/shop.html"), { timeout: 15000 });
    await italian.page.locator(".shop-public-card").first().waitFor();
    await italian.page.waitForFunction(() => document.querySelector(".shop-public-exit")?.getAttribute("aria-label") === "Esci dal negozio");
    assert.match(await italian.page.locator(".shop-public-card").first().innerText(), /di spedizione/);
    assert.match(await italian.page.locator(".shop-public-card").nth(1).innerText(), /Spedizione gratuita/);
    await italian.page.locator(".shop-public-card").first().click();
    assert.equal(await italian.page.locator(".shop-public-checkout").innerText(), "Il pagamento apre a breve");
    await italian.context.close();
    console.log("Italian: the shop speaks Italian");
  } finally { await browser.close(); }
  console.log("Shared profile links opened signed out show only the member's shop.");
}
main().catch(error => { console.error(error); process.exit(1); });
