"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/invite-friends.js", "utf8");
const styles = fs.readFileSync("assets/invite-friends.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");
const profile = fs.readFileSync("profile.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

const sandbox = {
  navigator: { userAgent: "Android", clipboard: {} },
  document: { addEventListener() {} },
  window: {},
  HTMLElement: class HTMLElement {},
  URL,
  console
};
sandbox.window = sandbox;
vm.runInNewContext(source, sandbox, { filename: "invite-friends.js" });
const invite = sandbox.danzstakInviteFriends;

assert.equal(invite.joinUrl, "https://danzstak.com/");
const android = invite.buildSmsHref("Ciao Sigmund!", "Mozilla/5.0 (Linux; Android 15)");
const ios = invite.buildSmsHref("Ciao Sigmund!", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)");
assert.match(android, /^sms:\?body=/, "Android uses the supported query separator");
assert.match(ios, /^sms:&body=/, "iOS uses the supported body separator");
assert.equal(decodeURIComponent(android.split("body=")[1]), "Ciao Sigmund! https://danzstak.com/");
assert.doesNotMatch(android, /^sms:[+\d]/, "DanzStak never chooses or stores a recipient number");

for (const html of [feed, messages, profile]) {
  assert.match(html, /assets\/invite-friends\.js\?v=1/);
  assert.match(html, /assets\/invite-friends\.css\?v=1/);
}
assert.match(feed, /assets\/feed-enhancements\.js\?v=533/);
assert.match(messages, /data-invite-friends/);
assert.match(profile, /assets\/profile-sharing\.js\?v=417/);
assert.match(worker, /danzstak-shell-v696/);
assert.match(worker, /assets\/invite-friends\.js/);
assert.match(worker, /assets\/invite-friends\.css/);

for (const language of ["es","fr","de","pt","it","ko","ja","zh-Hans","zh-Hant","fil","hi","vi","th","id"]) {
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:"${language.replace("-", "\\-")}"|${language.replace("-", "\\-")}):\\[`);
  assert.match(i18n.slice(i18n.indexOf("const inviteFriendTranslations=")), pattern, `invite copy exists for ${language}`);
}
assert.match(source, /navigator\.share/);
assert.match(source, /navigator\.clipboard\.writeText\(JOIN_URL\)/);
assert.match(source, /DANZSTAK does not read your contacts/);
assert.doesNotMatch(source, /contacts\.get|selectContact|addressBook/i);
assert.match(styles, /min-height:44px/);

console.log("Invite-friend checks passed: localized opt-in SMS, share-sheet and copy-link handoff without recipient collection.");
