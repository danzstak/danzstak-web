const assert = require("node:assert/strict");
const fs = require("node:fs");

const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(messages, /window\.parent\.postMessage\(\{ type: "danzstak-presence-update", users \}, location\.origin\)/, "chat publishes same-origin presence");
assert.match(messages, /memberId: String\(member\.memberId \|\| ""\)/, "presence uses opaque member IDs");
assert.doesNotMatch(messages.slice(messages.indexOf("window.parent.postMessage") - 300, messages.indexOf("window.parent.postMessage") + 100), /email:/, "presence messages omit emails");
assert.match(feed, /event\.origin !== location\.origin/, "feed rejects cross-origin presence messages");
assert.match(feed, /event\.data\?\.type !== "danzstak-presence-update"/, "feed accepts only the expected message type");
assert.match(feed, /window\.addEventListener\("danzstak-presence-updated"/, "Friends refreshes after heartbeat");
assert.match(feed, /friendPresenceRefresh = fetch\("https:\/\/api\.danzstak\.com\/calls\/directory"/, "heartbeat fetches a fresh directory snapshot");
assert.match(feed, /document\.querySelector\("\.friend-directory-row\[data-member-id\]"\)/, "presence requests run only while Friends is visible");
assert.match(feed, /window\.danzstakApplyFriendsDirectoryPresence = users =>/, "the active directory owns live presence state");
assert.match(feed, /state\.friends = state\.friends\.map\(person => presenceById\.has/, "presence updates the backing friend model");
assert.match(feed, /state\.presenceAvailable = true/, "a successful snapshot clears unavailable status");
assert.match(feed, /renderCurrentView\(\)/, "online membership and counts rerender without a page reload");
assert.match(feed, /dot\.setAttribute\("aria-label", presenceLabel\)/, "fallback rows keep accessible presence labels");
assert.doesNotMatch(feed, /Add a friend by email/, "Friends does not require account emails");

console.log("Friend live-presence checks passed: secure snapshots update cards, Online membership and tab counts without reload.");
