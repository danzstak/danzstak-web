"use strict";
// Owner 2026-11-23 (a video call with a desktop, his screenshots at 0:08 and 1:02): "Control panel in video it should hide
// when the answer should hide from both". Real browser, touch, a real answered video call (a second RTCPeerConnection
// plays the other person), at 320/360/390/430px:
//   - right after connecting the top bar, status line and button panel are on show; 4 s later they step aside, the other
//     person's video and your own camera window stay;
//   - a tap where End was, while they're hidden, only brings them back (the call goes on, nothing pressed);
//   - a tap on the video while they're on show puts them away again;
//   - they stay on show while More's sheet is open and while the call is reconnecting;
//   - a voice call keeps its buttons.
// Both sides of a call run this same screen (sync-call-ui.js), so this covers the caller and the person who answered.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/call-chrome-hide.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });

async function setup(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: ["camera", "microphone"] });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return json(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "me@x.test" } });
    if (p === "/conversations") return json(route, { conversations: [{ contactEmail: "dee@x.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Dee", preview: "Ready", updatedAt: "2026-11-19T12:00:00.000Z", canContact: true }] });
    if (p === "/calls/ice") return json(route, { iceServers: [], expiresAt: Date.now() + 300000 });
    return json(route, { events: [] });
  });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().click();
  await page.locator("body.is-conversation-open").waitFor();
  return { context, page, errors };
}

// The same answered call as sync-call-screen-ui.cjs: each description crosses once its candidates are gathered.
async function call(page, kind) {
  await page.evaluate(async kind => {
    const wait = async (ok, ms) => { const t0 = performance.now(); while (!ok()) { if (performance.now() - t0 > ms) throw new Error("no connect"); await new Promise(r => setTimeout(r, 50)); } };
    const gathered = pc => pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise(resolve => {
      const done = () => { if (pc.iceGatheringState === "complete") { clearTimeout(cap); pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
      const cap = setTimeout(() => { pc.removeEventListener("icegatheringstatechange", done); resolve(); }, 5000);
      pc.addEventListener("icegatheringstatechange", done);
    });
    document.getElementById("contactEmail").value = "dee@x.test"; window.danzstakActiveContactName = "Dee";
    const caller = new RTCPeerConnection({ iceServers: [] }), media = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
    media.getTracks().forEach(t => caller.addTrack(t, media)); caller.createDataChannel("danzstak-call", { ordered: true });
    await caller.setLocalDescription(await caller.createOffer()); await gathered(caller);
    await makePeer(kind, { receiving: true }); contactName = "Dee"; // eslint-disable-line no-undef
    await peer.setRemoteDescription(caller.localDescription); await peer.setLocalDescription(await peer.createAnswer()); await gathered(peer); // eslint-disable-line no-undef
    await caller.setRemoteDescription(peer.localDescription);
    await wait(() => channel?.readyState === "open" && peer.connectionState === "connected", 10000); // eslint-disable-line no-undef
  }, kind);
}

const chrome = page => page.evaluate(() => {
  const seen = el => { const style = getComputedStyle(el); return style.visibility === "visible" && Number(style.opacity) > 0.5 && el.getClientRects().length > 0; };
  return {
    flag: document.body.dataset.callChrome || "",
    top: seen(document.querySelector(".conversation > .ds-call-top")), panel: seen(document.getElementById("mediaControls")),
    status: seen(document.getElementById("callStatus")) || !document.getElementById("callStatus").textContent.trim(),
    remote: seen(document.getElementById("remoteVideo")), pip: seen(document.querySelector(".video-grid .local-video")),
    mode: document.body.dataset.callMode || "", muted: document.getElementById("toggleMic").getAttribute("aria-pressed") === "true"
  };
});
const shownState = { top: true, panel: true };
const settle = page => page.waitForTimeout(350); // past the 200 ms fade

async function videoRun(browser, width) {
  const tag = `video ${width}px`;
  const { context, page, errors } = await setup(browser, width);
  await call(page, "video");
  await page.waitForTimeout(1200);
  let state = await chrome(page);
  assert.equal(state.mode, "video", `${tag}: the call is on`);
  assert.ok(state.top && state.panel, `${tag}: the buttons are on show right after connecting (${JSON.stringify(state)})`);
  const end = await page.evaluate(() => { const r = document.getElementById("hangUp").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

  // 4 s after connecting they step aside; both videos stay.
  await page.waitForFunction(() => document.body.dataset.callChrome === "hidden", null, { timeout: 7000 }).catch(() => { throw new Error(`${tag}: the buttons never stepped aside on a connected video call`); });
  await settle(page);
  state = await chrome(page);
  assert.deepEqual({ top: state.top, panel: state.panel, status: state.status }, { top: false, panel: false, status: false }, `${tag}: top bar, panel and status line step aside (${JSON.stringify(state)})`);
  assert.ok(state.remote && state.pip, `${tag}: their video and your camera window stay`);
  if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); await page.screenshot({ path: path.join(captureDir, `call-chrome-hidden-${width}.png`) }); }

  // A tap where End was only brings them back.
  await page.touchscreen.tap(end.x, end.y);
  await settle(page);
  state = await chrome(page);
  assert.equal(state.mode, "video", `${tag}: a tap where End was ended the call while the buttons were hidden`);
  assert.ok(state.top && state.panel && !state.flag, `${tag}: a tap brings the buttons back (${JSON.stringify(state)})`);

  // A tap on the video while they're on show puts them away.
  const vw = await page.evaluate(() => innerWidth);
  await page.touchscreen.tap(vw * 0.3, 420);
  await settle(page);
  state = await chrome(page);
  assert.ok(!state.top && !state.panel, `${tag}: a tap on the video puts the buttons away (${JSON.stringify(state)})`);
  assert.equal(state.muted, false, `${tag}: no button was pressed`);

  // More's sheet open: they stay.
  await page.touchscreen.tap(vw * 0.3, 420);
  await settle(page);
  await page.evaluate(() => document.getElementById("callMore").click());
  await page.waitForTimeout(5000);
  state = await chrome(page);
  assert.ok(state.top && state.panel, `${tag}: the buttons stay while More's sheet is open`);
  await page.evaluate(() => document.querySelector(".ds-call-sheet-close")?.click());

  // Reconnecting: they come back and stay.
  await page.waitForFunction(() => document.body.dataset.callChrome === "hidden", null, { timeout: 7000 });
  await page.evaluate(() => { document.body.dataset.callLink = "reconnecting"; });
  await settle(page);
  assert.ok((await chrome(page)).panel, `${tag}: the buttons come back while the call reconnects`);
  await page.waitForTimeout(5000);
  assert.ok((await chrome(page)).panel, `${tag}: the buttons stay while the call reconnects`);

  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

async function voiceRun(browser, width) {
  const tag = `voice ${width}px`;
  const { context, page, errors } = await setup(browser, width);
  await call(page, "phone");
  await page.waitForTimeout(6000);
  const state = await chrome(page);
  assert.ok(state.top && state.panel && !state.flag, `${tag}: a voice call keeps its buttons (${JSON.stringify(state)})`);
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL;
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  const browser = await chromium.launch(channel === "bundled" ? { headless: true, args } : { channel: channel || "msedge", headless: true, args });
  try {
    for (const width of [320, 360, 390, 430]) await videoRun(browser, width);
    await voiceRun(browser, 390);
  } finally { await browser.close(); }
  console.log("Call button checks passed: on a connected video call the top bar, status and buttons step aside after 4 s (both videos stay), a tap only brings them back, a tap on the video puts them away, they stay for More and while reconnecting, and a voice call keeps them (320-430px).");
})().catch(error => { console.error(error); process.exit(1); });
