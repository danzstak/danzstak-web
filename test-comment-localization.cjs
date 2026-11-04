const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const html = fs.readFileSync("feed.html", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
const keysMatch = i18n.match(/const commentActionKeys=(\[[\s\S]*?\]);\s*\n\s*const commentActions/);
const actionsMatch = i18n.match(/const commentActions=(\{[\s\S]*?\});\s*\n\s*for\(const \[language,values\] of Object\.entries\(commentActions\)\)/);
const templatesMatch = i18n.match(/const commentTemplates=(\{[\s\S]*?\});\s*\n\s*const memberCountLabels/);

assert.ok(keysMatch && actionsMatch && templatesMatch, "comment interface translations must use the shared DanzStak language layer");
const keys = vm.runInNewContext(`(${keysMatch[1]})`);
const actions = vm.runInNewContext(`(${actionsMatch[1]})`);
const templates = vm.runInNewContext(`(${templatesMatch[1]})`);
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 12, "the complete comment composer, reply and sort interface must be translated");
assert.deepEqual(Object.keys(actions).sort(), [...languages].sort(), "all non-English account languages must translate comment actions");
assert.deepEqual(Object.keys(templates).sort(), [...languages].sort(), "all non-English account languages must translate named reply context");
for (const language of languages) {
  assert.equal(actions[language].length, keys.length, `${language} must translate every comment action`);
  actions[language].forEach((value, index) => assert.ok(String(value).trim(), `${language} comment translation ${index} must not be empty`));
  assert.ok(templates[language].replying.includes("{name}"), `${language} replying template must preserve the member name`);
  assert.ok(templates[language].cancelReply.includes("{name}"), `${language} cancel-reply template must preserve the member name`);
}

for (const phrase of ["Write a comment…", "Add emoji to comment", "Post comment", "Most relevant ▾", "Newest ▾", "Reply", "Replying to ", "Cancel reply to "])
  assert.ok(feed.includes(phrase), `comment UI must retain the translatable source phrase: ${phrase}`);
assert.match(feed, /function refreshCommentInterfaceLanguage\(root = document\)/, "existing comments must refresh when the account language changes");
assert.match(feed, /new Intl\.RelativeTimeFormat\(locale/, "comment timestamps must follow the selected account language");
assert.match(feed, /time\.title = parsed\.toLocaleString\(locale/, "comment timestamps must expose the full localized date and time");
assert.match(feed, /attributeFilter: \["lang"\]/, "comment translations must observe live language changes");
assert.match(feed, /dataset\.replyName/, "member names must be preserved separately from translated interface copy");
assert.match(html, /assets\/i18n\.js\?v=390/);
assert.match(html, /assets\/feed-enhancements\.js\?v=524/);
assert.match(serviceWorker, /danzstak-shell-v672/);

console.log("Comment localization checks passed: all 15 languages cover composing, sorting, named replies, accessibility labels, and live language changes.");
