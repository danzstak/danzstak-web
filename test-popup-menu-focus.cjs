const fs = require("fs");
const assert = require("assert");

const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(feed, /menu\.addEventListener\("focusout"/,
  "post options close when keyboard focus leaves the menu");
assert.match(feed, /menu\.contains\(document\.activeElement\)/,
  "post options remain open while focus moves within the menu");
assert.match(feed, /document\.activeElement === toggle/,
  "post options do not immediately close when focus returns to their toggle");
assert.match(feed, /toggle\.setAttribute\("aria-expanded", "false"\)/,
  "post option focus dismissal exposes its closed state");

assert.match(messages, /conversationMenu\?\.addEventListener\("focusout"/,
  "conversation options close when keyboard focus leaves the menu");
assert.match(messages, /conversationMenu\.contains\(document\.activeElement\)/,
  "conversation options remain open while focus moves within the menu");
assert.match(messages, /document\.activeElement === conversationHeaderActions\.more/,
  "conversation options do not immediately close when focus returns to their toggle");
assert.match(messages, /closeConversationMenu\(\)/,
  "conversation focus dismissal uses the shared close behavior");

console.log("Popup menu focus regression checks passed.");
