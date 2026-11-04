"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const enhancements = readFileSync("assets/feed-enhancements.js", "utf8");
const styles = readFileSync("assets/feed-enhancements.css", "utf8");
const feed = readFileSync("feed.html", "utf8");

assert.match(enhancements, /appToast\.setAttribute\("aria-live", "polite"\)/, "feed feedback must be announced accessibly");
assert.match(enhancements, /appToast\.setAttribute\("aria-atomic", "true"\)/, "each feedback message must be announced as a unit");
assert.match(enhancements, /function showAppFeedback\(message, \{ urgent = false, timeout = 4200 \} = \{\}\)/, "feed actions need one reusable feedback path");
assert.match(enhancements, /Only Public posts can be shared outside DanzStak[\s\S]{0,80}urgent: true/, "private-share errors should use urgent branded feedback");
assert.match(enhancements, /Post privacy changed to \$\{values\[next\]\}/, "privacy changes should confirm the selected audience");
assert.match(enhancements, /writeText\(postPermalink\(post\)\); showAppFeedback\("Link copied\."\)/, "copying a post link should confirm success");
assert.match(styles, /\.app-toast\{[^}]*safe-area-inset-bottom/, "mobile feedback must clear the device safe area");
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{\.app-toast\{transition:none\}\}/, "toast motion must respect reduced-motion preferences");
assert.match(enhancements, /Tribe could not be deleted\.[\s\S]{0,80}urgent: true/, "Tribe failures should use the shared feedback path");
assert.match(enhancements, /Comment could not be deleted\.[\s\S]{0,80}urgent: true/, "comment failures should use the shared feedback path");
assert.doesNotMatch(enhancements, /alert\(/, "feed actions should not use blocking browser alerts");
assert.match(enhancements, /function openInfoDialog\(\{ title, content \}\)/, "long informational content should use an accessible dialog");
assert.match(enhancements, /title: "Edit history"/, "post edit history should open in the informational dialog");
assert.match(styles, /\.info-action-content\{[^}]*overflow:auto/, "long edit histories should scroll within the dialog");
assert.match(feed, /feed-enhancements\.css\?v=489/, "feed stylesheet cache key should be current");
assert.match(feed, /feed-enhancements\.js\?v=521/, "feed script cache key should be current");

console.log("Feed action feedback checks passed: post actions use compact, accessible, nonblocking status messages.");
