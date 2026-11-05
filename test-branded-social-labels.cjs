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
const authApi = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const terms = fs.readFileSync("terms.html", "utf8");
const privacy = fs.readFileSync("privacy.html", "utf8");

assert.match(feed, /<span>Dailies<\/span>/, "composer should use Dailies");
assert.doesNotMatch(feed, /<span>Story<\/span>/, "composer should not expose the old Story label");
assert.match(feed, /<span>The Roll<\/span>/, "composer should use The Roll");
assert.match(messages, />Tribes<\/button>/, "messenger filter should use Tribes");
assert.match(enhancements, /Add to The Roll/, "Roll action should use DanzStak branding");
assert.match(enhancements, /Create Tribe/, "group creation should use Tribes branding");
assert.match(aliases, /dictionary\.Flashes/, "localized Flashes alias should exist");
assert.match(aliases, /dictionary\.Dailies/, "localized Dailies alias should exist");
assert.match(aliases, /dictionary\.Tribes/, "localized Tribes alias should exist");
for (const [name, content] of Object.entries({ sharing, peopleSearch, enhancements, profile })) {
  assert.doesNotMatch(content, /your (?:DanzStak )?feed|your feed|feed result|feed posts|return to the feed/i,
    `${name} should present Your Mix instead of legacy feed wording`);
}
assert.match(sharing, /Share to Your Mix/, "sharing should use the Your Mix destination");
assert.match(enhancements, /top of Your Mix/, "pinning should use Your Mix terminology");
for (const [name, content] of Object.entries({ feed, messages, profile, profileSharing, directMessages, calls, authApi })) {
  assert.doesNotMatch(content, /Group Message|group members|group member|same group|shared-group/i,
    `${name} should present Tribe terminology to members`);
}
for (const [name, content] of Object.entries({ terms, privacy })) {
  assert.doesNotMatch(content, /members of a shared group|shared-group members/i,
    `${name} should explain communication access with the member-facing Tribe name`);
  assert.match(content, /members of a shared Tribe/i,
    `${name} should retain the enforced shared-membership rule while using Tribe branding`);
}
assert.doesNotMatch(authApi, /"(?:Valid group|required group|Group not found|Only the group owner|Describe the group concern)/i,
  "API feedback must use DanzStak Tribe language while retaining group-compatible storage and routes");
assert.match(authApi, /storedDescription === "A new DanzStak community group\." \? "A new DanzStak Tribe\."/, "legacy default descriptions should be branded at read time without rewriting custom Tribe descriptions");

// Compatibility contract: branding must not rename established API/storage hooks.
assert.match(feed, /id="shareToStory"/, "story compatibility hook must remain");
assert.match(feed, /id="shareToReels"/, "reel compatibility hook must remain");
assert.match(enhancements, /name === "Groups"/, "group route compatibility must remain");
assert.match(enhancements, /cloudReels/, "reel data compatibility must remain");

console.log("DanzStak social labels are branded without breaking compatibility.");
