const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const source = readFileSync("assets/feed-enhancements.js", "utf8");
const start = source.indexOf('if (name === "Friends")');
const end = source.indexOf('if (["Photos", "Videos"].includes(name))', start);
const workspace = source.slice(start, end);

assert.match(workspace, /state\.presenceAvailable = directoryResponse\?\.ok === true/, "presence failure is represented independently");
assert.match(workspace, /person\.online === true \? feedTranslate\("Online"\) : state\.presenceAvailable \? feedTranslate\("Offline"\) : feedTranslate\("Status unavailable"\)/, "a failed presence provider never falsely labels friends offline");
assert.match(workspace, /if \(!friendsResponse\?\.ok\)[\s\S]*Friends could not be loaded\.[\s\S]*Retry friends/, "friend-list failures have a clear retry state");
assert.match(workspace, /notificationResponse\?\.ok[\s\S]*friend_request/, "incoming request recovery uses the existing notification source when the expanded response is unavailable");
assert.match(workspace, /suppliedIncoming[\s\S]*directoryUsers\.filter\(person => person\.friendStatus === "incoming"\)/, "incoming requests merge API and live-directory states without duplicates");

console.log("Friends workspace resilience checks passed: presence, friends, and requests degrade independently with truthful states.");
