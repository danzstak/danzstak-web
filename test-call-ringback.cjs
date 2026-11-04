"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const chat = fs.readFileSync("assets/chat.js", "utf8");
const extract = name => chat.match(new RegExp(`(?:async )?function ${name}\\([^\\n]+`))[0];

assert.match(chat, /const delivery=await signal\("offer".*delivery\?\.accepted!==true.*startRingback\(\)/, "ringback must start only after the server accepts the call signal");
assert.doesNotMatch(chat, /setStatus\(tf\("Ringing \{name\}…"/, "server acceptance must not claim that the recipient device is audibly ringing");
assert.match(chat, /event\.signalType==="answer".*stopRingback\(\)/, "answering must stop outgoing ringback");
assert.match(chat, /async function end\(notify=true\).*stopRingback\(\)/, "every call end path must stop outgoing ringback");
assert.match(chat, /window\.addEventListener\("pagehide",teardownCall\).*window\.addEventListener\("beforeunload",teardownCall\)/, "navigation teardown must stop call audio");
assert.match(chat, /danzstakMediaCoordinator\?\.pauseAll\?\.\(\)/, "starting a call must silence other coordinated media");

const scheduled = new Map();
let nextTimer = 1;
const state = vm.createContext({
  ringTimer: null,
  ringbackTimer: null,
  ringbackMuted: false,
  audioContext: {
    state: "running",
    currentTime: 0,
    destination: {},
    createOscillator() { return { frequency: { value: 0 }, connect() { return this; }, start() {}, stop() {} }; },
    createGain() { return { gain: { value: 0 }, connect() { return this; } }; }
  },
  els: {
    incoming: { hidden: true },
    ringback: { hidden: true, textContent: "", attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }
  },
  navigator: { vibrate() {} },
  t: value => value,
  rememberCallFocus() {},
  setInterval(callback) { const id = nextTimer++; scheduled.set(id, callback); return id; },
  clearInterval(id) { scheduled.delete(id); },
  setTimeout(callback) { callback(); return nextTimer++; }
});

vm.runInContext([
  extract("playTone"),
  extract("updateRingbackControl"),
  extract("stopRingback"),
  extract("stopRing"),
  extract("startRingback")
].join("\n"), state);

state.startRingback();
assert.ok(state.ringbackTimer, "outgoing ringback should schedule one repeating cadence");
assert.equal(scheduled.size, 1, "outgoing ringback should not create competing intervals");
assert.equal(state.els.ringback.hidden, false, "ringback mute control should be visible while waiting");
assert.equal(state.els.ringback.attrs["aria-label"], "Mute");

state.ringbackMuted = true;
state.updateRingbackControl();
assert.equal(state.els.ringback.textContent, "🔇");
assert.equal(state.els.ringback.attrs["aria-label"], "Unmute");
assert.equal(state.els.ringback.attrs["aria-pressed"], "true");

state.startRingback();
assert.equal(scheduled.size, 1, "restarting ringback must replace, not overlap, the previous cadence");
state.stopRingback();
assert.equal(scheduled.size, 0, "stopping ringback must clear its interval");
assert.equal(state.els.ringback.hidden, true, "ringback control should disappear after answer or hang-up");
assert.equal(state.ringbackMuted, false, "the next call must not inherit a stale muted control state");

console.log("Call ringback checks passed: accepted-signal start, honest status, single cadence, mute control, and lifecycle cleanup.");
