const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(i18n, /const chatControlKeys=\["Incoming call"[\s\S]*"Open contact profile"\]/, "call and chat controls need one complete translation key set");
assert.match(i18n, /const callStatusKeys=\["Connected securely to \{name\}\."[\s\S]*"video"\]/, "the complete live call flow needs translated status templates");
assert.match(i18n, /const callMediaKeys=\["Camera and microphone access is blocked\.[\s\S]*"The microphone could not start\./, "camera and microphone recovery guidance needs one complete translation key set");
assert.match(i18n, /const conversationStatusKeys=\["Loading messages with \{name\}…"[\s\S]*"Saved chat\./, "saved conversations need translated loading and permission guidance");
assert.match(i18n, /const messageActionKeys=\["Remove attachment"[\s\S]*"Contacts are temporarily unavailable\. Retrying automatically…"\]/, "message actions, history, offline state, and empty states need one complete translation key set");
for (const language of ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"]) {
  assert.match(i18n, new RegExp(`(?:^|\\s|,)${language.includes("-") ? `"${language}"` : language}:\\[`), `${language} needs chat control translations`);
}
assert.match(chat, /t\("Incoming call"\)\+": "\+contactName/, "incoming calls should announce a translated label with the caller name");
assert.match(chat, /els\.mic\.textContent=t\(track\.enabled\?"Mute":"Unmute"\)/, "live microphone state should stay translated");
assert.match(chat, /els\.camera\.textContent=t\(track\.enabled\?"Camera off":"Camera on"\)/, "live camera state should stay translated");
assert.match(chat, /setStatus\(tf\("Calling \{name\}…",\{name:contactName\}\)\)/, "outgoing call progress should translate while preserving the member name");
assert.match(chat, /setStatus\(tf\("No answer from \{name\}\."/, "no-answer status should translate while preserving the member name");
assert.match(chat, /setStatus\(t\("Call declined\."\)\)/, "declined-call status should remain translated");
assert.match(chat, /function callMediaError\([\s\S]*return t\(video\?"Camera and microphone access is blocked\./, "call permission recovery should use the selected language");
assert.match(messages, /const translated = messageTranslate\(labels\[key\]\)/, "named conversation actions should translate before adding the member name");
assert.match(messages, /mine \? messageTranslate\("You"\)/, "message ownership labels should stay translated");
assert.match(messages, /messageFormat\("Loading messages with \{name\}…", \{ name: activeContactName \}\)/, "conversation loading should translate without losing the contact name");
assert.match(messages, /messageFormat\("You can message \{name\} directly\.", \{ name: activeContactName \}\)/, "conversation permission guidance should translate without losing the contact name");
assert.match(messages, /messageTranslate\(isOnline \? "Online" : "Offline"\)/, "conversation presence should use the selected language");
assert.match(messages, /addChoice\(messageTranslate\("Remove for everyone"\)/, "destructive message choices should use the selected language");
assert.match(messages, /callStatus\.textContent = messageTranslate\("Saved offline — waiting to send when you reconnect\."\)/, "offline delivery guidance should use the selected language");

console.log("Chat localization checks passed: all supported languages cover active conversation and call controls.");
