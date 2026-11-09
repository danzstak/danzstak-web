"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/chat.css", "utf8");
const syncCss = fs.readFileSync("assets/sync.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(syncCss, /--sync-canvas:#efeae2/, "SYNC threads need the approved warm conversation canvas");
assert.doesNotMatch(css, /\.message-list\{[^}]*radial-gradient/, "SYNC threads must not use the distracting dotted wallpaper");
assert.match(syncCss, /\.message\{[^}]*max-width:min\(75%,540px\)[^}]*background:var\(--sync-incoming\)[^}]*color:var\(--sync-ink\)/, "incoming messages need legible neutral bubbles");
assert.match(syncCss, /\.message\.mine\{[^}]*background:var\(--sync-outgoing\)[^}]*color:var\(--sync-ink\)/, "outgoing messages need a quiet DanzStak blue bubble");
assert.match(syncCss, /\.message\.mine\+\.message\.mine,\.message:not\(\.mine\)\+\.message:not\(\.mine\)\{margin-top:2px\}/, "adjacent messages from one speaker need a compact rhythm");
assert.match(syncCss, /\.message\.mine\+\.message:not\(\.mine\),\.message:not\(\.mine\)\+\.message\.mine\{margin-top:8px\}/, "speaker changes need a clear conversation gap");
assert.match(html, /assets\/sync\.css\?v=9/, "messages must request the new SYNC styling");
assert.match(worker, /danzstak-shell-v783/, "the PWA shell must advance for the updated conversation CSS");

console.log("SYNC thread-style checks passed: clean canvas, readable paired bubbles, speaker grouping, phone fit, and PWA refresh.");
