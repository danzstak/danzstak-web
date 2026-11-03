const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const template = fs.readFileSync(path.join(__dirname, "infrastructure", "call-signaling", "template.yaml"), "utf8");
const match = template.match(/const pushTranslations=(\{[\s\S]*?\});\s*\n\s*const pushFormat/);
assert.ok(match, "the signaling service must define a server-side push translation table");
const translations = vm.runInNewContext(`(${match[1]})`);
const languages = ["en", "es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.deepEqual(Object.keys(translations).sort(), [...languages].sort(), "push notifications must cover every supported account language");
for (const language of languages) {
  const copy = translations[language];
  assert.equal(copy.length, 9, `${language} must include member, call, message, and friend-request copy`);
  copy.forEach((value, index) => assert.ok(String(value).trim(), `${language} push value ${index} must not be empty`));
  assert.match(copy[2], /\{name\}/, `${language} call body must preserve the member-name placeholder`);
  assert.match(copy[2], /\{mode\}/, `${language} call body must preserve the call-mode placeholder`);
  assert.match(copy[6], /\{name\}/, `${language} message body must preserve the member-name placeholder`);
  assert.match(copy[8], /\{name\}/, `${language} friend-request body must preserve the member-name placeholder`);
}

assert.match(template, /async function pushPreferences\(userEmail,setting=''\)/, "the recipient preferences must drive push localization");
assert.match(template, /ProjectionExpression:setting\?'#setting, #language':'#language'/, "language and alert preference must be read together");
assert.match(template, /pushTranslations\[result\.Item\?\.language\?\.S\]\?result\.Item\.language\.S:'en'/, "unknown or missing languages must safely fall back to English");
assert.match(template, /notifyCall[\s\S]*?localizedPush\(preferences\.language,'call'/, "call pushes must use the recipient language");
assert.match(template, /notifyMessage[\s\S]*?localizedPush\(preferences\.language,'message'/, "message pushes must use the recipient language");
assert.match(template, /notifyFriendRequest[\s\S]*?localizedPush\(preferences\.language,'friend'/, "friend-request pushes must use the recipient language");
assert.doesNotMatch(template, /type:'message',title:'New DanzStak message'/, "message pushes must not bypass localization");
const notifyMessageSource = template.match(/async function notifyMessage[\s\S]*?(?=\s*async function notifyFriendRequest)/)?.[0] || "";
assert.ok(notifyMessageSource, "the message push function must remain present");
assert.doesNotMatch(notifyMessageSource, /\bcontent\b|\bpreview\b/, "lock-screen message pushes must not include message contents or previews");

console.log("Push localization checks passed: all 15 account languages cover privacy-safe call, message, and friend-request notifications.");
