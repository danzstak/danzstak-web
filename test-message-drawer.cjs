const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");
const directMessages = fs.readFileSync("assets/direct-messages.js", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const chatCss = fs.readFileSync("assets/chat.css", "utf8");

assert.match(feed, /drawer\.className = "message-drawer"/, "messages open in the feed drawer");
assert.match(feed, /class="message-drawer-loading" role="status">Loading SYNC…/, "the drawer announces an immediate branded loading state");
assert.match(feed, /id="messagesNav"[^>]*aria-label="SYNC"[^>]*title="SYNC"/, "the Feed launcher uses the same SYNC identity as the standalone screen");
assert.match(feed, /message-drawer-bar"><span>SYNC<\/span>/, "desktop embedded messaging has one consistent SYNC heading");
assert.match(feed, /href="messages\.html"[^>]*>[\s\S]*?menu-label">SYNC<\/span>/, "the mobile Menu has an intentional standalone SYNC destination");
assert.match(feed, /\.message-drawer\.is-loading iframe\{visibility:hidden\}/, "partially rendered chat chrome stays hidden while loading");
assert.match(feed, /event\.currentTarget\.src\.includes\("messages\.html"\)/, "an unrelated initial frame load cannot dismiss the loading state");
assert.match(feed, /drawer\.querySelector\("\.message-drawer-loading"\)\.hidden = true/, "the loading state clears when Messages is ready");
assert.match(feed, /if \(drawer && !drawer\.hidden\)[\s\S]*?message-drawer-close[\s\S]*?return;[\s\S]*?openMessageDrawer\(\)/, "the Messages icon toggles an open drawer closed");
assert.match(feed, /danzstak:message-drawer[\s\S]*?detail: \{ open: false \}/, "closing Messages announces that obscuring prompts may resume");
assert.match(feed, /detail: \{ open: true \}[\s\S]*?launcher\.setAttribute\("aria-expanded", "true"\)/, "opening Messages announces its modal-like state before focus moves into it");
assert.match(enhancements, /drawer\.classList\.contains\("is-video-call"\)[\s\S]*?drawer\.contains\(event\.target\)[\s\S]*?launcher\?\.contains\(event\.target\)[\s\S]*?message-drawer-close/,
  "clicking back into the page dismisses compact Messages without interrupting a video call");
assert.match(enhancements, /const messageDrawerOpenClicks = new WeakSet\(\)[\s\S]*?messageDrawerOpenClicks\.add\(event\)[\s\S]*?if \(!messageDrawerOpenClicks\.has\(event\)\) return/,
  "the tap that opens a friend conversation must not also dismiss the newly opened drawer");
assert.match(enhancements, /clickedControl instanceof HTMLElement\) messageDrawerPreviousFocus = clickedControl/,
  "click-outside dismissal must preserve the page control the member chose");
assert.match(feed, /event\.data\?\.type === "danzstak-call-mode"\) drawer\.classList\.toggle\("is-video-call", event\.data\.mode === "video"\)/, "only a video call expands the drawer to full screen");
assert.match(feed, /event\.data\?\.type === "danzstak-chat-view"\) drawer\.classList\.toggle\("is-conversation", event\.data\.open === true\)/, "ordinary conversations stay in the compact conversation drawer");
assert.match(feed, /\.message-drawer\.is-conversation:not\(\.is-video-call\) \.message-drawer-bar\{display:none\}/, "an open conversation must not waste space on a second Chats header");
assert.match(feed, /\.message-drawer\.is-conversation:not\(\.is-video-call\) iframe\{height:100%\}/, "the conversation frame must reclaim the removed header space");
assert.match(messages, /aria-label="Phone call"[^>]*disabled[^>]*><svg class="call-action-icon"/, "conversation header exposes a safe, consistent phone action");
assert.match(messages, /aria-label="Video call"[^>]*disabled[^>]*><svg class="call-action-icon"/, "conversation header exposes a safe, consistent video action");
assert.match(directMessages, /function createCallActionIcon\(kind\)/, "chat list call actions use the same consistent icons");
assert.match(directMessages, /\[\["phone", "startPhone"\], \["video", "startVideo"\]\]/, "chat list call actions distinguish phone and video calls");
assert.match(chatCss, /\.call-action-icon\{[^}]*stroke:currentColor/, "call icons inherit the surrounding interface color");
assert.match(chatCss, /\.message-form\{grid-template-columns:minmax\(0,1fr\) auto!important\}/, "message text and send stay on one composer row");
assert.match(chatCss, /\.conversation-header-actions\{grid-column:4;grid-row:1\/3;align-self:center\}/, "call actions stay aligned beside the contact name and presence");
assert.match(chatCss, /\.conversation-back\{grid-column:1;grid-row:1\/3/, "the mobile conversation has a dedicated leading Back control");
assert.match(chatCss, /\.embedded-messages>\.site-ownership\{display:none\}/, "the embedded chat hides the standalone legal footer");
assert.match(chatCss, /\.embedded-messages \.chats-heading h1\{position:absolute;width:1px;height:1px/, "the embedded drawer keeps one visible Chats heading while preserving the iframe heading for assistive technology");
assert.match(chatCss, /\.embedded-messages \.chats-heading\{position:static;min-height:0;height:0/, "the embedded list must not reserve an empty heading row");
assert.match(chatCss, /\.embedded-messages \.chat-heading-actions\{position:fixed;right:18px;bottom:max\(40px,calc\(env\(safe-area-inset-bottom\) \+ 18px\)\)/, "the embedded compose action floats above browser chrome and device safe areas");
assert.match(chatCss, /@media\(max-width:700px\)\{\.embedded-messages \.chat-heading-actions\{bottom:calc\(62px \+ env\(safe-area-inset-bottom,0px\)\)\}/, "the embedded SYNC action row must clear the fixed mobile navigation");

console.log("Message drawer checks passed: feed popup, icon toggle, compact chat, and video-only full screen.");
