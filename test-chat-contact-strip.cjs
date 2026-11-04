"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("messages.html", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");

assert.match(html, /id="chatContacts" class="chat-contact-strip" aria-label="Chats" hidden/, "the inbox must reserve a compact, named contact strip");
assert.match(source, /function renderChatContactStrip\(conversations\)/, "authorized contacts must render through one shared path");
assert.match(source, /\.filter\(conversation => conversation\?\.contactEmail && conversation\.canContact !== false\)/, "non-contactable members must not become top-row shortcuts");
assert.match(source, /String\(right\.updatedAt \|\| ""\)\.localeCompare\(String\(left\.updatedAt \|\| ""\)\)/, "contact order must be stable and based on recent real conversations");
assert.match(source, /button\.addEventListener\("click", \(\) => openConversationFromInbox\(conversation\)\)/, "a contact photo must open the existing authorized conversation");
assert.match(source, /const focusedSelector = focusedControl\?\.classList\.contains\("chat-contact"\) \? "\.chat-contact" : "\.conversation-user"/, "refreshes must restore focus to the same inbox surface");
assert.match(source, /danzstakIdentityMedia\?\.install\(avatar, conversation\)/, "expired contact photos must use the shared secure recovery behavior");
assert.match(source, /conversation\.online === true[\s\S]*className = "chat-contact-online"/, "online dots must appear only for confirmed presence");
assert.doesNotMatch(source, /chatContacts[\s\S]*profile\.html\?email=/, "the contact strip must not expose account emails in routes");
assert.match(css, /\.chat-contact-strip\{display:flex;[^}]*overflow-x:auto;[^}]*scroll-snap-type:x proximity/, "many contacts must scroll horizontally without taking over the inbox");
assert.match(css, /\.chat-contact\{[^}]*flex:0 0 58px;[^}]*min-height:78px/, "contact shortcuts must remain compact and touchable");
assert.match(css, /\.chat-contact-avatar\{[^}]*width:52px;height:52px;[^}]*border-radius:50%;[^}]*object-fit:cover/, "real photos and initials must share consistent circular geometry");

console.log("Chat contact-strip checks passed: authorized real contacts, recent stable order, photo recovery, truthful presence, and existing-thread navigation.");
