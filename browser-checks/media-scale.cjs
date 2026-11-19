"use strict";
// Owner 2026-11-19: photos scaled to 720p before upload (landscape inside 1280×720, portrait inside 720×1280), the page's
// own picker handler gets the smaller file exactly once, small photos and GIFs pass through untouched.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><input type="file" id="pick" multiple><input type="file" id="raw" data-no-scale><script>
      window.seen = [];
      for (const id of ["pick", "raw"]) document.getElementById(id).addEventListener("change", async event => {
        const out = [];
        for (const file of event.target.files) { let w = 0, h = 0; try { const b = await createImageBitmap(file); w = b.width; h = b.height; } catch {} out.push({ name: file.name, type: file.type, size: file.size, w, h }); }
        window.seen.push({ id, out });
      });
    </script>`);
    await page.addScriptTag({ path: path.resolve(__dirname, "..", "assets", "media-scale.js") });
    const make = async (w, h, type) => page.evaluate(async ([w, h, type]) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
      for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 7},80%,${30 + i % 40}%)`; g.fillRect(Math.random() * w, Math.random() * h, w / 8, h / 8); }
      const blob = await new Promise(r => c.toBlob(r, type, 0.95));
      return [...new Uint8Array(await blob.arrayBuffer())];
    }, [w, h, type]);
    const files = [
      { name: "wide.jpg", mimeType: "image/jpeg", buffer: Buffer.from(await make(4000, 3000, "image/jpeg")) },
      { name: "tall.png", mimeType: "image/png", buffer: Buffer.from(await make(1000, 3000, "image/png")) },
      { name: "small.jpg", mimeType: "image/jpeg", buffer: Buffer.from(await make(640, 480, "image/jpeg")) }
    ];
    await page.setInputFiles("#pick", files);
    await page.waitForFunction(() => window.seen.length >= 1, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const seen = await page.evaluate(() => window.seen);
    assert.equal(seen.length, 1, "the page's handler runs once, with the scaled files");
    const [wide, tall, small] = seen[0].out;
    assert.deepEqual([wide.w, wide.h, wide.type], [960, 720, "image/jpeg"], "landscape fits 1280×720 (4:3 → 960×720)");
    assert.ok(wide.size < files[0].buffer.length, "smaller file");
    assert.deepEqual([tall.w, tall.h, tall.type], [427, 1280, "image/png"], "portrait fits 720×1280");
    assert.deepEqual([small.w, small.h, small.size], [640, 480, files[2].buffer.length], "small photos are never scaled up or re-encoded");
    await page.setInputFiles("#raw", [files[0]]);
    await page.waitForFunction(() => window.seen.length >= 2);
    const raw = (await page.evaluate(() => window.seen[1])).out[0];
    assert.deepEqual([raw.w, raw.h], [4000, 3000], "data-no-scale opts out");
    console.log("Media scale browser check passed: 4000×3000 → 960×720, 1000×3000 → 427×1280, small and opt-out untouched, one handler call.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
