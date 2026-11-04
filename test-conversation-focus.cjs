const fs = require("fs");
const assert = require("assert");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const styles = fs.readFileSync("assets/chat.css", "utf8");

assert.match(source, /focusedControl = document\.activeElement\?\.closest\?\.\("\.conversation-user,\.chat-contact"\)/, "contact refresh must remember the focused chat row or avatar shortcut");
assert.match(source, /focusedSelector = focusedControl\?\.classList\.contains\("chat-contact"\) \? "\.chat-contact" : "\.conversation-user"/, "focus restoration must remain on the same inbox surface");
assert.match(source, /button\.dataset\.contactEmail = conversation\.contactEmail/, "chat rows need a stable contact identity");
assert.match(source, /focusTarget\?\.focus\(\{ preventScroll: true \}\)/, "contact refresh must restore keyboard focus without scrolling");
assert.match(source, /button\.setAttribute\("aria-current", "true"\)/, "the active conversation must be exposed to assistive technology");
assert.match(styles, /\.conversation-user\.is-active/, "the active conversation needs a visible treatment");

console.log("Conversation focus checks passed: polling preserves focus and marks the active chat.");
