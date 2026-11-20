"use strict";
// Owner's CloudShell deploy, 2026-11-20, stopped twice in aws-deploy-auth-api.ps1:
// 1. "Join-Path: Cannot bind argument to parameter 'Path' because it is null": $env:TEMP is Windows-only; CloudShell
//    (Linux) has none. Every temp path now comes from $TempRoot, which falls back to the system temp folder.
// 2. "LimitExceeded … Maximum policy size of 10240 bytes exceeded for role DANZSTAK-Auth-API-role": a role's inline
//    policies share one 10,240-character quota. The Auth API's permissions are a managed policy now (its own 6,144
//    quota), attached before the old inline copy is removed, so access never lapses.
// test-infrastructure.ps1 builds the policy with PowerShell and checks it stays under 6,144 characters.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8").replace(/\r\n/g, "\n");

assert.match(deploy, /\$TempRoot = if \(\$env:TEMP\) \{ \$env:TEMP \} else \{ \[IO\.Path\]::GetTempPath\(\) \}/, "a temp folder on Linux too");
assert.doesNotMatch(deploy.replace("if ($env:TEMP) { $env:TEMP }", ""), /\$env:TEMP/, "no other $env:TEMP use");

assert.doesNotMatch(deploy, /put-role-policy/, "no inline policy writes (they share the role's 10,240-character quota)");
assert.match(deploy, /\$accessPolicyName = "DanzStakAuthApiAccess"/);
const create = deploy.indexOf("aws iam create-policy --policy-name $accessPolicyName"), version = deploy.indexOf("aws iam create-policy-version --policy-arn $accessPolicyArn --policy-document \"file://$Policy\" --set-as-default");
const attach = deploy.indexOf("aws iam attach-role-policy --role-name $RoleName --policy-arn $accessPolicyArn");
const removeInline = deploy.indexOf("aws iam delete-role-policy --role-name $RoleName --policy-name DanzStakPostAuthorization");
const detachDailies = deploy.indexOf("aws iam detach-role-policy --role-name $RoleName --policy-arn \"arn:aws:iam::$($identity.Account):policy/DanzStakPostDailies\"");
assert.ok(create > 0 && version > 0, "the managed policy is created, or updated with a new default version");
assert.ok(attach > Math.max(create, version), "attached after it is created or updated");
assert.ok(removeInline > attach && detachDailies > attach, "the old inline copy and the Dailies policy come off only after the managed one is attached");
assert.match(deploy, /if \(@\(\$versions\.Versions\)\.Count -ge 5 -and \$older\.Count -gt 0\) \{\s*\n\s*aws iam delete-policy-version/, "the 5-version limit is respected");
assert.ok(deploy.indexOf(removeInline > 0 ? "aws iam delete-role-policy" : "") < deploy.indexOf("aws lambda update-function-code"), "permissions are settled before the new code goes live");
console.log("Auth API deploy policy checks passed: a temp folder on Linux (CloudShell), a managed access policy instead of the inline one (created or versioned, attached, then the inline copy and the Dailies policy removed), before the new code.");
