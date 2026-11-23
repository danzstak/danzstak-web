// The Auth API deploy never replaces the Lambda settings it couldn't read.
//
// Lambda keeps a function's settings (environment variables) encrypted. A caller that may not decrypt them gets
// Environment.Error and no Variables from get-function-configuration. The GitHub deploy role is such a caller on purpose:
// its boundary denies kms:Decrypt so it never sees a secret value. Deploy run 7 (2026-11-23, dry run) planned
// "Set Auth API environment" with only the 12 settings the script sets itself: a real run would have replaced all 25 live
// settings (sign-in, sessions, Stripe, site address, ...) with those 12 and taken the Auth API down for every member.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const script = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");

// 1. One place writes the settings.
const writes = [...script.matchAll(/update-function-configuration[^\n]*--environment/g)];
assert.equal(writes.length, 1, "aws-deploy-auth-api.ps1 writes the Auth API settings in exactly one place");

// 2. "Read" means no Environment.Error and at least one live setting.
const readLine = script.match(/^\s*\$settingsRead\s*=\s*(.+)$/m);
assert.ok(readLine, "the script decides $settingsRead from the live configuration");
assert.match(readLine[1], /-not \$current\.Environment\.Error/, "settings that came back with Environment.Error were not read");
assert.match(readLine[1], /\$current\.Environment\.Variables\.PSObject\.Properties\)\.Count -gt 0/, "no live settings at all counts as not read");
assert.ok(readLine.index < script.indexOf("$variables = @{}"), "$settingsRead is decided from the configuration as read, before any setting is added");

// 3. The write sits in the branch that only runs when the settings were read.
const write = writes[0].index;
const skip = script.lastIndexOf("if (-not $settingsRead) {", write);
assert.ok(skip > 0, "the settings write follows an `if (-not $settingsRead)` check");
const between = script.slice(skip, write);
assert.match(between, /SKIP {2}Auth API environment/, "when the settings can't be read the run says so and leaves them as they are");
assert.match(between, /\}\s*elseif \(/, "the write is in the elseif branch, never reached when $settingsRead is false");
assert.doesNotMatch(between.replace(/^[\s\S]*?\}\s*elseif \(/, ""), /\n\s*\}\s*\n/, "nothing closes the elseif block before the write");

// 4. The reason still holds: the GitHub deploy role can't decrypt (it never sees secret values).
const boundary = fs.readFileSync("infrastructure/github-deploy/bootstrap.yaml", "utf8");
assert.match(boundary, /Sid: DenyKeyUse\s+Effect: Deny\s+Action: \[[^\]]*'kms:Decrypt'/, "the deploy boundary denies kms:Decrypt");

console.log("Auth API settings checks passed: the deploy writes the Lambda settings only after reading the live ones (an encrypted, unreadable response leaves them as they are).");
