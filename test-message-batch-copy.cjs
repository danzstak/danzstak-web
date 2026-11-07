"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

assert.match(html, /id="messageSelectionToolbar"[^>]*aria-label="Selected messages"[^>]*hidden/, "SYNC must provide a named selection toolbar that starts hidden");
assert.match(html, /id="copySelectedMessages"[^>]*data-icon="copy"[^>]*aria-label="Copy selected"/, "the selection toolbar must expose an accessible Copy action");
assert.match(html, /id="cancelMessageSelection"[^>]*aria-label="Cancel selection"/, "the selection toolbar must expose an accessible Cancel action");
assert.match(source, /const selectedMessages = new Map\(\)/, "selection state must be local to the current SYNC client");
assert.match(source, /sort\(\(left, right\) => String\(left\.createdAt[^\n]+localeCompare/, "batch Copy must sort by message time instead of tap order");
assert.match(source, /message\.senderEmail === currentEmail \? messageTranslate\("You"\) : activeContactName/, "copied text must use short visible speaker labels, never account emails");
assert.match(source, /return `\$\{speaker\} · \$\{time\}\\n\$\{String\(message\.content/, "copied batches must contain speaker, time, and original text only");
assert.match(source, /navigator\.clipboard\.writeText\(content\)/, "batch Copy must remain a local clipboard action");
assert.match(source, /messageCopyFallback\.select\(\)/, "clipboard denial must expose a selected manual-copy fallback");
assert.match(source, /if \(!selectedMessages\.size \|\| event\.target\.closest\?\.\("a,button,input,textarea,video"\)\) return/, "selection mode must not hijack links, controls, or media");
assert.match(source, /clearMessageSelection\(\);\s*const closingContact/, "changing conversations must clear the previous thread's selection");
assert.match(css, /\.message\.is-selected\{[^}]*outline:/, "selected bubbles must have a clear visible state");
assert.match(css, /\.message-selection-actions button[^}]*min-height:40px/, "selection actions must remain compact before coarse-pointer expansion");
assert.match(css, /@media\(pointer:coarse\)[\s\S]*\.message-selection-actions button[^}]*44px/, "selection actions must retain 44px phone targets");
for (const key of ["Select message", "{count} selected", "Copy selected", "Cancel selection", "Copied {count} messages."]) assert.ok(i18n.includes(JSON.stringify(key)), `${key} must be localized`);
for (const language of ["es","fr","de","pt","it","ko","ja","zh-Hans","zh-Hant","fil","hi","vi","th","id"]) assert.match(i18n, new RegExp(`(?:"${language}"|${language}):\\[`), `${language} must retain batch-selection translations`);

console.log("Message batch-Copy checks passed: chronological selection, visible speaker labels, local clipboard, fallback, isolation, accessibility, and localization.");
