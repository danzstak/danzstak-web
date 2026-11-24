"use strict";
// Owner 2026-11-24: "when user goes to the desktop the video stops". On a phone's home screen a web app can't use the camera,
// so the other person's picture froze, and on some phones the camera never came back. Real browser, two real
// RTCPeerConnections (this page runs SYNC's chat.js; the other side is a plain peer in the same page), video call, 360/390px:
//   1. this phone goes to the home screen → the other side gets {"type":"call-camera","state":"paused"};
//   2. the phone took the camera away (track ended) → coming back puts a new live camera into the call (the video sender's
//      track is live and new, the self-view shows it, Camera off stays as chosen) and the other side gets "on";
//   3. the other person goes to their home screen → "Dee paused the video" lies over their picture (centre tap hits it),
//      in Italian on an Italian phone; "on" takes it away; hanging up clears it;
//   4. a voice call sends nothing when the phone goes to the home screen.
// Run: node scripts/static-server.cjs 8150 . then DANZSTAK_BASE_URL=http://127.0.0.1:8150 node browser-checks/call-video-away.cjs
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });

async function setup(browser, width, locale = "en-US") {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: ["camera", "microphone"] });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return reply(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "me@x.test" } });
    if (p === "/conversations") return reply(route, { conversations: [{ contactEmail: "dee@x.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Dee", preview: "Ready", updatedAt: "2026-11-19T12:00:00.000Z", canContact: true }] });
    if (p === "/calls/ice") return reply(route, { iceServers: [], expiresAt: Date.now() + 300000 });
    if (p === "/calls/signal") return reply(route, { accepted: true }, 202);
    return reply(route, { events: [] });
  });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().click();
  await page.locator("body.is-conversation-open").waitFor();
  return { context, page, errors };
}

// This page makes the call (chat.js), the other side answers; both send camera and microphone.
async function connect(page, kind) {
  await page.evaluate(async kind => {
    const gathered = pc => pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise(resolve => { const done = () => { if (pc.iceGatheringState === "complete") { clearTimeout(cap); resolve(); } }; const cap = setTimeout(resolve, 5000); pc.addEventListener("icegatheringstatechange", done); });
    const wait = async (ok, ms) => { const t0 = performance.now(); while (!ok()) { if (performance.now() - t0 > ms) throw new Error("no connect"); await new Promise(r => setTimeout(r, 50)); } };
    document.getElementById("contactEmail").value = "dee@x.test"; window.danzstakActiveContactName = "Dee";
    const other = window.__other = new RTCPeerConnection({ iceServers: [] });
    window.__otherGot = [];
    other.addEventListener("datachannel", event => { window.__otherChannel = event.channel; event.channel.addEventListener("message", m => window.__otherGot.push(m.data)); });
    const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
    media.getTracks().forEach(track => other.addTrack(track, media));
    /* eslint-disable no-undef */
    callId = "33333333-4444-4555-8666-777777777777"; contact = "dee@x.test"; contactName = "Dee"; callRole = "caller";
    await makePeer(kind);
    useChannel(peer.createDataChannel("danzstak-call", { ordered: true }));
    await peer.setLocalDescription(await peer.createOffer()); await gathered(peer);
    await other.setRemoteDescription(peer.localDescription); await other.setLocalDescription(await other.createAnswer()); await gathered(other);
    await peer.setRemoteDescription(other.localDescription);
    await wait(() => peer.connectionState === "connected" && channel?.readyState === "open" && window.__otherChannel?.readyState === "open", 10000);
    /* eslint-enable no-undef */
  }, kind);
}
const goHome = (page, hidden) => page.evaluate(hidden => { Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => hidden ? "hidden" : "visible" }); document.dispatchEvent(new Event("visibilitychange")); }, hidden);
const got = page => page.evaluate(() => window.__otherGot.filter(text => text.startsWith('{"type":"call-camera')).map(text => JSON.parse(text).state));

async function leavingSide(browser, width) {
  const tag = `${width}px this phone leaves`, failures = [];
  const { context, page, errors } = await setup(browser, width);
  await connect(page, "video");
  // Camera off stays as chosen across the restart.
  await page.evaluate(() => { stream.getVideoTracks()[0].enabled = false; }); // eslint-disable-line no-undef
  await goHome(page, true);
  await page.waitForFunction(() => window.__otherGot.some(text => text.includes('"paused"')), null, { timeout: 5000 }).catch(() => {});
  if ((await got(page)).join() !== "paused") failures.push(`${tag}: the other side wasn't told the video paused (${await got(page)})`);
  // The phone takes the camera away while SYNC is on the home screen.
  const before = await page.evaluate(() => { const track = stream.getVideoTracks()[0]; track.stop(); return track.id; }); // eslint-disable-line no-undef
  await goHome(page, false);
  await page.waitForFunction(() => window.__otherGot.some(text => text.includes('"on"')), null, { timeout: 8000 }).catch(() => {});
  const after = await page.evaluate(() => { /* eslint-disable no-undef */ const sender = peer.getSenders().find(item => item.track?.kind === "video"), self = els.localVideo.srcObject?.getVideoTracks()[0]; return { senderTrack: sender?.track?.id || "", senderLive: sender?.track?.readyState, selfLive: self?.readyState, selfId: self?.id || "", enabled: sender?.track?.enabled, connected: peer.connectionState }; /* eslint-enable no-undef */ });
  if (after.senderLive !== "live" || after.senderTrack === before || !after.senderTrack) failures.push(`${tag}: coming back didn't put a new live camera into the call ${JSON.stringify(after)}`);
  if (after.selfLive !== "live" || after.selfId !== after.senderTrack) failures.push(`${tag}: the self-view doesn't show the new camera ${JSON.stringify(after)}`);
  if (after.enabled !== false) failures.push(`${tag}: Camera off was switched back on by the restart`);
  if ((await got(page)).join() !== "paused,on") failures.push(`${tag}: the other side wasn't told the video is back (${await got(page)})`);
  if (after.connected !== "connected") failures.push(`${tag}: the call dropped (${after.connected})`);
  await context.close();
  if (errors.length) failures.push(`${tag}: page errors ${errors.join(" | ")}`);
  return failures;
}

async function watchingSide(browser, width, locale) {
  const tag = `${width}px ${locale} the other person leaves`, failures = [];
  const { context, page, errors } = await setup(browser, width, locale);
  await connect(page, "video");
  await page.waitForFunction(() => document.body.hasAttribute("data-call-connected"), null, { timeout: 8000 }).catch(() => failures.push(`${tag}: their picture never showed`));
  await page.evaluate(() => window.__otherChannel.send(JSON.stringify({ type: "call-camera", state: "paused" })));
  await page.waitForFunction(() => document.querySelector(".call-remote-paused:not([hidden])"), null, { timeout: 5000 }).catch(() => {});
  const shown = await page.evaluate(() => { const note = document.querySelector(".call-remote-paused"), figure = document.getElementById("remoteVideo").closest("figure"); if (!note || note.hidden) return null; const r = note.getBoundingClientRect(), f = figure.getBoundingClientRect(); return { text: note.textContent, covers: Math.abs(r.width - f.width) < 1 && Math.abs(r.height - f.height) < 1 && r.width > 100, hit: note.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)), inChat: [...document.querySelectorAll("#messageList .message")].some(m => m.textContent.includes("call-camera")) }; });
  const line = locale.startsWith("it") ? "Dee ha messo in pausa il video" : "Dee paused the video";
  if (!shown || shown.text !== line || !shown.covers || !shown.hit) failures.push(`${tag}: "${line}" should lie over their picture ${JSON.stringify(shown)}`);
  if (shown?.inChat) failures.push(`${tag}: the camera message leaked into the chat`);
  await page.evaluate(() => window.__otherChannel.send(JSON.stringify({ type: "call-camera", state: "on" })));
  await page.waitForFunction(() => !document.querySelector(".call-remote-paused:not([hidden])"), null, { timeout: 5000 }).catch(() => failures.push(`${tag}: the paused line stayed after the video came back`));
  await page.evaluate(() => window.__otherChannel.send(JSON.stringify({ type: "call-camera", state: "paused" })));
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("hangUp").click());
  await page.waitForFunction(() => !document.body.dataset.callMode, null, { timeout: 8000 }).catch(() => {});
  if (await page.evaluate(() => Boolean(document.querySelector(".call-remote-paused:not([hidden])") || document.body.dataset.remoteCamera))) failures.push(`${tag}: hanging up left the paused line`);
  await context.close();
  if (errors.length) failures.push(`${tag}: page errors ${errors.join(" | ")}`);
  return failures;
}

async function voiceCall(browser) {
  const tag = "voice call", failures = [];
  const { context, page, errors } = await setup(browser, 390);
  await connect(page, "phone");
  await goHome(page, true);
  await page.waitForTimeout(400);
  await goHome(page, false);
  await page.waitForTimeout(400);
  if ((await got(page)).length) failures.push(`${tag}: a voice call sent camera messages (${await got(page)})`);
  await context.close();
  if (errors.length) failures.push(`${tag}: page errors ${errors.join(" | ")}`);
  return failures;
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL;
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  const browser = await chromium.launch(channel === "bundled" ? { headless: true, args } : { channel: channel || "msedge", headless: true, args });
  const failures = [];
  try {
    for (const width of [360, 390]) failures.push(...await leavingSide(browser, width), ...await watchingSide(browser, width, "en-US"));
    failures.push(...await watchingSide(browser, 390, "it-IT"), ...await voiceCall(browser));
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Call video away: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exitCode = 1; return; }
  console.log("Call video away checks passed (360/390px): going to the home screen tells the other side the video paused, coming back puts a new live camera into the call (Camera off kept) and says it's back, the other person's pause shows over their picture (English and Italian) and clears, and a voice call sends nothing.");
})().catch(error => { console.error(error); process.exitCode = 1; });
