"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const head = "a".repeat(40);
const branch = "codex/issue-55-epk";
const preview = "https://codex-issue-55-epk.d31oovi2mos5iz.amplifyapp.com/epk.html";
const body = `## Source SHA\n\n${head}\n\n## Preview / staging\n\n${preview}\n\nAWS Amplify branch ${branch}, DEVELOPMENT job 3.\n\n## Functional tests\n\nComplete regression and browser tests passed in the linked CI run without waived failures.\n\n## Responsive / accessibility evidence\n\nRendered 320px, 390px, 430px and 1366px; keyboard focus and touch-target checks passed.\n\n## Security / privacy review\n\nAuthentication, account isolation, XSS, private data, URLs and secret handling were reviewed.\n\n## UX review\n\nThe result remains Facebook-familiar while using original DANZSTAK branding.\n\n## Deployment state\n\nStaging only — production has not changed.\n\n## Rollback\n\nDelete the isolated preview branch and revert the reviewed commit without deleting user data or drafts.\n\n## Independent reviewer verdict\n\nUNVERIFIED — an authorized independent human review is required.\n\n## Owner production decision\n\nAUTHORIZED — subject to all protected release gates passing.\n`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "danzstak-release-evidence-"));
const eventPath = path.join(dir, "event.json");
const run = candidate => {
  fs.writeFileSync(eventPath, JSON.stringify({ pull_request: { draft:false, body:candidate, head:{ sha:head, ref:branch } } }));
  return spawnSync(process.execPath, ["scripts/verify-pr-release-evidence.cjs"], { encoding:"utf8", env:{ ...process.env, NODE_ENV:"test", GITHUB_EVENT_PATH:eventPath } });
};

try {
  assert.equal(run(body).status, 0, "complete exact-head staging evidence must pass");
  assert.notEqual(run(body.replace(head, "b".repeat(40))).status, 0, "stale source evidence must fail");
  assert.notEqual(run(body.replace(preview, "https://danzstak.com/epk.html")).status, 0, "production cannot masquerade as staging");
  assert.notEqual(run(body.replace("job 3", "deployment complete")).status, 0, "staging evidence must identify the Amplify job");
} finally {
  fs.rmSync(dir, { recursive:true, force:true });
}

console.log("Release governance checks passed: exact head, branch-bound staging, provenance, and negative cases are enforced.");
