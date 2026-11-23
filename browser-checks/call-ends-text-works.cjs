"use strict";
// Owner 2026-11-23, after a video call with a desktop dropped: "he could text me but I could not text him", then "When I
// exit out of the app the text box started working again on my side". His screenshot showed his draft in the box and
// "Turn on offline access in App and device settings first." Two causes:
//   1. the end of a call (and the call's data channel closing) disabled SYNC's text box and Send (chat.js disableChat),
//      until SYNC reloaded the chat;
//   2. SYNC's Send trusted navigator.onLine: a phone that wrongly reported "offline" after the network change didn't
//      even try, and said to turn on offline access.
// Real browser, touch, 360 and 390px, in SYNC with Dee:
//   - a video call connects and ends (End, centre tap): the text box and Send still work, and a text goes;
//   - with the phone saying it's offline, Send still sends for real (no offline-access message);
//   - a send that really fails for want of a connection keeps the words, says so, and goes by itself (same message id,
//     so never twice) once the connection is back.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/call-ends-text-works.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });

async function setup(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: ["camera", "microphone"] });
  const page = await context.newPage(), errors = [], sent = [], state = { offline: false };
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    if (p === "/auth/session") return reply(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "me@x.test" } });
    if (p === "/conversations") return reply(route, { conversations: [{ contactEmail: "dee@x.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Dee", preview: "Ready", updatedAt: "2026-11-19T12:00:00.000Z", canContact: true }] });
    if (p === "/calls/ice") return reply(route, { iceServers: [], expiresAt: Date.now() + 300000 });
    if (p === "/messages" && request.method() === "POST") {
      if (state.offline) return route.abort("internetdisconnected");
      const body = request.postDataJSON(); sent.push(body);
      return reply(route, { message: { messageId: `m-${sent.length}`, senderEmail: "me@x.test", recipientEmail: body.recipientEmail, content: body.content, createdAt: new Date().toISOString(), mine: true } }, 201);
    }
    if (p === "/messages") return reply(route, { messages: [], canContact: true });
    return reply(route, { events: [] });
  });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().click();
  await page.locator("body.is-conversation-open").waitFor();
  await page.waitForFunction(() => !document.getElementById("messageInput").disabled, null, { timeout: 10000 });
  return { context, page, errors, sent, state };
}

async function call(page) {
  await page.evaluate(async () => {
    const wait = async (ok, ms) => { const t0 = performance.now(); while (!ok()) { if (performance.now() - t0 > ms) throw new Error("no connect"); await new Promise(r => setTimeout(r, 50)); } };
    const gathered = pc => pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise(resolve => {
      const done = () => { if (pc.iceGatheringState === "complete") { clearTimeout(cap); pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
      const cap = setTimeout(() => { pc.removeEventListener("icegatheringstatechange", done); resolve(); }, 5000);
      pc.addEventListener("icegatheringstatechange", done);
    });
    document.getElementById("contactEmail").value = "dee@x.test"; window.danzstakActiveContactName = "Dee";
    const caller = new RTCPeerConnection({ iceServers: [] }), media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    media.getTracks().forEach(t => caller.addTrack(t, media)); caller.createDataChannel("danzstak-call", { ordered: true });
    window.__otherSide = caller;
    await caller.setLocalDescription(await caller.createOffer()); await gathered(caller);
    await makePeer("video", { receiving: true }); contactName = "Dee"; // eslint-disable-line no-undef
    await peer.setRemoteDescription(caller.localDescription); await peer.setLocalDescription(await peer.createAnswer()); await gathered(peer); // eslint-disable-line no-undef
    await caller.setRemoteDescription(peer.localDescription);
    await wait(() => channel?.readyState === "open", 10000); // eslint-disable-line no-undef
  });
}

async function centreTap(page, selector, label) {
  const spot = await page.evaluate(sel => { const node = document.querySelector(sel), r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: node.contains(document.elementFromPoint(x, y)), disabled: node.disabled === true }; }, selector);
  assert.ok(spot.hit, `${label}: ${selector} is covered`);
  assert.equal(spot.disabled, false, `${label}: ${selector} is disabled`);
  await page.touchscreen.tap(spot.x, spot.y);
}

async function type(page, text) {
  await page.locator("#messageInput").fill(text);
}

async function run(browser, width) {
  const tag = `${width}px`;
  const { context, page, errors, sent, state } = await setup(browser, width);

  // 1. A call connects and ends; the text box and Send still work.
  await call(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => { delete document.body.dataset.callChrome; });
  await centreTap(page, "#hangUp", `${tag} End`);
  await page.waitForFunction(() => !document.body.dataset.callMode, null, { timeout: 8000 });
  await page.evaluate(() => window.__otherSide?.close()); // their side closes too: the call's channel closes
  await page.waitForTimeout(600);
  const box = await page.evaluate(() => ({ input: document.getElementById("messageInput").disabled, send: document.querySelector('#messageForm button[type="submit"]').disabled }));
  assert.deepEqual(box, { input: false, send: false }, `${tag}: after the call the text box and Send still work`);
  await type(page, "Bro it fell out");
  await centreTap(page, '#messageForm button[type="submit"]', `${tag} Send`);
  await page.waitForFunction(() => document.getElementById("messageInput").value === "", null, { timeout: 8000 });
  assert.equal(sent.at(-1)?.content, "Bro it fell out", `${tag}: the text after the call went`);

  // 2. The phone says it's offline (wrongly): Send still sends for real.
  await page.evaluate(() => { Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false }); });
  await type(page, "Still here");
  await centreTap(page, '#messageForm button[type="submit"]', `${tag} Send while 'offline'`);
  await page.waitForFunction(() => document.getElementById("messageInput").value === "", null, { timeout: 8000 }).catch(() => {});
  const status = await page.locator("#callStatus").textContent();
  assert.doesNotMatch(status, /offline access/i, `${tag}: Send didn't try: "${status}"`);
  assert.equal(sent.at(-1)?.content, "Still here", `${tag}: a send while the phone says it's offline still goes`);

  // 3. A send that really fails keeps the words and goes by itself when the connection is back.
  state.offline = true;
  const before = sent.length;
  await type(page, "Call me back");
  await centreTap(page, '#messageForm button[type="submit"]', `${tag} Send without a connection`);
  await page.waitForFunction(() => /No connection right now/.test(document.getElementById("callStatus").textContent), null, { timeout: 15000 });
  assert.equal(await page.locator("#messageInput").inputValue(), "Call me back", `${tag}: the words stay in the box`);
  state.offline = false;
  await page.evaluate(() => { Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => true }); window.dispatchEvent(new Event("online")); });
  await page.waitForFunction(() => document.getElementById("messageInput").value === "", null, { timeout: 8000 }).catch(() => { throw new Error(`${tag}: the kept message didn't go by itself when the connection came back`); });
  assert.equal(sent.length, before + 1, `${tag}: it went once`);
  assert.equal(sent.at(-1).content, "Call me back");

  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL;
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  const browser = await chromium.launch(channel === "bundled" ? { headless: true, args } : { channel: channel || "msedge", headless: true, args });
  try {
    for (const width of [360, 390]) await run(browser, width);
  } finally { await browser.close(); }
  console.log("Text-after-call checks passed: after a video call ends the text box and Send still work, Send tries for real when the phone wrongly says it's offline, and a send that fails for want of a connection keeps the words and goes once by itself when the connection is back (360/390px).");
})().catch(error => { console.error(error); process.exit(1); });
