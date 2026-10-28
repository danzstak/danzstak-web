const assert = require("node:assert/strict");
const fs = require("node:fs");

const client = fs.readFileSync("assets/direct-messages.js", "utf8");
const styles = fs.readFileSync("assets/chat.css", "utf8");

assert.match(client, /function pendingMessageItem\(content, mediaFile\)/, "messaging needs an immediate sending bubble");
assert.match(client, /messageList\.appendChild\(pendingItem\)/, "the sending bubble must appear before the network request finishes");
assert.match(client, /meta\.textContent = "Sending…"/, "pending delivery state must be visible");
assert.match(client, /pendingItem\.replaceWith\(directMessageItem\(data\.message\)\)/, "the server-confirmed message must replace the pending bubble");
assert.match(client, /shownMessages\.add\(data\.message\.messageId\)/, "background polling must not duplicate a confirmed optimistic message");
assert.match(client, /if \(content && !messageInput\.value\.trim\(\)\) messageInput\.value = content/, "failed text must return to the composer");
assert.match(client, /Your message is still in the composer/, "failed delivery must explain that the draft was preserved");
assert.match(styles, /\.message-pending\{opacity:/, "pending messages need a distinct visual state");

console.log("Optimistic messaging checks passed: immediate sending state, confirmation replacement, deduplication, and draft recovery.");
