#!/usr/bin/env node
"use strict";
// Runs the whole local regression suite on any machine with Node: every test-*.cjs, then the PowerShell suites
// (test-release-verification.ps1, test-site.ps1, test-infrastructure.ps1) when pwsh or powershell is installed.
// Prints only failures and a final DONE line, so long runs stay readable. Exit code 1 if anything failed.
//
//   node scripts/run-all-tests.cjs            # everything
//   node scripts/run-all-tests.cjs epk        # only test-*.cjs whose name contains "epk" (PowerShell suites skipped)
//
// Why not test-regressions.ps1? Windows PowerShell 5.1 treats any stderr line from node as a failure.
// First run `npm ci --ignore-scripts` in infrastructure/auth-api so the AWS SDK tests can load.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const filter = process.argv[2] || "";
const tests = fs.readdirSync(root).filter(name => /^test-.*\.cjs$/.test(name) && name.includes(filter)).sort();
const shell = ["pwsh", "powershell"].find(cmd => spawnSync(cmd, ["-NoProfile", "-Command", "exit 0"], { stdio: "ignore" }).status === 0);
const failures = [];
const tail = text => String(text || "").trim().split(/\r?\n/).slice(-8).join("\n");

for (const name of tests) {
  const run = spawnSync(process.execPath, [name], { cwd: root, encoding: "utf8", timeout: 300000 });
  if (run.status !== 0) { failures.push(name); console.log(`FAIL ${name}\n${tail(run.stderr || run.stdout)}\n`); }
}
if (!filter) {
  if (!shell) console.log("SKIP PowerShell suites: install pwsh to run test-release-verification.ps1, test-site.ps1 and test-infrastructure.ps1.");
  else for (const name of ["test-release-verification.ps1", "test-site.ps1", "test-infrastructure.ps1"]) {
    const run = spawnSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", name], { cwd: root, encoding: "utf8", timeout: 300000 });
    if (run.status !== 0) { failures.push(name); console.log(`FAIL ${name}\n${tail(run.stderr || run.stdout)}\n`); }
  }
}
console.log(`DONE ${tests.length} test-*.cjs${filter ? ` matching "${filter}"` : ""}, ${failures.length} failed${failures.length ? `: ${failures.join(", ")}` : ""}`);
process.exitCode = failures.length ? 1 : 0;
