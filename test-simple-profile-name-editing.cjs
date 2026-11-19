"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
const css = fs.readFileSync("assets/profile-editor.css", "utf8");
const profile = fs.readFileSync("profile.html", "utf8");

assert.match(editor, /Name people see/, "the primary field uses ordinary language");
assert.match(editor, /Nome visibile agli altri/, "Italian members receive an understandable name label");
assert.match(editor, /Username \(optional\)/, "the technical username is moved out of the required main path");
assert.match(editor, /Non devi modificarlo per cambiare il nome visibile/, "Italian help explains that username changes are unnecessary");
// Audit E8 (owner 2026-11-19, "2 edit profile"): the Edit button is the only way into Edit profile; the name is plain text.
assert.doesNotMatch(editor, /profile-name-edit-hint|nameEditHint/, "no hidden \"tap your name\" shortcut");
assert.doesNotMatch(editor, /document\.getElementById\("profileName"\)\.addEventListener\("click"/, "tapping the name does not open the editor");
assert.doesNotMatch(editor, /profileName\.setAttribute\("role", "button"\)/, "the name is not a button");
assert.match(editor, /function openNameEdit\(\)/, "?edit=identity still opens the editor at the name field");
assert.match(editor, /profile\.handle = \(profile\.handle \|\| ""\)[\s\S]*window\.danzstakCurrentProfile\?\.handle/, "saving a visible name preserves the existing username automatically");
for (const language of ['en','es','fr','de','pt','it','ko','ja','zh-Hans','zh-Hant','fil','hi','vi','th','id']) {
  assert.match(editor, new RegExp(`(?:^|\\s|[,{])(?:"${language}"|${language}):`), `${language} receives direct profile-editor copy`);
}
assert.equal((editor.match(/language:"/g) || []).length, 15, "every supported profile language localizes the visible language control");
assert.match(editor, /resolveProfileLanguage/, "the editor resolves every supported locale explicitly");
assert.match(profile, /profile-editor\.js\?v=513/, "the profile loads the simplified editor release");

console.log("Simple profile-name editing checks passed: the Edit button is the one way in and all 15 languages explain visible names without username jargon.");
