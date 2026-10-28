const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const aliases = fs.readFileSync("assets/brand-language-aliases.js", "utf8");

assert.match(feed, /<span>Flashes<\/span>/, "composer should use Flashes");
assert.doesNotMatch(feed, /<span>Story<\/span>/, "composer should not expose the old Story label");
assert.match(feed, /<span>The Roll<\/span>/, "composer should use The Roll");
assert.match(messages, />Tribes<\/button>/, "messenger filter should use Tribes");
assert.match(enhancements, /Add to The Roll/, "Roll action should use DanzStak branding");
assert.match(enhancements, /Create Tribe/, "group creation should use Tribes branding");
assert.match(aliases, /dictionary\.Flashes/, "localized Flashes alias should exist");
assert.match(aliases, /dictionary\.Tribes/, "localized Tribes alias should exist");

// Compatibility contract: branding must not rename established API/storage hooks.
assert.match(feed, /id="shareToStory"/, "story compatibility hook must remain");
assert.match(feed, /id="shareToReels"/, "reel compatibility hook must remain");
assert.match(enhancements, /name === "Groups"/, "group route compatibility must remain");
assert.match(enhancements, /cloudReels/, "reel data compatibility must remain");

console.log("DanzStak social labels are branded without breaking compatibility.");
