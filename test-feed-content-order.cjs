"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feedHtml = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");

const composer = feedHtml.indexOf('<section class="panel">', feedHtml.indexOf('<div id="newsFeedView">'));
const stories = feedHtml.indexOf('<section id="storiesRail"');
const feed = feedHtml.indexOf('<section id="feed"');

assert.ok(composer >= 0, "the feed composer must exist");
assert.ok(stories > composer, "Flashes must render directly after the composer");
assert.ok(feed > stories, "Flashes must render before saved feed posts");
assert.match(feedHtml, /className = "story story-empty";/, "Flashes need a visible empty-state placeholder");
assert.match(feedHtml, /No Flashes yet/, "the Flashes placeholder should explain that no media is available yet");
assert.match(
  enhancements,
  /if \(posts\.length >= 4\) posts\[3\]\.insertAdjacentElement\("afterend", reelsRail\);/,
  "The Roll must be inserted after the fourth visible post"
);
assert.match(enhancements, /video\.autoplay = !dataSaverEnabled\(\);/, "The Roll videos should autoplay unless data saver is enabled");
assert.match(enhancements, /video\.muted = true;/, "autoplay videos must be muted for browser compatibility");
assert.match(enhancements, /intersectionRatio >= 0\.6/, "only sufficiently visible Roll videos should play");
assert.match(enhancements, /Videos shared to The Roll will appear here\./, "The Roll needs a visible empty-state placeholder");

console.log("feed content ordering and autoplay checks passed");
