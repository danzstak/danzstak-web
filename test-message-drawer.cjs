const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");

assert.match(feed, /drawer\.className = "message-drawer"/, "messages open in the feed drawer");
assert.match(feed, /if \(drawer && !drawer\.hidden\)[\s\S]*?message-drawer-close[\s\S]*?return;[\s\S]*?openMessageDrawer\(\)/, "the Messages icon toggles an open drawer closed");
assert.match(feed, /event\.data\?\.type === "danzstak-call-mode"\) drawer\.classList\.toggle\("is-video-call", event\.data\.mode === "video"\)/, "only a video call expands the drawer to full screen");
assert.match(feed, /event\.data\?\.type === "danzstak-chat-view"\) drawer\.classList\.toggle\("is-conversation", event\.data\.open === true\)/, "ordinary conversations stay in the compact conversation drawer");

console.log("Message drawer checks passed: feed popup, icon toggle, compact chat, and video-only full screen.");
