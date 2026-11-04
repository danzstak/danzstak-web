const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const i18n = fs.readFileSync(path.join(__dirname, "assets", "i18n.js"), "utf8");
const sharing = fs.readFileSync(path.join(__dirname, "assets", "profile-sharing.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "profile.html"), "utf8");
const keyMatch = i18n.match(/const profileShareKeys=(\[[\s\S]*?\]);\s*\n\s*const profileShareGuidance/);
const guidanceMatch = i18n.match(/const profileShareGuidance=(\{[\s\S]*?\});\s*\n\s*for\(const \[language,values\] of Object\.entries\(profileShareGuidance\)\)/);

assert.ok(keyMatch && guidanceMatch, "profile sharing must use the shared DanzStak translation dictionaries");
const keys = vm.runInNewContext(`(${keyMatch[1]})`);
const guidance = vm.runInNewContext(`(${guidanceMatch[1]})`);
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 11, "the complete profile share and invite dialog must be translated");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every non-English account language must translate profile sharing");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} must translate every profile-sharing phrase`);
  guidance[language].forEach((value, index) => assert.ok(String(value).trim(), `${language} profile-sharing value ${index} must not be empty`));
}
for (const key of keys) assert.ok(sharing.includes(`'${key}'`) || sharing.includes(`"${key}"`), `${key} must remain an English source phrase that the shared observer can translate`);
assert.match(sharing, /url\.searchParams\.set\('member', member\)/, "profile sharing must retain opaque member links");
assert.doesNotMatch(sharing, /searchParams\.set\('user'/, "profile sharing must never put account email addresses in shared links");
assert.match(sharing, /dialog\.onclose = \(\) => opener\.focus\(\)/, "closing the share dialog must return focus to its opener");
assert.match(html, /assets\/i18n\.js\?v=387/);
assert.match(html, /assets\/profile-sharing\.js\?v=416/);

console.log("Profile sharing localization checks passed: all 15 languages cover profile links, invitations, clipboard recovery, and dialog controls.");
