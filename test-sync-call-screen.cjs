"use strict";
// SYNC video call screen (fix-it "Call screen", owner 2026-11-17). Static contract; real-browser check:
// browser-checks/sync-call-screen.cjs (360, 390, 1280).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/call-screen.js", "utf8"), css = fs.readFileSync("assets/call-screen.css", "utf8"), html = fs.readFileSync("messages.html", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8"), chat = fs.readFileSync("assets/chat.js", "utf8"), i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");
assert.doesNotThrow(() => new Function(js));
assert.doesNotMatch(js, /getUserMedia|RTCPeerConnection|srcObject\s*=|\/calls\//, "layout only: media and signalling untouched");
assert.match(css, /\.video-grid video\{max-height:none!important\}/, "the old 440px cap on call video is gone");
assert.match(css, /#remoteVideo,[^{]*\{object-fit:cover;object-position:50% 35%\}/, "fills the screen, faces framed");
assert.match(css, /\[data-fit="contain"\] #remoteVideo/, "double-tap fits the whole picture");
assert.match(css, /\[data-call-subtitles="on"\]\{--call-subtitle-band:clamp\(84px,17dvh,140px\)\}/, "subtitle band only when subtitles are on");
assert.match(css, /\.video-grid\{bottom:max\(var\(--call-subtitle-band\),var\(--call-note-band,0px\)\)!important/, "the video ends above the subtitle band, or above an in-call note (L3)");
assert.match(js, /HOLD_MS = 300/, "long-press about 300 ms");
assert.match(js, /if \(start\.touch && distance > 10\) \{ clearTimeout\(holdTimer\); start = null; return; \}/, "a swipe is not a long-press");
assert.match(js, /localStorage\.setItem\(KEY, next\)/, "the corner is remembered on this device");
assert.match(css, /--call-pip-bottom:calc\(var\(--call-panel-h\) \+ 12px \+ var\(--call-subtitle-band\)\)/, "bottom corners sit above the call panel (F15k: its real height, measured by sync-call-ui.js)");
assert.match(html, /<script src="assets\/call-screen\.js\?v=\d+" defer><\/script>/);
assert.match(html, /<link rel="stylesheet" href="assets\/call-screen\.css\?v=\d+">/);
assert.ok(worker.includes('"/assets/call-screen.js"') && worker.includes('"/assets/call-screen.css"'));
assert.match(chat, /RTCPeerConnection/, "the call code itself is unchanged and still here");
for (const lang of ["it", "fr", "es"]) { const b = i18n.slice(i18n.indexOf(`"${lang}": {`), i18n.indexOf("\n}", i18n.indexOf(`"${lang}": {`))); for (const k of ["Whole picture", "Full screen", "Showing your camera big"]) assert.ok(b.includes(JSON.stringify(k) + ":"), `${lang}: ${k}`); }
console.log("SYNC call screen checks passed: full-screen cover without the 440px cap, double-tap fit, subtitle band only when on, long-press drag with remembered corner above the buttons, media untouched.");
