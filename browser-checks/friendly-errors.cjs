"use strict";
// Audit A6/E2 (2026-11-19): the shop manager and Trusted contacts showed raw programming errors to members
// ("Cannot read properties of undefined…"). Odd or empty server replies must give a plain message instead.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/friendly-errors.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const raw = /Cannot read propert|undefined|is not a function|is not defined|before initialization|\[object /;
const cases = [
  { path: "store.html?manage=1", reply: () => ({}), expect: /Name your shop to open a private draft/ },
  { path: "store.html?manage=1", reply: p => p === "/marketplace/shop" ? { shop: { status: "draft" } } : {}, expect: /No products yet|No products are available/ },
  { path: "trusted-contacts.html", reply: () => ({}), act: async page => { await page.locator("text=ADD CONTACT").first().click(); await page.waitForTimeout(600); }, expect: null }
];
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const item of cases) for (const width of [360, 390]) {
      const label = `${item.path} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => { const p = new URL(route.request().url()).pathname; route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } } : item.reply(p)) }); });
      await page.goto(`${base}/${item.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
      if (item.act) await item.act(page);
      const body = await page.evaluate(() => document.body.innerText);
      if (raw.test(body)) failures.push(`${label}: raw error text on screen: ${body.match(new RegExp(".*(" + raw.source + ").*"))?.[0]}`);
      if (item.expect && !item.expect.test(body)) failures.push(`${label}: expected ${item.expect}`);
      if (errors.length) failures.push(`${label}: script errors: ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Friendly error checks passed: the shop manager and Trusted contacts never show raw programming errors.");
})();
