const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");
const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(feed, /data-feature="Notifications" aria-controls="notificationDrawer" aria-expanded="false"/, "the bell names and controls its drawer");
assert.match(source, /notificationDrawer\.className = "notification-drawer"/, "notifications open in an embedded feed drawer");
assert.match(source, /if \(name === "Notifications" && !notificationDrawer\?\.hidden\)[\s\S]*?closeNotificationDrawer\(\)/, "the bell toggles an open drawer closed");
assert.match(source, /event\.key === "Escape"[\s\S]*?closeNotificationDrawer\(\)/, "Escape closes the notification drawer");
assert.match(source, /messageDrawer[\s\S]*?message-drawer-close[\s\S]*?openNotificationDrawer/, "opening notifications closes Messages first");
assert.match(source, /getElementById\("messagesNav"\)[\s\S]*?closeNotificationDrawer\(false\)/, "opening Messages closes Notifications first");
assert.match(source, /notificationFeedView\.hidden = false/, "opening notifications preserves the feed");
assert.match(css, /\.notification-drawer\{position:fixed/, "the notification panel overlays rather than replaces the feed");
assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.notification-drawer\{top:58px;right:8px;left:8px/, "the drawer fits phone screens");

console.log("Notification drawer checks passed: toggle, focus-safe dismissal, feed preservation, and responsive layout.");
