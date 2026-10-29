const assert = require("node:assert/strict");
const fs = require("node:fs");

const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(messages, /window\.parent\.postMessage\(\{ type: "danzstak-presence-update", users \}, location\.origin\)/, "the chat frame publishes fresh presence to its same-origin parent");
assert.match(messages, /memberId: String\(member\.memberId \|\| ""\)/, "presence messages use opaque member IDs");
assert.doesNotMatch(messages.slice(messages.indexOf('window.parent.postMessage') - 300, messages.indexOf('window.parent.postMessage') + 100), /email:/, "presence messages do not expose account emails");
assert.match(feed, /event\.origin !== location\.origin/, "the feed rejects cross-origin presence messages");
assert.match(feed, /event\.data\?\.type !== "danzstak-presence-update"/, "the feed accepts only the expected message type");
assert.match(feed, /status\.textContent = online \? "Online" : "Offline"/, "friend status text updates from the fresh snapshot");
assert.match(feed, /dot\.classList\.toggle\("online", online\)/, "friend presence dots update from the fresh snapshot");

console.log("Friend live-presence checks passed: same-origin opaque updates keep Friends and Chats consistent.");
