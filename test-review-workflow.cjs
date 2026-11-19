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
assert.equal(servers.length, 2, "both browser jobs start scripts/static-server.cjs");
const diagnostics = text.match(/NODE_OPTIONS: --require \.\/scripts\/check-diagnostics\.cjs/g) || [];
assert.equal(diagnostics.length, 2, "both browser-check steps load scripts/check-diagnostics.cjs");
for (const file of ["scripts/static-server.cjs", "scripts/check-diagnostics.cjs"]) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`);

console.log(`Review workflow checks passed: ${listed.length} checks in ${blocks.filter(block => block.lines.some(line => /run-checks\.ps1/.test(line))).length} steps run through scripts/run-checks.ps1, and no step runs several checks directly.`);
