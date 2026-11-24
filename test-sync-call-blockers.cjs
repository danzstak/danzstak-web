"use strict";
// Owner SYNC call test (2026-11-17): static guards for the root-cause fixes. Real-browser reproduction:
// browser-checks/sync-call-blockers.cjs (429 + startup race, ringing without reload, refused call, panel, rename).
const assert = require("node:assert/strict");
const fs = require("node:fs");

const devices = fs.readFileSync("assets/call-devices.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const incoming = fs.readFileSync("assets/incoming-calls.js", "utf8");
const friend = fs.readFileSync("assets/profile-friend.js", "utf8");
const speaker = fs.readFileSync("assets/call-setup.js", "utf8"); // the Speaker button became the computer Audio & video check
const html = fs.readFileSync("messages.html", "utf8");

// Root cause: one failed /calls/devices during identify() left the page with no device credential all session.
assert.match(devices, /async function identifyWithRetry\(\)\{let last;for\(const wait of \[0,1000,3000,6000\]\)/, "identify retries with backoff");
assert.match(devices, /const ready=identifyWithRetry\(\)\.catch\(\(\)=>\{state\.unreachable=true;render\(\);reidentifyLater\(5000\);return null;\}\);/, "a failed identify tries again later (and the device says it is still being checked)");
// A failed /calls/devices keeps the last known answer; only a real answer marks the device unregistered.
assert.doesNotMatch(devices, /catch\(error\)\{state\.registered=false;/, "errors must not mark the device unregistered");
assert.match(devices, /window\.danzstakSyncDeviceRegistered=\(\)=>state\.registered\|\|\(!state\.known&&\(Boolean\(state\.credential\)\|\|state\.storedAny\)\)/, "a device holding its key counts as registered until SYNC answers");
// Owner 2026-11-24 ("sometimes sync wants to reverify the device when the device is registered"): a device holding a key
// SYNC couldn't check yet is checked again before anything concludes "unregistered", and never shows the verify form meanwhile.
assert.match(devices, /async function loadDevices\(\)\{try\{if\(!state\.identified&&state\.storedAny\)await identify\(\);/, "no 'unregistered' verdict without the device's own key");
assert.match(devices, /window\.danzstakRefreshCallingDevice=async\(\)=>/);
// Refused call: only open registration when /calls/devices confirms the device is unregistered.
assert.match(chat, /const confirmed=await window\.danzstakRefreshCallingDevice\?\.\(\);if\(confirmed===false\)\{openCallDeviceRegistration\(\);return;\}/);
// Pollers never stop for good; banners clear.
assert.match(incoming, /Date\.now\(\) < registrationBackoffUntil/, "incoming poller backs off instead of stopping");
assert.match(incoming, /danzstak:call-device-ready/, "incoming poller resumes when the credential is ready");
assert.match(incoming, /handledCalls\.set\(event\.callId, Date\.now\(\) \+ 120000\);\s*window\.danzstakRequireCallingDevice/, "prompt once per call, not every poll");
assert.match(chat, /callDeviceRegistrationRequired&&!peer&&!pending&&!autoAnswer&&Date\.now\(\)<registrationRetryAt/, "SYNC poller backs off instead of stopping");
assert.match(chat, /if\(registrationBannerShown\)\{registrationBannerShown=false;setStatus\(""\);\}/, "a successful poll clears the registration banner");
// Panel: one line, DS numbers out, inline rename (no prompt()).
assert.doesNotMatch(html, /Every calling device must receive/);
assert.match(html, /<section class="sync-network-number" aria-labelledby="syncNetworkNumberTitle" hidden>/);
assert.doesNotMatch(devices, /=prompt\(/, "rename must not use prompt()");
assert.match(devices, /form\.className="device-rename"/);
assert.match(devices, /if\(verifySection\)verifySection\.hidden=registered\|\|checking;/, "a registered device (or one still being checked) is not shown the SMS form again");
// Friend state refreshes on return; speaker routing where supported, honest note where not.
assert.match(friend, /document\.addEventListener\("visibilitychange", onReturn\);/);
assert.match(chat, /mediaElement\.muted=false;mediaElement\.volume=1;mediaElement\.playsInline=true;/, "remote call audio is unmuted at full volume");
assert.match(speaker, /"setSinkId" in HTMLMediaElement\.prototype/, "speaker routing on computers");
assert.match(html, /<script src="assets\/call-setup\.js\?v=\d+" defer><\/script>/);
console.log("SYNC call blocker checks passed: identify retries, errors keep state, pollers back off, refused calls explain, one-line panel, inline rename, speaker.");
