"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/sync.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(css, /--sync-font-body:"Segoe UI",-apple-system,BlinkMacSystemFont,"Roboto","Helvetica Neue",sans-serif/, "SYNC needs one native, phone-friendly font stack");
assert.match(css, /\.chat-sidebar\{padding:12px 16px;/, "SYNC needs a 4px-grid screen inset");
assert.match(css, /\.conversation-row\{height:72px;min-height:72px;/, "conversation rows need the measured 72px rhythm");
assert.match(css, /\.conversation-user\{height:72px;min-height:72px!important;[^}]*grid-template-columns:48px minmax\(0,1fr\) auto[^}]*gap:12px[^}]*padding:12px 0/, "conversation rows need 48px avatars and 12px spacing");
assert.match(css, /\.conversation-copy strong\{font-size:16px;line-height:20px;font-weight:600/, "conversation titles need the compact hierarchy");
assert.match(css, /\.conversation-copy small\{font-size:14px!important;line-height:20px/, "conversation previews need readable 14px text");
assert.match(css, /\.conversation-user time\{font-size:12px!important;line-height:16px/, "conversation timestamps need the 12px meta scale");
assert.match(css, /\.message-list\{padding:12px 16px 20px;scrollbar-gutter:stable\}/, "threads need a compact full-width conversation canvas");
assert.match(css, /\.message\{max-width:min\(75%,540px\)[^}]*padding:8px 12px[^}]*border-radius:0 12px 12px 12px[^}]*font-size:15px;line-height:20px/, "incoming bubbles need the measured mobile geometry");
assert.match(css, /\.message\.mine\{[^}]*border-radius:12px 0 12px 12px[^}]*background:var\(--sync-outgoing\)/, "outgoing bubbles need the mirrored DanzStak treatment");
assert.match(css, /\.message\.mine\+\.message\.mine,\.message:not\(\.mine\)\+\.message:not\(\.mine\)\{margin-top:2px\}/, "same-speaker messages need a 2px rhythm");
assert.match(css, /\.message\.mine\+\.message:not\(\.mine\),\.message:not\(\.mine\)\+\.message\.mine\{margin-top:8px\}/, "speaker changes need an 8px rhythm");
assert.match(css, /\.message-form\{min-height:52px;gap:8px;padding:8px 12px/, "the composer needs the measured 52px minimum");
assert.match(css, /\.message-input-shell\{min-height:44px;border-radius:24px\}/, "the message field needs a familiar rounded shell");
assert.match(css, /\.message-input-shell #messageInput\{padding:9px 12px!important;font-size:15px;line-height:20px\}/, "composer text needs the 15px input scale");
assert.match(html, /assets\/sync\.css\?v=10/, "SYNC must request the new layout contract");
assert.match(worker, /danzstak-shell-v792/, "the installed PWA must advance for the SYNC contract");

console.log("SYNC layout-contract checks passed: conversation rows, typography, bubbles, composer, DanzStak branding, and PWA refresh.");
