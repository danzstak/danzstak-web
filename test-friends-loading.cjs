const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const source = readFileSync("assets/feed-enhancements.js", "utf8");
const start = source.indexOf('if (name === "Friends")');
const end = source.indexOf('if (["Photos", "Videos"].includes(name))', start);
const workspace = source.slice(start, end);

assert.match(workspace, /Promise\.allSettled\(\[\s*fetch\("https:\/\/api\.danzstak\.com\/friends"[\s\S]*fetch\("https:\/\/api\.danzstak\.com\/calls\/directory"[\s\S]*fetch\("https:\/\/api\.danzstak\.com\/notifications"/, "Friends, presence and request recovery load independently");
assert.match(workspace, /state\.presenceAvailable = directoryResponse\?\.ok === true/, "presence availability remains explicit instead of falsely showing offline");
assert.match(workspace, /const friendsData = await friendsResponse\.json\(\);[\s\S]*const friends = friendsData\.friends \|\| \[\]/, "accepted friends render from the authoritative Friends response");
assert.match(workspace, /online: directoryFriend\.online === true/, "accepted friends merge truthful directory presence when available");
assert.match(workspace, /friendsResult\.status === "rejected" && friendsResult\.reason\?\.name === "AbortError"[\s\S]*Friends took too long to load/, "timeouts have a specific recovery state");
assert.match(workspace, /retry\.textContent = feedTranslate\("Retry friends"\)/, "failed friend loading exposes a clear retry");
assert.match(workspace, /if \(!isCurrentWorkspace\(\)\) return;/, "stale responses cannot replace a newer workspace");

console.log("Friends loading checks passed: independent sources, truthful presence, stale guards, timeout recovery and retry remain explicit.");
