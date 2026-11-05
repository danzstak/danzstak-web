const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /const memberId = String\(person\.memberId \|\| ""\)/, "friend profile routes normalize member IDs");
assert.match(source, /return \/\^\[a-f0-9-\]\{36\}\$\/\.test\(memberId\) \? "profile\.html\?member=" \+ encodeURIComponent\(memberId\) : ""/, "friend profile routes require an opaque UUID");
assert.match(source, /document\.createElement\(href \? "a" : "div"\)/, "legacy friends remain visible without a broken profile link");
assert.match(source, /if \(href\) identity\.href = href/, "valid friends link through an opaque member route");
assert.match(source, /identity\.setAttribute\("aria-label", `\$\{displayName\.textContent\}, \$\{statusText\}\. \$\{feedTranslate\("Open profile"\)\}`\)/, "friend profile links announce the visible name and localized presence");
assert.match(source, /profileLink\.setAttribute\("aria-label", `\$\{profileLink\.querySelector\("strong"\)\?\.textContent \|\| feedTranslate\("DanzStak member"\)\}, \$\{presenceLabel\}\. \$\{feedTranslate\("Open profile"\)\}`\)/, "fallback live presence refreshes the accessible profile link");
assert.match(source, /message\.addEventListener\("click", \(\) => openMessageDrawer\(person\.email\)\)/, "legacy friends retain the authorized Message action");

console.log("Friend profile route checks passed: valid opaque links and safe legacy fallback retain messaging.");
