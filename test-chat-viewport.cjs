"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/chat.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");

assert.match(html, /assets\/chat\.css\?v=\d+/, "Messages must load versioned viewport-constrained chat styling");
assert.match(css, /@media\(min-width:761px\)\{\.chat-shell\{height:calc\(100dvh - 100px\);min-height:520px\}/, "desktop chat should fit the available viewport instead of growing with message history");
assert.match(css, /\.chat-sidebar,\.conversation\{min-height:0\}/, "chat grid children must be allowed to shrink so their own content can scroll");
assert.match(css, /\.chat-sidebar\{overflow:auto\}/, "a long conversation directory should scroll without moving the composer off screen");
assert.match(css, /\.message-list\{flex:1 1 auto;max-height:none;overflow:auto\}/, "message history should own the scrolling region");
assert.match(css, /\.message-form\{margin-top:auto;/, "the composer should remain anchored after the message history");
assert.match(css, /body:has\(>\.install-app-button:not\(\[hidden\]\)\) \.chat-shell,body:has\(>\.app-update-button:not\(\[hidden\]\)\) \.chat-shell\{height:calc\(100dvh - 148px\);min-height:min\(520px,calc\(100dvh - 148px\)\)\}/, "temporary app prompts must reduce the desktop chat shell instead of pushing the composer below the viewport");

console.log("Chat viewport checks passed: desktop history scrolls internally and the composer stays available.");
