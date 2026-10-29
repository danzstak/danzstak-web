const assert = require("assert");
const fs = require("fs");

const feed = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const sharing = fs.readFileSync("assets/post-sharing.js", "utf8");
const facebookImport = fs.readFileSync("assets/facebook-import.js", "utf8");
const profileEditor = fs.readFileSync("assets/profile-editor.js", "utf8");

assert.match(feed, /Video shared by \" \+ author/, "feed videos need an author-based accessible name");
assert.match(feed, /Video Flash from \" \+ storyAuthor/, "Flash preview videos need an author and caption accessible name");
assert.match(feed, /media\.setAttribute\(\"aria-label\", storyDisplayCaption\(story\)\)/, "Flash viewer videos need an accessible caption");
assert.match(feed, /Video shared by \" \+ authorName/, "late-loaded feed videos need an accessible name");
assert.match(enhancements, /Video in The Roll from /, "Roll videos need an accessible name");
assert.match(sharing, /Video by ' \+ source\.authorName/, "shared-post videos need an accessible name");
assert.match(facebookImport, /Selected Facebook export video/, "Facebook import previews need an accessible name");
assert.match(profileEditor, /post\.content \? \"Video: \" \+ post\.content : \"Profile post video\"/, "profile-post videos need a content-based accessible name");

console.log("Video accessibility checks passed: posts, profiles, Flashes, The Roll, shares, and import previews are named.");
