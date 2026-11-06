"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const frontend = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(template, /async function friendRemove\(event,user\)/, "backend must implement friend removal");
assert.match(template, /accountByMemberId\(memberId\)/, "removal must resolve an opaque member ID server-side");
assert.match(template, /ConditionExpression:'#status = :friends'/, "only an accepted friendship may be removed");
assert.match(template, /TransactItems:\[\{Delete:[\s\S]*?friendEmail:\{S:target\}[\s\S]*?\},\{Delete:[\s\S]*?friendEmail:\{S:user\.email\}/, "both friendship directions must be removed atomically");
assert.match(template, /POST \/friends\/remove/, "API Gateway and the handler must expose the removal route");
assert.doesNotMatch(frontend.slice(frontend.indexOf("removeAcceptedFriend"), frontend.indexOf("function renderOnlineFriendList")), /contactEmail|person\.email/, "the removal request must not send a private account email");

const functionStart = frontend.indexOf("async function removeAcceptedFriend(");
const functionEnd = frontend.indexOf("function renderOnlineFriendList", functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, "friend-removal client must remain testable");
const requests = [];
const feedback = [];
const workspaces = [];
let decision = null;
let refreshes = 0;
const button = {
  dataset: {}, disabled: false, isConnected: true,
  label: "Remove Mobile Friend from your friends", title: "",
  getAttribute(name) { return name === "aria-label" ? this.label : ""; },
  setAttribute(name, value) { if (name === "aria-label") this.label = value; }
};
const context = vm.createContext({
  openChoiceDialog: async () => decision,
  feedTranslate: value => value,
  friendActionFetch: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
  renderWorkspace: name => workspaces.push(name),
  refreshPeopleLists: () => { refreshes++; },
  danzstakShowFeedback: (message, options) => feedback.push({ message, options })
});
vm.runInContext(frontend.slice(functionStart, functionEnd), context);
context.button = button;

(async () => {
  const memberId = "22222222-2222-4222-8222-222222222222";
  assert.equal(await vm.runInContext(`removeAcceptedFriend("${memberId}", button)`, context), false);
  assert.equal(requests.length, 0, "cancelling confirmation must not call the API");

  decision = "remove";
  const success = vm.runInContext(`removeAcceptedFriend("${memberId}", button)`, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].args[1].body), { memberId });
  requests[0].resolve({ ok: true, json: async () => ({ removed: true }) });
  assert.equal(await success, true);
  assert.deepEqual(workspaces, ["Friends"]);
  assert.equal(refreshes, 1);
  assert.equal(feedback.at(-1).message, "Friend removed.");

  const keysMatch = i18n.match(/const friendRemovalKeys=(\[[^;]+\]);/);
  const translationsMatch = i18n.match(/const friendRemovalGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(friendRemovalGuidance\)\)/);
  assert.ok(keysMatch && translationsMatch, "friend-removal translations must remain inspectable");
  const localeContext = vm.createContext({ result: null });
  vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, localeContext);
  const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "ar", "fil", "hi", "vi", "th", "id"];
  for (const language of languages) {
    assert.equal(localeContext.result.translations[language].length, localeContext.result.keys.length, `${language} must translate friend removal completely`);
    assert.ok(localeContext.result.translations[language].every(value => String(value).trim()), `${language} translations cannot be blank`);
  }

  assert.match(frontend, /className = "friend-workspace-actions"/);
  assert.match(frontend, /remove\.dataset\.icon = "trash"/);
  assert.match(styles, /\.friend-workspace-actions\{display:flex;align-items:center;gap:6px;flex-wrap:nowrap\}/);
  assert.match(styles, /\.friend-remove-action\.ds-icon-button\{[^}]*min-height:44px/, "mobile remove control must retain a 44px touch target");
  assert.match(feed, /feed-enhancements\.js\?v=528/);
  assert.match(feed, /feed-enhancements\.css\?v=499/);
  console.log("Friend-removal checks passed: opaque identity, atomic relationship cleanup, confirmation, recovery, localization, and mobile controls.");
})().catch(error => { console.error(error); process.exitCode = 1; });
