const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");

const messages = readFileSync("assets/direct-messages.js", "utf8");
const styles = readFileSync("assets/chat.css", "utf8");

assert.match(messages, /function updateConversationPresence\(conversation\)/, "presence updates should use one consistent header renderer");
assert.match(messages, /conversationPresence\.hidden = !translatedPresence;/, "16-D: the status shows whenever the contact shares it, and nothing (not a false \"Offline\") when they hide it");
assert.match(messages, /const translatedPresence = contactTyping \? messageTranslate\("typing…"\) : isOnline \? messageTranslate\("Online"\) : lastSeenText\(conversation\?\.lastSeenAt\);/, "16-D: typing…, Online or last seen, in the selected language");
assert.match(messages, /conversationPresence\.textContent = translatedPresence;/, "the translated presence should be visible");
assert.match(messages, /conversationPresence\.classList\.toggle\("is-offline", !isOnline && !contactTyping\)/, "offline status should receive its muted visual treatment");
assert.match(messages, /conversationPresence\.setAttribute\("aria-label", translatedPresence \? `\$\{contactName\}: \$\{translatedPresence\}` : contactName\)/, "presence should name the contact for assistive technology");
assert.match(messages, /if \(activeContact && !conversationHeader\.hidden\)[\s\S]*?updateConversationPresence\(activeConversation\)/, "directory polling should refresh an already-open conversation header");
assert.match(styles, /\.conversation-presence\.is-offline\{color:#667085\}/, "offline status should use a neutral, readable color");

console.log("Message presence checks passed: open chats clearly and accessibly show typing…, Online or last seen.");
