"use strict";
// Task 32 (owner 2026-11-18): share a phone photo to DanzStak. The installed app's share target posts the photo to
// /share-target; the service worker keeps it and opens Mix with the composer ready (nothing posts on its own).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/share-target.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");

(async () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
  assert.equal(manifest.share_target.action, "/share-target");
  assert.ok(manifest.share_target.params.files[0].accept.every(type => /^(image|video)\//.test(type)), "photos and videos only, never audio");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of (process.env.W ? [Number(process.env.W)] : [360, 390])) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      const cors = { "access-control-allow-origin": new URL(baseUrl).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
      await context.route("https://api.danzstak.com/**", route => { if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors }); const p = new URL(route.request().url()).pathname; return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(p === "/auth/session" ? { authenticated: true, user: { sub: "me", email: "me@danzstak.invalid", name: "Eroticon" } } : {}) }); });
      await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => { await navigator.serviceWorker.register("/service-worker.js"); await navigator.serviceWorker.ready; });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });
      const png = fs.readFileSync("assets/favicon-192.png").toString("base64");
      // What Android does: a multipart POST navigation to the share target.
      await Promise.all([
        page.waitForURL(/\/feed\.html/, { timeout: 15000 }),
        page.evaluate(b64 => {
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const form = document.createElement("form"); form.method = "POST"; form.action = "/share-target"; form.enctype = "multipart/form-data";
          const input = document.createElement("input"); input.type = "file"; input.name = "media";
          const transfer = new DataTransfer(); transfer.items.add(new File([bytes], "IMG_2041.png", { type: "image/png" })); input.files = transfer.files;
          const text = document.createElement("input"); text.name = "text"; text.value = "Last night at the Central";
          form.append(input, text); document.body.append(form); form.submit();
        }, png)
      ]);
      await page.waitForFunction(() => !location.search.includes("share=") && document.querySelector(".composer-preview img, #mediaPreview img, [class*=preview] img[src^='blob:']"), null, { timeout: 15000 });
      const state = await page.evaluate(() => ({ text: document.getElementById("postText")?.value, media: window.danzstakSelectedMedia?.file?.name, kind: window.danzstakSelectedMedia?.kind }));
      assert.equal(state.media, "IMG_2041.png", `${width}px: the shared photo is attached`);
      assert.equal(state.kind, "image");
      assert.equal(state.text, "Last night at the Central", `${width}px: shared text in the box`);
      assert.equal(await page.evaluate(async () => (await (await caches.open("danzstak-share")).keys()).length), 0, `${width}px: nothing left behind`);
      if (width === 390) await page.screenshot({ path: "docs/screenshots/share-target-390.png" });
      assert.deepEqual(errors.filter(e => !/posts list/.test(e)), [], `${width}px page errors`);
      await context.close();
    }
    console.log("Share target checks passed: Share → DanzStak opens Mix with the photo attached and the text in the box; nothing stored afterwards.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
