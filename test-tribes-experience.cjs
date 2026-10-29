const assert = require("node:assert/strict");
const fs = require("node:fs");

const ui = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

for (const required of [
  'button.textContent = label',
  '["discover", "Discover"]',
  '["joined", "Your Tribes"]',
  'groupSearch.placeholder = "Search Tribes"',
  'categoryFilter.setAttribute("aria-label", "Filter Tribes by category")',
  'createToggle.textContent = "+ Create Tribe"',
  'groupView !== "joined"',
  'className = "group-card-cover"',
  'className = "tribe-detail"',
  '["discussion", "Discussion"]',
  '["crew", "The Crew"]',
  '"Invite as Elder"',
  '"Return to Crew"',
  'renderTribePosts(group, feed)',
  'addMediaPicker("Photo"',
  'addMediaPicker("Video"',
  'purpose: "post"',
  'content: content || "Shared media"'
]) assert.ok(ui.includes(required), `Tribes experience is missing: ${required}`);

for (const required of [
  ".groups-toolbar{",
  ".groups-tabs{",
  ".groups-discovery-controls{",
  ".group-card-cover{",
  ".groups-empty{",
  ".tribe-hero{",
  ".tribe-nav{",
  ".tribe-crew-member{",
  ".tribe-detail{scroll-margin-top:90px}",
  "@media(max-width:700px){.tribe-detail{scroll-margin-top:122px}",
  "@media(max-width:700px){.groups-discovery-controls"
]) assert.ok(css.includes(required), `Responsive Tribes styling is missing: ${required}`);

assert.match(feed, /feed-enhancements\.css\?v=375/);
assert.match(feed, /feed-enhancements\.js\?v=382/);
console.log("Tribes experience checks passed: discovery, detail, discussion, Elders, The Crew, and responsive layout.");
