const assert = require("node:assert/strict");
const fs = require("node:fs");

const push = fs.readFileSync("assets/push-notifications.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const settings = fs.readFileSync("assets/device-settings.js", "utf8");

assert.doesNotMatch(push, /showPermissionPrompt|danzstak_push_prompt_dismissed/, "push permission must not be promoted on page load");
assert.match(settings, /data-notify/, "notification enrollment must remain an explicit device-settings action");
assert.match(push, /async function enable\(\)[\s\S]*Notification\.requestPermission\(\)/, "only explicit enrollment may request permission");
assert.match(push, /async function disable\(\)[\s\S]*DELETE[\s\S]*unsubscribe/, "disabling alerts must revoke both server and browser state");
assert.match(worker, /const activeConversations = new Map\(\)/, "the service worker must track the visible conversation per client");
assert.match(worker, /async function visibleConversationClient[\s\S]*visibilityState !== "visible"[\s\S]*tracked === memberId/, "only the matching visible conversation may suppress a message push");
assert.match(worker, /if \(activeClient\)[\s\S]*DANZSTAK_MESSAGE_VISIBLE[\s\S]*return;/, "a matching visible chat must suppress the redundant system notification");
assert.match(messages, /syncActivePushConversation\(conversation\.memberId\)/, "opening a chat must identify it to the service worker");
assert.match(messages, /closeConversation[\s\S]*syncActivePushConversation\(""\)/, "closing a chat must clear active-chat suppression");
assert.match(worker, /candidate\.origin === self\.location\.origin[\s\S]*\^\\\/\(\?:feed\|messages\|profile\)/, "push deep links must remain same-origin and route-limited");
assert.match(worker, /setAppBadge\(1\)/, "background push should set an app badge when supported");
assert.match(worker, /notificationclick[\s\S]*clearAppBadge\(\)/, "opening a notification should clear its app badge");
assert.match(feed, /navigator\.setAppBadge\(safeCount\)/, "in-app unread counts should synchronize the installed-app badge");
assert.match(feed, /navigator\.clearAppBadge\(\)/, "clearing unread notifications should clear the installed-app badge");

console.log("PWA push checks passed: explicit opt-in/out, private deep links, active-chat suppression, and badge synchronization are wired.");
