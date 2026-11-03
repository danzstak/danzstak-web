const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /const friendMemberId = String\(person\.memberId \|\| ""\)/, "friend profile routes normalize member IDs");
assert.match(source, /const hasProfileRoute = \/\^\[a-f0-9-\]\{36\}\$\/\.test\(friendMemberId\)/, "friend profile routes require an opaque UUID");
assert.match(source, /document\.createElement\(hasProfileRoute \? "a" : "div"\)/, "legacy friends remain visible without a broken profile link");
assert.match(source, /link\.href = "profile\.html\?member=" \+ encodeURIComponent\(friendMemberId\)/, "valid friends link through an opaque member route");
assert.match(source, /link\.setAttribute\("aria-label", `\$\{displayName\.textContent\}, \$\{status\.textContent\}\. \$\{feedTranslate\("Open profile"\)\}`\)/, "friend profile links announce the visible name and localized current presence");
assert.match(source, /profileLink\.setAttribute\("aria-label", `\$\{profileLink\.dataset\.friendName \|\| feedTranslate\("DanzStak member"\)\}, \$\{presenceLabel\}\. \$\{feedTranslate\("Open profile"\)\}`\)/, "live presence refreshes the localized accessible profile-link name");
assert.match(source, /message\.addEventListener\("click", \(\) => openMessageDrawer\(person\.email\)\)/, "legacy friends retain the authorized Message action");

console.log("Friend profile route checks passed: valid opaque links and safe legacy fallback retain messaging.");
