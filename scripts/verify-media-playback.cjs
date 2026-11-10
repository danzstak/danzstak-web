"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const root = path.resolve(__dirname, "..");
const assetBase = String(process.env.DANZSTAK_MEDIA_ASSET_BASE || "").replace(/\/$/, "");

(async () => {
  assert.ok(fs.existsSync(edgePath), `Microsoft Edge not found at ${edgePath}`);
  const browser = await chromium.launch({ executablePath: edgePath, headless: true, args: ["--disable-gpu"] });
  try {
    console.log("Browser playback: browser launched");
    const context = await browser.newContext({ viewport: { width: 390, height: 720 } });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.route("https://www.youtube-nocookie.com/embed/test**", route => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><script>
        window.commands=[];
        addEventListener('message',event=>{let data=event.data;try{if(typeof data==='string')data=JSON.parse(data)}catch{return}if(data?.event==='command'){commands.push(data.func);if(data.func==='unMute')parent.postMessage(JSON.stringify({event:'infoDelivery',info:{muted:false}}),'*');if(data.func==='mute')parent.postMessage(JSON.stringify({event:'infoDelivery',info:{muted:true}}),'*')}});
      <\/script>`
    }));
    await page.setContent(`<!doctype html><style>
      *{box-sizing:border-box}body{margin:0;background:#eee}.stage{height:620px;margin:20px 0 500px;background:#111}.stage video,.stage iframe{display:block;width:100%;height:100%;border:0}.danzstak-media-shell{height:100%}
    </style><main id="root"></main>`);
    console.log("Browser playback: shell loaded");
    await page.addScriptTag(assetBase ? { url: `${assetBase}/assets/icon-buttons.js?v=7` } : { path: path.join(root, "assets", "icon-buttons.js") });
    console.log("Browser playback: icons loaded");
    await page.addStyleTag(assetBase ? { url: `${assetBase}/assets/responsive-media.css?v=9` } : { path: path.join(root, "assets", "responsive-media.css") });
    await page.addScriptTag(assetBase ? { url: `${assetBase}/assets/media-visibility.js?v=390` } : { path: path.join(root, "assets", "media-visibility.js") });
    console.log("Browser playback: coordinator loaded");

    await page.evaluate(() => {
      const root = document.querySelector("#root");
      function nativeStage(id) {
        const stage = document.createElement("section"); stage.className = "stage";
        const video = document.createElement("video"); video.id = id; video.className = "post-media"; video.controls = true; video.playsInline = true;
        stage.append(video); root.append(stage);
      }
      nativeStage("first");
      nativeStage("second");
      const youtubeStage = document.createElement("section"); youtubeStage.className = "stage";
      const frame = document.createElement("iframe"); frame.id = "youtube"; frame.className = "reel-player";
      frame.src = "https://www.youtube-nocookie.com/embed/test?autoplay=0&mute=1&enablejsapi=1";
      youtubeStage.append(frame); root.append(youtubeStage);
    });
    console.log("Browser playback: media nodes inserted");
    await page.evaluate(() => {
      for (const [id, color] of [["first", "#1769e0"], ["second", "#ef6c20"]]) {
        const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
        const context = canvas.getContext("2d"); context.fillStyle = color; context.fillRect(0, 0, 320, 180);
        document.getElementById(id).srcObject = canvas.captureStream(15);
        window[id + "Canvas"] = canvas;
      }
    });
    console.log("Browser playback: streams attached");

    await page.waitForSelector("#first");
    await page.waitForTimeout(500);
    console.log("Browser playback: fixtures loaded");
    let state = await page.evaluate(() => ({ firstPaused: first.paused, secondPaused: second.paused, firstMuted: first.muted, secondMuted: second.muted }));
    assert.deepEqual(state, { firstPaused: true, secondPaused: true, firstMuted: true, secondMuted: true }, "opening DanzStak must not start or unmute native videos");

    await page.locator("#first").evaluate(element => { element.closest(".danzstak-media-shell").querySelector(".danzstak-audio-toggle").dataset.testAudio = "first"; });
    await page.locator('[data-test-audio="first"]').click();
    console.log("Browser playback: first control clicked");
    await page.waitForFunction(() => !first.paused && first.currentTime > 0.05 && !first.muted, null, { timeout: 5000 });

    await page.locator("#second").scrollIntoViewIfNeeded();
    console.log("Browser playback: scrolled to second");
    await page.waitForTimeout(350);
    state = await page.evaluate(() => ({ firstPaused: first.paused, firstMuted: first.muted, secondPaused: second.paused, secondMuted: second.muted }));
    assert.deepEqual(state, { firstPaused: true, firstMuted: true, secondPaused: true, secondMuted: true }, "scrolling away must pause and mute the previous player without autoplaying the next");

    await page.locator("#second").evaluate(element => { element.closest(".danzstak-media-shell").querySelector(".danzstak-audio-toggle").dataset.testAudio = "second"; });
    await page.locator('[data-test-audio="second"]').click();
    console.log("Browser playback: second control clicked");
    await page.waitForFunction(() => !second.paused && second.currentTime > 0.05 && !second.muted && first.paused && first.muted, null, { timeout: 5000 });
    await page.evaluate(() => dispatchEvent(new CustomEvent("danzstak:message-drawer", { detail: { open: true } })));
    await page.waitForFunction(() => first.paused && second.paused && first.muted && second.muted);

    await page.locator("#youtube").scrollIntoViewIfNeeded();
    console.log("Browser playback: scrolled to YouTube");
    await page.waitForTimeout(500);
    const youtubeFrame = page.frames().find(frame => frame.url().includes("youtube-nocookie.com/embed/test"));
    assert.ok(youtubeFrame, "the controlled YouTube test player should load");
    let commands = await youtubeFrame.evaluate(() => commands.slice());
    assert.equal(commands.includes("playVideo"), false, "a visible YouTube player must not autoplay");
    await page.locator("#youtube").evaluate(element => { element.closest(".danzstak-media-shell").querySelector(".danzstak-audio-toggle").dataset.testAudio = "youtube"; });
    await page.locator('[data-test-audio="youtube"]').click();
    await page.waitForTimeout(200);
    commands = await youtubeFrame.evaluate(() => commands.slice());
    assert.ok(commands.includes("playVideo") && commands.includes("unMute"), "explicit YouTube interaction must use the provider API");
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(350);
    commands = await youtubeFrame.evaluate(() => commands.slice());
    assert.ok(commands.includes("pauseVideo") && commands.includes("mute"), "an off-screen YouTube player must be paused and muted through its API");

    console.log("Real-browser media playback checks passed: no startup autoplay, explicit native/YouTube playback, 60% viewport pause, navigation pause, muted return, and one audio owner.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
