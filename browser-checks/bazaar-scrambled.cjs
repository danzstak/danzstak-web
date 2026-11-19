"use strict";
// Owner 2026-11-19: Bazaar items from every shop mixed up. The API returns one shop's items, then the next (like the
// old server order); the grid must alternate shops. Run: DANZSTAK_BASE_URL=http://127.0.0.1:8134 node browser-checks/bazaar-scrambled.cjs
const { chromium } = require("playwright");
const path = require("node:path");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8134").replace(/\/$/, "");
const svg = color => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${color}"/></svg>`);
const shops = [["Eroticon Records", "#ff5a1f", 8], ["Night Shift", "#1f8bff", 4], ["Bone Saw", "#9e1b1b", 4]];
const products = shops.flatMap(([shop, color, count], s) => Array.from({ length: count }, (_, i) => ({ id: `p${s}${i}`, memberId: `m${s}`, shopName: shop, title: `${shop.split(" ")[0]} item ${i + 1}`, priceCents: 1500, shippingCents: 500, imageUrl: svg(color) })));
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      let seen = "";
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        if (url.pathname === "/marketplace/bazaar") seen = url.searchParams.get("seed") || "";
        const body = url.pathname === "/marketplace/bazaar" ? { products, total: products.length, nextOffset: null } : url.pathname === "/auth/session" ? { authenticated: true, user: { sub: "x" } } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/bazaar.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".bazaar-card:not(.bazaar-example)");
      const sellers = await page.$$eval(".bazaar-card:not(.bazaar-example) .bazaar-seller", nodes => nodes.map(node => node.textContent));
      if (sellers.length !== products.length) failures.push(`${width}px: ${sellers.length} of ${products.length} items shown`);
      for (let i = 1; i < 12; i++) if (sellers[i] === sellers[i - 1]) { failures.push(`${width}px: same shop twice in a row at ${i}: ${sellers.slice(0, 12).join(" | ")}`); break; }
      if (!/^[a-z0-9]{6,}$/.test(seen)) failures.push(`${width}px: no per-visit seed sent (${seen})`);
      if (process.env.CAPTURE) await page.screenshot({ path: path.join(process.env.CAPTURE, `bazaar-scrambled-${width}.png`) });
      await page.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Bazaar scramble browser check passed at 360/390px: shops alternate, every item shown, seed sent.");
})();
