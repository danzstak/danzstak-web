const fs = require("node:fs");
const assert = require("node:assert/strict");

const css = fs.readFileSync("assets/chat.css", "utf8");
const markup = fs.readFileSync("messages.html", "utf8");

assert.match(css, /@media\(max-width:760px\)\{body:not\(\.is-conversation-open\) \.conversation\{display:none\}/, "mobile chat list must not expose an empty conversation canvas");
assert.match(css, /body\.is-conversation-open \.chat-sidebar\{display:none\}/, "mobile conversation must hide the list after selection");
assert.match(css, /body\.is-conversation-open \.conversation\{height:100%;min-height:0\}/, "mobile conversation should fill the available screen");
assert.match(markup, /assets\/chat\.css\?v=\d+/, "messages should load versioned mobile layout styling");

console.log("Mobile message-view checks passed: list and conversation use separate full-width states.");
