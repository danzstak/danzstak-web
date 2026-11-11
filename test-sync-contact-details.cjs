"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("messages.html", "utf8");
const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const css = fs.readFileSync("assets/chat.css", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const icons = fs.readFileSync("assets/icon-buttons.js", "utf8");

assert.match(html, /<dialog id="contactDetailsDialog"[^>]*aria-labelledby="contactDetailsName"/, "contact details must be a named modal surface");
for (const id of ["closeContactDetails", "contactDetailsAvatar", "contactDetailsName", "contactDetailsPresence", "contactDetailsProfile", "contactDetailsPhone", "contactDetailsVideo", "contactDetailsBlock", "contactDetailsStatus"]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} must be present`);
}
assert.match(source, /for \(const trigger of \[conversationAvatar, conversationName\]\)[\s\S]*?openContactDetails\(\)/, "the conversation identity must open contact details");
assert.match(source, /history\.pushState\(\{ \.\.\.currentState, danzstakContactDetails: true \}, ""\)/, "mobile contact details must participate in Back navigation");
assert.doesNotMatch(source, /danzstakContactDetails:\s*(?:activeConversation|memberId|contactEmail|email)/, "history state must not expose contact identity");
assert.match(source, /body: JSON\.stringify\(\{ memberId: activeConversation\.memberId \}\)/, "blocking must submit only the opaque member ID");
assert.match(source, /directFetch\("\/friends\/block"/, "blocking must use the existing protected account endpoint");
assert.match(source, /window\.danzstakConfirm[\s\S]*?Block \{name\}\?/, "blocking must retain a named destructive confirmation");
assert.match(css, /\.contact-details-actions\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, "contact actions must form one compact familiar row");
assert.match(html, /id="contactDetailsVideo"[^>]*data-icon-layout="label"/, "video must retain its familiar visible label");
assert.match(icons, /control\.dataset\.iconLayout === "label"/, "shared icons must support compact icon-and-label actions without erasing text");
assert.match(css, /@media\(max-width:560px\)[\s\S]*?\.contact-details-dialog\{width:100%;max-width:none;height:100dvh/, "phone contact details must be a dedicated full-screen view");
assert.match(html, /assets\/chat\.css\?v=464/);
assert.match(html, /assets\/direct-messages\.js\?v=499/);
assert.match(html, /id="newVideoCall"[^>]*data-icon="video"[^>]*aria-label="Start a video call"/, "SYNC must expose a visible video-call entry point");
assert.match(source, /newVideoCall"[\s\S]*?dataset\.chatFilter === "calls"/, "the video-call entry point must open the functional Calls directory");

const keysMatch = i18n.match(/const contactDetailKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const contactDetailGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(contactDetailGuidance\)\)/);
assert.ok(keysMatch && translationsMatch, "contact-detail translations must remain inspectable");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, context);
for (const language of ["es","fr","de","pt","it","ko","ja","zh-Hans","zh-Hant","fil","hi","vi","th","id","ar"]) {
  const values = context.result.translations[language];
  assert.equal(values?.length, context.result.keys.length, `${language} must translate every contact-detail phrase`);
  assert.ok(values.every(value => String(value).trim()), `${language} contact-detail translations must not be blank`);
}

console.log("SYNC contact-detail checks passed: familiar identity view, full-screen phone layout, safe profile/call actions, confirmed blocking, private history, and localization.");
