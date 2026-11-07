"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const styles = fs.readFileSync("assets/sync.css", "utf8");
const page = fs.readFileSync("messages.html", "utf8");

assert.match(styles, /\.conversation-row\{border-bottom:1px solid #eef1f5\}\.conversation-user\{gap:2px 8px!important\}\.conversation-call-actions\{display:none\}/, "Chats must keep avatar spacing without leaking call controls into the inbox row");
assert.match(styles, /body\[data-sync-screen="calls"\] \.conversation-call-actions\{display:flex\}/, "the dedicated Calls section must retain voice and video actions");
assert.match(styles, /\.conversation-user\{grid-template-columns:46px minmax\(0,1fr\) auto!important;gap:2px 10px!important;/, "phone conversation rows must reserve the full avatar width and a separate text gap");
assert.match(styles, /\.conversation-list-avatar,\.conversation-avatar-wrap\{width:46px!important;height:46px!important\}/, "the reserved phone avatar track must match the rendered avatar width");
assert.match(page, /assets\/sync\.css\?v=8/, "SYNC must load the corrected conversation-row stylesheet");

console.log("SYNC conversation-row checks passed: phone avatar track, text gap, and versioned stylesheet are aligned.");
