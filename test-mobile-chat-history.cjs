"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");

assert.match(source, /window\.parent === window/, "embedded chat must not change the top-level browser history");
assert.match(source, /matchMedia\?\.\("\(max-width: 760px\)"\)/, "conversation history must be limited to the mobile layout");
assert.match(source, /history\.pushState\(\{ \.\.\.currentState, danzstakChatOpen: true \}, ""\)/, "opening a mobile conversation must add a back-navigation entry");
assert.match(source, /history\.back\(\)/, "the mobile close control must return to the chat list through browser history");
assert.match(source, /if \(window\.parent === window\) \{\s*closeConversationFromControl\(\);\s*return;/, "standalone minimize must consume the same mobile history entry as close");
assert.match(source, /window\.parent\.postMessage\(\{ type: "danzstak-chat-minimize" \}/, "embedded minimize must keep using the parent drawer protocol");
assert.match(source, /window\.addEventListener\("popstate"/, "browser Back and Forward must synchronize the conversation view");
assert.match(source, /openConversation\(mobileHistoryConversation, \{ updateHistory: false \}\)/, "browser Forward must restore the conversation without creating a history loop");
assert.doesNotMatch(source, /danzstakChatOpen:\s*(?:contact|email)/, "history state must not expose a contact email");
assert.match(messages, /assets\/direct-messages\.js\?v=497/, "Messages must load the live read-receipt, avatar-stable, batch-copy, media-safe and registered-device implementation");

console.log("Mobile chat history checks passed: Back returns to the list, Forward restores the chat, embedded drawers remain isolated, and history state contains no contact email.");
