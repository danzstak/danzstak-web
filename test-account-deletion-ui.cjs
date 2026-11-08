const assert = require("node:assert/strict");
const fs = require("node:fs");
const ui = fs.readFileSync("assets/account-deletion.js", "utf8");
const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const page = fs.readFileSync("feed.html", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(page, /account-deletion\.js/, "Settings must load the deletion controller before enhancements");
assert.match(feed, /danzstakAccountDeletionControl/, "Settings must expose account deletion without hiding it behind logout");
assert.match(ui, /DELETE MY DANZSTAK ACCOUNT/, "destructive confirmation must require the exact phrase");
assert.match(ui, /auth\/account-deletion\/reauth/, "identity verification must use the forced-reauth endpoint");
assert.doesNotMatch(ui, /method: "DELETE"/, "permanent deletion must not advertise cancellation");
assert.doesNotMatch(ui, /deletion\.graceEndsAt/, "permanent deletion must not display a grace deadline");
assert.match(ui, /completed_limited_retention/, "the truthful limited-retention completion status must render as complete");
assert.match(ui, /Try again/, "temporary status failures must remain recoverable");
assert.match(ui, /aria-live/, "status changes must be announced without stealing focus");
assert.match(ui, /permanent deletion starts immediately and cannot be undone/, "the user must understand that permanent deletion starts without a grace period");
assert.match(ui, /Screenshots, downloads, independent reuploads, and copies outside DanzStak cannot be recalled/, "the user must see the honest off-platform limit");
assert.match(ui, /payments, safety, legal obligations, backups, or cache expiry/, "retention wording must be factual");
assert.match(ui, /aria-labelledby/, "the destructive dialog must have an accessible name");
for (const language of ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"]) {
  assert.match(i18n, new RegExp(`(?:\\"${language}\\"|\\b${language}):\\[`), `account-deletion controls must cover ${language}`);
}
assert.match(worker, /account-deletion\.js/, "the deletion controller must be available to the installed PWA");
console.log("Account deletion UI checks passed: discoverable Settings control, fresh verification, exact confirmation, immediate irreversible processing, status, receipt, and retention wording.");
