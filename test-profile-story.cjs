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
// About: story first; owner-only edit/add; visitors never see an empty block.
assert.ok(editor.indexOf("details.appendChild(storyBlock)") < editor.indexOf('detail("Location", "profileLocation")'), "story sits above the details");
assert.match(editor, /storyEdit\.hidden = !story \|\| !owner;/);
assert.match(editor, /storyAdd\.hidden = Boolean\(story\) \|\| !owner;/);
assert.match(editor, /storyBlock\.hidden = !story && !owner;/);
assert.match(editor, /storyText\.setAttribute\("data-no-translate", ""\)/, "the member's own words are never machine-translated");
assert.match(editor, /renderProfileStory\(profile\);/);
// Look: big pull-quote, no grey boxes, 44px targets.
assert.match(css, /\.profile-story-text\{[^}]*font-size:clamp\(20px,5\.4vw,26px\)[^}]*white-space:pre-line/);
assert.match(css, /\.details \.detail\{[^}]*border:0!important[^}]*background:transparent!important/);
assert.match(css, /\.profile-story-edit\{[^}]*width:44px;height:44px/);
assert.match(css, /\.profile-story-add\{[^}]*min-height:44px/);
console.log("profile story ok");
