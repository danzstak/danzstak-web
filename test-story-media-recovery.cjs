const fs = require("fs");
const assert = require("assert");

const feed = fs.readFileSync("feed.html", "utf8");

assert.match(feed, /async function refreshStoryMedia\(story\)/, "Flashes should have a signed-media refresh path");
assert.match(feed, /candidate\.storyId === story\.storyId/, "Flash recovery should match the durable story id");
assert.match(feed, /async function openStoryViewer\(story\)/, "The Flash viewer should wait for media recovery");
assert.match(feed, /Media is temporarily unavailable\./, "Broken Flash media should show an honest unavailable state");
assert.match(feed, /Retry media/, "The Flash viewer should offer a retry action");
assert.match(feed, /probe\.addEventListener\("error"/, "Image cards should detect expired signed URLs");
assert.match(feed, /const installStoryVideo = async/, "Video cards should refresh expired signed URLs");
assert.doesNotMatch(feed.slice(feed.indexOf("async function refreshStoryMedia"), feed.indexOf("async function loadStories")), /isConnected/, "Flash recovery must not depend on attachment timing");

console.log("Flash media recovery checks passed.");
