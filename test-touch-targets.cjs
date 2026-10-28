const fs = require("node:fs");
const assert = require("node:assert/strict");

const chat = fs.readFileSync("assets/chat.css", "utf8");
const shared = fs.readFileSync("assets/soft-ui.css", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");

assert.match(chat, /@media\(pointer:coarse\)\{[\s\S]*\.conversation-call,[\s\S]*min-width:44px;min-height:44px/, "touch chat controls keep a 44px target");
assert.match(chat, /\.chat-filters button,[\s\S]*#newChat/, "chat filters and compose control are included in touch sizing");
assert.match(chat, /#newChat,\.message-attach,\.message-camera,[\s\S]*min-width:44px;min-height:44px/, "attachment and camera controls remain finger-sized");
assert.match(chat, /\.conversation-user\{min-height:56px\}/, "contact rows remain easy to tap");
assert.match(shared, /@media\(pointer:coarse\)\{[\s\S]*\.post-menu-toggle\{min-width:44px;min-height:44px\}/, "feed actions retain coarse-pointer touch sizing");
assert.match(messages, /assets\/chat\.css\?v=367/, "messages loads the touch-target release");

console.log("Touch-target checks passed: compact desktop controls expand safely for coarse-pointer devices.");
