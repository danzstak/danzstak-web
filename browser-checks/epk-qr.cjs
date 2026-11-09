"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const QRCode = require("../infrastructure/auth-api/node_modules/qrcode");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.2:8023").replace(/\/$/, "");
const captureDir = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/epk-qr");
const liveQr = process.env.DANZSTAK_LIVE_QR === "1";
const widths = [320, 360, 390, 414, 430, 1366];
const kit = { artistName:"Night Circuit", hometown:"Berlin, Germany", actType:"electronic", look:"techno", genres:["Techno"], shortPitch:"A hardware live set ready for independent rooms.", publicDetails:{}, media:[] };

(async () => {
  const encodedUrl = "https://danzstak.com/epk.html?id=night-circuit";
  const qrSvg = await QRCode.toString(encodedUrl, { type:"svg", errorCorrectionLevel:"M", margin:2, width:512 });
  fs.mkdirSync(captureDir, { recursive:true });
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:900 }, serviceWorkers:"block" });
      const page = await context.newPage(), errors = [], requests = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => { if (request.url() === "https://api.danzstak.com/epk/qr" && request.method() === "POST") requests.push(JSON.parse(request.postData() || "{}")); });
      await page.route("https://api.danzstak.com/epk/public/**", route => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ kit, private:false }) }));
      if (!liveQr) await page.route("https://api.danzstak.com/epk/qr", route => route.fulfill({ status:200, contentType:"image/svg+xml", body:qrSvg }));
      await page.goto(`${baseUrl}/epk.html?id=night-circuit`, { waitUntil:"networkidle" });
      await page.getByRole("button", { name:"QR code" }).click();
      await page.getByRole("heading", { name:"Share this EPK" }).waitFor();
      await page.locator("#epkQrImage[src^='data:image/svg+xml']").waitFor();
      assert.deepEqual(requests, [{ url:encodedUrl }]);
      assert.equal(await page.locator("#downloadEpkQr").getAttribute("download"), "night-circuit-qr.svg");
      assert.ok((await page.locator("#closeEpkQr").boundingBox()).height >= 44, `close target is too short at ${width}px`);
      assert.ok((await page.locator("#downloadEpkQr").boundingBox()).height >= 44, `download target is too short at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `QR dialog overflowed at ${width}px`);
      assert.deepEqual(errors, []);
      if ([390,1366].includes(width)) await page.screenshot({ path:path.join(captureDir, `epk-qr-${width}.png`), fullPage:true });
      await page.getByRole("button", { name:"Close QR code" }).click();
      assert.equal(await page.locator("#epkQrDialog").evaluate(dialog => dialog.open), false);
      await context.close();
    }
    console.log("EPK QR browser checks passed: exact published link, visible/downloadable SVG, accessible targets, no overflow, and clean close at six widths.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
