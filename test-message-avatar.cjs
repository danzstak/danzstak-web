const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("assets/chat.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(source, /image\.addEventListener\("load", \(\) => \{[\s\S]*conversationAvatar\.style\.backgroundImage = `url\("\$\{conversation\.picture\}"\)`/, "The selected contact picture must reach the conversation header only after loading");
assert.match(source, /const avatarContact = conversation\.contactEmail/, "A late avatar load must remain bound to the selected conversation");
assert.match(source, /picture: member\.picture \|\| existing\?\.picture \|\| ""/, "A fresh directory picture must replace an expired saved URL");
assert.match(source, /avatar\.addEventListener\("error", \(\) => \{[\s\S]*avatar\.replaceWith\(fallback\)/, "A failed list photo must fall back to the member initial");
assert.match(html, /id="conversationAvatar"[^>]+href="profile\.html"/, "The selected contact avatar must link to a profile without exposing an email");
assert.match(html, /id="conversationName"[^>]+href="profile\.html"/, "The selected contact name must link to the same profile");
assert.match(source, /const profileHref = conversation\.memberId \? "profile\.html\?member=" \+ encodeURIComponent\(conversation\.memberId\) : "profile\.html"/, "Chat profile links must use an opaque member id");
assert.match(source, /memberId: friend\.memberId \|\| existing\.memberId \|\| ""/, "Accepted-friend data must enrich existing chats with a member id");
assert.doesNotMatch(source, /profile\.html\?email=/, "Chat profile links must never reveal account emails");
assert.match(css, /\.conversation-list-avatar,\.conversation-avatar\{[^}]*background-position:center;[^}]*background-size:cover;[^}]*background-repeat:no-repeat;/, "Conversation photos must be centered and cropped inside the round avatar");
assert.match(css, /\.conversation-avatar:focus-visible,\.conversation-name:focus-visible\{outline:/, "Keyboard users need a visible focus indicator on chat profile links");
assert.match(html, /assets\/chat\.css\?v=\d+/, "Messages must request versioned messenger and avatar styling");

console.log("Message avatar checks passed: selected contact photos fill the list and conversation header consistently.");
