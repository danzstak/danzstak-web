"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const devices = fs.readFileSync("assets/call-devices.js", "utf8");
const keysMatch = i18n.match(/const callingDeviceKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const callingDevices=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(callingDevices\)\)/);
const staticKeysMatch = i18n.match(/const callingDeviceStaticKeys=(\[[^;]+\]);/);
const staticTranslationsMatch = i18n.match(/const callingDeviceStatic=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(callingDeviceStatic\)\)/);
const requirementKeysMatch = i18n.match(/const syncDeviceRequirementKeys=(\[[^;]+\]);/);
const requirementTranslationsMatch = i18n.match(/const syncDeviceRequirements=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(syncDeviceRequirements\)\)/);

assert.ok(keysMatch && translationsMatch && staticKeysMatch && staticTranslationsMatch && requirementKeysMatch && requirementTranslationsMatch, "calling-device translations must remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]},staticKeys:${staticKeysMatch[1]},staticTranslations:${staticTranslationsMatch[1]},requirementKeys:${requirementKeysMatch[1]},requirementTranslations:${requirementTranslationsMatch[1]}}`, context);
const { keys, translations, staticKeys, staticTranslations, requirementKeys, requirementTranslations } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

for (const language of languages) {
  assert.equal(translations[language].length, keys.length, `${language} must translate every calling-device label`);
  translations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} calling-device translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} calling-device translation ${index + 1} cannot fall back to English`);
  });
  assert.equal(staticTranslations[language].length, staticKeys.length, `${language} must translate every static calling-device label`);
  staticTranslations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} static calling-device translation ${index + 1} cannot be blank`);
    assert.notEqual(value, staticKeys[index], `${language} static calling-device translation ${index + 1} cannot fall back to English`);
  });
  assert.equal(requirementTranslations[language].length, requirementKeys.length, `${language} must translate every mandatory SYNC device label`);
  requirementTranslations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} mandatory SYNC device translation ${index + 1} cannot be blank`);
    assert.notEqual(value, requirementKeys[index], `${language} mandatory SYNC device translation ${index + 1} cannot fall back to English`);
  });
}

for (const key of ["Last active", "This device is registered for SYNC.", "Register this device before using SYNC.", "Register this device to use SYNC", "Calls allowed", "Incoming calls off", "Rename", "Turn calls off", "Allow calls", "Revoke", "Registering this device…", "It will stop receiving SYNC calls."]) {
  assert.ok(devices.includes(`t(${JSON.stringify(key)})`), `calling-device UI must translate ${key}`);
}
assert.doesNotMatch(devices, /t\(`Revoke \$\{device\.name\}/, "dynamic revoke text must not bypass the translation dictionary");

console.log("Calling-device localization checks passed for all 15 supported languages.");
