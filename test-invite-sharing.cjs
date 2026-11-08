"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");

const script = read("assets/invite-sharing.js");
const style = read("assets/invite-sharing.css");
const i18n = read("assets/i18n.js");
const feed = read("feed.html");
const messages = read("messages.html");
const worker = read("service-worker.js");

assert.match(script, /const JOIN_URL = "https:\/\/danzstak\.com\/"/, "invites must use the public HTTPS signup destination");
assert.match(script, /navigator\.share\(/, "supported phones must use the native share sheet");
assert.match(script, /navigator\.clipboard\.writeText\(JOIN_URL\)/, "every device needs a copy-link fallback");
assert.match(script, /sms:\$\{isAppleMobile\(\) \? "&" : "\?"\}body=/, "SMS handoff must account for iOS and Android URI forms");
assert.match(script, /message\.addEventListener\("input", syncSms\)/, "editing the invitation must update the SMS handoff");
assert.doesNotMatch(script, /contacts|addressBook|getUserMedia|phoneNumber|recipient=/i, "the MVP must not read contacts or collect recipient numbers");
assert.match(style, /min-height:48px/, "invite choices must remain comfortable touch targets");
assert.match(style, /@media\(max-width:560px\)/, "the dialog must have a phone-first layout");

for (const [page, expected] of [[feed, "assets/invite-sharing.js?v=1"], [messages, "assets/invite-sharing.js?v=1"]]) {
  assert.ok(page.includes(expected), "Friends and SYNC must load the shared invite behavior");
  assert.ok(page.includes("assets/invite-sharing.css?v=1"), "Friends and SYNC must load shared invite styling");
}
assert.match(messages, /data-invite-friend[^>]+aria-label="Invite a friend"/, "SYNC must expose an accessible invite action");
assert.match(worker, /danzstak-shell-v752/);
assert.match(worker, /assets\/invite-sharing\.js/);
assert.match(worker, /assets\/invite-sharing\.css/);

const keyMatch = i18n.match(/const inviteKeys=(\[[\s\S]*?\]);\s*\n\s*const inviteGuidance/);
const guidanceMatch = i18n.match(/const inviteGuidance=(\{[\s\S]*?\});\s*\n\s*for\(const \[language,values\] of Object\.entries\(inviteGuidance\)\)/);
assert.ok(keyMatch && guidanceMatch, "invite phrases must use the shared translation dictionaries");
const keys = vm.runInNewContext(`(${keyMatch[1]})`);
const guidance = vm.runInNewContext(`(${guidanceMatch[1]})`);
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every non-English account language must translate invitations");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} must translate every invite phrase`);
  guidance[language].forEach((value, index) => assert.ok(String(value).trim(), `${language} invite phrase ${index} must not be empty`));
}
for (const key of keys) assert.ok(script.includes(key), `${key} must remain a translatable source phrase`);

console.log("Invite sharing checks passed: editable SMS handoff, native share, copy fallback, privacy, PWA shell, touch targets, and 15 languages.");
