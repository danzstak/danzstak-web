"use strict";
// Owner 2026-11-18: "Eroticon uploaded a video to their profile and it's not showing in the Dailies or The Roll."
// Every photo/video posted goes into the poster's Dailies for 24 h, and every video into The Roll.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8"), feed = fs.readFileSync("feed.html", "utf8");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
// The Roll: the profile composer now marks videos for The Roll (Mix already pre-ticks "The Roll" for videos).
assert.match(editor, /originalContentCertified: true, mediaKey, mediaType, reel: mediaType === "video" \};/);
// Dailies: both composers add a Daily that reuses the post's media.
assert.match(feed, /if \(mediaKey && \["image", "video"\]\.includes\(mediaType\)\) void fetchWithDeadline\("https:\/\/api\.danzstak\.com\/stories", \{ method: "POST"[\s\S]{0,200}fromPost: true/);
assert.match(editor, /if \(mediaKey && profile\.isOwner && \["image", "video"\]\.includes\(mediaType\)\) void profileFetch\(profileApi \+ "\/stories"[\s\S]{0,260}fromPost: true/);
// Server: a post-media Daily must be the caller's own post upload, is not "dedicated" (expiry and Daily delete never
// remove the post's media), and still counts toward TAKE N for videos.
assert.match(template, /const fromPost=body\.fromPost===true&&postUpload;/);
assert.match(template, /!\(fromPost\|\|storyUpload&&body\.dedicatedMedia===true\)\)return json\(400,\{error:'Valid Story media required'\}\)/);
assert.match(template, /dedicated:\{BOOL:!fromPost\}/);
assert.match(template, /postUpload=new RegExp\(`\^users\/\$\{prefix\}\//, "only your own post media");
assert.match(template, /if\(key\.startsWith\('stories\/'\)\)\{let removed=false;/, "expiry deletes only dedicated stories/ media");
assert.match(template, /async function removeExpiredStory\(item\)\{const storyId=item\.storyId\.S,mediaKey=item\.mediaKey\.S;if\(mediaKey\.startsWith\('stories\/'\)\)/, "the scheduled cleanup too");
console.log("Posts feed Dailies and The Roll checks passed.");
