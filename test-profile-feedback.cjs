"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const editor = readFileSync("assets/profile-editor.js", "utf8");
const styles = readFileSync("assets/profile-editor.css", "utf8");
const profile = readFileSync("profile.html", "utf8");

assert.match(editor, /function showProfileFeedback\(message, \{ urgent = false, timeout = 4200 \} = \{\}\)/, "profile editing needs one reusable feedback path");
assert.match(editor, /profileToast\.setAttribute\("aria-live", "polite"\)/, "profile feedback should be announced accessibly");
assert.match(editor, /profileToast\.setAttribute\("aria-atomic", "true"\)/, "profile feedback should be announced as a unit");
assert.doesNotMatch(editor, /alert\(/, "profile editing should not use blocking browser alerts");
assert.match(editor, /Profile video saved[\s\S]{0,90}showProfileFeedback/, "successful video changes should use branded feedback");
assert.match(styles, /\.profile-toast\{[^}]*safe-area-inset-bottom/, "profile feedback should clear mobile safe areas");
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{\.profile-toast\{transition:none\}\}/, "profile feedback should respect reduced motion");
assert.match(profile, /profile-editor\.css\?v=389/);
assert.match(profile, /profile-editor\.js\?v=473/);

console.log("Profile feedback checks passed: edit-profile actions use compact, accessible, nonblocking messages.");
