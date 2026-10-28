"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feedHtml = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const enhancementCss = fs.readFileSync("assets/feed-enhancements.css", "utf8");

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
assert.match(feedHtml, /video\.post-media \{ height:auto; max-height:none; object-fit:contain; object-position:center center; \}/, "the post box should follow and center each video's real aspect ratio");
assert.match(feedHtml, /img\.post-media \{ height:auto; max-height:none; object-fit:contain; object-position:center center; \}/, "the post box should follow and center each image's real aspect ratio");
assert.match(feedHtml, /\.post > \.post-media \{ width:calc\(100% \+ 40px\); margin:12px -20px 0; border-radius:0; \}/, "feed photos and videos should reach both edges of the post card");
assert.match(feedHtml, /#feed > \.post \{ width:100%; margin-left:auto; margin-right:auto; \}/, "post boxes should remain centered in the feed column");
assert.match(enhancementCss, /\.reels-list \.reel-card\{flex:0 0 100%;width:100%;min-width:0/, "each Roll video card should fill the post box");
assert.match(enhancementCss, /\.reels-list video\.reel-player\{height:auto;max-height:none;aspect-ratio:auto\}/, "Roll cards should grow or shrink around the video's real aspect ratio");
assert.match(enhancementCss, /\.post-actions \.likeBtn\[data-reaction=""\][^}]*color:#14804a/, "approval thumbs should use green");
assert.match(enhancementCss, /\.post-actions \.dislikeBtn[^}]*color:#c62828/, "disapproval thumbs should use red");

console.log("feed content ordering and autoplay checks passed");
