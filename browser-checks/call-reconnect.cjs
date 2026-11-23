"use strict";
// Owner 2026-11-23 (a video call with a desktop: the picture turned blue, froze, "Glitched out and stopped working"; the
// other side saw "The call was interrupted"). A call whose network drops is now restarted (ICE restart) over
// call-signaling's "restart" / "restart-answer" signals instead of being ended 10 s later. Real browser, two real
// RTCPeerConnections, signalling through the mocked API, at 390px:
//   - this page answered the call: the other side sends a restart offer through the inbox; the page answers it with a
//     "restart-answer" (POST /calls/signal), the connection uses the new ICE credentials and stays up, the call stays on;
//   - this page made the call: restartIce sends a "restart" offer; the other side's answer comes back through the inbox and
//     the connection uses the new credentials and stays up.
// The decisions around it (who restarts, 25 s, three tries, the "call dropped" line) are in test-call-connection-loss.cjs,
// and the server's rules for the two signals in test-call-restart-signal.cjs.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/call-reconnect.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });

async function setup(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: ["camera", "microphone"] });
  const page = await context.newPage(), errors = [], signals = [], inbox = { events: [] }, acked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    if (p === "/auth/session") return reply(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "me@x.test" } });
    if (p === "/conversations") return reply(route, { conversations: [{ contactEmail: "dee@x.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Dee", preview: "Ready", updatedAt: "2026-11-19T12:00:00.000Z", canContact: true }] });
    if (p === "/calls/ice") return reply(route, { iceServers: [], expiresAt: Date.now() + 300000 });
    if (p === "/calls/signal") { signals.push(request.postDataJSON()); return reply(route, { delivered: true }, 201); }
    if (p === "/calls/inbox") { const events = inbox.events; inbox.events = []; return reply(route, { events }); }
    if (p === "/calls/ack") { acked.push(...(request.postDataJSON().eventIds || [])); return reply(route, { acked: true }); }
    return reply(route, { events: [] });
  });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().click();
  await page.locator("body.is-conversation-open").waitFor();
  return { context, page, errors, signals, inbox, acked };
}

// The other side of the call lives in the same page as window.__other (it never touches DanzStak's code).
const gatheredSource = `pc => pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise(resolve => {
  const done = () => { if (pc.iceGatheringState === "complete") { clearTimeout(cap); pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
  const cap = setTimeout(() => { pc.removeEventListener("icegatheringstatechange", done); resolve(); }, 5000);
  pc.addEventListener("icegatheringstatechange", done);
})`;
const ufrag = sdp => (/a=ice-ufrag:(\S+)/.exec(sdp || "") || [])[1] || "";

async function connect(page, role) {
  await page.evaluate(async ([role, gatheredText]) => {
    const gathered = eval(gatheredText); // eslint-disable-line no-eval
    const wait = async (ok, ms) => { const t0 = performance.now(); while (!ok()) { if (performance.now() - t0 > ms) throw new Error("no connect"); await new Promise(r => setTimeout(r, 50)); } };
    document.getElementById("contactEmail").value = "dee@x.test"; window.danzstakActiveContactName = "Dee";
    const other = window.__other = new RTCPeerConnection({ iceServers: [] });
    const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    media.getTracks().forEach(t => other.addTrack(t, media));
    /* eslint-disable no-undef */
    callId = "33333333-4444-4555-8666-777777777777"; contact = "dee@x.test"; contactName = "Dee"; callRole = role; restartCount = 0; everConnected = false;
    if (role === "callee") {
      other.createDataChannel("danzstak-call", { ordered: true });
      await other.setLocalDescription(await other.createOffer()); await gathered(other);
      await makePeer("video", { receiving: true });
      await peer.setRemoteDescription(other.localDescription); await peer.setLocalDescription(await peer.createAnswer()); await gathered(peer);
      await other.setRemoteDescription(peer.localDescription);
    } else {
      await makePeer("video");
      useChannel(peer.createDataChannel("danzstak-call", { ordered: true }));
      await peer.setLocalDescription(await peer.createOffer()); await gathered(peer);
      await other.setRemoteDescription(peer.localDescription); await other.setLocalDescription(await other.createAnswer()); await gathered(other);
      await peer.setRemoteDescription(other.localDescription);
    }
    await wait(() => peer.connectionState === "connected" && everConnected === true, 10000);
    /* eslint-enable no-undef */
  }, [role, gatheredSource]);
}

const state = page => page.evaluate(() => ({ connection: peer.connectionState, mode: document.body.dataset.callMode || "", remote: peer.remoteDescription?.sdp || "", local: peer.localDescription?.sdp || "", restarts: restartCount })); // eslint-disable-line no-undef

async function answeredSide(browser) {
  const tag = "answered the call";
  const run = await setup(browser);
  await connect(run.page, "callee");
  const before = await state(run.page);
  // The caller's network changed: it sends a restart offer, which arrives through the inbox.
  const offer = await run.page.evaluate(async gatheredText => {
    const gathered = eval(gatheredText); // eslint-disable-line no-eval
    const other = window.__other;
    await other.setLocalDescription(await other.createOffer({ iceRestart: true })); await gathered(other);
    return { type: other.localDescription.type, sdp: other.localDescription.sdp };
  }, gatheredSource);
  run.inbox.events.push({ eventId: `${Date.now()}#restart-1`, senderEmail: "dee@x.test", callId: "33333333-4444-4555-8666-777777777777", mode: "video", signalType: "restart", payload: offer, createdAt: new Date().toISOString() });
  const deadline = Date.now() + 10000;
  while (!run.signals.some(signal => signal.signalType === "restart-answer") && Date.now() < deadline) await run.page.waitForTimeout(100);
  const answer = run.signals.find(signal => signal.signalType === "restart-answer");
  assert.ok(answer, `${tag}: the page answers the restart through call-signaling`);
  assert.equal(answer.callId, "33333333-4444-4555-8666-777777777777"); assert.equal(answer.mode, "video"); assert.equal(answer.recipientEmail, "dee@x.test");
  assert.notEqual(ufrag(answer.payload.sdp), ufrag(before.local), `${tag}: the answer carries new ICE credentials`);
  await run.page.evaluate(async payload => { await window.__other.setRemoteDescription(payload); }, answer.payload);
  await run.page.waitForFunction(() => peer.connectionState === "connected" && window.__other.connectionState === "connected", null, { timeout: 10000 }); // eslint-disable-line no-undef
  const after = await state(run.page);
  assert.equal(ufrag(after.remote), ufrag(offer.sdp), `${tag}: the connection uses the restarted credentials`);
  assert.equal(after.mode, "video", `${tag}: the call stays on`);
  assert.ok(run.acked.includes(run.acked.find(id => /restart-1/.test(id))), `${tag}: the restart is acknowledged`);
  assert.equal(run.signals.filter(signal => signal.signalType === "hangup").length, 0, `${tag}: nothing hung up`);
  await run.context.close();
  assert.deepEqual(run.errors, [], `${tag}: page errors`);
}

async function callingSide(browser) {
  const tag = "made the call";
  const run = await setup(browser);
  await connect(run.page, "caller");
  const before = await state(run.page);
  // The network dropped (the page sees the connection as disconnected): the caller restarts ICE.
  await run.page.evaluate(() => { Object.defineProperty(peer, "connectionState", { configurable: true, get: () => "disconnected" }); restartIce(peer); }); // eslint-disable-line no-undef
  const deadline = Date.now() + 10000;
  while (!run.signals.some(signal => signal.signalType === "restart") && Date.now() < deadline) await run.page.waitForTimeout(100);
  const restart = run.signals.find(signal => signal.signalType === "restart");
  assert.ok(restart, `${tag}: restartIce sends a restart offer through call-signaling`);
  assert.equal(restart.payload.type, "offer");
  assert.notEqual(ufrag(restart.payload.sdp), ufrag(before.local), `${tag}: with new ICE credentials`);
  const answer = await run.page.evaluate(async ([payload, gatheredText]) => {
    const gathered = eval(gatheredText); // eslint-disable-line no-eval
    const other = window.__other;
    await other.setRemoteDescription(payload); await other.setLocalDescription(await other.createAnswer()); await gathered(other);
    return { type: other.localDescription.type, sdp: other.localDescription.sdp };
  }, [restart.payload, gatheredSource]);
  await run.page.evaluate(() => { delete peer.connectionState; }); // eslint-disable-line no-undef
  run.inbox.events.push({ eventId: `${Date.now()}#restart-answer-1`, senderEmail: "dee@x.test", callId: "33333333-4444-4555-8666-777777777777", mode: "video", signalType: "restart-answer", payload: answer, createdAt: new Date().toISOString() });
  await run.page.waitForFunction(sdp => peer.remoteDescription?.sdp === sdp, answer.sdp, { timeout: 10000 }); // eslint-disable-line no-undef
  await run.page.waitForFunction(() => peer.connectionState === "connected" && peer.signalingState === "stable", null, { timeout: 10000 }); // eslint-disable-line no-undef
  const after = await state(run.page);
  assert.equal(after.restarts, 1, `${tag}: one restart`);
  assert.equal(run.signals.filter(signal => signal.signalType === "hangup").length, 0, `${tag}: nothing hung up`);
  await run.context.close();
  assert.deepEqual(run.errors, [], `${tag}: page errors`);
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL;
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  const browser = await chromium.launch(channel === "bundled" ? { headless: true, args } : { channel: channel || "msedge", headless: true, args });
  try {
    await answeredSide(browser);
    await callingSide(browser);
  } finally { await browser.close(); }
  console.log("Call reconnect checks passed: a restart offer from the caller is answered through call-signaling and the call carries on with new ICE credentials, and the caller's own restart offer is answered and applied, with nothing hung up (390px, two real peer connections).");
})().catch(error => { console.error(error); process.exit(1); });
