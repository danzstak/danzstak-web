"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const chat = fs.readFileSync("assets/chat.js", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

assert.match(i18n, /const connectionActionKeys=\["No friends or Tribe members available yet\."[\s\S]*"Accept"\]/, "friend and call directory states need one complete translation key set");
for (const language of ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"]) {
  const key = language.includes("-") ? `"${language}"` : language;
  assert.match(i18n, new RegExp(`(?:^|\\s|,)${key}:\\[`), `${language} needs directory action translations`);
}

for (const translatedCall of [
  't("No friends or Tribe members available yet.")',
  't(user.online?"Online":"Offline")',
  't(user.online?"Online":"Offline — calls can ring through notifications when enabled")',
  'select.textContent=t("Message")',
  'relationship.textContent=t(user.friendStatus==="friends"?"Friends":"Requested")',
  'relationship.textContent=t("Accept")',
  'relationship.textContent=t("Add Friend")',
  'select.textContent=t("Not connected")',
  'p.textContent=t("Users are temporarily unavailable. Retrying automatically…")',
  'tf("Friend request sent to {name}."',
  't(accept?"You are now friends.":"Friend request declined.")'
]) {
  assert.ok(chat.includes(translatedCall), `call directory should translate ${translatedCall}`);
}

assert.match(chat, /requestFriend\(user\.email,user\.name\)/, "friend-request feedback should use the visible profile name instead of exposing an email address");

console.log("Call directory localization checks passed: presence, relationships, recovery, and friend feedback follow the selected language.");
