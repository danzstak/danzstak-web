"use strict";
// Task 32 (owner 2026-11-18): share a phone photo to DanzStak. The installed app's share target posts the photo to
// /share-target; the real service worker keeps it and opens Mix with the composer ready (nothing posts on its own).
// Real browser at 320, 360, 390, 414, 430 with the service worker running:
// - photo + text → composer has the photo attached and the text in the box; nothing left in the share cache;
// - three photos → one post with all three (up to 20);
// - video → attached as a video (it goes to The Roll automatically when posted, #602: no checkbox);
// - signed out → nothing attached, the share waits; after sign-in Mix opens it in the composer;
// - audio → refused with a plain message.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/share-target.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/share-target");
const png = fs.readFileSync("assets/favicon-192.png").toString("base64");

async function open(browser, width, auth) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36" }); // the Share menu is a phone's
  const cors = { "access-control-allow-origin": new URL(baseUrl).origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
  await context.route("https://api.danzstak.com/**", route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return auth.signedIn ? route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.invalid", name: "Night Shift" } }) }) : route.fulfill({ status: 401, contentType: "application/json", headers: cors, body: '{"authenticated":false}' });
    if (!auth.signedIn && p === "/calls/presence") return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "{}" }); // keep the page here; Mix's own redirect is not under test
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(p === "/secure-posts" ? { posts: [] } : {}) });
  });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
  // pwa.js registers the worker and reloads once it takes control; wait that out.
  const deadline = Date.now() + 30000;
  for (;;) {
    const controlled = await page.evaluate(async () => { await navigator.serviceWorker.ready; return Boolean(navigator.serviceWorker.controller); }).catch(() => false);
    if (controlled) break;
    if (Date.now() > deadline) throw new Error("the service worker never took control");
    await page.waitForTimeout(500);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)).catch(() => false))) await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  }
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800); // let a controller-change reload finish
  return { context, page };
}
// What Android does: a multipart POST navigation to the share target.
async function share(page, files, text = "") {
  await Promise.all([
    page.waitForURL(/\/feed\.html/, { timeout: 20000 }),
    page.evaluate(([files, text]) => {
      const form = document.createElement("form"); form.method = "POST"; form.action = "/share-target"; form.enctype = "multipart/form-data";
      const input = document.createElement("input"); input.type = "file"; input.name = "media";
      const transfer = new DataTransfer();
      for (const { b64, name, type } of files) transfer.items.add(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], name, { type }));
      input.files = transfer.files;
      const words = document.createElement("input"); words.name = "text"; words.value = text;
      form.append(input, words); document.body.append(form); form.submit();
    }, [files, text])
  ]);
}
const shareCount = page => page.evaluate(async () => (await (await caches.open("danzstak-share")).keys()).length);
// Polled from here: page.waitForFunction would treat an async predicate's Promise as already true.
async function sharesCleared(page, ms) {
  for (const until = Date.now() + ms; Date.now() < until; await page.waitForTimeout(100)) if ((await shareCount(page)) === 0) return;
  throw new Error(`the shared file was still on the phone after ${ms} ms`);
}
const composer = page => page.evaluate(() => ({ text: document.getElementById("postText")?.value, media: window.danzstakSelectedMedia?.file?.name || "", more: (window.danzstakSelectedMedia?.more || []).map(item => item.file.name), kind: window.danzstakSelectedMedia?.kind || "", preview: Boolean(document.querySelector(".composer-media-preview img, .composer-media-preview video")), noRollCheckbox: !document.getElementById("shareToReels"), overflow: document.documentElement.scrollWidth > innerWidth, feedback: document.querySelector(".app-feedback, [data-app-feedback], .danzstak-feedback")?.textContent || "" }));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  // Edge in CI like the other checks (the runner has no bundled Chromium); DANZSTAK_BROWSER_CHANNEL=bundled locally.
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch({ ...(channel && channel !== "bundled" ? { channel } : {}), headless: true });
  try {
    for (const width of [320, 360, 390, 414, 430]) {
      const label = `${width}px`, shots = width === 360 || width === 390;
      // Photo + text.
      let auth = { signedIn: true }, { context, page } = await open(browser, width, auth);
      await share(page, [{ b64: png, name: "IMG_2041.png", type: "image/png" }], "Last night at the Central");
      await page.waitForFunction(() => window.danzstakSelectedMedia?.file && !location.search.includes("share="), null, { timeout: 15000 });
      // The hand-off ends when the shared file is cleared from the phone (after the text goes in; photo scaling,
      // media-scale.js, makes the photo arrive a moment before the text).
      await sharesCleared(page, 10000);
      let state = await composer(page);
      assert.equal(state.media, "IMG_2041.png", `${label}: the shared photo is attached`);
      assert.ok(state.kind === "image" && state.preview, `${label}: photo preview in the composer`);
      assert.equal(state.text, "Last night at the Central", `${label}: shared text in the box`);
      assert.equal(state.overflow, false, `${label}: no sideways scroll`);
      await sharesCleared(page, 5000);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("danzstak_pending_share")), null, `${label}: nothing pending`);
      if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(output, `1-photo-in-composer-${width}.png`) }); }

      if (width === 390) {
        // Three photos: one post with all three (owner 2026-11-22: up to 20 photos in a post), in the order shared.
        await share(page, ["IMG_1.png", "IMG_2.png", "IMG_3.png"].map(name => ({ b64: png, name, type: "image/png" })));
        await page.waitForFunction(() => window.danzstakSelectedMedia?.file?.name === "IMG_1.png" && (window.danzstakSelectedMedia?.more || []).length === 2, null, { timeout: 15000 });
        await sharesCleared(page, 10000);
        state = await composer(page);
        assert.deepEqual(state.more, ["IMG_2.png", "IMG_3.png"], `${label}: all shared photos go in one post`);
        assert.match(await page.evaluate(() => document.body.innerText), /Album: Mobile uploads/, `${label}: phone photos land in Mobile uploads`);
        if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(output, `3-three-photos-${width}.png`) }); }
        // Video: attached as video; The Roll is automatic for every posted video (no opt-in box since #602).
        await share(page, [{ b64: Buffer.from("not really a video but typed as one").toString("base64"), name: "VID_0007.mp4", type: "video/mp4" }]);
        await page.waitForFunction(() => window.danzstakSelectedMedia?.file?.name === "VID_0007.mp4", null, { timeout: 15000 });
        state = await composer(page);
        assert.ok(state.kind === "video" && state.noRollCheckbox, `${label}: a shared video goes in as a video, no Roll opt-in box`);
        // Audio: refused, nothing kept.
        await share(page, [{ b64: Buffer.from("ID3").toString("base64"), name: "track.mp3", type: "audio/mpeg" }]);
        await page.waitForFunction(() => /can't be posted on DanzStak/.test(document.body?.innerText || ""), null, { timeout: 10000 });
        assert.equal(await shareCount(page), 0, `${label}: audio is never kept`);
        assert.equal(await page.evaluate(() => window.danzstakSelectedMedia?.file?.name || ""), "", `${label}: nothing attached from an audio share`);
      }
      assert.deepEqual(page.errors, [], `${label}: page errors`);
      await context.close();

      // Signed out: the share waits; after sign-in Mix puts it in the composer.
      auth = { signedIn: false };
      ({ context, page } = await open(browser, width, auth));
      await share(page, [{ b64: png, name: "IMG_2042.png", type: "image/png" }], "Soundcheck");
      await page.waitForFunction(() => /Sign in to post what you shared/.test(document.body?.innerText || "") && !location.search.includes("share="), null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => window.danzstakSelectedMedia?.file?.name || ""), "", `${label}: nothing attached while signed out`);
      assert.equal(await shareCount(page), 2, `${label}: the share waits on the phone`);
      if (width === 390) await page.screenshot({ path: path.join(output, `2-signed-out-waits-${width}.png`) });
      auth.signedIn = true;
      await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakSelectedMedia?.file?.name === "IMG_2042.png", null, { timeout: 15000 });
      await sharesCleared(page, 5000); // the hand-off is over (the text goes in just after the scaled photo)
      assert.equal((await composer(page)).text, "Soundcheck", `${label}: after sign-in the text comes back too`);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("danzstak_pending_share")), null);
      assert.deepEqual(page.errors, [], `${label}: page errors`);
      await context.close();
    }
    console.log("Share target checks passed (320, 360, 390, 414, 430): Share → DanzStak opens Mix with the photo attached and the text in the box, videos go in as videos, signed-out shares wait for sign-in, audio is refused, nothing stays on the phone afterwards.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
