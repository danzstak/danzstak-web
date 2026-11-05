const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const source = readFileSync("assets/feed-enhancements.js", "utf8");
const css = readFileSync("assets/feed-enhancements.css", "utf8");
const people = readFileSync("assets/people-search.js", "utf8");
const backend = readFileSync("infrastructure/call-signaling/template.yaml", "utf8");

const start = source.indexOf('if (name === "Friends")');
const end = source.indexOf('if (["Photos", "Videos"].includes(name))', start);
assert.ok(start >= 0 && end > start, "Friends workspace is inspectable");
const workspace = source.slice(start, end);

for (const label of ["All Friends", "Online", "Requests", "Find Friends"])
  assert.ok(workspace.includes(`["${label === "All Friends" ? "all" : label === "Find Friends" ? "find" : label.toLowerCase()}", "${label}"]`), `${label} tab is present`);
assert.match(workspace, /state = \{ view: "all", friends: \[\], incoming: \[\], directory: \[\], presenceAvailable: false, shown: 24 \}/, "large friend directories are paged from 24 rows");
assert.match(workspace, /people\.slice\(0, state\.shown\)/, "All Friends uses the current page limit");
assert.match(workspace, /state\.shown \+= 24/, "Show more reveals another bounded page");
assert.match(workspace, /state\.friends\.filter\(person => person\.online === true\)/, "Online tab filters accepted friends by truthful presence");
assert.match(workspace, /message\.textContent = feedTranslate\("Message \(SYNC\)"\)/, "friends have a clearly labeled SYNC action");
assert.match(workspace, /more\.textContent = feedTranslate\("More"\)/, "destructive friendship controls live behind More");
assert.doesNotMatch(workspace, /dataset\.icon = "trash"/, "friend rows do not expose a trash button");
assert.match(workspace, /friendActionFetch\("\/friends\/respond"/, "request decisions persist through the authenticated API");
assert.match(workspace, /tabs\.addEventListener\("keydown"/, "tab navigation supports arrow, Home and End keys");
assert.match(workspace, /notificationsResult/, "legacy APIs still recover incoming requests from notifications");
assert.match(people, /labelText\.className = "visually-hidden"/, "member search has one concise visible field and an accessible label");
assert.doesNotMatch(people.match(/window\.danzstakMountPeopleFinder[\s\S]*?\n  };/)?.[0] || "", /Type their name\. They do not need to be online\./, "the dedicated Find Friends tab removes redundant permanent instructions");

assert.match(css, /\.friends-toolbar\{display:grid;grid-template-columns:minmax\(190px,280px\) minmax\(0,1fr\)/, "desktop header keeps search and tabs adjacent without stretching the field");
assert.match(css, /\.friends-directory-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "desktop directory uses a compact two-column list");
assert.match(css, /\.friend-directory-row\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/, "identity and actions share one compact row");
assert.match(css, /\.friend-sync-action,.friend-more-action,.friend-request-actions button\{min-height:38px/, "desktop actions are compact");
assert.match(css, /@media\(max-width:700px\)[\s\S]*\.friend-sync-action,.friend-more-action,.friend-request-actions button\{min-height:44px/, "mobile actions retain 44px touch targets");
assert.match(css, /\.friends-filter\[hidden\]\{display:none!important\}/, "view-specific search controls cannot leak into another tab");

assert.match(backend, /visible=items\.filter\(item=>\['friends','incoming','outgoing'\]\.includes\(item\.status\?\.S\)\)/, "Friends API loads accepted and pending relationship states");
assert.match(backend, /return json\(200,\{friends:byStatus\('friends'\),incoming:byStatus\('incoming'\),outgoing:byStatus\('outgoing'\)\}\)/, "Friends API returns relationship lists without breaking the existing friends field");

console.log("Issue 54 Friends directory checks passed: compact tabs, paging, presence, requests, member search, SYNC actions, safe More menu, keyboard support and backend relationship states.");
