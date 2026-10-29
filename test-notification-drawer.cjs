const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");
const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(feed, /data-feature="Notifications" aria-controls="notificationDrawer" aria-expanded="false"/, "the bell names and controls its drawer");
assert.match(source, /notificationDrawer\.className = "notification-drawer"/, "notifications open in an embedded feed drawer");
assert.match(source, /if \(name === "Notifications" && notificationDrawer && !notificationDrawer\.hidden\)[\s\S]*?closeNotificationDrawer\(\)/, "the bell only closes a drawer that already exists and is open");
assert.doesNotMatch(source, /name === "Notifications" && !notificationDrawer\?\.hidden/, "the first bell click must not mistake a missing drawer for an open one");
assert.match(source, /event\.key === "Escape"[\s\S]*?closeNotificationDrawer\(\)/, "Escape closes the notification drawer");
assert.match(source, /notificationDrawer\.contains\(event\.target\)[\s\S]*?notificationControls\.some\(control => control\.contains\(event\.target\)\)[\s\S]*?closeNotificationDrawer\(false\)/,
  "clicking outside dismisses notifications without stealing focus from the clicked control");
assert.match(source, /messageDrawer[\s\S]*?message-drawer-close[\s\S]*?openNotificationDrawer/, "opening notifications closes Messages first");
assert.match(source, /getElementById\("messagesNav"\)[\s\S]*?closeNotificationDrawer\(false\)/, "opening Messages closes Notifications first");
assert.match(source, /notificationUnderlyingWorkspace = !featurePanel\.hidden/, "the drawer remembers an open workspace");
assert.match(source, /notificationWorkspacePlaceholder = featurePanel\.cloneNode\(true\)/, "an inert visual placeholder keeps the current workspace behind the drawer");
assert.match(source, /if \(workspaceToRestore\) openWorkspaceRoute\(workspaceToRestore, false\)/, "closing notifications restores the exact workspace that was open");
assert.match(source, /else notificationFeedView\.hidden = false/, "opening notifications preserves the feed when no workspace is active");
assert.match(source, /location\.hash\.toLowerCase\(\) === "#notifications"[\s\S]*?history\.replaceState/, "closing a legacy notification route prevents refresh from reopening it");
assert.match(source, /async function loadNotificationSources\(\)[\s\S]*?attempt < 2[\s\S]*?new AbortController\(\)[\s\S]*?Promise\.allSettled/, "notification loading retries one cold start with a fresh bounded request batch");
assert.match(source, /if \(socialReady \|\| engagementReady\) break/, "a usable notification source prevents an unnecessary retry");
assert.match(source, /loadNotificationSources\(\)\.then/, "the notification drawer uses the resilient source loader");
assert.match(css, /\.notification-drawer\{position:fixed/, "the notification panel overlays rather than replaces the feed");
assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.notification-drawer\{top:58px;right:8px;left:8px/, "the drawer fits phone screens");
assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.notification-row\{display:grid;grid-template-columns:42px minmax\(0,1fr\)/, "phone notifications reserve a readable message column");
assert.match(css, /\.notification-actions\{grid-column:2;grid-row:2;justify-content:flex-start;margin-left:0\}/, "phone notification actions sit below the message instead of squeezing it");

console.log("Notification drawer checks passed: toggle, focus-safe dismissal, workspace/feed preservation, and responsive layout.");
