const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

async function verify(file, startText, endText, invocation, expected) {
  const source = fs.readFileSync(file, "utf8");
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, `${startText} must exist in ${file}`);
  const context = vm.createContext({
    AbortController,
    setTimeout,
    clearTimeout,
    profileTranslate: value => value,
    engagementApi: "https://api.danzstak.com",
    fetch: async () => { throw new TypeError("Failed to fetch"); }
  });
  vm.runInContext(source.slice(start, end), context);
  await assert.rejects(vm.runInContext(invocation, context), expected);
}

(async () => {
  await verify("assets/feed-enhancements.js", "async function friendActionFetch", "function renderOnlineFriendList", 'friendActionFetch("/friends")', /cannot connect to friends/);
  await verify("assets/feed-enhancements.js", "async function groupFetch", "async function migrateLocalGroups", 'groupFetch("/groups")', /cannot connect to Tribes/);
  await verify("assets/feed-enhancements.js", "async function settingsFetch", "const heading", "settingsFetch()", /cannot load account settings/);
  await verify("assets/feed-enhancements.js", "async function postActionFetch", "const changedPostPreferenceFields", 'postActionFetch("/secure-posts")', /cannot update this post/);
  await verify("assets/feed-enhancements.js", "async function engagementFetch", "async function loadEngagement", 'engagementFetch("/engagement")', /cannot update this post/);
  await verify("assets/feed-enhancements.js", "async function reelFetch", "let internalReelsVersion", 'reelFetch("/stories")', /cannot load The Roll/);
  await verify("assets/profile-editor.js", "async function profileFetch", "let viewingOtherProfile", 'profileFetch("https://api.danzstak.com/profiles")', /cannot update your profile/);
  console.log("Feed network checks passed: friends, Tribes, settings, posts, engagement, The Roll, and profile editing replace raw browser failures with retry guidance.");
})().catch(error => { console.error(error); process.exitCode = 1; });
