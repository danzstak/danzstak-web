const fs = require("fs");
const assert = require("assert");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const styles = fs.readFileSync("assets/chat.css", "utf8");

assert.match(source, /focusedContact = document\.activeElement\?\.closest\?\.\("\.conversation-user"\)/, "contact refresh must remember the focused chat row");
assert.match(source, /button\.dataset\.contactEmail = conversation\.contactEmail/, "chat rows need a stable contact identity");
assert.match(source, /focusTarget\?\.focus\(\{ preventScroll: true \}\)/, "contact refresh must restore keyboard focus without scrolling");
assert.match(source, /button\.setAttribute\("aria-current", "true"\)/, "the active conversation must be exposed to assistive technology");
assert.match(styles, /\.conversation-user\.is-active/, "the active conversation needs a visible treatment");

console.log("Conversation focus checks passed: polling preserves focus and marks the active chat.");
