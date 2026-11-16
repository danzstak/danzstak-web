const assert = require('node:assert/strict');
const fs = require('node:fs');

// Task 07-E: accept dates, send confirmations (artist approves each), wait for the club's written
// OK; if none after 3 days, one follow-up email and a phone call whose OK is recorded as evidence.
const api = fs.readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const js = fs.readFileSync('assets/booking-selections.js', 'utf8');
const handler = api.slice(api.indexOf('async function bookingAcceptDate'), api.indexOf('// Booking sends are the real events'));

assert.match(api, /if \(data\?\.action === "accept_date"\) return await bookingAcceptDate\(userId, data, reply\);/, 'accept rides the existing POST /booking-pipeline route');
assert.match(handler, /status: "Date proposed", showDate: acceptDate, acceptedDate: acceptDate/, 'accepting sets Date proposed with the date');
assert.doesNotMatch(handler, /"Confirmed"/, 'accepting never marks a show Confirmed (owner 2026-11-16: confirmed when the club confirms)');
assert.match(handler, /didn't offer \$\{acceptDate\}/, 'only dates the club offered');
assert.match(handler, /ConditionExpression: "revision = :revision"/, 'no lost updates across devices');
assert.doesNotMatch(handler, /SendEmail|sendBookingReply|reserve/i, 'the accept action itself sends nothing and spends no credit');

// Confirmations: one per club, editable, sent only after a tick and a click, in the booking thread.
assert.match(js, /function renderAcceptDates\(result\)/);
assert.match(js, /send\.textContent = "Send confirmation"; send\.disabled = true;/, 'send starts disabled');
assert.match(js, /approve\.addEventListener\("change", \(\) => \{ send\.disabled = !approve\.checked \|\| !draft\.value\.trim\(\); \}\);/, 'the artist must tick before sending');
assert.match(js, /draft\.addEventListener\("input", \(\) => \{ approve\.checked = false; send\.disabled = true; \}\);/, 'editing after the tick needs a fresh review');
assert.match(js, /\/tour-manager\/outreach\/reply/, 'confirmations go in the existing booking thread (no credit)');
assert.match(js, /Email sent, but the date wasn't saved: \$\{error\.message\} Use "Save date only" — don't send again\./, 'a failed save after a send never re-sends');
assert.match(js, /No DanzStak booking thread with this club\. Confirm by your own email, then save the date\./);

// Chasing: 3 days, one follow-up, a call, and the phone OK as written evidence.
assert.match(js, /const CONFIRM_WAIT_DAYS = 3;/);
assert.match(js, /if \(booking\.confirmFollowUpAt\)[^\n]*Follow-up sent/, 'only one follow-up');
assert.match(js, /send\.textContent = "Send follow-up"; send\.disabled = true;/);
assert.match(js, /href: `tel:\$\{String\(phone\)\.replace\(\/\[\^\\d\+\]\/g, ""\)\}`/, 'tap to call the club');
assert.match(js, /confirmationEvidence = `Confirmed by phone with \$\{who\.value\.trim\(\)\} on \$\{when\.value\} for \$\{booking\.acceptedDate\} \(recorded by the artist\)\.`/);
assert.match(js, /who\.required = true;/, 'a phone OK needs who confirmed');
console.log('Booking accept-dates tests passed.');
