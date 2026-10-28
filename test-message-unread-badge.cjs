const assert = require("node:assert/strict");
const fs = require("node:fs");

const client = fs.readFileSync("assets/direct-messages.js", "utf8");
const styles = fs.readFileSync("assets/chat.css", "utf8");

assert.match(client, /badge\.className = "conversation-unread"/, "saved chats need a visible unread badge");
assert.match(client, /Number\(conversation\.unread\) > 99 \? "99\+"/, "large unread counts must stay compact");
assert.match(client, /badge\.setAttribute\("aria-label", `\$\{conversation\.unread\} unread message/, "unread counts need an accessible label");
assert.match(client, /conversation\.unread = 0; markChatRead/, "opening a chat must clear its local unread state immediately");
assert.match(styles, /\.conversation-unread\{[^}]*border-radius:999px/, "unread counts need a compact messenger-style badge");

console.log("Message unread-badge checks passed: compact counts, accessible labels, and immediate local clearing.");
