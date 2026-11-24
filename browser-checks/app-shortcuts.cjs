"use strict";
// SHORTCUT (owner 2026-11-24): long-pressing DanzStak's installed icon lists SYNC and My shop. Real browser, touch,
// at 320/360/390/430px:
// - My shop opened signed out (store.html?manage=1, as the shortcut opens it) goes to the landing page to sign in, never
//   a dead "could not be loaded" line;
// - after signing in, the member lands straight back in their shop manager;
// - a member with no shop yet lands on opening one (the shop form, no error);
// - both shortcut icons load from the manifest and are drawn at phone size for a look (screenshot).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8133 node browser-checks/app-shortcuts.cjs
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8133").replace(/\/$/, "");
const shots = path.join(__dirname, "..", "docs", "screenshots", "app-shortcuts");

async function run(browser, width, { hasShop }) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  let signedIn = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), url = new URL(request.url()), cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-headers": "content-type" } });
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (!signedIn) return json(401, { error: "Authentication required." });
    if (url.pathname === "/auth/session") return json(200, { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", name: "Eroticon", username: "eroticon" } });
    if (url.pathname === "/marketplace/shop") return hasShop ? json(200, { shop: { name: "Sleeping Dragon Records", description: "Vinyl", status: "published", products: [] } }) : json(404, { error: "No shop yet" });
    return json(200, {});
  });
  await page.goto(`${base}/store.html?manage=1`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(url => /\/(index\.html)?$/.test(url.pathname), { timeout: 15000 });
  assert.equal(await page.evaluate(() => sessionStorage.getItem("danzstak_return_to")), "/store.html?manage=1", `${width}px: the shop manager is remembered for after sign-in`);

  signedIn = true; // the hosted sign-in sends the member back to the landing page with a session
  await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(url => url.pathname.endsWith("/store.html") && url.searchParams.get("manage") === "1", { timeout: 15000 });
  await page.locator("#shopManager").waitFor({ state: "visible" });
  const status = await page.locator("#storeStatus").textContent();
  assert.doesNotMatch(status, /could not be loaded/i, `${width}px: no dead end (${status})`);
  if (!hasShop) assert.match(status, /Name your shop/, `${width}px: a member with no shop lands on opening one`);
  else assert.equal(await page.locator("#shopName").inputValue(), "Sleeping Dragon Records");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: nothing wider than the screen`);
  assert.deepEqual(errors, [], `${width}px: no page errors`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) { await run(browser, width, { hasShop: false }); await run(browser, width, { hasShop: true }); }

    // The two shortcut icons from the manifest, drawn the way a phone's long-hold list shows them.
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.webmanifest"), "utf8"));
    const context = await browser.newContext({ viewport: { width: 360, height: 220 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`${base}/manifest.webmanifest`);
    const rows = manifest.shortcuts.map(item => `<li><img src="${item.icons.find(icon => icon.sizes === "192x192").src}" alt=""><span>${item.name}</span></li>`).join("");
    await page.setContent(`<base href="${base}/"><style>body{margin:0;background:#2b2b2e;font:500 16px system-ui}ul{list-style:none;margin:24px 16px;padding:8px 0;background:#f4f4f2;border-radius:20px;width:220px}li{display:flex;align-items:center;gap:14px;padding:10px 16px}img{width:40px;height:40px;border-radius:50%}</style><ul>${rows}</ul>`);
    const loaded = await page.$$eval("img", images => Promise.all(images.map(image => image.complete ? image.naturalWidth : new Promise(done => { image.onload = () => done(image.naturalWidth); image.onerror = () => done(0); }))));
    assert.deepEqual(loaded, [192, 192], "both shortcut icons load at 192px");
    fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, "long-hold-360.png") });
    await context.close();
  } finally { await browser.close(); }
  console.log("App shortcut browser checks passed: My shop signs in and comes back, at 320–430px; both icons load.");
})().catch(error => { console.error(error); process.exit(1); });
