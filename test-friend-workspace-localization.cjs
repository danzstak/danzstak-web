const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const start = feed.indexOf('if (name === "Friends")');
const end = feed.indexOf('if (["Photos", "Videos"].includes(name))', start);
const workspace = feed.slice(start, end);

for (const text of [
  "Search friends",
  "Message (SYNC)", "More", "Status unavailable",
  "No matching friends", "No friend requests"
]) {
  assert.ok(workspace.includes(`feedTranslate("${text}")`), `${text} must use the translation layer`);
  assert.ok(i18n.includes(`"${text}"`), `${text} must have dictionary coverage`);
}
for (const text of ["Confirm", "Delete"]) {
  assert.ok(workspace.includes(`"${text}"`), `${text} must remain an action label`);
  assert.ok(i18n.includes(`"${text}"`), `${text} must have dictionary coverage`);
}
assert.match(workspace, /button\.textContent = feedTranslate\(label\)/, "request action labels use translations");
for (const text of ["All Friends", "Online", "Requests", "Find Friends"]) {
  assert.ok(workspace.includes(`"${text}"`), `${text} must remain a tab label`);
  assert.ok(i18n.includes(`"${text}"`), `${text} must have dictionary coverage`);
}
assert.match(workspace, /feedTranslate\(label\)/, "dynamic tab labels pass through the translation layer");
for (const text of ["Amici", "Richieste", "Trova amici", "Cerca amici", "Conferma", "Elimina"])
  assert.ok(i18n.includes(`"${text}"`), `Italian users must receive ${text}`);
assert.doesNotMatch(workspace, /textContent = "(?:All Friends|Requests|Find Friends|Message \(SYNC\)|Confirm|Delete)"/, "Friends must not bypass translations");

console.log("Friend workspace localization checks passed: navigation, states, actions and Italian guidance use i18n.");
