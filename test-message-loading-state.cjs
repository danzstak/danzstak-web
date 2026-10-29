const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(source, /messageList\.setAttribute\("aria-busy", "true"\)/, "message history announces that it is loading");
assert.match(source, /Loading messages with \$\{activeContactName\}…/, "initial loading state identifies the selected contact");
assert.match(source, /status\.setAttribute\("role", "alert"\)/, "initial message failures are announced in the conversation");
assert.match(source, /retry\.textContent = "Try loading messages again"/, "initial message failures provide an in-place retry");
assert.match(source, /if \(reset\) renderMessageLoadError\(message\)/, "background refresh failures do not replace an existing conversation");
assert.match(source, /messageList\.setAttribute\("aria-busy", "false"\)/, "message history clears its busy state after loading or closing");

console.log("Message loading-state checks passed: opening chats announces progress and initial failures remain recoverable.");
