"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const keysMatch = i18n.match(/const remoteAudioKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const remoteAudioGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(remoteAudioGuidance\)\)/);
assert.ok(keysMatch && translationsMatch, "remote-audio translations must remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, context);
const { keys, translations } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];
for (const language of languages) {
  assert.equal(translations[language].length, keys.length, `${language} must translate every remote-audio message`);
  translations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} translation ${index + 1} cannot fall back to English`);
  });
}
console.log("Remote call-audio localization checks passed for every supported non-English language.");
