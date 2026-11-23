"use strict";

// T0-A3 (owner 2026-11-19): "The Roll goes silent when it opens full screen" and the full-screen video did not fill the
// screen (strip at the lower right, grey bar above the header, bottom cut off). The member's sound choice carries over
// inline -> full screen -> back, only a tap changes it, a fresh visit stays muted, and the next video inherits it.
// Taps land on the centre of the speaker icon (Manager's plan: tap icons, not button boxes).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_LOCAL_URL || process.env.DANZSTAK_FEED_ORIGIN || "http://127.0.0.1:8017").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const viewports = [[320, 568], [360, 780], [390, 844], [414, 896], [430, 932], [1366, 900]];
const me = "11111111-1111-4111-8111-111111111111";
const posts = ["a", "b", "c"].map((name, index) => ({ // three: the owner's rule is checked over three videos in a row
  postId: `roll-sound-${name}`, userId: me, authorName: "Roll Sound Test", content: `Roll video ${name}`,
  createdAt: `2026-11-1${8 - index}T18:00:00.000Z`, audience: "public", isOwner: true, mediaType: "video",
  mediaKey: `uploads/roll-sound-${name}.webm`, mediaUrl: `https://media.example.invalid/roll-sound-${name}.webm`,
  reel: true, viewCount: 3, commentPolicy: "everyone",
  mediaRatio: 0.5625 // every post the app saves carries its shape (F22), so nothing above The Roll jumps when videos load
}));
function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: me, email: "roll-sound@danzstak.invalid" } };
  if (pathname === "/profiles" || pathname === "/profile") return { profile: { memberId: me, name: "Roll Sound Test", handle: "rollsound", isOwner: true } };
  if (pathname === "/secure-posts") return { posts };
  if (pathname === "/stories") return { dailyTakeCount: 0, stories: [], reels: [] };
  if (pathname === "/engagement") return { myReaction: "", reactionCounts: {}, comments: [] };
  return {};
}

// A 5-second portrait WebM with an audio track, recorded in the browser so no binary lives in the repository.
async function recordClip(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent('<canvas id="frame" width="360" height="640"></canvas>');
    const bytes = await page.evaluate(async () => {
      const canvas = document.querySelector("#frame"), paint = canvas.getContext("2d");
      const audio = new AudioContext(), tone = audio.createOscillator(), out = audio.createMediaStreamDestination();
      tone.connect(out); tone.start();
      const stream = new MediaStream([...canvas.captureStream(15).getVideoTracks(), ...out.stream.getAudioTracks()]);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      for (let frame = 0; frame < 75; frame += 1) {
        paint.fillStyle = frame % 30 < 15 ? "#ff5a1f" : "#e85015"; paint.fillRect(0, 0, 360, 640);
        paint.fillStyle = "#fff"; paint.font = "900 40px Arial"; paint.textAlign = "center"; paint.fillText("THE ROLL", 180, 330);
        await new Promise(resolve => setTimeout(resolve, 66));
      }
      recorder.stop(); await stopped;
      stream.getTracks().forEach(track => track.stop()); tone.stop(); await audio.close();
      return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
    });
    return Buffer.from(bytes);
  } finally { await context.close(); }
}

const rollState = page => page.evaluate(() => {
  const rail = document.querySelector(".reels-rail");
  const videos = [...document.querySelectorAll("video.reel-player")];
  const playing = videos.filter(video => !video.paused);
  const active = playing[0] || null;
  const toggle = active?.closest(".danzstak-media-shell")?.querySelector(".danzstak-audio-toggle");
  return {
    full: Boolean(rail?.classList.contains("roll-fullscreen")),
    playing: playing.map(video => ({ src: video.currentSrc.split("/").pop(), muted: video.muted })),
    audible: videos.filter(video => !video.paused && !video.muted).length,
    toggle: toggle?.getAttribute("aria-label") || ""
  };
});

// Tap the centre of the speaker icon of the playing Roll video, after proving the centre belongs to that button.
async function tapSpeaker(page, touch, label) {
  const point = await page.evaluate(() => {
    const video = [...document.querySelectorAll("video.reel-player")].find(item => !item.paused);
    const button = video?.closest(".danzstak-media-shell")?.querySelector(".danzstak-audio-toggle");
    if (!button) return null;
    const icon = button.querySelector("svg,.ds-action-icon") || button, box = icon.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2, hit = document.elementFromPoint(x, y);
    return { x, y, owns: Boolean(hit && (hit === button || button.contains(hit))) };
  });
  assert.ok(point, `${label}: no speaker button on the playing Roll video`);
  assert.equal(point.owns, true, `${label}: the speaker icon's centre is covered by another element`);
  if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
}

async function tapTile(page, touch, label) {
  const trigger = page.locator(".reels-rail:not(.roll-fullscreen) .reel-fullscreen-trigger").first();
  await trigger.scrollIntoViewIfNeeded();
  const box = await trigger.boundingBox();
  assert.ok(box, `${label}: The Roll tile is not visible`);
  const x = box.x + box.width / 2, y = box.y + box.height / 3;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  await page.locator(".reels-rail.roll-fullscreen").waitFor({ state: "visible" });
}

async function openFeed(browser, clip, width, height) {
  const touch = width < 700;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://media.example.invalid/**", route => route.fulfill({ status: 200, contentType: "video/webm", body: clip }));
  await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()).pathname)) }));
  await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
  await page.locator("video.reel-player").first().waitFor({ state: "attached", timeout: 15000 });
  await page.locator(".reels-rail").evaluate(rail => rail.scrollIntoView({ block: "center" }));
  await page.waitForFunction(() => [...document.querySelectorAll("video.reel-player")].some(video => !video.paused), null, { timeout: 10000 });
  return { context, page, errors, touch };
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const clip = await recordClip(browser);
    for (const [width, height] of viewports) {
      const label = `${width}px`;
      // 1. Sound turned on inline stays on in full screen, and the full-screen video fills the screen.
      let { context, page, errors, touch } = await openFeed(browser, clip, width, height);
      assert.equal((await rollState(page)).playing[0]?.muted, true, `${label}: The Roll strip must autoplay muted`);
      await tapSpeaker(page, touch, `${label} inline`);
      await page.waitForFunction(() => [...document.querySelectorAll("video.reel-player")].some(video => !video.paused && !video.muted));
      await tapTile(page, touch, label);
      await page.waitForTimeout(700);
      let state = await rollState(page);
      assert.equal(state.full, true, `${label}: tapping the tile must open The Roll full screen`);
      assert.equal(state.audible, 1, `${label}: sound turned on in the strip must carry into full screen: ${JSON.stringify(state)}`);
      // Owner 2026-11-19: "every 3rd video the sound goes off in the roll". Mix reloading its posts (a phone does it after
      // its connection comes back) rebuilt The Roll and stopped the playing video; it must keep playing with its sound.
      await page.evaluate(() => { window.__rollVideo = [...document.querySelectorAll("video.reel-player")].find(video => !video.paused); window.dispatchEvent(new CustomEvent("danzstak:posts-loaded", { detail: { posts: window.danzstakLoadedPosts || [] } })); });
      await page.waitForTimeout(800);
      const kept = await page.evaluate(() => ({ playing: Boolean(window.__rollVideo?.isConnected && !window.__rollVideo.paused), muted: window.__rollVideo?.muted }));
      assert.deepEqual(kept, { playing: true, muted: false }, `${label}: Mix reloading its posts must not stop or mute the playing Roll video`);
      assert.equal(state.toggle, "Mute video", `${label}: the full-screen speaker must show sound on`);
      const geometry = await page.evaluate(() => {
        const rail = document.querySelector(".reels-rail.roll-fullscreen");
        const video = [...rail.querySelectorAll("video.reel-player")].find(item => !item.paused);
        const card = video.closest(".reel-card"), details = card.querySelector(":scope > .ds-ma") || card.querySelector(".reel-details"); // F1a: the rail's caption layer (gradient edge to edge) replaces the old strip
        const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
        const links = [...details.querySelectorAll("a,button")].filter(node => node.checkVisibility()).map(box);
        return { vw: innerWidth, vh: innerHeight, card: box(card), details: box(details), links, padding: getComputedStyle(rail).padding, background: getComputedStyle(rail).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      const near = (a, b) => Math.abs(a - b) <= 1;
      assert.ok(near(geometry.card.left, 0) && near(geometry.card.top, 0) && near(geometry.card.right, geometry.vw) && near(geometry.card.bottom, geometry.vh), `${label}: the full-screen video must fill the screen exactly: ${JSON.stringify(geometry.card)}`);
      assert.equal(geometry.padding, "0px", `${label}: no strip padding in full screen (grey bar, video pushed down)`);
      assert.equal(geometry.background, "rgb(5, 5, 8)", `${label}: the full-screen Roll is dark edge to edge`);
      assert.ok(near(geometry.details.left, 0) && near(geometry.details.right, geometry.vw), `${label}: the caption runs edge to edge (no strip at the lower right): ${JSON.stringify(geometry.details)}`);
      assert.ok(geometry.details.bottom <= geometry.vh + 1 && geometry.links.every(link => link.bottom <= geometry.vh + 1 && link.right <= geometry.vw + 1), `${label}: nothing in the caption is cut off: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.overflow, false, `${label}: full screen must not scroll sideways`);
      if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `roll-fullscreen-sound-${width}.png`) }); }

      // 4. The next video inherits the sound, and only one video plays (checked once, at 390px).
      if (width === 390) {
        const first = state.playing[0].src;
        await page.locator(".reels-rail.roll-fullscreen .reels-list").evaluate(list => { const next = list.querySelectorAll(".reel-card")[1]; list.scrollTo({ top: next.offsetTop }); });
        await page.waitForFunction(src => [...document.querySelectorAll("video.reel-player")].some(video => !video.paused && !video.currentSrc.endsWith(src)), first, { timeout: 5000 });
        await page.waitForTimeout(400);
        const next = await rollState(page);
        assert.equal(next.playing.length, 1, `${label}: only one Roll video may play: ${JSON.stringify(next)}`);
        assert.notEqual(next.playing[0].src, first, `${label}: scrolling must move to the next video`);
        assert.equal(next.playing[0].muted, false, `${label}: the next video inherits sound on: ${JSON.stringify(next)}`);
        await page.locator(".reels-rail.roll-fullscreen .reels-list").evaluate(list => list.scrollTo({ top: 0 }));
        await page.waitForFunction(src => [...document.querySelectorAll("video.reel-player")].some(video => !video.paused && video.currentSrc.endsWith(src)), first, { timeout: 5000 });
        // Directive F2 (owner: "each video I have to turn the audio on"): when a video plays to its end, The Roll moves on
        // by itself and the next video keeps the sound. Real playback: the 5-second clip runs out on its own.
        await page.waitForFunction(src => [...document.querySelectorAll("video.reel-player")].some(video => !video.paused && !video.currentSrc.endsWith(src)), first, { timeout: 12000 });
        await page.waitForTimeout(400);
        const advanced = await rollState(page);
        assert.equal(advanced.playing.length, 1, `${label}: after auto-advance only one Roll video plays: ${JSON.stringify(advanced)}`);
        assert.equal(advanced.playing[0].muted, false, `${label}: the auto-advanced video keeps the sound on: ${JSON.stringify(advanced)}`);
        assert.equal(advanced.audible, 1, `${label}: never two audible players: ${JSON.stringify(advanced)}`);
        assert.equal(advanced.toggle, "Mute video", `${label}: the speaker on the auto-advanced video shows sound on`);
        await page.locator(".reels-rail.roll-fullscreen .reels-list").evaluate(list => list.scrollTo({ top: 0 }));
        await page.waitForFunction(src => [...document.querySelectorAll("video.reel-player")].some(video => !video.paused && video.currentSrc.endsWith(src)), first, { timeout: 5000 });
        // Owner, 2026-11-19 6:32 pm: "In The Roll when sound is on the next video should have sound on; when the sound is
        // off the next video should have sound off." Three videos in a row: sound on carries to the second and the third;
        // turning it off on the third carries back to the second.
        const goTo = async index => {
          await page.locator(".reels-rail.roll-fullscreen .reels-list").evaluate((list, at) => list.scrollTo({ top: list.querySelectorAll(".reel-card")[at].offsetTop }), index);
          await page.waitForFunction(at => { const video = document.querySelectorAll(".reels-rail.roll-fullscreen .reel-card")[at]?.querySelector("video.reel-player"); return video && !video.paused; }, index, { timeout: 5000 });
          await page.waitForTimeout(400);
          return rollState(page);
        };
        for (const index of [1, 2]) {
          const at = await goTo(index);
          assert.deepEqual([at.playing.length, at.playing[0]?.muted, at.audible], [1, false, 1], `${label}: video ${index + 1} of 3 follows sound on: ${JSON.stringify(at)}`);
        }
        await tapSpeaker(page, touch, `${label} third video`);
        await page.waitForFunction(() => [...document.querySelectorAll("video.reel-player")].every(video => video.paused || video.muted));
        const back = await goTo(1);
        assert.deepEqual([back.playing.length, back.playing[0]?.muted, back.audible, back.toggle], [1, true, 0, "Unmute video"], `${label}: sound off on the third video carries to the next one played: ${JSON.stringify(back)}`);
        // Sound back on for the rest of this run (the next step mutes in full screen and checks the strip).
        await goTo(0);
        await tapSpeaker(page, touch, `${label} first video again`);
        await page.waitForFunction(() => [...document.querySelectorAll("video.reel-player")].some(video => !video.paused && !video.muted));
      }

      // 2. Muting in full screen carries back to Mix.
      await tapSpeaker(page, touch, `${label} full screen`);
      await page.waitForFunction(() => [...document.querySelectorAll("video.reel-player")].every(video => video.paused || video.muted));
      await page.goBack();
      await page.locator(".reels-rail.roll-fullscreen").waitFor({ state: "detached" }).catch(() => {});
      await page.waitForFunction(() => !document.querySelector(".reels-rail")?.classList.contains("roll-fullscreen"));
      await page.waitForTimeout(700);
      state = await rollState(page);
      assert.equal(state.audible, 0, `${label}: muting in full screen must carry back to the strip: ${JSON.stringify(state)}`);
      assert.deepEqual(errors, [], `${label}: page errors: ${errors.join(" | ")}`);
      await context.close();

      // 3. A fresh visit with no tap opens the full-screen Roll muted (visibility or opening never turns sound on).
      ({ context, page, errors, touch } = await openFeed(browser, clip, width, height));
      await tapTile(page, touch, `${label} fresh`);
      await page.waitForTimeout(700);
      state = await rollState(page);
      assert.equal(state.full, true, `${label} fresh: The Roll opens full screen`);
      assert.equal(state.audible, 0, `${label} fresh: without a tap on a speaker the full-screen Roll stays muted: ${JSON.stringify(state)}`);
      assert.equal(state.toggle, "Unmute video", `${label} fresh: the speaker shows sound off`);
      assert.deepEqual(errors, [], `${label} fresh: page errors: ${errors.join(" | ")}`);
      await context.close();
    }
    console.log(`The Roll full-screen checks passed at ${viewports.map(([width]) => width).join(", ")}px: sound carries in and back, fresh visits stay muted, the next video inherits it, and full screen fills the screen.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
