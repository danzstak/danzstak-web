"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const loadBlock = source.slice(source.indexOf("async function requestInternalReelMedia"), source.indexOf("function reelPlatform"));
const renderStart = source.indexOf("function renderPlayableReels");
const renderBlock = source.slice(renderStart, source.indexOf('window.addEventListener("danzstak:posts-loaded"', renderStart));

assert.match(loadBlock, /mediaKey: post\.mediaKey/,
  "The Roll must retain the durable media key when a signed URL cannot be resolved");
assert.match(loadBlock, /internalReels = resolved;/,
  "temporarily unavailable videos must not be removed from The Roll");
assert.doesNotMatch(loadBlock, /resolved\.filter\(Boolean\)/,
  "failed signed URLs must not silently filter videos out");
assert.match(renderBlock, /className = "reel-player-fallback reel-media-recovery"/,
  "unavailable internal videos need a visible recovery card");
assert.match(renderBlock, /requestInternalReelMedia\(reel\)/,
  "The Roll recovery control must request a fresh media URL");
assert.match(renderBlock, /video\.addEventListener\("error"[\s\S]*video\.replaceWith\(createInternalRecovery\(\)\)/,
  "expired video URLs must become retryable without removing the Roll card");

console.log("The Roll media recovery checks passed: internal videos stay visible and can refresh expired URLs.");
