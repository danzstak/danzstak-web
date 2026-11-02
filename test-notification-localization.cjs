"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const keysMatch = i18n.match(/const notificationKeys=(\[[^;]+\]);/);
const guidancePattern = /const notificationGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(notificationGuidance\)\)/;
const guidanceMatch = i18n.match(guidancePattern);

assert.ok(keysMatch && guidanceMatch, "notification translation tables should remain inspectable");
assert.ok(i18n.replace(/\r?\n/g, "\r\n").match(guidancePattern), "notification checks should work with Windows CI line endings");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},guidance:${guidanceMatch[1]}}`, context);
const { keys, guidance } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 8, "drawer states, counts, and accessible notification labels should all be localized");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every supported non-English locale needs notification translations");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} should translate every notification state`);
  guidance[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} notification translation ${index + 1} cannot be blank`);
    if (language !== "fr" || index !== 0) assert.notEqual(value, keys[index], `${language} notification translation ${index + 1} cannot fall back to English`);
  });
}

assert.match(feed, /feedFormat\(safeCount === 1 \? "\{label\}, \{count\} new notification" : "\{label\}, \{count\} new notifications"/, "notification controls should announce localized counts");
assert.match(feed, /feedFormat\(safeCount === 1 \? "\{count\} new notification\." : "\{count\} new notifications\."/, "live notification announcements should use localized singular and plural text");
assert.match(feed, /feedTranslate\("No new notifications\."\)/, "cleared notification counts should announce in the selected language");
assert.match(feed, /typeof MutationObserver === "function"[\s\S]{0,40}new MutationObserver\(\(\) => \{ if \(lastNotificationCount !== null\) updateNotificationCount\(lastNotificationCount\); \}\)/, "language changes should immediately refresh notification labels without announcing a false count change");

console.log("Notification localization checks passed: drawer states, badges, singular/plural announcements, and language changes cover all supported locales.");
