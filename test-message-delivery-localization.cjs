"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const keysMatch = i18n.match(/const messageDeliveryKeys=(\[[^;]+\]);/);
const guidancePattern = /const messageDeliveryGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(messageDeliveryGuidance\)\)/;
const guidanceMatch = i18n.match(guidancePattern);

assert.ok(keysMatch && guidanceMatch, "message-delivery translations should remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},guidance:${guidanceMatch[1]}}`, context);
const { keys, guidance } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 7, "delivery, read, pending, edited, and unread states should all be localized");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every supported non-English locale needs message-delivery translations");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} should translate every delivery state`);
  guidance[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} message-delivery translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} message-delivery translation ${index + 1} cannot fall back to English`);
  });
}

assert.match(messages, /messageTranslate\(message\.read \? "Read" : "Delivered"\)/, "receipt labels should follow the selected language");
assert.match(messages, /messageTranslate\("Sending…"\)/, "pending delivery text should follow the selected language");
assert.match(messages, /messageTranslate\("edited"\)/, "edited markers should follow the selected language");
assert.match(messages, /messageFormat\("You: \{text\}\. Sending\."/, "pending message announcements should preserve user text inside a localized template");
assert.match(messages, /messageFormat\(Number\(conversation\.unread\) === 1 \? "\{count\} unread message" : "\{count\} unread messages"/, "unread badges should use localized singular and plural labels");

console.log("Message delivery localization checks passed: sending, delivered, read, edited, pending announcements, and unread counts cover all supported locales.");
