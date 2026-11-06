"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const plans = fs.readFileSync("assets/make-plans.js", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const keysMatch = i18n.match(/const planKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const planGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(planGuidance\)\)/);
assert.ok(keysMatch && translationsMatch, "Make Plans translations must remain inspectable");

const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, context);
const { keys, translations } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "ar", "fil", "hi", "vi", "th", "id"];
for (const language of languages) {
  assert.equal(translations[language].length, keys.length, `${language} must translate every Make Plans message`);
  let localized = 0;
  translations[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} Make Plans translation ${index + 1} cannot be blank`);
    if (value !== keys[index]) localized++;
  });
  assert.ok(localized >= keys.length - 2, `${language} cannot broadly fall back to English`);
  assert.notEqual(translations[language][0], keys[0], `${language} must localize the primary action`);
}

assert.match(html, /assets\/i18n\.js\?v=395/);
assert.match(html, /assets\/make-plans\.js\?v=3/);
assert.match(plans, /new Error\(t\(body\.error \|\| "Plans are temporarily unavailable\."\)\)/, "server plan errors should follow the selected language");
assert.match(i18n, /\.plan-card h3,\.plan-card p/, "artist-entered plan details must never be machine-translated");
console.log("Make Plans localization checks passed for all 15 non-English languages without translating user content.");
