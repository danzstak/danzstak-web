"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const page = fs.readFileSync("feed.html", "utf8");
const block = source.slice(source.indexOf('if (name === "Notifications")'), source.indexOf('if (name === "Friends")'));

assert.match(source, /const renderVersion = \+\+workspaceRenderVersion;[\s\S]*?const isCurrentWorkspace = \(\) => renderVersion === workspaceRenderVersion && !featurePanel\.hidden/,
  "workspace renders should have one authoritative version guard");
assert.match(block, /readArrayResponse\(friendsResponse, "friends"\)[\s\S]*?if \(!isCurrentWorkspace\(\)\) return;[\s\S]*?notificationSourceCounts\.social/,
  "stale notification responses must stop before changing badge counts or drawer content");
assert.match(block, /\.catch\(\(\) => \{\s*if \(!isCurrentWorkspace\(\)\) return;/,
  "a stale notification failure must not replace a newer workspace with an error");
assert.match(page, /assets\/feed-enhancements\.js\?v=501/,
  "Your Mix should request the guarded notification controller");

console.log("Notification stale-response checks passed: older drawer loads cannot overwrite current state.");
