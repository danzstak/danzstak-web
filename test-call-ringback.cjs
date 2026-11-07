"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const chat = fs.readFileSync("assets/chat.js", "utf8");
const extract = name => chat.match(new RegExp(`(?:async )?function ${name}\\([^\\n]+`))[0];

assert.match(chat, /async function signal\([^)]*\)\{return request\(/, "call signaling must return the delivery response used to start ringback");
assert.match(chat, /const delivery=await signal\("offer".*delivery\?\.accepted!==true.*startRingback\(\)/, "ringback must start only after server acceptance");
assert.doesNotMatch(chat, /setStatus\(tf\("Ringing \{name\}…"/, "the UI must not claim the recipient device is audibly ringing");
assert.match(chat, /event\.signalType==="answer".*stopRingback\(\)/, "answering must stop ringback");
assert.match(chat, /async function end\(notify=true\).*stopRingback\(\)/, "every call end path must stop ringback");
assert.match(chat, /danzstakMediaCoordinator\?\.pauseAll\?\.\(\)/, "starting a call must silence feed media");
assert.match(chat, /window\.addEventListener\("pagehide",teardownCall\).*window\.addEventListener\("beforeunload",teardownCall\)/, "navigation must stop call audio");
assert.match(chat, /document\.addEventListener\("pointerdown",unlockCallAudio/, "ordinary interaction must unlock the foreground SYNC ringtone");
assert.match(chat, /if\(pending&&!els\.incoming\.hidden&&!ringTimer\)startIncomingRingtone\(\)/, "unlocking audio while an incoming call is visible must start its ringtone");
assert.match(chat, /document\.addEventListener\("visibilitychange",\(\)=>\{if\(document\.hidden\)stopIncomingRingtone\(\)/, "backgrounding SYNC must silence its foreground ringtone");

const scheduled = new Map();
let nextTimer = 1;
const state = vm.createContext({
  ringTimer: null,
  incomingRingStopTimer: null,
  incomingRingDeadline: Date.now() + 25000,
  ringbackTimer: null,
  ringbackMuted: false,
  pending: { callId: "incoming-call" },
  document: { hidden: false, body: { dataset: {}, classList: { contains() { return false; } } } },
  audioContext: {
    state: "running", currentTime: 0, destination: {},
    createOscillator() { return { frequency: { value: 0 }, connect() { return this; }, start() {}, stop() {} }; },
    createGain() { return { gain: { value: 0 }, connect() { return this; } }; }
  },
  els: {
    incoming: { hidden: true },
    ringback: { hidden: true, textContent: "", attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }
  },
  navigator: { vibrate() {} }, t: value => value, rememberCallFocus() {},
  setInterval(callback) { const id = nextTimer++; scheduled.set(id, callback); return id; },
  clearInterval(id) { scheduled.delete(id); },
  setTimeout() { return nextTimer++; },
  clearTimeout() {},
  Date
});
vm.runInContext(["playTone", "startIncomingRingtone", "stopIncomingRingtone", "updateRingbackControl", "stopRingback", "stopRing", "startRingback"].map(extract).join("\n"), state);

state.startIncomingRingtone();
assert.ok(state.ringTimer, "an unlocked visible incoming call must have a ringtone cadence");
assert.equal(scheduled.size, 1);
state.stopIncomingRingtone();
assert.equal(scheduled.size, 0, "stopping an incoming ringtone must clear its cadence");
assert.match(chat, /const INCOMING_RING_DURATION_MS=25000/, "incoming ringtone sound must be capped at 25 seconds");
assert.match(chat, /incomingRingStopTimer=setTimeout\(stopIncomingRingtone,remaining\)/, "the ringtone must stop when its remaining sound window expires");

state.startRingback();
assert.ok(state.ringbackTimer);
assert.equal(scheduled.size, 1, "ringback must have one cadence");
assert.equal(state.els.ringback.hidden, false);
assert.equal(state.els.ringback.attrs["aria-label"], "Mute");
state.ringbackMuted = true;
state.updateRingbackControl();
assert.equal(state.els.ringback.textContent, "🔇");
assert.equal(state.els.ringback.attrs["aria-label"], "Unmute");
state.startRingback();
assert.equal(scheduled.size, 1, "restarting must replace the previous cadence");
state.stopRingback();
assert.equal(scheduled.size, 0);
assert.equal(state.els.ringback.hidden, true);
assert.equal(state.ringbackMuted, false);
console.log("Call ringback checks passed: accepted-signal start, honest status, one cadence, mute, and cleanup.");
