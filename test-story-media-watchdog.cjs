"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const viewer = feed.slice(feed.indexOf("async function openStoryViewer"), feed.indexOf("async function loadStories"));
const rail = feed.slice(feed.indexOf("async function loadStories"), feed.indexOf("async function createDedicatedStory"));

assert.match(viewer, /setTimeout\(\(\) => \{[\s\S]*?showRecovery\("Media is taking longer than expected\."\);[\s\S]*?\}, 15000\)/,
  "the full Flash viewer should expose recovery after a stalled load");
assert.match(viewer, /story\.mediaType === "video" \? "loadeddata" : "load"/,
  "successful Flash media should cancel the viewer watchdog");
assert.match(viewer, /viewer\.addEventListener\("close", \(\) => stopWatchingMedia\(\)/,
  "closing the viewer should cancel its active watchdog");
assert.match(rail, /const timer = setTimeout\(async \(\) => \{[\s\S]*?installStoryImage\(false\)[\s\S]*?\}, 15000\)/,
  "stalled Flash image cards should refresh their signed URL once");
assert.match(rail, /video\.addEventListener\("loadstart", armWatchdog/,
  "Flash video cards should only start their watchdog on a real load attempt");
assert.match(rail, /video\.preload === "none" && video\.paused/,
  "data-saver Flash videos must not be reported as broken while dormant");
assert.match(rail, /video\.addEventListener\("loadedmetadata", clearWatchdog/,
  "loaded Flash video previews should cancel their watchdog");

console.log("Flash media watchdog checks passed: viewer and rail stalls recover without penalizing dormant videos.");
