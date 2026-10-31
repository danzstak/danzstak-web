const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");

const feed = readFileSync("feed.html", "utf8");
const messages = readFileSync("assets/direct-messages.js", "utf8");

assert.match(feed, /let presenceHeartbeatPromise = null;/, "feed should share one in-flight presence heartbeat");
assert.match(feed, /async function loadOnlineUsers\(\)[\s\S]*?const presenceState = await refreshPresenceHeartbeat\(\);/, "online users should publish presence before loading the directory");
assert.match(feed, /async function loadFriends\(\)[\s\S]*?await refreshPresenceHeartbeat\(\);[\s\S]*?calls\/directory/, "friends should wait for presence before loading online status");
assert.match(messages, /async function loadConversations\(\)[\s\S]*?await directFetch\("\/calls\/presence"[\s\S]*?Promise\.allSettled\([\s\S]*?calls\/directory/, "Messages should publish presence before loading conversation status");

console.log("Presence ordering checks passed: feed, friends, and Messages publish activity before directory reads.");
