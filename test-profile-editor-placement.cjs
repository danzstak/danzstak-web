"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const script = fs.readFileSync("assets/profile-editor.js", "utf8");
const styles = fs.readFileSync("assets/profile-editor.css", "utf8");

assert.match(script, /actions\.insertAdjacentElement\("afterend", panel\)/,
  "the editor should stay near the profile actions instead of below the complete post history");
assert.doesNotMatch(script, /profileCard\.appendChild\(panel\)/,
  "the editor must not be appended after the timeline");
assert.match(styles, /\.edit-profile-panel\{[^}]*width:100%[^}]*max-width:100%[^}]*min-width:0[^}]*overflow:hidden/,
  "the editor should remain inside the profile card at every viewport width");
assert.match(styles, /\.edit-profile-panel input,\.edit-profile-panel textarea,\.edit-profile-panel select\{[^}]*width:100%[^}]*min-width:0/,
  "profile inputs and privacy selectors should not overflow their panel");
assert.match(script, /profile-identity-fields[^]*Display name[^]*Username[^]*More profile details/,
  "name and username should be the first visible profile controls");
assert.match(script, /<details class="profile-edit-section" data-profile-privacy>/,
  "privacy and tagging should be grouped instead of crowding the basic identity form");
assert.match(script, /mediaSummary\.textContent = "Photos and video"/,
  "photo and video tools should be available in one optional section");
assert.match(script, /requestedSection\.open = true/,
  "direct privacy links should open the collapsed section before focusing its control");
assert.match(styles, /@media\(max-width:560px\)\{\.profile-identity-fields\{grid-template-columns:1fr\}/,
  "the two basic identity fields should stack cleanly on phones");

console.log("Profile editor placement checks passed.");
