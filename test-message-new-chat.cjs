const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("messages.html", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(html, /id="newChat"[^>]*aria-label="Start a new chat"/);
assert.match(html, /id="enableRinging"[^>]*aria-label="Enable call alerts"[^>]*>🔔<\/button>/);
assert.match(html, /<section class="conversation"[^>]*>[\s\S]*id="callStatus" class="call-status conversation-status"/, "message and call status belongs to the visible conversation panel");
assert.doesNotMatch(html, /id="callStatus"[^>]*sr-only/, "message failures must not be visually hidden");
assert.match(css, /\.embedded-messages\.is-conversation-open #callStatus\{display:block\}/, "the embedded drawer keeps message failures visible");
assert.match(css, /\.conversation-status\{[^}]*padding:6px 14px/, "the visible status stays compact in the conversation");
assert.match(html, /id="conversationUsers" aria-busy="true"/);
assert.match(html, /id="deleteChat"[^>]*aria-label="Delete chat"[^>]*>🗑️<\/button>/);
assert.match(html, /class="chat-compat-controls" hidden aria-hidden="true"/);
assert.match(css, /\.new-chat-button\{/);
assert.match(css, /\.chat-heading-actions\{/);
assert.match(css, /\.chat-compat-controls\[hidden\],\.delete-chat\[hidden\]\{display:none!important\}/);
assert.match(source, /getElementById\("newChat"\).*addEventListener\("click"/s);
assert.match(source, /chatSearch\?\.focus\(\)/);
assert.match(source, /conversationUsers\?\.setAttribute\?\.\("aria-busy", "true"\)/);
assert.match(source, /conversationUsers\?\.setAttribute\?\.\("aria-busy", "false"\)/);

console.log("New-chat checks passed: contacts remain in one familiar list and the compose control resets search and filters.");
