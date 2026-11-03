"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const block = source.slice(source.indexOf("function installDirectMessageMedia"), source.indexOf("function directMessageItem"));

assert.match(block, /const watchAttachment = \(media, onTimeout\) =>/,
  "chat attachments should share a bounded load watchdog");
assert.match(block, /new IntersectionObserver\([\s\S]*?root: messageList, rootMargin: "300px"/,
  "only attachments approaching the conversation viewport should start timing");
assert.match(block, /media\.tagName === "IMG" \? media\.complete && media\.naturalWidth > 0 : media\.readyState >= 2/,
  "already loaded media must never be replaced by a timeout state");
assert.match(block, /media\.tagName === "VIDEO"[\s\S]*?media\.preload = "metadata"[\s\S]*?requestLoad && media\.readyState === 0\) media\.load\(\)/,
  "a visible chat video should begin a real metadata load attempt");
assert.match(block, /media\.addEventListener\("pointerdown", \(\) => armWatchdog\(\)/,
  "a direct video gesture should opt into recovery without resetting native playback");
assert.match(block, /armWatchdog\(true\)/,
  "near-viewport videos should explicitly begin their metadata request");
assert.match(block, /setTimeout\(\(\) => \{ watchdog = 0; onTimeout\(\); \}, 15000\)/,
  "active attachment loads should have a bounded wait");
assert.match(block, /showRecovery\("Media is taking longer than expected\."\)/,
  "stalled attachments should expose an honest localized retry state");
assert.match(block, /message\.mediaUrl = ""/,
  "retrying a stalled attachment should request a fresh signed URL");

console.log("Message media watchdog checks passed: near-viewport attachment stalls become retryable.");
