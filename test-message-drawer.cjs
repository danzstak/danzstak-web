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
assert.match(feed, /\.message-drawer\.is-conversation:not\(\.is-video-call\) \.message-drawer-bar\{display:none\}/, "an open conversation must not waste space on a second Chats header");
assert.match(feed, /\.message-drawer\.is-conversation:not\(\.is-video-call\) iframe\{height:100%\}/, "the conversation frame must reclaim the removed header space");
assert.match(messages, /aria-label="Phone call"><svg class="call-action-icon"/, "conversation header exposes a consistent phone action");
assert.match(messages, /aria-label="Video call"><svg class="call-action-icon"/, "conversation header exposes a consistent video action");
assert.match(directMessages, /function createCallActionIcon\(kind\)/, "chat list call actions use the same consistent icons");
assert.match(directMessages, /\[\["phone", "startPhone"\], \["video", "startVideo"\]\]/, "chat list call actions distinguish phone and video calls");
assert.match(chatCss, /\.call-action-icon\{[^}]*stroke:currentColor/, "call icons inherit the surrounding interface color");
assert.match(chatCss, /\.message-form\{grid-template-columns:minmax\(0,1fr\) auto!important\}/, "message text and send stay on one composer row");
assert.match(chatCss, /\.conversation-header-actions\{grid-column:3;grid-row:1\/3;align-self:center\}/, "call actions stay aligned beside the contact name and presence");
assert.match(chatCss, /\.embedded-messages>\.site-ownership\{display:none\}/, "the embedded chat hides the standalone legal footer");
assert.match(chatCss, /\.embedded-messages \.chats-heading h1\{position:absolute;width:1px;height:1px/, "the embedded drawer keeps one visible Chats heading while preserving the iframe heading for assistive technology");
assert.match(chatCss, /\.embedded-messages \.chats-heading\{position:static;min-height:0;height:0/, "the embedded list must not reserve an empty heading row");
assert.match(chatCss, /\.embedded-messages \.chat-heading-actions\{position:fixed;right:18px;bottom:max\(40px,calc\(env\(safe-area-inset-bottom\) \+ 18px\)\)/, "the embedded compose action floats above browser chrome and device safe areas");

console.log("Message drawer checks passed: feed popup, icon toggle, compact chat, and video-only full screen.");
