"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const keysMatch = i18n.match(/const messageMediaKeys=(\[[^;]+\]);/);
const guidancePattern = /const messageMediaGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(messageMediaGuidance\)\)/;
const guidanceMatch = i18n.match(guidancePattern);

assert.ok(keysMatch && guidanceMatch, "message-media translations should remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},guidance:${guidanceMatch[1]}}`, context);
const { keys, guidance } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 16, "attachment, message-summary, link, and reaction labels should all be localized");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every supported non-English locale needs message-media translations");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} should translate every message-media state`);
  guidance[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} message-media translation ${index + 1} cannot be blank`);
    if (index !== 2) assert.notEqual(value, keys[index], `${language} message-media translation ${index + 1} cannot fall back to English`);
  });
}

assert.match(messages, /messageTranslate\("Photo ready to send"\)/, "photo previews should announce in the selected language");
assert.match(messages, /messageTranslate\("Video ready to send"\)/, "video previews should announce in the selected language");
assert.match(messages, /messageFormat\("\{name\} sent a video\."/, "message summaries should preserve the sender inside a localized template");
assert.match(messages, /messageFormat\("Photo from \{name\}"/, "received photo labels should preserve the sender inside a localized template");
assert.match(messages, /messageFormat\("Video from \{name\}"/, "received video labels should preserve the sender inside a localized template");
assert.match(messages, /messageFormat\("Open shared link on \{site\}"/, "shared-link labels should preserve the destination inside a localized template");
assert.match(messages, /messageFormat\(message\.myReaction === emoji \? "Remove \{emoji\}" : "React with \{emoji\}"/, "reaction choices should announce localized actions without changing the emoji");

console.log("Message media localization checks passed: attachment previews, accessible summaries, media labels, shared links, and reactions cover all supported locales.");
