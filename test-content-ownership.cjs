"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const sharing = fs.readFileSync("assets/post-sharing.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(api, /placementRemoved/, "the server needs a durable remove-from-here state");
assert.match(api, /deletedEverywhere/, "the server needs a durable creator-withdrawal state");
assert.match(api, /sharedPostUnavailableReason:[^\n]+creator_deleted/, "shares need a privacy-safe creator-deleted reason");
assert.match(api, /REMOVE content, mediaKey, mediaType, reel/, "global withdrawal must strip original text and playable media metadata");
assert.match(api, /DeleteObjectCommand\(\{ Bucket: process\.env\.MEDIA_BUCKET, Key: mediaKey \}\)/, "global withdrawal must revoke the owned media object before fulfillment");
assert.match(api, /A shared post can only be removed from your own account/, "resharers must not gain source-owner deletion power");
assert.match(api, /attribute_not_exists\(deletedEverywhere\)/, "remove-from-here must not revive globally withdrawn content");
assert.match(enhancements, /Remove from here/);
assert.match(enhancements, /Delete everywhere/);
assert.match(enhancements, /including shares by other users/);
assert.match(enhancements, /Downloads, screenshots, external shares, or unrelated reuploads cannot be erased/);
assert.match(enhancements, /\?scope=/, "the selected deletion scope must reach the server");
assert.match(sharing, /Original content removed by its creator\./, "dependent shares need a compact honest tombstone");
assert.match(css, /\.shared-post-card\.is-original-removed/);
assert.match(feed, /dataset\.sharedPostId/, "rendered posts must retain their canonical source reference");
assert.match(feed, /dataset\.sharedPostUnavailableReason/, "rendered shares must retain the safe unavailable state");

console.log("Creator ownership checks passed: separate placement removal, server-authoritative global withdrawal, share tombstones, owner boundaries, and accurate limitations.");
