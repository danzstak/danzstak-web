"use strict";
// Task 31: incoming calls ring without a prior tap where allowed; otherwise vibrate + "Tap to hear the ringer".
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = f => fs.readFileSync(f, "utf8");
const chat = read("assets/chat.js"), incoming = read("assets/incoming-calls.js"), ringer = read("assets/call-ringer.js"), worker = read("service-worker.js");
assert.doesNotMatch(chat, /function startIncomingRingtone\(\)\{const remaining=incomingRingDeadline-Date\.now\(\);if\(!pending\|\|document\.hidden\|\|audioContext\?\.state!=="running"/, "SYNC no longer gives up silently when audio isn't unlocked yet");
assert.match(chat, /audioContext=new AudioContextClass\(\)/, "SYNC creates its audio context for an incoming call");
assert.match(chat, /danzstakCallRinger\?\.needsTap\?\.\(els\.incoming,\(\)=>unlockCallAudio\(\)\)/, "SYNC asks for one tap when sound is blocked");
assert.match(incoming, /if \(ringtoneContext\?\.state !== "running"\) \{ window\.danzstakCallRinger\?\.vibrateStart\?\.\(remaining\); window\.danzstakCallRinger\?\.needsTap\?\.\(popup, unlockRingtone\); return; \}/, "Mix/profile calls vibrate and ask for a tap when blocked");
assert.match(incoming, /function stopRingtone\(\) \{\r?\n    window\.danzstakCallRinger\?\.stop\?\.\(\);/, "stopping the ring stops vibration and the tap prompt");
assert.match(ringer, /navigator\.vibrate\(\[600, 300, 600\]\)/, "repeating vibration");
assert.match(ringer, /label: "Test ringer"/, "Test ringer row in the SYNC sheet");
for (const page of ["feed.html", "profile.html", "messages.html"]) assert.match(read(page), /assets\/call-ringer\.js\?v=\d+/, `${page} loads the ringer`);
assert.match(worker, /"\/assets\/call-ringer\.js", "\/assets\/call-ringer\.css"/, "cached offline");
const tones = read("assets/sync-tones.js"), setup = read("assets/call-setup.js");
// F15e (owner 2026-11-19: "10 dB louder minimum"): rings are re-voiced for a phone speaker and soft-limited below
// clipping; browser-checks/ringer-loudness.cjs measures the result against the old levels.
assert.match(tones, /tone\.kind === "ring" && out\.createWaveShaper/, "rings go through the loudness chain");
assert.match(tones, /master\.connect\(lowCut\)\.connect\(drive\)\.connect\(shaper\)\.connect\(presence\)\.connect\(push\)\.connect\(limiter\)\.connect\(out\.destination\);/, "sub-bass cut, saturation, presence, soft limiter");
assert.match(tones, /limiter\.oversample = "none";/, "the final limiter cannot overshoot its ceiling");
assert.doesNotMatch(tones, /RING_MAKEUP_GAIN|createDynamicsCompressor/, "no compressor with automatic make-up gain (it made the old rings clip)");
assert.match(setup, /const DEFAULT_RING = 1;/, "the default ring volume is the maximum");
assert.match(chat, /finally\{delete els\.enable\.dataset\.busy;els\.enable\.disabled=false;\}/, "Call alerts can be tapped again (owner: it did nothing)");
assert.match(chat, /window\.danzstakShowFeedback\?\.\(message,\{urgent\}\)/, "Call alerts shows its result on screen");
console.log("Call ringer checks passed: rings without a tap where allowed, vibrates + asks for a tap when blocked, Test ringer, offline cache.");
