"use strict";

// Guards .github/workflows/review.yml against checks that run but never count.
// A pwsh `run:` block that lists several commands only fails on the LAST command's exit code. That hid nine failing
// browser checks in a green release-train run (Actions run 44503523581). Any step that runs more than one check must
// go through scripts/run-checks.ps1, which runs them all, then fails if any failed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "review.yml"), "utf8").split(/\r?\n/);
const runner = fs.readFileSync(path.join(root, "scripts", "run-checks.ps1"), "utf8");

// Collect every `run: |` block with its first line number.
const blocks = [];
for (let index = 0; index < workflow.length; index += 1) {
  const match = workflow[index].match(/^(\s*)run:\s*\|\s*$/);
  if (!match) continue;
  const indent = match[1].length;
  const lines = [];
  let next = index + 1;
  for (; next < workflow.length; next += 1) {
    const line = workflow[next];
    if (line.trim() && line.match(/^\s*/)[0].length <= indent) break;
    lines.push(line);
  }
  blocks.push({ line: index + 1, lines });
  index = next - 1;
}
assert.ok(blocks.length >= 4, "review.yml run blocks were not found");

// A direct check invocation: `node <file>` or a repository .ps1 script.
const direct = /^\s*(?:&\s*)?(?:node\s+\S|\.[\\/][\w./\\-]+\.ps1\b)/;
const listed = [];
for (const block of blocks) {
  const invocations = block.lines.filter(line => direct.test(line));
  assert.ok(invocations.length <= 1, `review.yml line ${block.line}: ${invocations.length} checks run directly in one step, so only the last one can fail it. List them in scripts/run-checks.ps1 -Checks @(...) instead:\n${invocations.join("\n")}`);
  const usesRunner = block.lines.some(line => /\.[\\/]scripts[\\/]run-checks\.ps1\s+-Checks\s+@\(/.test(line));
  if (!usesRunner) continue;
  for (const line of block.lines) {
    const entry = line.match(/^\s*'([^']+)'\s*$/);
    if (entry) listed.push({ line: block.line, entry: entry[1] });
  }
}
assert.ok(listed.length >= 40, `expected the review checks to run through scripts/run-checks.ps1, found ${listed.length}`);

// Every listed check exists and is listed once per job step.
const seen = new Set();
for (const { line, entry } of listed) {
  const file = entry.split(/\s+/)[0].replace(/^\.[\\/]/, "").replace(/\\/g, "/");
  assert.ok(/\.(c?js|mjs|ps1)$/.test(file), `review.yml line ${line}: ${entry} is not a .cjs/.mjs/.js/.ps1 check`);
  assert.ok(fs.existsSync(path.join(root, file)), `review.yml line ${line}: ${file} does not exist`);
  const key = `${line}:${entry}`;
  assert.ok(!seen.has(key), `review.yml line ${line}: ${entry} is listed twice`);
  seen.add(key);
}

// The runner keeps going after a failure and fails at the end.
assert.match(runner, /foreach \(\$check in \$Checks\)/, "run-checks.ps1 must run every listed check");
assert.match(runner, /\$global:LASTEXITCODE = 0/, "run-checks.ps1 must reset the exit code before each check");
assert.match(runner, /-NoProfile -NonInteractive -File \$script/, "run-checks.ps1 must run .ps1 checks in their own pwsh process");
assert.match(runner, /catch \{[\s\S]*?\$code = 1/, "run-checks.ps1 must count a check that throws as failed");
assert.match(runner, /if \(\$failed\.Count -gt 0\) \{\s*throw /, "run-checks.ps1 must fail the step when any check failed");
const loop = runner.slice(runner.indexOf("foreach ($check in $Checks)"), runner.indexOf("$failed = @("));
// No statement inside the loop may leave it early (the one throw for a missing file is caught and counted).
assert.doesNotMatch(loop, /(?:^|[;{])\s*(?:exit|break|return)\b/m, "run-checks.ps1 must not stop at the first failing check");
assert.doesNotMatch(loop, /(?:^|[;{])\s*throw\b(?![^\n]*Check file not found)/m, "run-checks.ps1 must not stop at the first failing check");

// The regression suite (review.yml "regression" job) also goes through the runner, and runs the runner's own test.
const regressions = fs.readFileSync(path.join(root, "test-regressions.ps1"), "utf8");
assert.match(regressions, /scripts\/run-checks\.ps1'\) -Checks \$checks/, "test-regressions.ps1 must run its checks through scripts/run-checks.ps1");
assert.match(regressions, /'test-run-checks\.ps1'/, "test-regressions.ps1 must run test-run-checks.ps1");
assert.ok(fs.existsSync(path.join(root, "test-run-checks.ps1")), "test-run-checks.ps1 is missing");

// Directive F0 (2026-11-19): browser checks are served by scripts/static-server.cjs (HTTP/1.1 keep-alive, backlog 511),
// not python -m http.server (HTTP/1.0, backlog 5, file types from the Windows registry), and a failing browser check
// prints what the browser saw (scripts/check-diagnostics.cjs).
const text = workflow.join("\n");
assert.doesNotMatch(text, /Start-Process python|'http\.server'/, "review.yml must serve the site with scripts/static-server.cjs, not python -m http.server");
const servers = text.match(/Start-Process node -ArgumentList '\.\\scripts\\static-server\.cjs','\d+'/g) || [];
assert.equal(servers.length, 3, "every browser job starts scripts/static-server.cjs");
const diagnostics = text.match(/NODE_OPTIONS: --require \.\/scripts\/check-diagnostics\.cjs/g) || [];
assert.equal(diagnostics.length, 3, "every browser-check step loads scripts/check-diagnostics.cjs");
for (const file of ["scripts/static-server.cjs", "scripts/check-diagnostics.cjs"]) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);

// L1 (2026-11-23): browser checks never reach the live API. A page served from 127.0.0.1 that a check didn't fully mock
// called api.danzstak.com for real, and its 401s looked exactly like the member failure the access logs are there to
// catch. Every job that starts a browser blocks the API host before its server and checks start.
const jobs = text.split(/\n(?=  [\w-]+:\n)/).filter(job => /^  [\w-]+:\n/.test(job));
const browserJobs = jobs.filter(job => /npm install[^\n]*\bplaywright@/.test(job));
assert.equal(browserJobs.length, 3, "three review jobs start a browser");
for (const job of browserJobs) {
  const name = job.match(/^  ([\w-]+):/)[1];
  const block = job.indexOf(".\\scripts\\block-live-api.ps1");
  assert.ok(block > 0, `${name}: runs scripts/block-live-api.ps1`);
  assert.ok(block < job.indexOf("static-server.cjs") && block < job.indexOf("run-checks.ps1"), `${name}: blocks the live API before the server and the checks start`);
}
// CI-FLAKE (2026-11-26): one job of 92 signed-in checks ran ~35 minutes and the Windows runner ran out of ephemeral ports
// (net::ERR_NO_BUFFER_SPACE, a stylesheet never loaded, a layout assertion failed). The signed-in checks are split over
// two runners, every browser job widens the port range before its checks and reports connection states afterwards, and
// a local page file that fails for a network reason is named first (scripts/check-diagnostics.cjs).
for (const job of browserJobs) {
  const name = job.match(/^  ([\w-]+):/)[1];
  const prepare = job.indexOf(".\\scripts\\ci-network.ps1 -Prepare");
  assert.ok(prepare > 0 && prepare < job.indexOf("run-checks.ps1"), `${name}: widens the runner's ports before the checks (scripts/ci-network.ps1 -Prepare)`);
  assert.match(job, /name: Report the runner's network\n\s+if: always\(\)\n\s+shell: pwsh\n\s+run: \.\\scripts\\ci-network\.ps1 -Report/, `${name}: reports connection states even when a check failed`);
  const minutes = Number((job.match(/timeout-minutes: (\d+)/) || [])[1]);
  assert.ok(minutes > 0 && minutes <= 30, `${name}: a browser job stays under 30 minutes (split it rather than raise the limit)`);
}
const accountJobs = browserJobs.filter(job => /^  browser-account-security(-2)?:/.test(job));
assert.equal(accountJobs.length, 2, "the signed-in checks run on two runners");
const accountChecks = accountJobs.map(job => (job.match(/^\s*'\.\\browser-checks\\[^']+'\s*$/gm) || []).length);
assert.ok(accountChecks.every(count => count >= 20 && count <= 60), `each signed-in job runs a fair share of the checks: ${accountChecks.join(" + ")}`);
const network = fs.readFileSync(path.join(root, "scripts", "ci-network.ps1"), "utf8");
assert.match(network, /netsh int ipv4 set dynamicport tcp start=10000 num=55536/, "ci-network.ps1 widens the IPv4 ephemeral range");
assert.match(network, /netsh int ipv6 set dynamicport tcp start=10000 num=55536/, "ci-network.ps1 widens the IPv6 ephemeral range");
assert.match(network, /throw "The ephemeral TCP port range did not widen/, "ci-network.ps1 fails the step when the range didn't change");
const diagnosticsSource = fs.readFileSync(path.join(root, "scripts", "check-diagnostics.cjs"), "utf8");
assert.match(diagnosticsSource, /ERR_\(NO_BUFFER_SPACE\|/, "check-diagnostics.cjs treats ERR_NO_BUFFER_SPACE as the runner's network");
assert.match(diagnosticsSource, /page asset failed to load: /, "check-diagnostics.cjs names a page file that failed to load");

const blocker = fs.readFileSync(path.join(root, "scripts", "block-live-api.ps1"), "utf8");
assert.match(blocker, /\$names = @\('api\.danzstak\.com'\)/, "block-live-api.ps1 blocks api.danzstak.com");
assert.match(blocker, /"0\.0\.0\.0 \$name"; ":: \$name"/, "both IPv4 and IPv6 point at a dead address");
assert.match(blocker, /if \(\$LASTEXITCODE -ne 0\) \{ throw /, "the step fails when the API still resolves");
assert.doesNotMatch(fs.readFileSync(path.join(root, ".github", "workflows", "live-check.yml"), "utf8"), /block-live-api/, "the live check keeps its real network");

console.log(`Review workflow checks passed: ${listed.length} checks in ${blocks.filter(block => block.lines.some(line => /run-checks\.ps1/.test(line))).length} steps run through scripts/run-checks.ps1, and no step runs several checks directly.`);
