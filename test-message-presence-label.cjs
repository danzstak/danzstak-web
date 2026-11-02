const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");

const messages = readFileSync("assets/direct-messages.js", "utf8");
const styles = readFileSync("assets/chat.css", "utf8");

assert.match(messages, /function updateConversationPresence\(conversation\)/, "presence updates should use one consistent header renderer");
assert.match(messages, /conversationPresence\.hidden = false;/, "an open conversation should always expose the contact status");
assert.match(messages, /const translatedPresence = messageTranslate\(isOnline \? "Online" : "Offline"\)/, "the header should distinguish online and offline contacts in the selected language");
assert.match(messages, /conversationPresence\.textContent = translatedPresence;/, "the translated presence should be visible");
assert.match(messages, /conversationPresence\.classList\.toggle\("is-offline", !isOnline\)/, "offline status should receive its muted visual treatment");
assert.match(messages, /conversationPresence\.setAttribute\("aria-label", `\$\{contactName\}: \$\{translatedPresence\}`\)/, "presence should name the contact for assistive technology");
assert.match(messages, /if \(activeContact && !conversationHeader\.hidden\)[\s\S]*?updateConversationPresence\(activeConversation\)/, "directory polling should refresh an already-open conversation header");
assert.match(styles, /\.conversation-presence\.is-offline\{color:#667085\}/, "offline status should use a neutral, readable color");

console.log("Message presence checks passed: open chats clearly and accessibly show Online or Offline.");
