const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");
const directMessages = fs.readFileSync("assets/direct-messages.js", "utf8");
const chatCss = fs.readFileSync("assets/chat.css", "utf8");

assert.match(feed, /drawer\.className = "message-drawer"/, "messages open in the feed drawer");
assert.match(feed, /if \(drawer && !drawer\.hidden\)[\s\S]*?message-drawer-close[\s\S]*?return;[\s\S]*?openMessageDrawer\(\)/, "the Messages icon toggles an open drawer closed");
assert.match(feed, /event\.data\?\.type === "danzstak-call-mode"\) drawer\.classList\.toggle\("is-video-call", event\.data\.mode === "video"\)/, "only a video call expands the drawer to full screen");
assert.match(feed, /event\.data\?\.type === "danzstak-chat-view"\) drawer\.classList\.toggle\("is-conversation", event\.data\.open === true\)/, "ordinary conversations stay in the compact conversation drawer");
assert.match(messages, /aria-label="Phone call">📞<\/button>/, "conversation header exposes a recognizable phone action");
assert.match(messages, /aria-label="Video call">📹<\/button>/, "conversation header exposes a recognizable video action");
assert.match(directMessages, /\[\["📞", "startPhone"\], \["📹", "startVideo"\]\]/, "chat list call actions use the same recognizable icons");
assert.match(chatCss, /\.message-form\{grid-template-columns:minmax\(0,1fr\) auto!important\}/, "message text and send stay on one composer row");
assert.match(chatCss, /\.conversation-header-actions\{grid-column:3;grid-row:1\/3;align-self:center\}/, "call actions stay aligned beside the contact name and presence");

console.log("Message drawer checks passed: feed popup, icon toggle, compact chat, and video-only full screen.");
