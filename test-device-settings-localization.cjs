"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const settings = fs.readFileSync("assets/device-settings.js", "utf8");
const keysMatch = i18n.match(/const deviceStateKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const deviceStates=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(deviceStates\)\)/);

assert.ok(keysMatch && translationsMatch, "device-state translations should remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, context);
const { keys, translations } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 27, "installation, notification, offline, update, and storage states should all be localized");
assert.deepEqual(Object.keys(translations).sort(), [...languages].sort(), "every supported non-English locale needs device-state translations");
for (const language of languages) {
  assert.equal(translations[language].length, keys.length, `${language} should translate every device state`);
  translations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} device-state translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} device-state translation ${index + 1} cannot fall back to English`);
  });
}

assert.match(settings, /const deviceTranslate=value=>window\.danzstakTranslate\?\.\(value\)\|\|value/, "device settings should use the active site language");
assert.match(settings, /const text=\(selector,value\)=>\{dialog\.querySelector\(selector\)\.textContent=deviceTranslate\(value\)/, "all status rows should translate at assignment time");
assert.match(settings, /deviceFormat\('\{count\} MB used by this site'/, "storage usage should retain its numeric value inside a localized template");
for (const key of keys) assert.ok(settings.includes(key), `${key} must remain connected to device settings`);

console.log("Device-settings localization checks passed: install, alerts, offline access, updates, and storage cover all supported locales.");
