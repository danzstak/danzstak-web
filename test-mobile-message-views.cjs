const fs = require("node:fs");
const assert = require("node:assert/strict");

const css = fs.readFileSync("assets/chat.css", "utf8");
const markup = fs.readFileSync("messages.html", "utf8");

assert.match(css, /@media\(max-width:760px\)\{body:not\(\.is-conversation-open\) \.conversation\{display:none\}/, "mobile chat list must not expose an empty conversation canvas");
assert.match(css, /body\.is-conversation-open \.chat-sidebar\{display:none\}/, "mobile conversation must hide the list after selection");
assert.match(css, /body\.is-conversation-open \.conversation\{height:100%;min-height:0\}/, "mobile conversation should fill the available screen");
assert.match(markup, /assets\/chat\.css\?v=\d+/, "messages should load versioned mobile layout styling");
assert.match(css, /@media\(max-width:560px\)\{[\s\S]*?\.chat-header\{height:60px;min-height:60px;flex-wrap:nowrap/, "phone chat navigation must remain on one compact row");
assert.match(css, /\.chat-header \.chat-brand\{flex:0 0 70px\}/, "DanzStak branding should remain legible in the compact phone header");
assert.match(css, /\.chat-header \.chat-brand img\{width:70px;height:42px\}/, "the phone logo should be visually balanced with navigation controls");
assert.match(css, /\.chat-header \.button\{min-height:40px;padding:6px 8px;font-size:12px;white-space:nowrap\}/, "compact phone navigation must retain reliable controls");
assert.match(css, /body\.messages-page\{max-width:100vw;overflow-x:hidden\}/, "phone Messages must not push navigation or app prompts beyond the viewport");
assert.match(markup, /aria-label="Back to Your Mix"[^>]*>Your Mix<\/a>/, "the phone return control should stay understandable without an oversized label");

console.log("Mobile message-view checks passed: list and conversation use separate full-width states.");
