"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const block = feed.slice(feed.indexOf("const watchPostMedia"), feed.indexOf("function renderNextPostBatch"));

assert.match(block, /setTimeout\(\(\) => \{[\s\S]*?\}, 15000\)/,
  "post media should stop waiting after a bounded load attempt");
assert.match(block, /new IntersectionObserver\([\s\S]*?rootMargin: "300px"/,
  "lazy images should only be watched when they approach the viewport");
assert.match(block, /entries\.some\(entry => entry\.isIntersecting\)[\s\S]*?armWatchdog\(\)/,
  "a visible image should begin its bounded load window");
assert.match(block, /addEventListener\("loadstart", armWatchdog\)/,
  "video watchdogs should wait for a real browser load attempt");
assert.match(block, /media\.paused && media\.preload === "none"/,
  "dormant data-saver and off-screen videos must not be reported as broken");
assert.match(block, /addEventListener\("stalled", armWatchdog\)/,
  "stalled video requests should receive a bounded retry window");
assert.match(block, /watchPostMedia\(existingMedia, \(\) => loadPostMedia\(\)\)/,
  "a stalled stored URL should refresh its signed media ticket automatically");
assert.match(block, /Media is taking longer than expected\./,
  "a stalled refreshed ticket should expose an honest retry state");
assert.ok(i18n.includes("Media is taking longer than expected."),
  "the slow-media message should be localizable");

console.log("Post media watchdog checks passed: active stalled loads recover without penalizing dormant videos.");
