"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const markup = fs.readFileSync("booking-selections.html", "utf8");
const client = fs.readFileSync("assets/booking-selections.js", "utf8");
const styles = fs.readFileSync("assets/booking-selections.css", "utf8");
const backend = fs.readFileSync("infrastructure/auth-api/tour-manager-billing.mjs", "utf8");
const workspace = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");

for (const label of ["Band tour pitch", "DJ / electronic gig pitch", "Festival pitch"]) assert.match(client, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(client, /Artist-entered expected draw/, "draw claims must remain explicitly artist supplied");
assert.match(client, /end of the date range cannot be before the proposed show date/i, "invalid date ranges must be stopped before review");
assert.match(client, /Apply template to draft[\s\S]*Replace this pitch draft\?/, "reapplying a template must not silently overwrite the artist's edits");
assert.match(client, /Review email to[\s\S]*Recipient[\s\S]*Subject[\s\S]*1 booking-email credit/, "the review must show the exact recipient, subject, and cost");
assert.match(client, /I reviewed this exact recipient and message and approve sending it/, "each recipient needs explicit artist approval");
assert.match(client, /confirm\.disabled = true[\s\S]*confirm\.disabled = !check\.checked/, "send must stay disabled until approval is checked");
assert.match(client, /artistApproved:true/, "the reviewed send must carry an explicit approval assertion");
assert.match(backend, /body\?\.artistApproved !== true[\s\S]*approve this email before sending/, "the server must reject drafts that were not approved");
assert.match(client, /Review one follow-up · 1 credit[\s\S]*followUpTo:initialPitch\.id/, "a due reminder must be reviewed, charged once, and bound to its original pitch");
assert.match(backend, /attribute_not_exists\(followUpSendId\)[\s\S]*attribute_not_exists\(repliedAt\)/, "the server must atomically prevent a second follow-up or a reminder after reply");
assert.match(backend, /This follow-up is not due yet/, "the server must enforce the artist's saved follow-up date");
for (const field of ["message: { S: message }", "template: { S: template }", "artistApprovedAt: { S: reservedAt }"]) assert.ok(backend.includes(field), `the immutable send record must retain ${field}`);
for (const field of ["pitchTemplate", "expectedDraw", "setDetails", "outreachSubject"]) assert.match(workspace, new RegExp(field), `the account workspace must persist ${field}`);
assert.match(styles, /\.booking-send-review[\s\S]*max-height:[^;]+vh/, "the review dialog must be bounded on phones");
assert.match(styles, /\.booking-send-actions button\{min-height:44px\}/, "review actions must remain touch sized");
assert.match(markup, /booking-selections\.css\?v=10/);
assert.match(markup, /booking-selections\.js\?v=18/);

console.log("Booking pitch review checks passed: templates, artist-entered facts, overwrite protection, exact preview, explicit approval, one safe follow-up, server enforcement, persistence, and mobile geometry.");
