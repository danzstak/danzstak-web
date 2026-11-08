"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feedHtml = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const enhancementCss = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const mediaVisibility = fs.readFileSync("assets/media-visibility.js", "utf8");

const composer = feedHtml.indexOf('<section class="panel post-composer" id="postComposer">', feedHtml.indexOf('<div id="newsFeedView">'));
const stories = feedHtml.indexOf('<section id="storiesRail"');
const feed = feedHtml.indexOf('<section id="feed"');

assert.ok(composer >= 0, "the feed composer must exist");
assert.ok(stories >= 0 && stories < composer, "Dailies must render before the composer");
assert.ok(feed > composer, "the composer must render before saved feed posts");
assert.match(feedHtml, /className = "story story-empty";/, "Flashes need an accessible empty-state status");
assert.match(feedHtml, /No Dailies yet/, "the Dailies status should explain that no media is available yet");
assert.match(enhancementCss, /\.stories \.story-empty\{[^}]*position:absolute!important[^}]*clip-path:inset\(50%\)!important/, "the empty Flashes status should remain accessible without rendering a second empty card");
assert.match(enhancementCss, /\.stories \.story-empty::before\{display:none\}/, "the empty Flashes status should not inherit the dark media overlay");
assert.match(enhancementCss, /\.stories \.story-create\{[^}]*background:#fff!important/, "the Flashes creation control should remain a distinct action card");
assert.match(
  enhancements,
  /if \(posts\.length >= 4\) posts\[3\]\.insertAdjacentElement\("afterend", reelsRail\);/,
  "The Roll must be inserted after the fourth visible post"
);
assert.match(enhancements, /video\.autoplay = false;/, "The Roll videos must require explicit playback instead of starting when the app opens");
assert.match(enhancements, /video\.muted = true;/, "autoplay videos must be muted for browser compatibility");
assert.match(mediaVisibility, /const thresholdFor=element=>inSession\(element\)\?0\.5:0\.6/, "the feed must require 60% visibility while fullscreen Roll handoff occurs at exactly 50%");
assert.match(enhancements, /danzstakMediaCoordinator\?\.startSession\?\./, "fullscreen Roll playback must use the shared single-player coordinator");
assert.match(enhancements, /Videos shared to The Roll will appear here\./, "The Roll needs a visible empty-state placeholder");
assert.match(feedHtml, /video\.post-media \{ height:auto; max-height:none; object-fit:contain; object-position:center center; \}/, "the post box should follow and center each video's real aspect ratio");
assert.match(feedHtml, /img\.post-media \{ height:auto; max-height:none; object-fit:contain; object-position:center center; \}/, "the post box should follow and center each image's real aspect ratio");
assert.match(feedHtml, /\.post \{ --post-inline-padding:20px; \}/, "feed cards expose their current media gutter");
assert.match(feedHtml, /\.post > \.post-media \{ width:calc\(100% \+ var\(--post-inline-padding\) \+ var\(--post-inline-padding\)\); max-width:none; margin:12px calc\(0px - var\(--post-inline-padding\)\) 0; border-radius:0; \}/, "feed photos and videos should reach both edges of the post card evenly without a global max-width clamp");
assert.match(feedHtml, /#feed > \.post \{ width:100%; margin-left:auto; margin-right:auto; \}/, "post boxes should remain centered in the feed column");
assert.match(enhancementCss, /\.reels-list \.reel-card\{flex:0 0 100%;width:100%;min-width:0/, "each Roll video card should fill the post box");
assert.match(enhancementCss, /\.reels-list video\.reel-player\{height:auto;max-height:none;aspect-ratio:auto\}/, "Roll cards should grow or shrink around the video's real aspect ratio");
assert.match(enhancementCss, /\.roll-fullscreen \.reels-list\{[^}]*flex-direction:column[^}]*scroll-snap-type:y mandatory/, "fullscreen Roll videos should swipe vertically one at a time");
assert.match(enhancements, /rollOpen\.textContent = "Open fullscreen"/, "The Roll exposes a clear fullscreen action");
assert.match(enhancements, /event\.key === "Escape"[^}]*setRollFullscreen\(false\)/, "fullscreen Roll can be closed with Escape");
assert.match(enhancementCss, /\.post-actions \.likeBtn\[data-reaction=""\][^}]*color:#14804a/, "approval thumbs should use green");
assert.match(enhancementCss, /\.post-actions \.dislikeBtn[^}]*color:#c62828/, "disapproval thumbs should use red");

console.log("feed content ordering and autoplay checks passed");
