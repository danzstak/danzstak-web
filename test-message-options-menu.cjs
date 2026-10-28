const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("messages.html", "utf8");
const script = fs.readFileSync("assets/direct-messages.js", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");

assert.match(html, /id="conversationMore"[^>]*aria-expanded="false"[^>]*aria-controls="conversationMenu"/, "conversation needs an accessible options trigger");
assert.match(html, /id="conversationMenu"[^>]*role="menu"[^>]*hidden/, "conversation options should start closed");
assert.match(html, /id="headerDeleteChat"[^>]*role="menuitem"/, "chat deletion must be available from the conversation header");
assert.match(script, /headerDeleteChat\?\.addEventListener\("click", \(\) => \{ closeConversationMenu\(\); deleteChat\?\.click\(\); \}\)/, "header deletion should reuse the confirmed deletion flow");
assert.match(script, /event\.key === "Escape"/, "options menu should close from the keyboard");
assert.match(css, /\.conversation-menu\[hidden\]\{display:none\}/, "closed menu must not remain visible");
assert.match(css, /body:not\(\.embedded-messages\) #minimizeConversation\{display:none\}/, "standalone mobile header should make room for the options menu");

console.log("Message options checks passed: mobile users can reach confirmed chat deletion from an accessible header menu.");
