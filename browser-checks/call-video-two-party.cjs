"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017";
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
  });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block", permissions: ["camera", "microphone"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://api.danzstak.com/**", route => {
      const endpoint = new URL(route.request().url()).pathname;
      if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "artist@example.test" } });
      if (endpoint === "/conversations") return json(route, { conversations: [{ contactEmail: "venue@example.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Venue Booker", preview: "Ready", updatedAt: "2026-11-07T12:00:00.000Z", canContact: true }] });
      if (endpoint === "/friends") return json(route, { friends: [{ email: "venue@example.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Venue Booker", picture: "" }] });
      if (endpoint === "/calls/directory") return json(route, { users: [{ email: "venue@example.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Venue Booker", online: true, friendStatus: "friends" }] });
      if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: [], canContact: true });
      if (endpoint === "/calls/presence") return json(route, { ok: true });
      if (endpoint === "/calls/ice") return json(route, { iceServers: [{ urls: ["stun:stun.kinesisvideo.us-east-1.amazonaws.com:443"] }], expiresAt: Date.now() + 300000 });
      if (endpoint === "/calls/devices") return json(route, { devices: [] });
      if (endpoint === "/calls/inbox") return json(route, { events: [] });
      if (endpoint.startsWith("/notifications") || endpoint.startsWith("/push")) return json(route, {});
      return json(route, {});
    });

    await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.locator(".conversation-user").first().click();
    await page.locator("body.is-conversation-open").waitFor();
    await page.locator("body").click({ position: { x: 10, y: 100 } });

    const evidence = await page.evaluate(async () => {
      const waitFor = async (predicate, timeout = 12000) => {
        const started = performance.now();
        while (!predicate()) {
          if (performance.now() - started > timeout) throw new Error("Timed out waiting for the two-party media connection");
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      };
      const finishIce = connection => connection.iceGatheringState === "complete"
        ? Promise.resolve()
        : new Promise(resolve => {
          const timeout = setTimeout(() => {
            connection.removeEventListener("icegatheringstatechange", onStateChange);
            resolve();
          }, 5000);
          const onStateChange = () => {
            if (connection.iceGatheringState !== "complete") return;
            clearTimeout(timeout);
            connection.removeEventListener("icegatheringstatechange", onStateChange);
            resolve();
          };
          connection.addEventListener("icegatheringstatechange", onStateChange);
        });

      document.getElementById("contactEmail").value = "venue@example.test";
      window.danzstakActiveContactName = "Venue Booker";
      await makePeer("video");
      useChannel(peer.createDataChannel("danzstak-video-test", { ordered: true }));
      const appPeer = peer;
      const appLocal = stream;
      const remotePeer = new RTCPeerConnection({ iceServers: [] });
      const remoteLocal = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Deliberately omit the MediaStream argument. Valid WebRTC peers can
      // deliver these as track events with event.streams empty; SYNC still
      // needs to assemble and play both remote tracks.
      remoteLocal.getTracks().forEach(track => remotePeer.addTrack(track));
      const remoteReceived = new MediaStream();
      remotePeer.addEventListener("track", event => remoteReceived.addTrack(event.track));

      await appPeer.setLocalDescription(await appPeer.createOffer());
      await finishIce(appPeer);
      await remotePeer.setRemoteDescription(appPeer.localDescription);
      await remotePeer.setLocalDescription(await remotePeer.createAnswer());
      await finishIce(remotePeer);
      await appPeer.setRemoteDescription(remotePeer.localDescription);
      await waitFor(() => appPeer.connectionState === "connected" && remotePeer.connectionState === "connected");
      await waitFor(() => document.getElementById("remoteVideo").srcObject?.getAudioTracks().length === 1 && document.getElementById("remoteVideo").srcObject?.getVideoTracks().length === 1);
      await waitFor(() => remoteReceived.getAudioTracks().length === 1 && remoteReceived.getVideoTracks().length === 1);
      await new Promise(resolve => setTimeout(resolve, 1200));

      const appStats = [...(await appPeer.getStats()).values()];
      const remoteStats = [...(await remotePeer.getStats()).values()];
      const appInbound = appStats.filter(item => item.type === "inbound-rtp" && !item.isRemote);
      const remoteInbound = remoteStats.filter(item => item.type === "inbound-rtp" && !item.isRemote);
      const received = entries => ({
        audio: entries.some(item => item.kind === "audio" && Number(item.bytesReceived || 0) > 0),
        video: entries.some(item => item.kind === "video" && (Number(item.bytesReceived || 0) > 0 || Number(item.framesDecoded || 0) > 0))
      });

      const mic = appLocal.getAudioTracks()[0];
      const camera = appLocal.getVideoTracks()[0];
      document.getElementById("toggleMic").click();
      document.getElementById("toggleCamera").click();
      const toggled = { mic: mic.enabled, camera: camera.enabled };
      document.getElementById("toggleMic").click();
      document.getElementById("toggleCamera").click();
      const restored = { mic: mic.enabled, camera: camera.enabled };
      const remoteElement = document.getElementById("remoteVideo");
      const beforeEnd = {
        app: received(appInbound),
        remote: received(remoteInbound),
        remoteTracks: remoteElement.srcObject.getTracks().map(track => ({ kind: track.kind, state: track.readyState })).sort((a, b) => a.kind.localeCompare(b.kind)),
        localTracks: appLocal.getTracks().map(track => ({ kind: track.kind, state: track.readyState })).sort((a, b) => a.kind.localeCompare(b.kind)),
        videoGridVisible: !document.getElementById("videoGrid").hidden,
        controlsVisible: !document.getElementById("mediaControls").hidden
      };
      await end(false);
      const afterEnd = {
        remoteCleared: remoteElement.srcObject === null,
        localStopped: appLocal.getTracks().every(track => track.readyState === "ended"),
        controlsHidden: document.getElementById("mediaControls").hidden,
        gridHidden: document.getElementById("videoGrid").hidden
      };
      remoteLocal.getTracks().forEach(track => track.stop());
      remotePeer.close();
      return { beforeEnd, toggled, restored, afterEnd };
    });

    assert.deepEqual(evidence.beforeEnd.app, { audio: true, video: true }, "DanzStak must receive live audio and video RTP from the other party");
    assert.deepEqual(evidence.beforeEnd.remote, { audio: true, video: true }, "the other party must receive DanzStak audio and video RTP");
    assert.deepEqual(evidence.beforeEnd.remoteTracks, [{ kind: "audio", state: "live" }, { kind: "video", state: "live" }]);
    assert.deepEqual(evidence.beforeEnd.localTracks, [{ kind: "audio", state: "live" }, { kind: "video", state: "live" }]);
    assert.equal(evidence.beforeEnd.videoGridVisible, true);
    assert.equal(evidence.beforeEnd.controlsVisible, true);
    assert.deepEqual(evidence.toggled, { mic: false, camera: false }, "mute and camera-off must disable their real tracks");
    assert.deepEqual(evidence.restored, { mic: true, camera: true }, "unmute and camera-on must restore their real tracks");
    assert.deepEqual(evidence.afterEnd, { remoteCleared: true, localStopped: true, controlsHidden: true, gridHidden: true }, "hangup must stop and clear every media surface");
    assert.deepEqual(errors, [], `browser errors: ${errors.join(" | ")}`);
    console.log("Two-party video-call browser check passed: bidirectional audio/video RTP, real track controls, and complete hangup cleanup.");
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
