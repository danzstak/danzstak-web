const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

async function helper(file, startText, endText, invocation, expected) {
  const source = fs.readFileSync(file, "utf8");
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, `${file} request helper must exist`);
  const context = vm.createContext({
    AbortController,
    URL,
    api: "https://api.danzstak.com",
    directApi: "https://api.danzstak.com",
    API: "https://api.danzstak.com",
    t: value => value,
    setTimeout,
    clearTimeout,
    fetch: async () => { throw new TypeError("Failed to fetch"); }
  });
  vm.runInContext(source.slice(start, end), context);
  await assert.rejects(vm.runInContext(invocation, context), expected);
}

(async () => {
  await helper(
    "assets/direct-messages.js",
    "async function directFetch",
    "let activeFilter",
    'directFetch("/messages")',
    /DanzStak cannot connect right now/
  );
  await helper(
    "assets/push-notifications.js",
    "async function api",
    "async function state",
    'api("/push/config")',
    /DanzStak cannot connect right now/
  );
  await helper(
    "assets/incoming-calls.js",
    "async function api",
    "function showCall",
    'api("/calls/events")',
    /DanzStak cannot connect to calls right now/
  );
  await helper(
    "assets/people-search.js",
    "async function peopleFetch",
    "function memberId",
    'peopleFetch("/people?query=sigmund")',
    /DanzStak cannot connect right now/
  );
  await helper("assets/home.js", "async function homeFetch", "legalAgreement.addEventListener", 'homeFetch("/auth/session")', /DanzStak cannot connect right now/);
  await helper("assets/logout.js", "async function logoutFetch", "document.addEventListener", "logoutFetch()", /DanzStak cannot log out right now/);
  await helper("assets/profile.js", "async function profileFetch", "function firstString", 'profileFetch("/profiles")', /DanzStak cannot load this profile right now/);
  await helper("assets/post-sharing.js", "async function shareFetch", "const defaultTribes", 'shareFetch("/secure-posts")', /DanzStak cannot share this post right now/);
  await helper("assets/media-tags.js", "async function tagFetch", "async function patch", 'tagFetch("/friends")', /DanzStak cannot update tags right now/);
  await helper("assets/chat.js", "async function request", "function waitIce", 'request("/calls/directory")', /DanzStak cannot connect to calls right now/);
  await helper("assets/facebook-import.js", "async function importFetch", "function importUploadDeadline", 'importFetch("https://api.danzstak.com/facebook-import")', /DanzStak cannot continue the import right now/);
  await helper("assets/support.js", "async function supportFetch", "message.addEventListener", "supportFetch()", /DanzStak cannot send your support request right now/);
  console.log("Core social network checks passed: account, profile, sharing, tagging, Messages, calls, imports, support, push setup, and member discovery replace raw browser failures with retryable product guidance.");
})().catch(error => { console.error(error); process.exitCode = 1; });
