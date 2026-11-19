"use strict";
// Owner 2026-11-18 evening: logout → landing page top; Tribe initials centred + Tribe pictures; "+ bio" is the 5th profile icon.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = f => fs.readFileSync(f, "utf8");
const logout = read("assets/logout.js"), home = read("assets/home.js"), tribes = read("assets/tribes-polish.css"), feed = read("assets/feed-enhancements.js"), editor = read("assets/profile-editor.js"), polish = read("assets/profile-polish.css");
assert.match(logout, /location\.replace\("\.\/\?signedout=1"\)/, "logout lands on the landing page");
assert.match(logout, /new Promise\(resolve => setTimeout\(resolve, 1500\)\)/, "push cleanup never holds logout up for more than 1.5 s");
assert.match(home, /showSession\(false, issue \|\| ""\)/, "signed-out landing opens at the top without a status box");
assert.match(tribes, /\.group-card-cover:not\(\.has-photo\)::after\{position:absolute;inset:0;display:grid;place-items:center/, "Tribe initial is centred");
assert.doesNotMatch(tribes, /\.group-card-cover\{[^}]*;background:#121418!important/, "no background shorthand that wipes a Tribe picture");
assert.match(feed, /if \(group\.coverUrl\) \{ cover\.style\.backgroundImage = `url\(/, "Tribe directory box shows the Tribe's own picture");
// Superseded later on 2026-11-18 (owner: "+ bio" was redundant with Edit profile and showed to visitors): removed.
assert.match(editor, /addBioButton\.hidden = true;\r?\n\s*addBioButton\.remove\(\);/, "+ bio is gone");
assert.match(editor, /if \(profile\.isOwner && profile\.picture\) installCompactAvatar\(profile\);/, "profile composer fetches the owner photo when missing");
assert.doesNotMatch(editor, /compactAvatar\.textContent = "D";/, "never the DanzStak D in the profile composer");
console.log("Owner evening checks passed: logout to landing, centred Tribe initials and pictures, + bio as the 5th icon.");
