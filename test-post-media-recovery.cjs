"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const block = feed.slice(feed.indexOf("function appendPost(post, target)"), feed.indexOf("function renderNextPostBatch"));

assert.match(block, /post\.mediaKey && \["image", "video"\]\.includes\(post\.mediaType\)/,
  "stored post media should use a recoverable loading path");
assert.match(block, /className = "post-media-recovery"/,
  "post media failures need a visible recovery surface");
assert.match(block, /retry\.addEventListener\("click", \(\) => loadPostMedia\(\)\)/,
  "users need a one-tap media retry");
assert.match(block, /existingMedia\.addEventListener\("error", \(\) => loadPostMedia\(\)/,
  "expired post media URLs should be refreshed automatically");
assert.match(block, /if \(!ticket\?\.mediaUrl\) throw new Error/,
  "invalid view tickets must show recovery instead of silently hiding media");
assert.doesNotMatch(block, /\.isConnected/,
  "fast media responses must not depend on whether a post fragment is attached to the document");
for (const label of ["Loading media…", "Media is temporarily unavailable.", "Retry media"]) {
  assert.ok(i18n.includes(label), `${label} should be localizable`);
}

console.log("Post media recovery checks passed: expired or failed media URLs remain visible and retryable.");
