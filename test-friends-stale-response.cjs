const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const start = source.indexOf('if (name === "Friends")');
const end = source.indexOf('if (["Photos", "Videos"].includes(name))', start);

assert.notEqual(start, -1, "Friends workspace block should exist");
assert.notEqual(end, -1, "Friends workspace block should have a stable boundary");

const friendsBlock = source.slice(start, end);
const directoryParsed = friendsBlock.indexOf("const directoryPeople = new Map");
const onlineRendered = friendsBlock.indexOf("renderOnlineFriendList(onlineList");
const directoryGuard = friendsBlock.indexOf("if (!isCurrentWorkspace()) return;", directoryParsed);

assert(directoryParsed >= 0, "Friends workspace should parse the online directory");
assert(onlineRendered > directoryParsed, "Friends workspace should render online users after parsing");
assert(
  directoryGuard > directoryParsed && directoryGuard < onlineRendered,
  "A stale Friends request must be rejected before online users are rendered"
);

const friendsParsed = friendsBlock.indexOf("const friends = (await friendsResponse.json()).friends || [];");
const emptyRendered = friendsBlock.indexOf("if (!friends.length)", friendsParsed);
const friendsGuard = friendsBlock.indexOf("if (!isCurrentWorkspace()) return;", friendsParsed);

assert(friendsParsed >= 0, "Friends workspace should parse accepted friends");
assert(
  friendsGuard > friendsParsed && friendsGuard < emptyRendered,
  "A stale Friends request must be rejected after accepted friends are parsed"
);

const catchStart = friendsBlock.indexOf("}).catch(error => {");
const catchMutation = friendsBlock.indexOf('list.setAttribute("aria-busy", "false");', catchStart);
const catchGuard = friendsBlock.indexOf("if (!isCurrentWorkspace()) return;", catchStart);

assert(catchStart >= 0, "Friends workspace should handle request failures");
assert(
  catchGuard > catchStart && catchGuard < catchMutation,
  "A stale Friends failure must not replace the active workspace"
);

const feedHtml = fs.readFileSync("feed.html", "utf8");
assert.match(feedHtml, /assets\/feed-enhancements\.js\?v=511/, "Feed should load the localized guarded Friends workspace build");

console.log("Friends stale-response guard checks passed.");
