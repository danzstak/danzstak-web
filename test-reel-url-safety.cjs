"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /function approvedVideoUrl\(value\)/, "The Roll should have one defensive URL parser");
assert.match(source, /isApprovedVideoUrl\(url\) && reelPlayer\(url\)/, "only approved, playable links should survive parsing");
assert.match(source, /if \(!reel\.internal && !reelUrlValue\) continue;/, "damaged external records should not break rendering");
assert.match(source, /open\.href = reelUrlValue\.href/, "source links should use the normalized approved URL");
assert.match(source, /rel = "noopener noreferrer nofollow ugc"/, "member links should be isolated and marked as user-generated content");
assert.match(source, /data\.reels\.flatMap\(reel => \{/, "cloud records should be filtered before entering The Roll");
assert.doesNotMatch(source, /reelPlatform\(new URL\((?:reel|result\.reel)\.url\)/, "cloud records must not use unchecked URL construction");
assert.match(source, /provider: "tiktok", layout: "portrait", aspect: "9\/16"/, "TikTok must not be forced into a landscape box");
assert.match(source, /provider: "instagram"[\s\S]*aspect: match\[1\] === "p" \? "1\/1" : "9\/16"/, "Instagram posts and reels need provider-appropriate framing");
assert.match(source, /frame\.style\.setProperty\("--ds-media-aspect", playerInfo\.aspect/, "provider geometry must reach the rendered iframe");
assert.doesNotMatch(source, /source\.textContent\s*=\s*reel\.internal\s*\?\s*reel\.content\s*:\s*reelUrlValue\.hostname/, "The Roll must not expose raw infrastructure hostnames");
assert.match(source, /feedTranslate\(reelSourceLabel\(reelUrlValue\)\)/, "external Roll cards should render a localizable friendly source label");

const helperStart = source.indexOf("function reelPlatform(");
const helperEnd = source.indexOf("function isApprovedVideoUrl(", helperStart);
const context = vm.createContext({ URL });
vm.runInContext(source.slice(helperStart, helperEnd), context);
assert.equal(vm.runInContext("reelSourceLabel(new URL('https://danzstak-media.s3.us-west-1.amazonaws.com/reel.mp4'))", context), "DanzStak video");
assert.equal(vm.runInContext("reelSourceLabel(new URL('https://youtu.be/example'))", context), "YouTube video");
assert.equal(vm.runInContext("reelSourceLabel(new URL('https://media.example/reel.mp4'))", context), "External video");

console.log("Roll URL-safety checks passed: approved links remain usable while raw infrastructure hostnames stay out of artist-facing metadata.");
