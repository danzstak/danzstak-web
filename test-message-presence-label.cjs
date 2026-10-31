const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");

const messages = readFileSync("assets/direct-messages.js", "utf8");
const styles = readFileSync("assets/chat.css", "utf8");

assert.match(messages, /conversationPresence\.hidden = false;/, "an open conversation should always expose the contact status");
assert.match(messages, /conversationPresence\.textContent = isOnline \? "Online" : "Offline";/, "the header should distinguish online and offline contacts");
assert.match(messages, /conversationPresence\.classList\.toggle\("is-offline", !isOnline\)/, "offline status should receive its muted visual treatment");
assert.match(messages, /conversationPresence\.setAttribute\("aria-label", conversationName\.textContent \+ " is " \+ \(isOnline \? "online" : "offline"\)\)/, "presence should name the contact for assistive technology");
assert.match(styles, /\.conversation-presence\.is-offline\{color:#667085\}/, "offline status should use a neutral, readable color");

console.log("Message presence checks passed: open chats clearly and accessibly show Online or Offline.");
