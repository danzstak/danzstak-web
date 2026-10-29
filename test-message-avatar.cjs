const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("assets/chat.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(source, /conversationAvatar\.style\.backgroundImage = `url\("\$\{conversation\.picture\}"\)`/, "The selected contact picture must reach the conversation header");
assert.match(html, /id="conversationAvatar"[^>]+href="profile\.html"/, "The selected contact avatar must link to a profile without exposing an email");
assert.match(html, /id="conversationName"[^>]+href="profile\.html"/, "The selected contact name must link to the same profile");
assert.match(source, /const profileHref = conversation\.memberId \? "profile\.html\?member=" \+ encodeURIComponent\(conversation\.memberId\) : "profile\.html"/, "Chat profile links must use an opaque member id");
assert.match(source, /memberId: friend\.memberId \|\| existing\.memberId \|\| ""/, "Accepted-friend data must enrich existing chats with a member id");
assert.doesNotMatch(source, /profile\.html\?email=/, "Chat profile links must never reveal account emails");
assert.match(css, /\.conversation-list-avatar,\.conversation-avatar\{[^}]*background-position:center;[^}]*background-size:cover;[^}]*background-repeat:no-repeat;/, "Conversation photos must be centered and cropped inside the round avatar");
assert.match(css, /\.conversation-avatar:focus-visible,\.conversation-name:focus-visible\{outline:/, "Keyboard users need a visible focus indicator on chat profile links");
assert.match(html, /assets\/chat\.css\?v=\d+/, "Messages must request versioned messenger and avatar styling");

console.log("Message avatar checks passed: selected contact photos fill the list and conversation header consistently.");
