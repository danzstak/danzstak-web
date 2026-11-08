"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const coordinatorPath = path.resolve(__dirname, "..", "assets", "media-visibility.js");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>
      body { margin: 0; background: #eef2f7; }
      article { display: grid; align-content: start; padding-top: 18px; }
      video { display: block; width: 100%; height: 360px; background: #111827; object-fit: cover; }
      .danzstak-media-shell { position: relative; display: block; }
      .danzstak-audio-toggle { position: absolute; right: 14px; bottom: 14px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: #111827cc; }
    </style></head><body>
      <article style="height:760px"><video id="first" class="post-media" playsinline></video></article>
      <article style="height:760px"><video id="second" class="post-media" playsinline></video></article>
      <script>
        window.danzstakIcons = { upgrade() {}, create() { return document.createElement('span'); } };
        function attachStream(video, frequency) {
          const canvas = document.createElement('canvas');
          canvas.width = 32; canvas.height = 18;
          canvas.getContext('2d').fillRect(0, 0, 32, 18);
          const stream = canvas.captureStream(10);
          const audio = new AudioContext();
          const oscillator = audio.createOscillator();
          const destination = audio.createMediaStreamDestination();
          oscillator.frequency.value = frequency;
          oscillator.connect(destination);
          oscillator.start();
          destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
          video.srcObject = stream;
        }
        attachStream(document.querySelector('#first'), 220);
        attachStream(document.querySelector('#second'), 330);
      </script>
    </body></html>`);
    await page.addScriptTag({ path: coordinatorPath });
    await page.waitForTimeout(150);

    const initial = await page.evaluate(() => [...document.querySelectorAll("video")].map(video => ({ muted: video.muted, paused: video.paused, autoplay: video.autoplay })));
    assert.deepEqual(initial, [
      { muted: true, paused: true, autoplay: false },
      { muted: true, paused: true, autoplay: false }
    ], "opening the feed must leave every actual browser media element paused and muted");

    await page.evaluate(async () => {
      const first = document.querySelector("#first");
      first.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await first.play();
    });
    await page.locator("#first").evaluate(video => video.closest(".danzstak-media-shell").querySelector(".danzstak-audio-toggle").click());
    await page.waitForTimeout(100);
    let state = await page.evaluate(() => [...document.querySelectorAll("video")].map(video => ({ muted: video.muted, paused: video.paused })));
    assert.deepEqual(state, [
      { muted: false, paused: false },
      { muted: true, paused: true }
    ], "an explicit unmute must grant audio to only the selected in-frame video");

    await page.evaluate(() => scrollTo(0, 760));
    await page.waitForTimeout(250);
    state = await page.evaluate(() => [...document.querySelectorAll("video")].map(video => ({ muted: video.muted, paused: video.paused })));
    assert.equal(state[0].paused, true, "scrolling the active video out of frame must pause it");
    assert.equal(state[0].muted, true, "scrolling the active video out of frame must stop its audio");
    assert.equal(state[1].muted, true, "the newly visible video must not inherit audible playback");

    await page.evaluate(async () => {
      const second = document.querySelector("#second");
      second.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await second.play();
    });
    await page.locator("#second").evaluate(video => video.closest(".danzstak-media-shell").querySelector(".danzstak-audio-toggle").click());
    await page.waitForTimeout(100);
    state = await page.evaluate(() => [...document.querySelectorAll("video")].map(video => ({ muted: video.muted, paused: video.paused })));
    assert.deepEqual(state, [
      { muted: true, paused: true },
      { muted: false, paused: false }
    ], "starting the next video must keep the previous player paused and silent");
    if (captureDir) {
      fs.mkdirSync(captureDir, { recursive: true });
      await page.screenshot({ path: path.join(captureDir, "video-playback-coordinator-390.png"), fullPage: false });
    }

    await page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, value: true }));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(50);
    state = await page.evaluate(() => [...document.querySelectorAll("video")].map(video => ({ muted: video.muted, paused: video.paused })));
    assert.ok(state.every(video => video.muted && video.paused), "backgrounding the app must leave no video playing or audible");

    console.log("Browser video coordinator checks passed: startup silence, one audible player, viewport handoff, and background pause.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
