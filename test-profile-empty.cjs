"use strict";
// Profile empty states (fix-it 18, owner 2026-11-17). Real browser: browser-checks/profile-empty.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const people = fs.readFileSync("assets/i18n-people.js", "utf8");
assert.doesNotMatch(editor, /Add a short bio so people know more about you/, "no instructional bio placeholder");
assert.match(editor, /addBioButton\.hidden = Boolean\(profile\.bio\) \|\| profile\.isOwner !== true \|\| viewingOtherProfile;/, "only the owner sees + bio, and only without a bio");
assert.match(editor, /bioElement\.hidden = !profile\.bio;/, "visitors see nothing when there is no bio");
assert.match(editor, /const section = field\?\.closest\("details"\); if \(section\) section\.open = true; field\?\.focus\(\);/, "+ bio lands in the bio field");
assert.match(editor, /empty\.className = "profile-empty-wall"; empty\.textContent = profileTranslate\("No posts yet"\);/, "empty wall says so");
for (const [lang, word] of [["it", "Ancora nessun post"], ["fr", "Pas encore de publications"], ["es", "Aún no hay publicaciones"]]) assert.ok(people.includes(`"No posts yet": "${word}"`), lang);
console.log("Profile empty-state checks passed.");
