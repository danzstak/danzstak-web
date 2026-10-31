const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");

const feed = readFileSync("feed.html", "utf8");
const enhancements = readFileSync("assets/feed-enhancements.js", "utf8");
const messages = readFileSync("assets/direct-messages.js", "utf8");

assert.match(feed, /let presenceHeartbeatPromise = null;/, "feed should share one in-flight presence heartbeat");
assert.match(feed, /let peopleSnapshotPromise = null;/, "feed should share one friends-and-presence snapshot per refresh");
assert.match(feed, /function loadPeopleSnapshot\(\)[\s\S]*?await refreshPresenceHeartbeat\(\);[\s\S]*?calls\/directory[\s\S]*?\/friends/, "the shared snapshot should publish presence before loading directory and friend state");
assert.match(feed, /async function loadOnlineUsers\(\)[\s\S]*?await loadPeopleSnapshot\(\)/, "online users should consume the shared snapshot");
assert.match(feed, /async function loadFriends\(\)[\s\S]*?await loadPeopleSnapshot\(\)/, "friends should consume the shared snapshot");
assert.match(enhancements, /if \(name === "Friends"\)[\s\S]*?refreshPresenceHeartbeat\(\)[\s\S]*?Promise\.allSettled\([\s\S]*?calls\/directory/, "the full Friends workspace should publish presence before reading friend status");
assert.match(messages, /async function loadConversations\(\)[\s\S]*?await directFetch\("\/calls\/presence"[\s\S]*?Promise\.allSettled\([\s\S]*?calls\/directory/, "Messages should publish presence before loading conversation status");

console.log("Presence ordering checks passed: feed, friends, and Messages publish activity before directory reads.");
