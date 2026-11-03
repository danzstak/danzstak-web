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
assert.match(styles, /\.dark-mode \.edit-profile-panel select\{[^}]*background:#111827[^}]*color:#f5f7fb/,
  "profile selectors should remain legible in dark mode");
assert.match(script, /profile-identity-fields[^]*profileEditorWords\.name[^]*profile-username[^]*More profile details/,
  "the visible name should come first and the optional username should be collapsed");
const panelTemplate = script.slice(script.indexOf("panel.innerHTML"), script.indexOf("// Keep profile controls"));
assert.equal((panelTemplate.match(/data-profile-language/g) || []).length, 1,
  "the profile editor should expose one unambiguous language control");
assert.ok(panelTemplate.indexOf("data-profile-language") < panelTemplate.indexOf("profile-username"),
  "language should stay visible beside the member name instead of being buried in advanced details");
assert.match(script, /<details class="profile-edit-section" data-profile-privacy>/,
  "privacy and tagging should be grouped instead of crowding the basic identity form");
assert.match(script, /mediaSummary\.textContent = "Photos and video"/,
  "photo and video tools should be available in one optional section");
assert.match(script, /requestedSection\.open = true/,
  "direct privacy links should open the collapsed section before focusing its control");
assert.match(styles, /@media\(max-width:560px\)\{\.profile-identity-fields\{grid-template-columns:1fr\}/,
  "the basic identity field should fit cleanly on phones");

console.log("Profile editor placement checks passed.");
