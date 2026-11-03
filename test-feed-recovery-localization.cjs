"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const keysMatch = i18n.match(/const feedRecoveryKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const feedRecovery=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(feedRecovery\)\)/);

assert.ok(keysMatch && translationsMatch, "feed recovery translations should remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, context);
const { keys, translations } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 13, "news, presence, friend, and post recovery states should all be localized");
assert.deepEqual(Object.keys(translations).sort(), [...languages].sort(), "every supported non-English locale needs feed recovery translations");
for (const language of languages) {
  assert.equal(translations[language].length, keys.length, `${language} should translate every feed recovery state`);
  translations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} feed recovery translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} feed recovery translation ${index + 1} cannot fall back to English`);
  });
}

for (const key of keys.filter(key => !key.includes("{error}"))) {
  assert.ok(feed.includes(`feedTranslate("${key}")`), `${key} should pass through the selected language`);
}
assert.ok(feed.includes('feedFormat("Unable to load posts: {error}"'), "post loading errors should preserve the server detail inside a localized template");
assert.doesNotMatch(feed, /innerHTML\s*=\s*'<p class="muted">(?:Loading news|No headlines|News is temporarily unavailable)/, "network states should be rendered as text instead of untranslated HTML");

console.log("Feed recovery localization checks passed: news, presence, friends, and post failures cover all supported locales.");
