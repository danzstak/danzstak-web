"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/chat.css", "utf8");
const syncCss = fs.readFileSync("assets/sync.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(syncCss, /--sync-canvas:#efeae2/, "SYNC threads need the approved warm conversation canvas");
assert.doesNotMatch(css, /\.message-list\{[^}]*radial-gradient/, "SYNC threads must not use the distracting dotted wallpaper");
assert.match(syncCss, /\.chat-list-panel,\.message-list\{[^}]*background-image:url\("danzstak-score-pattern\.svg"\)/, "sparse SYNC surfaces need the original faint musical-score layer");
assert.match(syncCss, /\.chat-list-panel::after,\.message-list::after\{[^}]*background:url\("danzstak-d-icon\.png"\)[^}]*opacity:\.055/, "sparse SYNC surfaces need a restrained official DanzStak watermark");
assert.match(syncCss, /\.conversation-row\{[^}]*background:#fffffff5/, "conversation rows must remain readable over the sparse-surface artwork");
assert.match(syncCss, /\.message\{[^}]*max-width:min\(75%,540px\)[^}]*background:var\(--sync-incoming\)[^}]*color:var\(--sync-ink\)/, "incoming messages need legible neutral bubbles");
assert.match(syncCss, /\.message\.mine\{[^}]*background:var\(--sync-outgoing\)[^}]*color:var\(--sync-ink\)/, "outgoing messages need a quiet DanzStak blue bubble");
assert.match(syncCss, /\.message\.mine\+\.message\.mine,\.message:not\(\.mine\)\+\.message:not\(\.mine\)\{margin-top:2px\}/, "adjacent messages from one speaker need a compact rhythm");
assert.match(syncCss, /\.message\.mine\+\.message:not\(\.mine\),\.message:not\(\.mine\)\+\.message\.mine\{margin-top:8px\}/, "speaker changes need a clear conversation gap");
assert.match(html, /assets\/sync\.css\?v=11/, "messages must request the new SYNC styling");
assert.match(worker, /danzstak-shell-v790/, "the PWA shell must advance for the updated conversation CSS");
assert.match(worker, /\/assets\/danzstak-score-pattern\.svg/, "the installed PWA must cache the musical-score surface artwork");

console.log("SYNC thread-style checks passed: branded music canvas, readable paired bubbles, speaker grouping, phone fit, and PWA refresh.");
