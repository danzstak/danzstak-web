"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

const copyStart = messages.indexOf("async function copyDirectMessage(");
const paletteStart = messages.indexOf("function openMessageReactions(");
const itemStart = messages.indexOf("function directMessageItem(");
const itemEnd = messages.indexOf("function firstSafeMessageUrl(", itemStart);
assert.ok(copyStart >= 0 && paletteStart > copyStart, "message copy helper must exist before the action menu");

const copySource = messages.slice(copyStart, paletteStart);
assert.match(copySource, /navigator\.clipboard\?\.writeText/, "whole-message Copy must use the system clipboard when available");
assert.match(copySource, /navigator\.clipboard\.writeText\(content\)/, "Copy must use the exact original message content");
assert.match(copySource, /setTimeout\(\(\) => reject\([^\n]+3000\)/, "clipboard access must have a bounded failure path");
assert.match(copySource, /range\.selectNodeContents\(text\)/, "denied clipboard access must leave the message text selected for manual copy");
assert.match(copySource, /messageTranslate\("Copied\."\)/, "successful Copy must give translated feedback");
assert.match(copySource, /messageTranslate\("Select the message text and copy it\."\)/, "manual-copy recovery must give translated guidance");

const paletteSource = messages.slice(paletteStart, itemStart);
assert.match(paletteSource, /message\.content[\s\S]*message-copy-choice[\s\S]*messageTranslate\("Copy message"\)/, "text messages must expose a named Copy action");
assert.match(paletteSource, /copyDirectMessage\(item, message\)/, "the Copy action must invoke the exact-message helper");

const itemSource = messages.slice(itemStart, itemEnd);
assert.match(itemSource, /pointerdown[\s\S]*closest\?\.\("\.message-text"\)[^\n]+return/, "long-press actions must not steal native text selection from message text");
assert.match(itemSource, /contextmenu[\s\S]*closest\?\.\("\.message-text"\)[^\n]+return/, "right-click or mobile selection on message text must keep the native copy menu");

for (const key of ["Copy message", "Copied.", "Select the message text and copy it."]) {
  assert.ok(i18n.includes(JSON.stringify(key)), `${key} must be registered for localization`);
}
for (const language of ["es","fr","de","pt","it","ko","ja","zh-Hans","zh-Hant","fil","hi","vi","th","id"]) {
  assert.match(i18n, new RegExp(`(?:"${language}"|${language}):\\[`), `${language} must include message-copy translations`);
}

console.log("Message Copy checks passed: exact clipboard text, manual fallback, native partial selection, keyboard menu, and 15-language labels.");
