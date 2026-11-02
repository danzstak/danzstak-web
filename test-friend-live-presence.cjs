const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(messages, /window\.parent\.postMessage\(\{ type: "danzstak-presence-update", users \}, location\.origin\)/, "the chat frame publishes fresh presence to its same-origin parent");
assert.match(messages, /memberId: String\(member\.memberId \|\| ""\)/, "presence messages use opaque member IDs");
assert.doesNotMatch(messages.slice(messages.indexOf('window.parent.postMessage') - 300, messages.indexOf('window.parent.postMessage') + 100), /email:/, "presence messages do not expose account emails");
assert.match(feed, /event\.origin !== location\.origin/, "the feed rejects cross-origin presence messages");
assert.match(feed, /event\.data\?\.type !== "danzstak-presence-update"/, "the feed accepts only the expected message type");
assert.match(feed, /window\.addEventListener\("danzstak-presence-updated"/, "the Friends view refreshes after the page heartbeat even when Messages is closed");
assert.match(feed, /friendPresenceRefresh = fetch\("https:\/\/api\.danzstak\.com\/calls\/directory"/, "the Friends view requests a fresh presence snapshot after each heartbeat");
assert.match(feed, /if \(!document\.querySelector\("\.friend-workspace-row\[data-member-id\]"\) \|\| friendPresenceRefresh\) return/, "presence refreshes only while Friends is visible and never overlap");
assert.match(feed, /applyFriendWorkspacePresence\(data\.users \|\| \[\]\)/, "heartbeat snapshots update the same friend cards as chat snapshots");
assert.match(feed, /status\.textContent = online \? "Online" : "Offline"/, "friend status text updates from the fresh snapshot");
assert.match(feed, /dot\.classList\.toggle\("online", online\)/, "friend presence dots update from the fresh snapshot");

const refreshStart = feed.indexOf("function applyFriendWorkspacePresence(users)");
const refreshEnd = feed.indexOf("function linkifyUserText(element)", refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, "friend presence refresh block must remain testable");
const handlers = {};
const attributes = {};
const status = { textContent: "Offline" };
const dot = { title: "Offline", classList: { toggle(name, enabled) { attributes[name] = enabled; } } };
const profileLink = { dataset: { friendName: "Sleeping Dragon" }, setAttribute(name, value) { attributes[name] = value; } };
const row = {
  dataset: { memberId: "b4f80438-e021-70d6-1dac-91deb901b6d9" },
  querySelector(selector) {
    if (selector === ".friend-details small") return status;
    if (selector === ".friend-presence") return dot;
    if (selector === "a.friend-card-large") return profileLink;
    return null;
  }
};
let directoryLoads = 0;
const context = vm.createContext({
  AbortController,
  Error,
  Promise,
  clearTimeout() {},
  document: {
    querySelector(selector) { return selector.includes("friend-workspace-row") ? row : null; },
    querySelectorAll(selector) { return selector.includes("friend-workspace-row") ? [row] : []; }
  },
  fetch: async () => {
    directoryLoads += 1;
    return { ok: true, json: async () => ({ users: [{ memberId: row.dataset.memberId, online: true }] }) };
  },
  location: { origin: "https://danzstak.com" },
  setTimeout() { return 1; },
  window: { addEventListener(type, handler) { handlers[type] = handler; } }
});
vm.runInContext(feed.slice(refreshStart, refreshEnd), context);

(async () => {
  handlers["danzstak-presence-updated"]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(directoryLoads, 1, "one page heartbeat should request one fresh directory snapshot");
  assert.equal(status.textContent, "Online", "the open Friends row should update without reopening Messages");
  assert.equal(dot.title, "Online");
  assert.equal(attributes.online, true);
  assert.equal(attributes["aria-label"], "Sleeping Dragon, Online. Open profile");
  console.log("Friend live-presence checks passed: heartbeat and same-origin chat snapshots keep Friends current.");
})().catch(error => { console.error(error); process.exitCode = 1; });
