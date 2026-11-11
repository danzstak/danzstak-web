"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017";
const users = {
  alice: { email: "alice@example.test", memberId: "00000000-0000-4000-8000-000000000001", name: "Alice" },
  bob: { email: "bob@example.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Bob" }
};

const queues = new Map([[users.alice.email, []], [users.bob.email, []]]);
let eventNumber = 0;
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

function routeFor(identity, other) {
  return async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/auth/session") return json(route, { authenticated: true, user: { sub: identity.memberId, email: identity.email } });
    if (path === "/calls/presence") return json(route, { ok: true });
    if (path === "/calls/ice") return json(route, { iceServers: [{ urls: ["stun:stun.kinesisvideo.us-east-1.amazonaws.com:443"] }], expiresAt: Date.now() + 300000 });
    if (path === "/conversations") return json(route, { conversations: [{ contactEmail: other.email, memberId: other.memberId, name: other.name, preview: "Ready to call", updatedAt: new Date().toISOString(), canContact: true }] });
    if (path === "/friends") return json(route, { friends: [{ email: other.email, memberId: other.memberId, name: other.name, picture: "" }], incoming: [], outgoing: [] });
    if (path === "/calls/directory") return json(route, { users: [{ email: other.email, memberId: other.memberId, name: other.name, online: true, friendStatus: "friends" }] });
    if (path === "/messages") return json(route, { messages: [], canContact: true });
    if (path === "/calls/devices") return json(route, { devices: [] });
    if (path === "/calls/inbox") return json(route, { events: queues.get(identity.email) || [] });
    if (path === "/calls/ack") {
      const body = request.postDataJSON();
      const handled = new Set(body.eventIds || []);
      queues.set(identity.email, (queues.get(identity.email) || []).filter(event => !handled.has(event.eventId)));
      return json(route, { ok: true });
    }
    if (path === "/calls/signal") {
      const body = request.postDataJSON();
      const target = String(body.recipientEmail || "").toLowerCase();
      const targetQueue = queues.get(target);
      if (!targetQueue) return json(route, { error: "Unknown recipient" }, 404);
      targetQueue.push({
        eventId: `event-${++eventNumber}`,
        callId: body.callId,
        signalType: body.signalType,
        senderEmail: identity.email,
        senderName: identity.name,
        mode: body.mode,
        payload: body.payload
      });
      return json(route, { accepted: true });
    }
    if (path === "/profiles") return json(route, { profile: { memberId: identity.memberId, name: identity.name, picture: "" } });
    return json(route, {});
  };
}

async function preparePage(context, identity, other) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        async getUserMedia(constraints) {
          const stream = new MediaStream();
          if (constraints.audio) {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            const destination = audio.createMediaStreamDestination();
            oscillator.frequency.value = 240;
            oscillator.connect(destination);
            oscillator.start();
            destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
          }
          if (constraints.video) {
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 36;
            const paint = canvas.getContext("2d");
            paint.fillStyle = "#1769e0";
            paint.fillRect(0, 0, canvas.width, canvas.height);
            canvas.captureStream(12).getVideoTracks().forEach(track => stream.addTrack(track));
          }
          return stream;
        }
      }
    });
  });
  const page = await context.newPage();
  await page.route("https://api.danzstak.com/**", routeFor(identity, other));
  await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().click();
  await page.locator("body.is-conversation-open").waitFor();
  await page.evaluate(() => {
    window.danzstakSyncDeviceRegistered = () => true;
    callDeviceRegistrationRequired = false;
  });
  return page;
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const aliceContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"], serviceWorkers: "block" });
    const bobContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"], serviceWorkers: "block" });
    const alice = await preparePage(aliceContext, users.alice, users.bob);
    const bob = await preparePage(bobContext, users.bob, users.alice);

    await alice.locator("#headerVideo").click();
    await alice.waitForFunction(() => peer?.localDescription?.type === "offer");
    await bob.evaluate(() => poll());
    await bob.locator("#incomingCall").waitFor({ state: "visible" });
    await bob.locator("#acceptCall").click();
    await bob.waitForFunction(() => peer?.localDescription?.type === "answer");
    await alice.evaluate(() => poll());

    await Promise.all([
      alice.waitForFunction(() => peer?.connectionState === "connected", null, { timeout: 15000 }),
      bob.waitForFunction(() => peer?.connectionState === "connected", null, { timeout: 15000 })
    ]);
    await Promise.all([
      alice.waitForFunction(() => document.querySelector("#remoteVideo")?.srcObject?.getVideoTracks().length === 1),
      bob.waitForFunction(() => document.querySelector("#remoteVideo")?.srcObject?.getVideoTracks().length === 1)
    ]);

    const [aliceState, bobState] = await Promise.all([alice.evaluate(() => ({
      connection: peer.connectionState,
      remoteAudio: document.querySelector("#remoteVideo").srcObject.getAudioTracks().length,
      remoteVideo: document.querySelector("#remoteVideo").srcObject.getVideoTracks().length,
      callMode: document.body.dataset.callMode,
      controlsVisible: !document.querySelector("#mediaControls").hidden
    })), bob.evaluate(() => ({
      connection: peer.connectionState,
      remoteAudio: document.querySelector("#remoteVideo").srcObject.getAudioTracks().length,
      remoteVideo: document.querySelector("#remoteVideo").srcObject.getVideoTracks().length,
      callMode: document.body.dataset.callMode,
      controlsVisible: !document.querySelector("#mediaControls").hidden
    }))]);

    for (const [name, state] of [["caller", aliceState], ["receiver", bobState]]) {
      assert.equal(state.connection, "connected", `${name} must reach a connected WebRTC state`);
      assert.equal(state.remoteAudio, 1, `${name} must receive the other device's audio track`);
      assert.equal(state.remoteVideo, 1, `${name} must receive the other device's video track`);
      assert.equal(state.callMode, "video", `${name} must remain in the video-call screen`);
      assert.equal(state.controlsVisible, true, `${name} must retain Hang Up, microphone, and camera controls`);
    }

    await alice.locator("#hangUp").click();
    await bob.evaluate(() => poll());
    await bob.waitForFunction(() => !peer && document.querySelector("#mediaControls").hidden);
    assert.equal(await alice.evaluate(() => !peer && document.querySelector("#mediaControls").hidden), true, "caller hangup must release local media and controls");

    await aliceContext.close();
    await bobContext.close();
    console.log("Two-party video-call browser check passed: offer, answer, bidirectional audio/video, connected controls, and hangup cleanup.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
