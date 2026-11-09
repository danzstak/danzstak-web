"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const support = read("aws-configure-support-email.ps1");
const readme = read("README.md");
const payments = read("docs/DUAL-PAYMENT-ARCHITECTURE.md");

for (const retired of [
  "aws-create-mail-relay-smtp.ps1",
  "aws-create-support-smtp.ps1",
  "aws-deploy-mail-server.ps1",
  "aws-deploy-support-forwarding.ps1",
  "infrastructure/mail-server/template.yaml",
  "infrastructure/support-email-forwarder/lambda_function.py",
]) {
  assert.equal(fs.existsSync(retired), false, `${retired} must stay retired`);
}

assert.match(support, /\[string\]\$Region = "us-east-1"/, "support mail must use the approved SES region");
assert.match(support, /danzstak-support-mail-\$AccountId-\$Region/, "inbound mail must stay in the region-scoped DanzStak bucket");
assert.match(support, /Actions = @\(@\{ S3Action = /, "the SES receipt rule must store incoming support mail privately");
assert.doesNotMatch(support, /LambdaAction|FORWARD_TO|support@sfscoop\.com|gmail/i, "support mail must not leave DanzStak through an external forwarder");
assert.match(readme, /Amazon SES in `us-east-1`/, "the repository must document the working SES region");
assert.match(readme, /not forwarded to another platform or personal mailbox/, "the DanzStak-only support boundary must be explicit");
assert.doesNotMatch(readme, /Stalwart|inbox\.danzstak\.com/i, "retired mailbox-server guidance must not return");
assert.match(payments, /Stripe and SFS Token via Phantom are the only approved payment methods/, "only Stripe and verified SFS Token wallet payments are allowed");
assert.doesNotMatch(payments, /SFScoop/i, "payment architecture must not depend on another platform");

console.log("DanzStak-only SES support checks passed: no Stalwart, Gmail or external forwarding path remains.");
