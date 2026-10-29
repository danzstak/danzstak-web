const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const start = source.indexOf("    async function loadNotificationSources()");
const end = source.indexOf("    loadNotificationSources().then", start);
assert.ok(start >= 0 && end > start, "resilient notification loader is missing");
const code = source.slice(start, end);

function response(ok) { return { ok }; }

(async () => {
  let calls = 0;
  let cleared = 0;
  const context = vm.createContext({
    AbortController,
    setTimeout: () => 1,
    clearTimeout: () => { cleared += 1; },
    fetch: async () => {
      const call = calls++;
      if (call < 4) throw new Error("cold start");
      return response(call === 4);
    }
  });
  vm.runInContext(code, context);
  const recovered = await vm.runInContext("loadNotificationSources()", context);
  assert.equal(calls, 8, "a failed initial batch should retry exactly once");
  assert.equal(cleared, 2, "both request-batch deadlines must be cleared");
  assert.equal(recovered[0].status, "fulfilled");
  assert.equal(recovered[0].value.ok, true, "the recovered social notification source is returned");

  let readyCalls = 0;
  const ready = vm.createContext({
    AbortController,
    setTimeout: () => 1,
    clearTimeout() {},
    fetch: async () => { readyCalls += 1; return response(true); }
  });
  vm.runInContext(code, ready);
  await vm.runInContext("loadNotificationSources()", ready);
  assert.equal(readyCalls, 4, "a healthy first batch must not be repeated");
  console.log("Notification loading checks passed: one bounded cold-start retry and no duplicate healthy batch.");
})().catch(error => { console.error(error); process.exitCode = 1; });
