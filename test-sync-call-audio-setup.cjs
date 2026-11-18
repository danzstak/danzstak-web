"use strict";
// Call audio setup (owner 2026-11-17): computers get a centered Audio & video check box; phones use their own controls;
// a blocked microphone/camera is explained with Try again. Real-browser check: browser-checks/sync-call-audio-setup.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const setup = fs.readFileSync("assets/call-setup.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const incoming = fs.readFileSync("assets/incoming-calls.js", "utf8");
const visibility = fs.readFileSync("assets/media-visibility.js", "utf8");
const css = fs.readFileSync("assets/call-setup.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

// Computers only; phones never get the box.
assert.match(setup, /const isComputer = !isPhone && Boolean\(window\.matchMedia\?\.\("\(hover: hover\) and \(pointer: fine\)"\)\.matches\);/);
assert.match(setup, /function openCheck\(\) \{\s*if \(!isComputer\) return Promise\.resolve\(false\);/, "phones never open the box");
// The box: mic + level meter, speaker + test sound, camera + preview, ring volume + preview ring, one ×.
for (const part of ["call-setup-mic", "call-setup-level", "call-setup-speaker", "call-setup-test", "call-setup-camera", "call-setup-preview", "call-setup-ring", "call-setup-ring-test", "call-setup-close"]) assert.ok(setup.includes(part), `box has ${part}`);
// Saved on this device only.
assert.match(setup, /localStorage\.setItem\(KEY, JSON\.stringify\(merged\)\)/);
assert.doesNotMatch(setup, /fetch\(/, "audio choices are never sent to the server");
// Wiring: chosen devices feed calls, first outgoing call opens the box, both ringers follow the ring volume.
assert.match(chat, /getUserMedia\(window\.danzstakCallSetup\?\.constraints\?\.\(kind\)\|\|/);
assert.match(chat, /async function start\(kind\)\{if\(kind!=="text"&&window\.danzstakCallSetup\?\.needsFirstCheck\?\.\(\)\)await window\.danzstakCallSetup\.openCheck\(\);/);
assert.match(chat, /const pulse=\(\)=>playTone\(720,\.22,window\.danzstakCallSetup\?\.ringVolume\?\.\(\)\?\?\.4\);/, "SYNC ring follows the setting (was .08)");
assert.match(incoming, /gain\.gain\.value = window\.danzstakCallSetup\?\.ringVolume\?\.\(\) \?\? 0\.4;/);
// Blocked microphone: Accept explains and Try again answers the same call.
assert.match(chat, /failure\.mediaBlocked=error\?\.name==="NotAllowedError"\|\|error\?\.name==="SecurityError";/);
assert.match(chat, /if\(e\.mediaBlocked\)\{const retryOffer=offer;await end\(false\);setStatus\(e\.message\);window\.danzstakCallSetup\?\.explainBlocked\?\.\(offer\.mode,\(\)=>\{pending=retryOffer;accept\(\);\}\);return;\}/);
assert.match(setup, /function browserSteps\(kind\)/);
// The preview isn't treated as a feed video.
assert.match(visibility, /!element\.closest\('\.video-grid,\.call-setup-dialog'\)/);
assert.match(css, /#mediaControls\[hidden\]\+\.call-speaker-note\{display:none\}/);
// Loaded and cached.
for (const page of [html, feed]) assert.match(page, /<script src="assets\/call-setup\.js\?v=\d+" defer><\/script>/);
assert.ok(worker.includes('"/assets/call-setup.js"') && worker.includes('"/assets/call-setup.css"'));
assert.ok(!fs.existsSync("assets/call-speaker.js"), "the earlier Speaker button is replaced by the box");
console.log("Call audio setup checks passed: computer-only box, device-only choices, ring volume, blocked mic explained, preview excluded from feed autoplay.");
