"use strict";
// Fix-it 18, Profile page item 1 (owner 2026-11-17): no big text buttons on the profile. Content already in context
// needs no "View in Your Mix"; Featured is gone from profiles, so no "Feature on profile"; any remaining action is a
// slim icon button with an accessible name. Real-browser check: browser-checks/profile-mirror.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const people = fs.readFileSync("assets/i18n-people.js", "utf8");

assert.doesNotMatch(editor, /"View in Your Mix"/, "profile posts must not carry a View in Your Mix button");
assert.doesNotMatch(editor, /profile-post-open/, "the profile post open-in-Mix link is gone");
assert.doesNotMatch(editor, /"Feature on profile"|"Remove from Featured"/, "profile posts must not carry Feature on profile");
assert.match(editor, /remove\.className = "profile-wall-remove";\s*remove\.dataset\.icon = "trash";\s*remove\.setAttribute\("aria-label", profileTranslate\("Remove from my profile"\)\);/, "removing a friend's wall post is a trash icon with a translated name");
assert.doesNotMatch(editor, /remove\.textContent = "Remove from my profile"/, "the wall remove control shows no text");
for (const [lang, word] of [["it", "Rimuovi dal mio profilo"], ["fr", "Retirer de mon profil"], ["es", "Quitar de mi perfil"]]) {
  assert.ok(people.includes(`"Remove from my profile": "${word}"`), `${lang} translation for the wall remove label`);
}
console.log("Profile text-button checks passed: no View in Your Mix, no Feature on profile, wall remove is a named icon.");
