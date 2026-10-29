const fs = require("fs");
const assert = require("assert");

const css = fs.readFileSync("assets/chat.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");

assert.match(source, /conversationAvatar\.style\.backgroundImage = `url\("\$\{conversation\.picture\}"\)`/, "The selected contact picture must reach the conversation header");
assert.match(css, /\.conversation-list-avatar,\.conversation-avatar\{[^}]*background-position:center;[^}]*background-size:cover;[^}]*background-repeat:no-repeat;/, "Conversation photos must be centered and cropped inside the round avatar");
assert.match(html, /assets\/chat\.css\?v=368/, "Messages must request the updated messenger and avatar styling");

console.log("Message avatar checks passed: selected contact photos fill the list and conversation header consistently.");
