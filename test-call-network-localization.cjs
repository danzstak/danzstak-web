"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const keysMatch = i18n.match(/const callNetworkKeys=(\[[^;]+\]);/);
const guidanceMatch = i18n.match(/const callNetworkGuidance=(\{[\s\S]*?\n \});\n for\(const \[language,values\] of Object\.entries\(callNetworkGuidance\)\)/);

assert.ok(keysMatch && guidanceMatch, "call network translation tables should remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},guidance:${guidanceMatch[1]}}`, context);
const { keys, guidance } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 4, "all known call transport and session errors should be localized");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every supported non-English locale needs call network recovery guidance");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} should translate every call network error`);
  guidance[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} translation ${index + 1} cannot fall back to English`);
  });
}

for (const key of keys) assert.ok(chat.includes(`t(${JSON.stringify(key)})`), `call transport error should be translated at runtime: ${key}`);

console.log("Call network localization checks passed: timeouts, offline recovery, expired sessions, and request failures cover all supported languages.");
