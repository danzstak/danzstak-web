"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const keysMatch = i18n.match(/const notificationKeys=(\[[^;]+\]);/);
const guidancePattern = /const notificationGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(notificationGuidance\)\)/;
const guidanceMatch = i18n.match(guidancePattern);
const activityKeysMatch = i18n.match(/const activityNotificationKeys=(\[[^;]+\]);/);
const activityPattern = /const activityNotifications=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(activityNotifications\)\)/;
const activityMatch = i18n.match(activityPattern);

assert.ok(keysMatch && guidanceMatch, "notification translation tables should remain inspectable");
assert.ok(activityKeysMatch && activityMatch, "activity-notification translation tables should remain inspectable");
assert.ok(i18n.replace(/\r?\n/g, "\r\n").match(guidancePattern), "notification checks should work with Windows CI line endings");
const context = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},guidance:${guidanceMatch[1]},activityKeys:${activityKeysMatch[1]},activity:${activityMatch[1]}}`, context);
const { keys, guidance, activityKeys, activity } = context.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 11, "drawer states, failures, actions, counts, and accessible notification labels should all be localized");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every supported non-English locale needs notification translations");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} should translate every notification state`);
  guidance[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} notification translation ${index + 1} cannot be blank`);
    if (language !== "fr" || index !== 0) assert.notEqual(value, keys[index], `${language} notification translation ${index + 1} cannot fall back to English`);
  });
}
assert.equal(activityKeys.length, 19, "message, Tribe, reaction, tag, reply, comment, friend-request, and profile activity should all be localized");
assert.deepEqual(Object.keys(activity).sort(), [...languages].sort(), "every supported non-English locale needs activity-notification translations");
for (const language of languages) {
  assert.equal(activity[language].length, activityKeys.length, `${language} should translate every activity-notification message`);
  activity[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} activity translation ${index + 1} cannot be blank`);
    for (const placeholder of activityKeys[index].match(/\{[^}]+\}/g) || []) assert.ok(value.includes(placeholder), `${language} activity translation ${index + 1} must preserve ${placeholder}`);
  });
}

assert.match(feed, /feedFormat\(safeCount === 1 \? "\{label\}, \{count\} new notification" : "\{label\}, \{count\} new notifications"/, "notification controls should announce localized counts");
assert.match(feed, /feedFormat\(safeCount === 1 \? "\{count\} new notification\." : "\{count\} new notifications\."/, "live notification announcements should use localized singular and plural text");
assert.match(feed, /feedTranslate\("No new notifications\."\)/, "cleared notification counts should announce in the selected language");
assert.match(feed, /list\.setAttribute\("aria-label", feedTranslate\("Notifications"\)\)/, "the notification region label should use the selected language");
assert.match(feed, /loading\.textContent = feedTranslate\("Loading notifications…"\)/, "the notification loading state should use the selected language");
assert.match(feed, /empty\.textContent = feedTranslate\("No new notifications\."\)/, "the notification empty state should use the selected language");
assert.match(feed, /notificationDrawer\.setAttribute\("aria-label", feedTranslate\("Notifications"\)\)/, "the notification dialog label should use the selected language");
assert.match(feed, /setAttribute\("aria-label", feedTranslate\("Close notifications"\)\)/, "the notification close control should use the selected language");
assert.match(feed, /error\.textContent = feedTranslate\("Notifications could not be loaded\."\)/, "the notification failure state should use the selected language");
assert.match(feed, /retry\.textContent = feedTranslate\("Retry"\)/, "the notification retry action should use the selected language");
for (const action of ["Open Tribe", "View post", "Open chat"]) assert.match(feed, new RegExp(`open\\.textContent = feedTranslate\\(\"${action}\"\\)`), `${action} should use the selected language`);
assert.match(feed, /button\.textContent = feedTranslate\(label\)/, "friend-request actions should use the selected language");
assert.match(feed, /return feedFormat\(templates\[label\] \|\| "\{name\} reacted to your post\.", \{ name: displayName \}\)/, "reaction notices should use parameterized translated templates");
assert.match(feed, /feedFormat\("\{name\} notified @everyone in \{group\}: \{preview\}"/, "Tribe announcements should use a parameterized translated template");
assert.match(feed, /feedFormat\("\{name\} tagged you in a post\."/, "tag notices should use a parameterized translated template");
assert.match(feed, /feedFormat\("\{name\} replied to you: \{preview\}"/, "reply notices should use a parameterized translated template");
assert.match(feed, /feedFormat\("\{name\} commented: \{preview\}"/, "comment notices should use a parameterized translated template");
assert.match(feed, /feedFormat\("\{name\} sent you a friend request\."/, "friend-request notices should use a parameterized translated template");
assert.match(feed, /feedFormat\("Open \{name\} profile"/, "notification profile links should have a localized accessible name");
assert.doesNotMatch(feed, /`\$\{displayName\} (?:tagged you|replied to you|commented|sent you a friend request)/, "activity notices must not bypass the translation layer");
assert.match(feed, /typeof MutationObserver === "function"[\s\S]{0,40}new MutationObserver\(\(\) => \{ if \(lastNotificationCount !== null\) updateNotificationCount\(lastNotificationCount\); \}\)/, "language changes should immediately refresh notification labels without announcing a false count change");

console.log("Notification localization checks passed: drawer states, badges, singular/plural announcements, and language changes cover all supported locales.");
