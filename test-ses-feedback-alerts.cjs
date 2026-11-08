"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const script = fs.readFileSync("aws-configure-ses-feedback-alerts.ps1", "utf8");
assert.match(script, /danzstak@gmail\.com/, "delivery-failure alerts must target the owner-approved DanzStak inbox");
assert.match(script, /MatchingEventTypes = @\("BOUNCE", "COMPLAINT", "REJECT"\)/, "the owner inbox must receive failures only, not successful delivery events");
assert.match(script, /Where-Object \{ \$_\.Protocol -eq "email" -and \$_\.Endpoint -ne \$AlertAddress \}/, "obsolete confirmed email subscriptions must be removed");
assert.doesNotMatch(script, /5starceo/i, "retired owner addresses must not be configured");
console.log("SES feedback-alert checks passed: DanzStak Gmail receives bounce, complaint and reject alerts only.");
