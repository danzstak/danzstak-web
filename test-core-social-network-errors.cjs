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
    directApi: "https://api.danzstak.com",
    API: "https://api.danzstak.com",
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
  console.log("Core social network checks passed: Messages, push setup, and calls replace raw browser failures with retryable product guidance.");
})().catch(error => { console.error(error); process.exitCode = 1; });
