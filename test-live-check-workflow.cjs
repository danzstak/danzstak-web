"use strict";
// Directive F26: live checks Claude can run. The cloud session can't reach danzstak.com, so GitHub Actions checks the live
// site every 30 minutes, after each push to main and on demand: main's service worker is published (waiting for Amplify
// after a push), the public browser checks pass against https://danzstak.com, screenshots are kept, and a failure opens
// or updates one "Live check failing" issue. Least privilege: read the code, write issues, nothing else.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const workflow = fs.readFileSync(".github/workflows/live-check.yml", "utf8");
assert.match(workflow, /schedule:\n\s+- cron: "\*\/30 \* \* \* \*"/, "every 30 minutes");
assert.match(workflow, /push:\n\s+branches: \[main\]/, "after each push to main");
assert.match(workflow, /workflow_dispatch: \{\}/, "on demand");
assert.match(workflow, /permissions:\n\s+contents: read\n\s+issues: write\n\n/, "only read the code and write the one issue");
assert.match(workflow, /DANZSTAK_BASE_URL: https:\/\/danzstak\.com/, "the browser checks run against the live site");
assert.match(workflow, /node \.\\scripts\\verify-live-pwa\.cjs/, "the published service worker is main's");
assert.match(workflow, /\$attempts = if \('\$\{\{ github\.event_name \}\}' -eq 'push'\) \{ 20 \} else \{ 1 \}/, "after a push it waits for Amplify to publish");
assert.match(workflow, /if: always\(\)\n\s+uses: actions\/upload-artifact@v4/, "screenshots are kept even when a check fails");
assert.match(workflow, /if: failure\(\)\n\s+uses: actions\/github-script@v7/, "a failure opens or updates the issue");
assert.match(workflow, /const title = "Live check failing";[\s\S]*issue\.title === title && !issue\.pull_request[\s\S]*createComment[\s\S]*issues\.create/, "one issue: updated, not duplicated");
assert.doesNotMatch(workflow, /secrets\./, "no secrets: the live checks are public and mock the API");

const checks = [...workflow.matchAll(/'\.\\browser-checks\\([\w-]+\.cjs)'/g)].map(match => match[1]);
assert.ok(checks.length >= 8, `a real set of public checks (${checks.length})`);
for (const check of checks) {
  const source = fs.readFileSync(`browser-checks/${check}`, "utf8");
  assert.match(source, /process\.env\.DANZSTAK_BASE_URL/, `${check} reads the site address, so it checks the live site (not a copy of the files)`);
  assert.match(source, /route\("https:\/\/api\.danzstak\.com\/\*\*"/, `${check} mocks the API: no member data is read or changed on the live site`);
}
console.log(`Live check workflow checks passed: every 30 min, after each push to main (waits for Amplify) and on demand; ${checks.length} public browser checks against danzstak.com with the API mocked; screenshots kept; one "Live check failing" issue; read + issues permissions only.`);
