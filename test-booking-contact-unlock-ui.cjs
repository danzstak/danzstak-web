const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const billing = readFileSync("assets/booking-billing.js", "utf8");
const selections = readFileSync("assets/booking-selections.js", "utf8");
const page = readFileSync("booking-selections.html", "utf8");
const deployment = readFileSync("aws-deploy-auth-api.ps1", "utf8");

assert.match(billing, /\/tour-manager\/contact-unlock\/checkout/);
assert.match(billing, /\/tour-manager\/contact-unlocks/);
assert.match(billing, /checkout\.stripe\.com/);
assert.match(selections, /Unlock booking contact · \$0\.75/);
assert.match(selections, /danzstakBookingContactUnlocked/);
assert.match(selections, /contactUnlocked \? \(venue\.emails/);
assert.match(selections, /contactUnlocked \? \(venue\.phones/);
assert.match(selections, /document\.addEventListener\("danzstak-contact-unlocks", render\)/);
assert.match(page, /booking-billing\.js\?v=5/);
assert.match(page, /booking-selections\.js\?v=17/);
assert.match(deployment, /POST \/tour-manager\/contact-unlock\/checkout/);
assert.match(deployment, /GET \/tour-manager\/contact-unlocks/);

console.log("Booking contact unlock UI checks passed: secure Checkout handoff, entitlement refresh, locked direct contacts, CSV redaction, and deployment routes.");
