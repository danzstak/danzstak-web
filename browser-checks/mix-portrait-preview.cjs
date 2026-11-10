"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const assetOrigin = String(process.env.DANZSTAK_ASSET_ORIGIN || "http://127.0.0.1:8017").replace(/\/$/, "");
const output = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/mix-portrait-preview");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      await page.setContent(`<!doctype html><html><head>
        <link rel="stylesheet" href="${assetOrigin}/assets/responsive-media.css?v=9">
        <style>html,body{margin:0;background:#edf2f8;font:16px Arial}.post{--post-inline-padding:12px;width:100%;box-sizing:border-box;padding:12px}.post-header{display:flex;gap:9px;align-items:center;padding:4px 0 10px}.avatar{width:40px;height:40px;border-radius:50%;background:#1769e0}.copy{display:grid;gap:3px}.copy small{color:#647084}.post-text{margin:0 0 10px;line-height:1.35}.post-actions{display:flex;justify-content:space-around;padding:10px 0}.danzstak-media-shell{margin-top:0!important}</style>
      </head><body><main id="feed"><article class="post">
        <header class="post-header"><span class="avatar"></span><span class="copy"><strong>Touring Artist</strong><small>5m · Public</small></span></header>
        <p class="post-text">New video from tonight's show.</p>
        <span class="danzstak-media-shell danzstak-native-video-shell" data-video-layout="portrait">
          <video class="post-media ds-responsive-media" data-video-layout="portrait" poster="${assetOrigin}/assets/danzstak-share-fb-v2.jpg" controls></video>
        </span>
        <div class="post-actions"><span>Like</span><span>Comment</span><span>Share</span><span>Save</span></div>
      </article></main></body></html>`, { waitUntil: "networkidle" });
      const geometry = await page.evaluate(() => {
        const shell = document.querySelector(".danzstak-native-video-shell");
        const video = shell.querySelector("video");
        const rect = shell.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          ratio: rect.width / rect.height,
          fit: getComputedStyle(video).objectFit,
          videoHeight: video.getBoundingClientRect().height,
          shellHeight: rect.height
        };
      });
      assert.equal(geometry.overflow, false, `${width}px preview overflows horizontally`);
      assert.ok(Math.abs(geometry.ratio - .8) <= .01, `${width}px preview ratio is ${geometry.ratio}, not 4:5`);
      assert.equal(geometry.fit, "cover", `${width}px preview does not fill its frame`);
      assert.ok(Math.abs(geometry.videoHeight - geometry.shellHeight) <= 1, `${width}px video does not fill the preview height`);
      await page.screenshot({ path: path.join(output, `mix-portrait-${width}.png`) });
      await context.close();
    }
    console.log(`Mix portrait preview checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
