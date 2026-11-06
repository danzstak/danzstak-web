"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.resolve(file), "utf8");
const reportPath = "docs/DANZSTAK-DEVELOPMENT-REPORT.md";
const report = read(reportPath);

for (const requiredPath of [
  "docs/QUALITY-ASSURANCE-POLICY.md",
  "docs/RELEASE-CHECKLIST.md",
  reportPath,
]) {
  assert.ok(fs.existsSync(requiredPath), `${requiredPath} is required release evidence.`);
}

assert.match(report, /(?:staging|preview)/i, "The development report must identify staging or preview evidence.");
assert.match(report, /(?:test|regression|browser evidence)/i, "The development report must record test evidence.");
assert.match(report, /(?:production unchanged|not deployed|production release)/i, "The development report must state the production boundary.");

const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath && fs.existsSync(eventPath)) {
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const pull = event.pull_request;
  if (pull) {
    const body = String(pull.body || "");
    const branch = String(pull.head?.ref || "");
    assert.ok(!pull.draft, "Production-bound review must be marked ready for review.");
    assert.match(body, /https:\/\/[^\s)]+(?:amplifyapp\.com|staging|preview)/i, "PR body must link an inspectable staging preview.");
    assert.match(body, /(?:test|regression).*(?:pass|success)|(?:pass|success).*(?:test|regression)/is, "PR body must summarize passing tests.");
    assert.match(body, /(?:production (?:is )?unchanged|not deployed|production boundary)/i, "PR body must state that production is unchanged before merge.");
    assert.ok(branch && report.includes(branch), `Development report must name review branch ${branch}.`);
  }
}

const reviewImages = [
  "docs/screenshots/issue-55-epk/epk-320.png",
  "docs/screenshots/issue-55-epk/epk-390.png",
  "docs/screenshots/issue-55-epk/epk-430.png",
  "docs/screenshots/issue-55-epk/epk-1366.png",
];
for (const image of reviewImages) {
  assert.ok(fs.existsSync(image), `${image} is required visual review evidence.`);
  assert.ok(fs.statSync(image).size > 10_000, `${image} is too small to be credible rendered evidence.`);
}

const workflow = read(".github/workflows/review.yml");
for (const check of ["regression", "responsive-accessibility-security", "release-evidence"]) {
  assert.ok(workflow.includes(`${check}:`), `Review workflow must publish required check ${check}.`);
}

console.log("Release evidence checks passed: staged preview, test boundary, responsive captures, and required workflow contexts are present.");
