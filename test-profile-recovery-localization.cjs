"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const profile = fs.readFileSync("assets/profile-editor.js", "utf8");
const keysMatch = i18n.match(/const profileRecoveryKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const profileRecovery=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(profileRecovery\)\)/);

assert.ok(keysMatch && translationsMatch, "profile recovery translations should remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, context);
const { keys, translations } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 8, "profile save, upload, connection, and fallback states should all be localized");
assert.deepEqual(Object.keys(translations).sort(), [...languages].sort(), "every supported non-English locale needs profile recovery translations");
for (const language of languages) {
  assert.equal(translations[language].length, keys.length, `${language} should translate every profile recovery state`);
  translations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} profile recovery translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} profile recovery translation ${index + 1} cannot fall back to English`);
  });
}

for (const key of keys) {
  assert.ok(profile.includes(`profileTranslate("${key}")`), `${key} should pass through the selected language`);
}
assert.match(profile, /const profileTranslate = value => window\.danzstakTranslate\?\.\(value\) \|\| value/, "profile recovery should use the active site language");

console.log("Profile recovery localization checks passed: saving, media uploads, connection failures, and success states cover all supported locales.");
