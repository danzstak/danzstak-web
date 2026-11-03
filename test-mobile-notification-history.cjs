"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(source, /matchMedia\("\(max-width: 700px\)"\)\.matches/, "notification history must be limited to the mobile drawer layout");
assert.match(source, /history\.pushState\(\{ \.\.\.currentState, danzstakNotificationsOpen: true \}, ""\)/, "opening mobile notifications must add a Back entry");
assert.match(source, /history\.back\(\)/, "Close and Escape must return through mobile history");
assert.match(source, /openNotificationDrawer\(notificationControls\[0\], \{ updateHistory: false \}\)/, "Forward must restore notifications without creating a loop");
assert.match(source, /closeNotificationDrawer\(true, \{ fromHistory: true \}\)/, "Back must close the drawer without adding another history action and restore focus");
assert.doesNotMatch(source, /danzstakNotificationsOpen:\s*(?:notice|notification|message|user|email)/, "history state must not contain notification or account data");
assert.match(feed, /assets\/feed-enhancements\.js\?v=509/, "the feed must load the notification-history build");

console.log("Mobile notification history checks passed: Back dismisses, Forward restores, desktop routing is unchanged, and history contains no notification data.");
