"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/chat.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(css, /\.message-list\{background:#edf2f4;/, "SYNC threads need a calm solid conversation canvas");
assert.doesNotMatch(css, /\.message-list\{[^}]*radial-gradient/, "SYNC threads must not use the distracting dotted wallpaper");
assert.match(css, /\.message\{[^}]*background:#fff[^}]*color:#172033/, "incoming messages need legible neutral bubbles");
assert.match(css, /\.message\.mine\{[^}]*background:#d9efff[^}]*color:#172033/, "outgoing messages need a quiet DanzStak blue bubble");
assert.match(css, /\.message\.mine\+\.message\.mine\{[^}]*border-top-right-radius:5px/, "adjacent outgoing messages must visually group");
assert.match(css, /\.message:not\(\.mine\)\+\.message:not\(\.mine\)\{[^}]*border-top-left-radius:5px/, "adjacent incoming messages must visually group");
assert.match(css, /\.message\.mine\+\.message:not\(\.mine\),\.message:not\(\.mine\)\+\.message\.mine\{margin-top:10px\}/, "speaker changes need a clear conversation gap");
assert.match(css, /@media\(max-width:560px\)[^\n]*\.message\{max-width:88%\}/, "phone bubbles must leave room to distinguish sender sides");
assert.match(html, /assets\/chat\.css\?v=457/, "messages must request the new thread styling");
assert.match(worker, /danzstak-shell-v732/, "the PWA shell must advance for the updated conversation CSS");

console.log("SYNC thread-style checks passed: clean canvas, readable paired bubbles, speaker grouping, phone fit, and PWA refresh.");
