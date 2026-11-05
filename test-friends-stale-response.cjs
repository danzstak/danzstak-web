const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const source = readFileSync("assets/feed-enhancements.js", "utf8");
const start = source.indexOf('if (name === "Friends")');
const end = source.indexOf('if (["Photos", "Videos"].includes(name))', start);
const block = source.slice(start, end);

const directoryParsed = block.indexOf("const directoryPeople = new Map");
const firstGuard = block.indexOf("if (!isCurrentWorkspace()) return;", directoryParsed);
const friendsParsed = block.indexOf("const friendsData = await friendsResponse.json();");
const secondGuard = block.indexOf("if (!isCurrentWorkspace()) return;", friendsParsed);
const stateMutation = block.indexOf("state.friends = friends.map", friendsParsed);
const catchStart = block.indexOf("}).catch(error => {");
const catchGuard = block.indexOf("if (!isCurrentWorkspace()) return;", catchStart);
const catchMutation = block.indexOf("content.replaceChildren();", catchStart);

assert(directoryParsed >= 0 && firstGuard > directoryParsed && firstGuard < friendsParsed, "directory parsing is guarded before friend state changes");
assert(friendsParsed >= 0 && secondGuard > friendsParsed && secondGuard < stateMutation, "accepted-friend parsing is guarded before rendering");
assert(catchStart >= 0 && catchGuard > catchStart && catchGuard < catchMutation, "stale failures cannot replace the current workspace");
assert.match(readFileSync("feed.html", "utf8"), /assets\/feed-enhancements\.js\?v=529/, "Feed loads the guarded Friends directory build");

console.log("Friends stale-response guard checks passed.");
