"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const keysMatch = i18n.match(/const messageFailureKeys=(\[[^;]+\]);/);
const guidancePattern = /const messageFailures=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(messageFailures\)\)/;
const guidanceMatch = i18n.match(guidancePattern);

assert.ok(keysMatch && guidanceMatch, "message-failure translations should remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},guidance:${guidanceMatch[1]}}`, context);
const { keys, guidance } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 18, "message upload, loading, editing, sending, and account failures should all be localized");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every supported non-English locale needs message-failure translations");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} should translate every message failure`);
  guidance[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} message-failure translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} message-failure translation ${index + 1} cannot fall back to English`);
  });
}

for (const key of [
  "Choose a photo or video. Standalone audio files are not supported.",
  "Attachment upload could not start",
  "Attachment upload failed",
  "Messages could not be loaded",
  "Try loading messages again",
  "Earlier messages could not be loaded",
  "Try loading earlier messages again",
  "Contacts are temporarily unavailable",
  "Attachments need a connection. Your draft is still here.",
  "Message could not be sent",
  "Chat could not be deleted",
  "Your account could not be loaded"
]) {
  assert.ok(messages.includes(`messageTranslate("${key}")`), `${key} should pass through the selected language`);
}
assert.match(messages, /messageFormat\("\{error\}\. Your message is still in the composer\."/, "send failures should preserve the server error inside a localized template");

console.log("Message failure localization checks passed: upload, load, edit, send, delete, and account errors cover all supported locales.");
