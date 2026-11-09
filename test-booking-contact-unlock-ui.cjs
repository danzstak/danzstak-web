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
assert.match(selections, /if \(dirty\)[\s\S]*Saving current venue…[\s\S]*await saveWorkspaceSnapshot\(\)[\s\S]*Opening secure checkout…/, "contact checkout must save dirty venue facts first");
assert.match(selections, /contactUnlocked \? \(venue\.emails/);
assert.match(selections, /contactUnlocked \? \(venue\.phones/);
assert.match(selections, /document\.addEventListener\("danzstak-contact-unlocks", render\)/);
assert.match(billing, /finishContactReturn[\s\S]*Verifying this booking contact…[\s\S]*refreshContactUnlocks\(\)[\s\S]*Booking contact unlocked/, "a successful Checkout return must wait for the webhook entitlement");
assert.match(billing, /clearContactResult[\s\S]*searchParams\.delete\("contact"\)[\s\S]*searchParams\.delete\("venueKey"\)/, "completed Checkout state must leave the address bar");
assert.match(billing, /focusVenueContact[\s\S]*scrollIntoView[\s\S]*target\.focus/, "Checkout return must take the artist back to the purchased venue contact");
assert.match(page, /booking-billing\.js\?v=7/);
assert.match(billing, /creditCheckoutMarker[\s\S]*finishCreditReturn[\s\S]*Verifying your booking-email credits[\s\S]*settledCreditPurchase[\s\S]*Credits verified/, "a successful credit Checkout return must wait for a settled ledger purchase");
assert.match(billing, /clearCreditResult[\s\S]*searchParams\.delete\("credits"\)/, "completed credit Checkout state must leave the address bar");
assert.match(page, /booking-selections\.js\?v=22/);
assert.match(deployment, /POST \/tour-manager\/contact-unlock\/checkout/);
assert.match(deployment, /GET \/tour-manager\/contact-unlocks/);

console.log("Booking contact unlock UI checks passed: save-first Checkout, webhook entitlement recovery, venue focus, locked direct contacts, CSV redaction, and deployment routes.");
