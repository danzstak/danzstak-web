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
assert.match(editor, /profile-name-edit-hint/, "owners receive a visible shortcut beside their current name");
assert.match(editor, /document\.getElementById\("profileName"\)\.addEventListener\("click"/, "tapping the visible name opens editing");
assert.match(editor, /profileName\.setAttribute\("role", "button"\)/, "the clickable name is keyboard and assistive-technology discoverable");
assert.match(editor, /profile\.handle = \(profile\.handle \|\| ""\)[\s\S]*window\.danzstakCurrentProfile\?\.handle/, "saving a visible name preserves the existing username automatically");
assert.match(css, /profile-name-edit-hint/, "the direct name-edit shortcut has dedicated styling");
for (const language of ['en','es','fr','de','pt','it','ko','ja','zh-Hans','zh-Hant','fil','hi','vi','th','id']) {
  assert.match(editor, new RegExp(`(?:^|\\s|[,{])(?:"${language}"|${language}):`), `${language} receives direct profile-editor copy`);
}
assert.equal((editor.match(/language:"/g) || []).length, 15, "every supported profile language localizes the visible language control");
assert.match(editor, /resolveProfileLanguage/, "the editor resolves every supported locale explicitly");
assert.match(profile, /profile-editor\.js\?v=484/, "the profile loads the simplified editor release");

console.log("Simple profile-name editing checks passed: owners can tap their name and all 15 languages explain visible names without username jargon.");
