"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/post-sharing.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const profile = fs.readFileSync("profile.html", "utf8");
const block = source.slice(source.indexOf("function installSharedPostMedia"), source.indexOf("async function openShareDialog"));

assert.match(block, /const watchSharedMedia = \(media, onTimeout\) =>/,
  "shared post media should use a bounded load watchdog");
assert.match(block, /new IntersectionObserver\([\s\S]*?rootMargin:'300px'/,
  "only shared media approaching the viewport should start timing");
assert.match(block, /media\.tagName === 'IMG' \? media\.complete && media\.naturalWidth > 0 : media\.readyState >= 2/,
  "already loaded shared media must not become recovery UI");
assert.match(block, /requestLoad && media\.readyState === 0\) media\.load\(\)/,
  "near-viewport shared videos should begin a metadata request");
assert.match(block, /media\.addEventListener\('pointerdown', \(\) => armWatchdog\(\)/,
  "native video gestures should opt into recovery without resetting playback");
assert.match(block, /setTimeout\(\(\) => \{ watchdog = 0; onTimeout\(\); \}, 15000\)/,
  "active shared-media loads should have a bounded wait");
assert.match(block, /showRecovery\('Media is taking longer than expected\.'\)/,
  "stalled shared media should expose an honest retry state");
for (const [name, page] of [["feed", feed], ["profile", profile]]) {
  assert.match(page, /assets\/post-sharing\.js\?v=419/, `${name} should request the updated shared-media controller`);
}

console.log("Shared post watchdog checks passed: near-viewport reshared media stalls become retryable.");
