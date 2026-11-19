"use strict";
// Owner 2026-11-18 (About tab screenshot): "No longform bio like we discussed ... so it can be their vanity wall."
// The About tab opens with the member's long-form story (up to 2000 characters), big, before plain detail lines.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const css = fs.readFileSync("assets/profile-polish.css", "utf8");
// Server stores and returns it, length-checked like every profile text field.
assert.match(template, /bio:\['profileBio',160\],story:\['profileStory',2000\],location:/);
assert.match(template, /story:profileString\(item,'profileStory',2000\)/);
// Editor: a real textarea, filled when the editor opens.
assert.match(editor, /<textarea name="story" maxlength="2000" rows="8"/);
assert.match(editor, /panel\.elements\.story\.value = profile\.story \|\| "";/);
// About: story first; written in Edit profile (no separate + bio button, owner 2026-11-19).
assert.ok(editor.indexOf("details.appendChild(storyBlock)") < editor.indexOf('detail("Location", "profileLocation"'), "story sits above the details");
assert.doesNotMatch(editor, /storyAdd|storyEdit|profile-story-add/, "owner 2026-11-19: no + bio button (it only opened Edit profile)");
assert.match(editor, /storyBlock\.hidden = !story;/, "no empty story block for anyone");
assert.match(editor, /storyText\.setAttribute\("data-no-translate", ""\)/, "the member's own words are never machine-translated");
assert.match(editor, /renderProfileStory\(profile\);/);
// Look: big pull-quote, no grey boxes, 44px targets.
assert.match(css, /\.profile-story-text\{[^}]*font-size:clamp\(20px,5\.4vw,26px\)[^}]*white-space:pre-line/);
assert.match(css, /\.details \.detail\{[^}]*border:0!important[^}]*background:transparent!important/);
// Owner 2026-11-19: Location and Work on one line.
assert.match(editor, /detail\("Location", "profileLocation", locationWork\);\r?\ndetail\("Work", "profileWork", locationWork\);/);
assert.match(css, /\.details \.detail-pair\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css, /\.details \.detail-pair:has\(>\.detail\[hidden\]\)\{grid-template-columns:minmax\(0,1fr\)\}/, "a visitor sees one full-width item when only one is filled");
console.log("profile story ok");
