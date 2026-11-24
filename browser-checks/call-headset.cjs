"use strict";
// Owner 2026-11-24: "the sync audio does not come through blutooth headsets", for "both the caller and reciever". Chrome
// on Android plays a call where its microphone is, and SYNC always asked for the default microphone (the phone's own).
// Real browser, a real video call in SYNC (two peer connections), with the phone's audio devices stood in for the way
// Chrome on Android names them ("Speakerphone", "Headset earpiece", "Bluetooth headset"):
//   phone, 360/390px (touch):
//   - no headset: the call uses the phone's microphone, never the earpiece as a "headset";
//   - a Bluetooth headset connects during the call: its microphone takes the call over (replaceTrack, same call), and
//     Mute stays as it was;
//   - it disconnects: the phone's microphone takes the call back, still connected, still muted;
//   - a headset already connected when the call starts: the call opens on the headset's microphone;
//   computer, 1280px: a headset ("AirPods Pro (Bluetooth)") beats the microphone and speaker picked earlier in "Audio &
//   video check", and the other person's sound goes to the headset (setSinkId to the headset's output, same group).
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/call-headset.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

// The stand-in devices: enumerateDevices reads window.__devices; getUserMedia opens the real (fake) microphone and labels
// the track with the device that was asked for, so the page can't tell it from a phone.
function devicesStandIn() {
  window.__devices = [];
  window.__asked = [];
  window.__sinks = [];
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.enumerateDevices = async () => window.__devices.map(device => ({ ...device, toJSON() { return this; } }));
  navigator.mediaDevices.getUserMedia = async constraints => {
    window.__asked.push(JSON.parse(JSON.stringify(constraints)));
    const exact = constraints?.audio?.deviceId?.exact || "";
    const stream = await real({ audio: Boolean(constraints?.audio), video: constraints?.video || false });
    const fallback = window.__devices.find(device => device.kind === "audioinput" && device.isDefault) || { deviceId: "", label: "" };
    for (const track of stream.getAudioTracks()) {
      const device = window.__devices.find(item => item.deviceId === exact) || fallback;
      const settings = track.getSettings.bind(track);
      track.getSettings = () => ({ ...settings(), deviceId: device.deviceId });
      Object.defineProperty(track, "label", { value: device.label });
    }
    return stream;
  };
  HTMLMediaElement.prototype.setSinkId = async function setSinkId(id) { window.__sinks.push(id); Object.defineProperty(this, "sinkId", { value: id, configurable: true }); };
}

async function setup(browser, { width, phone, devices, saved }) {
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 800 }, isMobile: phone, hasTouch: phone, ...(phone ? { userAgent: ANDROID } : {}), serviceWorkers: "block", permissions: ["camera", "microphone"] });
  await context.addInitScript(devicesStandIn);
  if (saved) await context.addInitScript(value => { localStorage.setItem("danzstak_call_av", value); localStorage.setItem("danzstak_call_av_checked", "1"); }, JSON.stringify(saved));
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return reply(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "me@x.test" } });
    if (p === "/conversations") return reply(route, { conversations: [{ contactEmail: "dee@x.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Dee", preview: "Ready", updatedAt: "2026-11-19T12:00:00.000Z", canContact: true }] });
    if (p === "/calls/ice") return reply(route, { iceServers: [], expiresAt: Date.now() + 300000 });
    if (p === "/messages") return reply(route, { messages: [], canContact: true });
    return reply(route, { events: [] });
  });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(list => { window.__devices = list; }, devices);
  await page.locator(".conversation-user").first().click();
  await page.locator("body.is-conversation-open").waitFor();
  return { context, page, errors };
}

// A video call with Dee: her side is a second peer connection in the same page.
async function call(page) {
  await page.evaluate(async () => {
    const wait = async (ok, ms) => { const t0 = performance.now(); while (!ok()) { if (performance.now() - t0 > ms) throw new Error("no connect"); await new Promise(r => setTimeout(r, 50)); } };
    const gathered = pc => pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise(resolve => {
      const done = () => { if (pc.iceGatheringState === "complete") { clearTimeout(cap); resolve(); } };
      const cap = setTimeout(resolve, 5000);
      pc.addEventListener("icegatheringstatechange", done);
    });
    document.getElementById("contactEmail").value = "dee@x.test"; window.danzstakActiveContactName = "Dee";
    const dee = new RTCPeerConnection({ iceServers: [] }), theirs = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    theirs.getTracks().forEach(t => dee.addTrack(t, theirs)); dee.createDataChannel("danzstak-call", { ordered: true });
    window.__dee = dee;
    await dee.setLocalDescription(await dee.createOffer()); await gathered(dee);
    await makePeer("video", { receiving: true }); contactName = "Dee"; // eslint-disable-line no-undef
    await peer.setRemoteDescription(dee.localDescription); await peer.setLocalDescription(await peer.createAnswer()); await gathered(peer); // eslint-disable-line no-undef
    await dee.setRemoteDescription(peer.localDescription);
    await wait(() => peer.connectionState === "connected", 10000); // eslint-disable-line no-undef
  });
}

// What the call sends right now: the microphone in the call's audio sender, and whether it is the one Mute controls.
const sending = page => page.evaluate(() => {
  const track = peer.getSenders().find(item => item.track?.kind === "audio")?.track; // eslint-disable-line no-undef
  const muteTrack = stream.getAudioTracks()[0]; // eslint-disable-line no-undef
  return { device: track?.getSettings().deviceId || "", live: track?.readyState === "live", enabled: track?.enabled, sameAsMute: track === muteTrack, audioTracks: stream.getAudioTracks().length, connected: peer.connectionState === "connected" }; // eslint-disable-line no-undef
});

async function changeDevices(page, list) {
  await page.evaluate(next => { window.__devices = next; navigator.mediaDevices.dispatchEvent(new Event("devicechange")); }, list);
}

async function waitFor(page, check, label) {
  const deadline = Date.now() + 8000;
  let last;
  while (Date.now() < deadline) { last = await sending(page); if (check(last)) return last; await page.waitForTimeout(100); }
  throw new Error(`${label}: ${JSON.stringify(last)}`);
}

const phoneMic = { kind: "audioinput", deviceId: "phone-mic", label: "Speakerphone", groupId: "g-phone", isDefault: true };
const earpiece = { kind: "audioinput", deviceId: "earpiece", label: "Headset earpiece", groupId: "g-phone" };
const bluetooth = { kind: "audioinput", deviceId: "bt-mic", label: "Bluetooth headset", groupId: "g-bt" };

async function phone(browser, width) {
  const tag = `${width}px phone`;
  // No headset when the call starts; then one connects, then it goes.
  let run = await setup(browser, { width, phone: true, devices: [phoneMic, earpiece] });
  await call(run.page);
  let now = await sending(run.page);
  assert.equal(now.device, "phone-mic", `${tag}: no headset: the phone's microphone (never "Headset earpiece")`);
  assert.ok(!(await run.page.evaluate(() => window.__asked.some(item => item.audio?.deviceId?.exact === "earpiece"))), `${tag}: the earpiece is never asked for`);
  await run.page.evaluate(() => document.getElementById("toggleMic").click()); // Mute
  assert.equal((await sending(run.page)).enabled, false, `${tag}: muted`);
  // A headset connecting fires more than one devicechange; here the first one still lists the phone alone, so the
  // headset only shows on the second, which lands while the first is being handled.
  await run.page.evaluate(next => {
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
    window.__devices = next;
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  }, [phoneMic, earpiece, bluetooth]);
  now = await waitFor(run.page, item => item.device === "bt-mic", `${tag}: the Bluetooth headset that connected didn't take the call`);
  assert.deepEqual({ live: now.live, enabled: now.enabled, sameAsMute: now.sameAsMute, audioTracks: now.audioTracks, connected: now.connected }, { live: true, enabled: false, sameAsMute: true, audioTracks: 1, connected: true }, `${tag}: same call, still muted, Mute works on the headset`);
  await changeDevices(run.page, [phoneMic, earpiece]);
  now = await waitFor(run.page, item => item.device === "phone-mic", `${tag}: the phone didn't take the call back when the headset went`);
  assert.deepEqual({ live: now.live, enabled: now.enabled, sameAsMute: now.sameAsMute, connected: now.connected }, { live: true, enabled: false, sameAsMute: true, connected: true }, `${tag}: back on the phone, same call, still muted`);
  await run.page.evaluate(() => document.getElementById("toggleMic").click()); // Unmute
  assert.equal((await sending(run.page)).enabled, true, `${tag}: Unmute works on the phone's microphone again`);
  assert.deepEqual(run.errors, [], `${tag}: page errors`);
  await run.context.close();

  // A headset already connected when the call starts.
  run = await setup(browser, { width, phone: true, devices: [phoneMic, earpiece, bluetooth] });
  await call(run.page);
  now = await sending(run.page);
  assert.equal(now.device, "bt-mic", `${tag}: a call that starts with the headset on uses its microphone`);
  assert.equal(now.audioTracks, 1, `${tag}: one microphone in the call`);
  assert.ok(await run.page.evaluate(() => window.__asked.some(item => item.audio?.deviceId?.exact === "bt-mic")), `${tag}: asked for the headset by its id`);
  assert.deepEqual(run.errors, [], `${tag}: page errors`);
  await run.context.close();
}

async function computer(browser) {
  const tag = "1280px computer";
  const devices = [
    { kind: "audioinput", deviceId: "default", label: "Default - MacBook Air Microphone (Built-in)", groupId: "g-mac", isDefault: true },
    { kind: "audioinput", deviceId: "mac-mic", label: "MacBook Air Microphone (Built-in)", groupId: "g-mac" },
    { kind: "audioinput", deviceId: "pods-mic", label: "AirPods Pro (Bluetooth)", groupId: "g-pods" },
    { kind: "audiooutput", deviceId: "default", label: "Default - MacBook Air Speakers (Built-in)", groupId: "g-mac" },
    { kind: "audiooutput", deviceId: "mac-out", label: "MacBook Air Speakers (Built-in)", groupId: "g-mac" },
    { kind: "audiooutput", deviceId: "pods-out", label: "AirPods Pro (Bluetooth)", groupId: "g-pods" }
  ];
  // Picked in "Audio & video check" before the AirPods were around.
  const run = await setup(browser, { width: 1280, phone: false, devices, saved: { mic: "mac-mic", speaker: "mac-out", ringVolume: 1 } });
  assert.equal(await run.page.evaluate(() => window.danzstakCallSetup.isComputer), true, `${tag}: runs as a computer`);
  await call(run.page);
  const now = await sending(run.page);
  assert.equal(now.device, "pods-mic", `${tag}: the AirPods' microphone beats the one picked before`);
  await run.page.waitForFunction(() => window.__sinks.includes("pods-out"), null, { timeout: 5000 }).catch(() => {});
  const sinks = await run.page.evaluate(() => ({ list: window.__sinks, remote: document.getElementById("remoteVideo").sinkId }));
  assert.equal(sinks.remote, "pods-out", `${tag}: Dee is heard in the AirPods, not the MacBook speakers (${JSON.stringify(sinks)})`);
  // The AirPods go: back to the speaker picked before.
  await changeDevices(run.page, devices.filter(device => device.groupId !== "g-pods"));
  await waitFor(run.page, item => item.device === "mac-mic", `${tag}: back to the picked microphone`);
  await run.page.waitForFunction(() => document.getElementById("remoteVideo").sinkId === "mac-out", null, { timeout: 5000 });
  assert.deepEqual(run.errors, [], `${tag}: page errors`);
  await run.context.close();
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL;
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  const browser = await chromium.launch(channel === "bundled" ? { headless: true, args } : { channel: channel || "msedge", headless: true, args });
  try {
    for (const width of [360, 390]) { await phone(browser, width); console.log(`ok ${width}px phone`); }
    await computer(browser); console.log("ok 1280px computer");
  } finally { await browser.close(); }
  console.log("Headset call checks passed: phones never take the earpiece for a headset; a Bluetooth headset that connects mid-call takes the call over and one that goes hands it back to the phone (same call, Mute kept); a call that starts with the headset on uses its microphone; on a computer a headset beats the microphone and speaker picked before, and the call's sound goes to it.");
})().catch(error => { console.error(error); process.exit(1); });
