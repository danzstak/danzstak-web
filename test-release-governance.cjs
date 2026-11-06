"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const workflow = fs.readFileSync(".github/workflows/review.yml", "utf8");
const template = fs.readFileSync(".github/pull_request_template.md", "utf8");
const governance = fs.readFileSync("docs/RELEASE-GOVERNANCE.md", "utf8");
const verifier = fs.readFileSync("scripts/verify-pr-release-evidence.cjs", "utf8");
const reconciliation = fs.readFileSync("docs/RELEASE-RECONCILIATION-2026-11-05.md", "utf8");
const browserProof = fs.readFileSync("browser-checks/original-feed-art-direction.cjs", "utf8");

for (const check of ["regression", "responsive-accessibility-security", "release-evidence"]) {
  assert.match(workflow, new RegExp(`^  ${check}:`, "m"), `review workflow must expose required ${check} check`);
}
assert.match(workflow, /playwright@1\.56\.1/, "browser review runtime must be pinned");
assert.match(workflow, /original-feed-art-direction\.cjs/, "review must render real responsive pages");
assert.match(browserProof, /\[320, 360, 390, 430, 1366\]/, "browser proof must cover all required phone widths and desktop");
for (const heading of ["Source SHA", "Preview / staging", "Functional tests", "Responsive / accessibility evidence", "Security / privacy review", "UX review", "Deployment state", "Rollback", "Independent reviewer verdict", "Owner production decision"]) {
  assert.ok(template.includes(`## ${heading}`), `PR template must require ${heading}`);
}
assert.match(verifier, /pull\.head\.sha/, "evidence gate must bind evidence to the exact head SHA");
assert.match(governance, /one approving review from an authorized human other than the change author/i, "governance must require independent human approval");
assert.match(governance, /explicit owner go\/no-go/i, "governance must keep the final production decision with the owner");
assert.match(governance, /Block force pushes and deletions/i, "owner setup must prevent destructive branch history changes");
assert.match(governance, /protected `production` GitHub Environment/i, "production credentials must be approval-gated");
for (const job of [896, 904, 906, 908, 909, 911]) assert.match(reconciliation, new RegExp(`\\| ${job} \\|`), `release reconciliation must include Amplify job ${job}`);
assert.match(reconciliation, /no repository rulesets/i, "protection audit must record the observed missing ruleset");

const head = "a".repeat(40);
const validBody = `## Source SHA\n\n${head}\n\n## Preview / staging\n\nhttps://preview.danzstak.invalid/feed.html\n\n## Functional tests\n\nComplete regression tests passed in the linked CI run.\n\n## Responsive / accessibility evidence\n\nRendered 320px, 360px, 390px, and 430px plus desktop; keyboard checks passed.\n\n## Security / privacy review\n\nAuthentication, account isolation, XSS, private data, and secret handling were reviewed.\n\n## UX review\n\nThe result remains Facebook-familiar while using original DANZSTAK branding.\n\n## Deployment state\n\nStaging only — production has not changed.\n\n## Rollback\n\nRevert the reviewed commit to the named previous known-good release without deleting user data.\n`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "danzstak-release-gate-"));
const eventPath = path.join(temp, "event.json");
const runGate = body => {
  fs.writeFileSync(eventPath, JSON.stringify({ pull_request: { draft: false, body, head: { sha: head } } }));
  return spawnSync(process.execPath, ["scripts/verify-pr-release-evidence.cjs"], { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_PATH: eventPath } });
};
assert.equal(runGate(validBody).status, 0, "complete evidence bound to the current SHA must pass");
assert.notEqual(runGate(validBody.replace(head, "b".repeat(40))).status, 0, "stale SHA evidence must fail");
assert.notEqual(runGate(validBody.replace("https://preview.danzstak.invalid/feed.html", "https://danzstak.com/")).status, 0, "production must not masquerade as staging");
fs.rmSync(temp, { recursive: true, force: true });

console.log("Release governance checks passed: PR evidence, independent review, responsive/security CI, protected production, and owner approval are explicit.");
