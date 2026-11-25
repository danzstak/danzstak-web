"use strict";
// Profile empty states (fix-it 18, owner 2026-11-17). Real browser: browser-checks/profile-empty.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const people = fs.readFileSync("assets/i18n-people.js", "utf8");
assert.doesNotMatch(editor, /Add a short bio so people know more about you/, "no instructional bio placeholder");
assert.doesNotMatch(editor, /addBioButton|profile-add-bio/, "no + bio in the action row (owner 2026-11-19: duplicated Edit profile)");
assert.match(editor, /const canEditThisProfile = \(\) => !viewingOtherProfile && window\.danzstakCurrentProfile\?\.isOwner !== false;/);
assert.match(editor, /editButton\.addEventListener\("click", \(\) => \{\r?\n\s*if \(!canEditThisProfile\(\)\) return;/, "the editor never opens on someone else's profile");
assert.match(editor, /if \(!canEditThisProfile\(\)\) \{ closeEditScreen\(false\); return; \}/, "and never saves there");
assert.match(editor, /bioElement\.hidden = !profile\.bio \|\| sameWords\(profile\.bio, /, "visitors see nothing when there is no bio, or when it only repeats the name (F14)");
assert.match(editor, /empty\.className = "profile-empty-wall"; empty\.textContent = profileTranslate\("No posts yet"\);/, "empty wall says so");
for (const [lang, word] of [["it", "Ancora nessun post"], ["fr", "Pas encore de publications"], ["es", "Aún no hay publicaciones"]]) assert.ok(people.includes(`"No posts yet": "${word}"`), lang);
console.log("Profile empty-state checks passed.");
{
  // Owner 2026-11-18: "navigating the site as SFScoop I can edit the Eroticon profile". Owner-only controls never show
  // or open on someone else's profile (the server already only ever saves the signed-in member's own profile).
  const polish = fs.readFileSync("assets/profile-polish.css", "utf8");
  assert.doesNotMatch(polish, /\.profile-actions/, "UIKIT 4b part 2: no old rule can show a hidden owner control (kit row, [hidden] stays hidden)");
  const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
  assert.match(template, /async function updateProfileUnique\(event,user\)[\s\S]*?Key:\{userEmail:\{S:user\.email\}\}/, "profile saves are always the caller's own record");
  console.log("Owner-only profile editing checks passed.");
}
