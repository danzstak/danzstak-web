const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(source, /const chatDraftKey = "danzstak_chat_drafts"/, "drafts need a dedicated session key");
assert.match(source, /sessionStorage\.getItem\(chatDraftKey\)/, "drafts should survive chat switching in the tab");
assert.match(source, /sessionStorage\.setItem\(chatDraftKey/, "draft changes should be saved in the tab");
assert.match(source, /restoreChatDraft\(contactInput\.value\)/, "opening a chat should restore its own draft");
assert.match(source, /saveChatDraft\(closingContact, messageInput\.value\)/, "closing a chat should preserve unfinished text");
assert.match(source, /messageInput\?\.addEventListener\("input"/, "typing should update the current draft");
assert.match(source, /saveChatDraft\(recipientEmail, ""\)/, "a confirmed send should clear the saved draft");
assert.match(source, /saveChatDraft\(contact, ""\)/, "deleting a chat should remove its draft");
assert.match(source, /closeConversation\(\{ focusList: true, preserveDraft: false \}\)/, "deleting a chat must not restore the removed draft");
assert.doesNotMatch(source, /localStorage\.setItem\(chatDraftKey/, "message drafts should not persist after the browser session");

console.log("Message draft checks passed: each chat preserves text in-session and clears it after send or deletion.");
