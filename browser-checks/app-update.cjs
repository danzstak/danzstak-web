"use strict";
// Owner 2026-11-23 (phone, Mix): "Update is hanging". The "Update DanzStak" button turned into "Updating…" and stayed.
// An update only takes over once the old service worker has finished what it's doing, and the old worker was busy
// re-downloading the whole app (251 files, 7 MB, "no-store") every time the app came back to the front: its
// once-an-hour guard lived in memory, and the browser restarts the worker after half a minute idle. On a phone's LTE
// that keeps the update waiting for a minute or more.
//
// This check serves the site itself, so it can publish a new version of the service worker mid-test. The served worker
// tags the requests it makes itself with fetch() (the shell refresh) with its version, and the server answers the old
// version's own requests slowly (2.5 s each, as on a slow line):
//   1. version 1 installs and controls the page (a first visit doesn't reload);
//   2. version 2 is published, the member comes back to the app (reload), the update is offered;
//   3. a centre tap on "Update DanzStak" → the page reloads into version 2 within 10 s, and version 1's cache is gone;
//   4. the old worker didn't start re-downloading the app while the update was on its way.
// Run: node browser-checks/app-update.cjs (it starts its own server; Edge by default, DANZSTAK_BROWSER_CHANNEL=bundled
// for Playwright's Chromium).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const state = { version: 1, oldWorkerFetches: 0 };

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { response.writeHead(403); return response.end(); }
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  let body;
  try { body = fs.readFileSync(file); } catch { response.writeHead(404, { "cache-control": "no-store" }); return response.end("Not found"); }
  if (url.pathname === "/service-worker.js") {
    // This version's own fetch() calls carry ?sw=<version> (the worker's network passthrough uses Request objects and
    // Cache.addAll doesn't go through self.fetch, so only the worker's own refresh is tagged).
    const tag = `const __sw = ${state.version}, __fetch = self.fetch.bind(self); self.fetch = (input, init) => __fetch(typeof input === "string" ? \`\${input}\${input.includes("?") ? "&" : "?"}sw=\${__sw}\` : input, init);\n`;
    body = Buffer.from(tag + String(body).replace(/const CACHE = "[^"]+";/, `const CACHE = "danzstak-shell-check-${state.version}";`));
  }
  const send = () => { response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "public, max-age=300, must-revalidate" }); response.end(body); };
  const fromWorker = Number(url.searchParams.get("sw") || 0);
  if (fromWorker && fromWorker < state.version) { state.oldWorkerFetches += 1; return setTimeout(send, 2500); }
  send();
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
    await context.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify({ authenticated: false }) }));
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));

    // 1. Version 1 installs and takes over.
    await page.goto(`${base}/index.html`, { waitUntil: "load" });
    await page.evaluate(() => { window.__firstVisit = true; });
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === "activated", null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__firstVisit), true, "a first visit doesn't reload when the app's worker takes over");
    const cachesBefore = await page.evaluate(() => caches.keys());
    assert.ok(cachesBefore.includes("danzstak-shell-check-1"), `version 1 is installed (${cachesBefore})`);

    // 2. Version 2 goes live; the member comes back to the app.
    state.version = 2;
    await page.reload({ waitUntil: "load" });
    const button = page.locator(".app-update-button");
    await button.waitFor({ state: "visible", timeout: 60000 });
    assert.equal((await button.textContent()).trim(), "Update DanzStak");

    // 3. Centre tap on the button: the page reloads into version 2 within 10 s.
    await page.evaluate(() => { window.__beforeUpdate = true; });
    await button.scrollIntoViewIfNeeded();
    const spot = await button.evaluate(node => { const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return { x, y, hit: node.contains(top), top: top ? `${top.tagName}.${top.className}` : "none", rect: [r.left, r.top, r.width, r.height].map(Math.round) }; });
    assert.ok(spot.hit, `the Update button is on top where it's tapped (${JSON.stringify(spot)})`);
    const tapped = Date.now();
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForFunction(() => !window.__beforeUpdate && document.readyState === "complete", null, { timeout: 10000 }).catch(async () => {
      const text = await button.textContent().catch(() => "");
      throw new Error(`The update hung: 10 s after the tap the page is still on version 1, button "${String(text).trim()}", ${state.oldWorkerFetches} re-download requests held the old worker`);
    });
    const seconds = ((Date.now() - tapped) / 1000).toFixed(1);
    const cachesAfter = await page.evaluate(() => caches.keys());
    assert.ok(cachesAfter.includes("danzstak-shell-check-2") && !cachesAfter.includes("danzstak-shell-check-1"), `version 2 took over (${cachesAfter})`);

    // 4. The old worker never started a full re-download while the update was on its way.
    assert.equal(state.oldWorkerFetches, 0, `the old worker re-downloaded ${state.oldWorkerFetches} files while the update waited`);
    assert.deepEqual(errors, [], "page errors");
    console.log(`App update checks passed: with version 2 published, "Update DanzStak" reloaded the app into it ${seconds} s after the tap, version 1's cache was removed, and no full re-download held the update up.`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
