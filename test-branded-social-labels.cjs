const fs = require("node:fs");
const assert = require("node:assert/strict");

const feed = fs.readFileSync("feed.html", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const aliases = fs.readFileSync("assets/brand-language-aliases.js", "utf8");
const profile = fs.readFileSync("assets/profile.js", "utf8");
const profileSharing = fs.readFileSync("assets/profile-sharing.js", "utf8");
const directMessages = fs.readFileSync("assets/direct-messages.js", "utf8");
const calls = fs.readFileSync("assets/chat.js", "utf8");
const sharing = fs.readFileSync("assets/post-sharing.js", "utf8");
const peopleSearch = fs.readFileSync("assets/people-search.js", "utf8");

assert.match(feed, /<span>Flashes<\/span>/, "composer should use Flashes");
assert.doesNotMatch(feed, /<span>Story<\/span>/, "composer should not expose the old Story label");
assert.match(feed, /<span>The Roll<\/span>/, "composer should use The Roll");
assert.match(messages, />Tribes<\/button>/, "messenger filter should use Tribes");
assert.match(enhancements, /Add to The Roll/, "Roll action should use DanzStak branding");
assert.match(enhancements, /Create Tribe/, "group creation should use Tribes branding");
assert.match(aliases, /dictionary\.Flashes/, "localized Flashes alias should exist");
assert.match(aliases, /dictionary\.Tribes/, "localized Tribes alias should exist");
for (const [name, content] of Object.entries({ sharing, peopleSearch, enhancements, profile })) {
  assert.doesNotMatch(content, /your (?:DanzStak )?feed|your feed|feed result|feed posts|return to the feed/i,
    `${name} should present Your Mix instead of legacy feed wording`);
}
assert.match(sharing, /Share to Your Mix/, "sharing should use the Your Mix destination");
assert.match(enhancements, /top of Your Mix/, "pinning should use Your Mix terminology");
for (const [name, content] of Object.entries({ feed, messages, profile, profileSharing, directMessages, calls })) {
  assert.doesNotMatch(content, /Group Message|group members|group member|same group|shared-group/i,
    `${name} should present Tribe terminology to members`);
}

// Compatibility contract: branding must not rename established API/storage hooks.
assert.match(feed, /id="shareToStory"/, "story compatibility hook must remain");
assert.match(feed, /id="shareToReels"/, "reel compatibility hook must remain");
assert.match(enhancements, /name === "Groups"/, "group route compatibility must remain");
assert.match(enhancements, /cloudReels/, "reel data compatibility must remain");

console.log("DanzStak social labels are branded without breaking compatibility.");
