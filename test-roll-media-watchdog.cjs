"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const observer = source.slice(source.indexOf("const reelPlaybackObserver"), source.indexOf("const reelForm"));
const render = source.slice(source.indexOf("function renderPlayableReels"), source.indexOf('window.addEventListener("danzstak:posts-loaded"'));

assert.match(observer, /video\.dataset\.loadRequested = "true";[\s\S]*?video\.preload = "auto";[\s\S]*?video\.play\(\)/,
  "visible Roll videos should explicitly mark and begin their load attempt");
assert.match(render, /const watchRollVideo = \(video, onTimeout\) =>/,
  "The Roll should share a bounded video-load watchdog");
assert.match(render, /video\.dataset\.loadRequested !== "true"/,
  "dormant data-saver videos must not be reported as broken");
assert.match(render, /video\.addEventListener\("pointerdown", \(\) => \{ video\.dataset\.loadRequested = "true";/,
  "a direct user play gesture should opt into watchdog recovery");
assert.match(render, /setTimeout\(\(\) => \{[\s\S]*?\}, 15000\)/,
  "active Roll video loads should have a bounded wait");
assert.match(render, /createInternalRecovery\("Media is taking longer than expected\."\)/,
  "stalled DanzStak videos should offer a fresh signed-URL retry");
assert.match(render, /createExternalRecovery\("Media is taking longer than expected\."\)/,
  "stalled direct external videos should remain visibly retryable");
assert.ok((render.match(/reelPlaybackObserver\.unobserve\(video\)/g) || []).length >= 4,
  "failed or stalled players should be released by the playback observer");
assert.match(render, /retry\.addEventListener\("click", \(\) => recovery\.replaceWith\(createExternalVideo\(\)\)\)/,
  "external direct-video recovery should retry the player in place");

console.log("The Roll watchdog checks passed: active internal and external video stalls become retryable.");
