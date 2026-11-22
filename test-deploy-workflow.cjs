"use strict";
// D0 (owner 2026-11-22): the backend deploys from GitHub instead of the owner's CloudShell. These rules keep that safe:
// the deploy workflow starts only by hand, only from main, only in the "production" environment (the owner approves each
// run), signs in to AWS with GitHub's OIDC token (no AWS keys anywhere in .github/), pins every action to a commit, and
// dry-runs by default. The two deploy scripts honour the dry run: nothing in aws-deploy-auth-api.ps1 changes AWS unless it
// sits inside Invoke-Change or an `if (-not $DryRun)` block, and the call-signaling change set executes only when
// DRY_RUN is "false".
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"); // Windows checkouts use CRLF
const workflow = read(".github/workflows/deploy.yml");

// 1. Started by hand only: workflow_dispatch is the only trigger.
const on = workflow.split(/\n(?=\S)/).find(block => block.startsWith("on:"));
assert.ok(on, "the workflow has an on: block");
const triggers = [...on.matchAll(/^  ([a-z_]+):/gm)].map(match => match[1]);
assert.deepEqual(triggers, ["workflow_dispatch"], `only workflow_dispatch starts a deploy (found: ${triggers.join(", ")})`);

// 2. Main only, environment production (the owner is its required reviewer), one deploy at a time.
assert.match(workflow, /\n    if: github\.ref == 'refs\/heads\/main'\n/, "the job runs only for main");
assert.match(workflow, /\n    environment: production\n/, "the job runs in the production environment (owner approval)");
assert.equal((workflow.match(/environment:/g) || []).length, 1, "one environment, production");
assert.match(workflow, /concurrency:\n  group: deploy-production\n  cancel-in-progress: false/, "one deploy at a time, never cancelled half-way");

// 3. Least privilege: an OIDC token and read access to the code, nothing else.
assert.match(workflow, /\npermissions:\n  id-token: write\n  contents: read\n\n/, "permissions are id-token: write and contents: read only");
assert.equal((workflow.replace("id-token: write", "").match(/\b[a-z-]+: write\b/g) || []).length, 0, "no other write permission");

// 4. Inputs: target choice and a dry run that defaults to true.
assert.match(workflow, /      target:\n[\s\S]*?type: choice\n\s+options:\n\s+- auth-api\n\s+- call-signaling\n\s+- both\n/, "target is auth-api | call-signaling | both");
assert.match(workflow, /      dry_run:\n(?:        .*\n)*?        default: true\n(?:        .*\n)*?        type: boolean\n/, "dry_run is a boolean that defaults to true");

// 5. Every action is pinned to a full commit SHA; AWS sign-in is the official action through OIDC.
const uses = [...workflow.matchAll(/uses: ([^\s#]+)/g)].map(match => match[1]);
assert.ok(uses.length >= 3, "checkout, setup-node and the AWS sign-in");
for (const ref of uses) assert.match(ref, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${ref} is pinned to a full commit SHA`);
assert.ok(uses.some(ref => ref.startsWith("aws-actions/configure-aws-credentials@")), "AWS sign-in uses aws-actions/configure-aws-credentials");
assert.match(workflow, /role-to-assume: arn:aws:iam::\$\{\{ vars\.AWS_ACCOUNT_ID \}\}:role\/DanzStak-GitHub-Deploy\n/, "the role comes from the AWS_ACCOUNT_ID repository variable (not a secret, not hard-coded)");
assert.match(workflow, /persist-credentials: false/, "the checkout doesn't keep a GitHub token on disk");
assert.doesNotMatch(workflow, /secrets\./, "the deploy workflow uses no secrets at all");

// 6. Order and dry run: tests first, then sign-in, call-signaling before the Auth API (which reads its outputs), smoke last.
const at = text => { const index = workflow.indexOf(text); assert.ok(index > 0, `the workflow has: ${text}`); return index; };
assert.ok(at("node scripts/run-all-tests.cjs") < at("aws-actions/configure-aws-credentials"), "the regression suite runs before AWS sign-in");
assert.ok(at("aws-actions/configure-aws-credentials") < at("bash scripts/deploy-call-signaling.sh"), "sign-in, then call-signaling");
assert.ok(at("bash scripts/deploy-call-signaling.sh") < at("./aws-deploy-auth-api.ps1 -DryRun"), "call-signaling, then the Auth API");
assert.ok(at("./aws-deploy-auth-api.ps1 -DryRun") < at("node scripts/deploy-smoke.cjs"), "smoke checks after the deploy");
assert.match(workflow, /if \(\$env:DRY_RUN -eq 'true'\) \{\n\s+pwsh -NoProfile -NonInteractive -File \.\/aws-deploy-auth-api\.ps1 -DryRun\n/, "a dry run passes -DryRun to the Auth API script");
assert.match(workflow, /DRY_RUN: \$\{\{ inputs\.dry_run \}\}/, "the dry-run choice reaches both scripts");

// 7. No AWS keys anywhere in .github/ (OIDC only).
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
for (const file of walk(".github")) {
  const text = read(file);
  assert.doesNotMatch(text, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|aws-access-key-id|aws-secret-access-key/i, `${file} holds no AWS keys`);
}

// 8. No account number in the new deploy files (public repo): it comes from ${AWS::AccountId} or the GitHub variable.
for (const file of [".github/workflows/deploy.yml", "infrastructure/github-deploy/bootstrap.yaml", "scripts/deploy-call-signaling.sh", "scripts/deploy-smoke.cjs", "docs/DEPLOY.md"]) {
  assert.doesNotMatch(read(file), /(?<![0-9a-f])\d{12}(?![0-9a-f])/, `${file} contains no 12-digit account number`);
}

// 9. Call-signaling: a change set, printed, executed only when DRY_RUN is "false", previous parameter values kept.
const callSignaling = read("scripts/deploy-call-signaling.sh");
assert.match(callSignaling, /^set -euo pipefail$/m, "the call-signaling script stops on the first failure");
assert.match(callSignaling, /DRY_RUN="\$\{DRY_RUN:-true\}"/, "the call-signaling script dry-runs unless told otherwise");
assert.match(callSignaling, /UsePreviousValue=true/, "every stack parameter keeps its current value");
const execute = callSignaling.indexOf("aws cloudformation execute-change-set");
const dryExit = callSignaling.search(/if \[ "\$DRY_RUN" != "false" \]; then\n\s+aws cloudformation delete-change-set[^\n]*\n[^\n]*\n[^\n]*\n\s+exit 0\n/);
assert.ok(dryExit > 0 && execute > dryExit, "execute-change-set comes only after the dry-run exit");
assert.equal((callSignaling.match(/execute-change-set/g) || []).length, 1, "one place executes the change set");
assert.ok(callSignaling.indexOf("risky=") < dryExit, "replacing or removing a stateful resource stops the run, dry or not");
assert.doesNotMatch(callSignaling, /aws cloudformation deploy\b/, "no `cloudformation deploy` shortcut that skips the review");

// 10. Auth API script: -DryRun exists, the CloudShell run is unchanged, and every AWS change is guarded.
const auth = read("aws-deploy-auth-api.ps1");
assert.match(auth, /^param\(\[switch\]\$EnableDeviceSmsOtp, \[switch\]\$DryRun\)$/m, "aws-deploy-auth-api.ps1 takes -DryRun (and keeps -EnableDeviceSmsOtp)");
assert.match(auth, /\$env:AWS_PAGER = ""/, "no pager: it runs unattended");
assert.doesNotMatch(auth, /Read-Host|\$Host\.UI\.Prompt|-Confirm\b/, "no prompts");
assert.match(auth, /function Invoke-Change \{[\s\S]*?if \(\$DryRun\) \{[\s\S]*?return\n  \}\n  & \$Action\n\}/, "Invoke-Change only runs the change when it isn't a dry run");
// Blank out every guarded block (Invoke-Change "..." { ... } and if (-not $DryRun) { ... }), then no AWS change may remain.
const mutating = /\baws\s+[\w-]+\s+(create-[\w-]+|update-[\w-]+|delete-[\w-]+|put-[\w-]+|attach-[\w-]+|detach-[\w-]+|add-permission|remove-permission|subscribe|set-[\w-]+|tag-[\w-]+|untag-[\w-]+|execute-[\w-]+)\b/g;
const guardStart = /Invoke-Change "[^"\n]*" \{|if \(-not \$DryRun\) \{/g;
let unguarded = auth;
let guarded = 0;
for (const match of auth.matchAll(guardStart)) {
  const open = match.index + match[0].length - 1;
  let depth = 0;
  let close = open;
  for (; close < auth.length; close++) {
    if (auth[close] === "{") depth++;
    else if (auth[close] === "}" && --depth === 0) break;
  }
  assert.ok(close < auth.length, `the guard at character ${match.index} closes`);
  unguarded = unguarded.slice(0, open) + " ".repeat(close - open + 1) + unguarded.slice(close + 1);
  guarded++;
}
const strays = [...unguarded.split("\n").entries()].filter(([, line]) => !/^\s*#/.test(line) && line.match(mutating));
assert.deepEqual(strays.map(([index, line]) => `line ${index + 1}: ${line.trim()}`), [], "every AWS change in aws-deploy-auth-api.ps1 is behind Invoke-Change or if (-not $DryRun)");
assert.ok(guarded >= 25, `the changes are guarded (${guarded} guarded blocks)`);
// The guards hold real changes: the CloudShell run still creates routes, uploads code and updates the access policy.
for (const command of ["aws apigatewayv2 create-route", "aws lambda update-function-code", "aws iam create-policy-version", "aws lambda add-permission", "aws sns subscribe"]) {
  assert.ok(auth.includes(command), `the real run still runs ${command}`);
}
assert.match(auth, /\$summary = "DRY RUN: a real run would make \$\(\$script:PlannedChanges\.Count\) change\(s\)/, "a dry run ends by saying nothing was changed");

console.log(`Deploy workflow checks passed: manual start from main only, environment production (owner approval), OIDC with ${uses.length} SHA-pinned actions and no AWS keys in .github/, dry run by default; call-signaling executes its change set only when DRY_RUN=false; every Auth API change is behind Invoke-Change or a real-run guard.`);
