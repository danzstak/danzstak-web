"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const edgePath = process.env.DANZSTAK_EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = path.resolve(process.env.DANZSTAK_VIDEO_LAYOUT_OUTPUT || "docs/screenshots/video-layout");
const assetBase = String(process.env.DANZSTAK_MEDIA_ASSET_BASE || "").replace(/\/$/, "");
fs.mkdirSync(output, { recursive: true });

function asset(name) {
  return assetBase ? { url: `${assetBase}/assets/${name}` } : { path: path.join(root, "assets", name.replace(/\?.*$/, "")) };
}

(async () => {
  assert.ok(fs.existsSync(edgePath), `Microsoft Edge not found at ${edgePath}`);
  const browser = await chromium.launch({ executablePath: edgePath, headless: true, args: ["--disable-gpu"] });
  try {
    for (const width of [320, 390, 414, 1024]) {
      const context = await browser.newContext({ viewport: { width, height: 820 }, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route(/https:\/\/(?:www\.)?(?:youtube-nocookie\.com|tiktok\.com|instagram\.com|facebook\.com|player\.vimeo\.com)\/.*/, route => {
        const host = new URL(route.request().url()).hostname;
        const colors = { "www.youtube-nocookie.com": "#e63946", "www.tiktok.com": "#14b8a6", "www.instagram.com": "#a855f7", "www.facebook.com": "#2563eb", "player.vimeo.com": "#06b6d4" };
        return route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${colors[host] || "#f59e0b"}}body{display:grid;place-items:center;color:white;font:700 20px Arial}</style><body>${host}</body>` });
      });
      await page.setContent(`<!doctype html><style>
        *{box-sizing:border-box}body{margin:0;padding:12px;background:#eef2f6;font-family:Arial}.post{--post-inline-padding:12px;width:min(100%,420px);margin:0 auto 18px;padding:12px;background:#fff}.post h2{margin:0 0 8px;font-size:15px}.reels-list{display:grid;gap:16px;width:min(100%,420px);margin:auto}.reel-card{display:block!important;min-height:0!important;width:100%!important;background:#fff!important}.reel-card>iframe,.reel-card>.danzstak-media-shell{width:100%}
      </style><main id="native"></main><section class="reels-list" id="providers"></section>`);
      await page.addStyleTag(asset("feed-enhancements.css?v=487"));
      await page.addStyleTag(asset("responsive-media.css?v=9"));
      await page.addScriptTag(asset("icon-buttons.js?v=7"));

      await page.evaluate(() => {
        const native = document.querySelector("#native");
        for (const [id, dimensions] of Object.entries({ landscape: [320, 180], square: [240, 240], portrait: [180, 320] })) {
          const post = document.createElement("article"); post.className = "post";
          post.innerHTML = `<h2>${id}</h2>`;
          const video = document.createElement("video"); video.id = id; video.className = "post-media"; video.controls = true; video.playsInline = true;
          video.dataset.expectedRatio = String(dimensions[0] / dimensions[1]);
          const colors = { landscape: "#f97316", square: "#22c55e", portrait: "#3b82f6" };
          video.poster = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions[0]}" height="${dimensions[1]}"><rect width="100%" height="100%" fill="${colors[id]}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial" font-size="28" font-weight="700">${id}</text></svg>`);
          post.append(video); native.append(post);
        }
        const providers = [
          ["youtube", "landscape", "16/9", "https://www.youtube-nocookie.com/embed/test?enablejsapi=1"],
          ["tiktok", "portrait", "9/16", "https://www.tiktok.com/player/v1/123"],
          ["instagram", "portrait", "9/16", "https://www.instagram.com/reel/test/embed/"],
          ["facebook", "landscape", "16/9", "https://www.facebook.com/plugins/video.php?href=test"],
          ["vimeo", "landscape", "16/9", "https://player.vimeo.com/video/123"]
        ];
        for (const [provider, layout, aspect, src] of providers) {
          const card = document.createElement("article"); card.className = "reel-card";
          const frame = document.createElement("iframe"); frame.className = "reel-player"; frame.src = src; frame.dataset.provider = provider; frame.dataset.videoLayout = layout; frame.style.setProperty("--ds-media-aspect", aspect);
          card.append(frame); providers && document.querySelector("#providers").append(card);
        }
      });
      await page.addScriptTag(asset("media-visibility.js?v=390"));
      await page.addScriptTag(asset("responsive-media.js?v=3"));
      await page.evaluate(() => {
        for (const [id, width, height, color] of [["landscape", 320, 180, "#f97316"], ["square", 240, 240, "#22c55e"], ["portrait", 180, 320, "#3b82f6"]]) {
          const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
          const drawing = canvas.getContext("2d"); drawing.fillStyle = color; drawing.fillRect(0, 0, width, height);
          drawing.fillStyle = "white"; drawing.font = "bold 24px Arial"; drawing.fillText(id, 12, 34);
          document.getElementById(id).srcObject = canvas.captureStream(10);
        }
      });
      await page.waitForFunction(() => [...document.querySelectorAll("video.post-media")].every(video => video.videoWidth && video.closest(".danzstak-media-shell")?.style.getPropertyValue("--ds-media-aspect")));
      await page.waitForSelector('[data-provider="youtube"]');
      await page.waitForTimeout(150);

      const nativeGeometry = await page.locator("video.post-media").evaluateAll(videos => videos.map(video => {
        const shell = video.closest(".danzstak-media-shell");
        const box = video.getBoundingClientRect(), shellBox = shell.getBoundingClientRect();
        return { id: video.id, expected: Number(video.dataset.expectedRatio), actual: box.width / box.height, topGap: box.top - shellBox.top, bottomGap: shellBox.bottom - box.bottom, videoBackground: getComputedStyle(video).backgroundColor, shellBackground: getComputedStyle(shell).backgroundColor };
      }));
      for (const item of nativeGeometry) {
        assert.ok(Math.abs(item.actual - item.expected) < .025, `${width}px ${item.id}: native video ratio changed: ${JSON.stringify(item)}`);
        assert.ok(Math.abs(item.topGap) <= 1 && Math.abs(item.bottomGap) <= 1, `${width}px ${item.id}: DANZSTAK wrapper introduced a strip: ${JSON.stringify(item)}`);
        assert.equal(item.videoBackground, "rgba(0, 0, 0, 0)", `${width}px ${item.id}: native video must not paint a black loading strip`);
        assert.equal(item.shellBackground, "rgba(0, 0, 0, 0)", `${width}px ${item.id}: feed wrapper must be transparent`);
      }
      const providerGeometry = await page.locator("iframe.reel-player").evaluateAll(frames => frames.map(frame => {
        const box = frame.getBoundingClientRect(), shell = frame.closest(".danzstak-media-shell"), shellBox = shell?.getBoundingClientRect();
        const expected = frame.dataset.videoLayout === "portrait" ? 9 / 16 : frame.dataset.videoLayout === "square" ? 1 : 16 / 9;
        return { provider: frame.dataset.provider, expected, actual: box.width / box.height, top: box.top, bottom: box.bottom, topGap: shellBox ? box.top - shellBox.top : 0, bottomGap: shellBox ? shellBox.bottom - box.bottom : 0, shellBackground: shell ? getComputedStyle(shell).backgroundColor : "none" };
      }));
      for (const [index, item] of providerGeometry.entries()) {
        assert.ok(Math.abs(item.actual - item.expected) < .025, `${width}px ${item.provider}: provider frame ratio changed: ${JSON.stringify(item)}`);
        assert.ok(Math.abs(item.topGap) <= 1 && Math.abs(item.bottomGap) <= 1, `${width}px ${item.provider}: provider wrapper introduced a strip: ${JSON.stringify(item)}`);
        if (index) assert.ok(item.top >= providerGeometry[index - 1].bottom, `${width}px ${item.provider}: provider cards overlap`);
        if (item.provider === "youtube") assert.equal(item.shellBackground, "rgba(0, 0, 0, 0)", `${width}px YouTube wrapper must not paint a black strip`);
      }
      await page.screenshot({ path: path.join(output, `video-layout-${width}.png`), fullPage: true, animations: "disabled" });
      await context.close();
    }
    console.log("Video layout checks passed: native landscape/square/portrait and YouTube, TikTok, Instagram, Facebook and Vimeo frames retain their intended ratio with no DANZSTAK-created black strip.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
