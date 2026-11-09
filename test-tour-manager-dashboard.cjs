const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("booking-selections.html", "utf8");
const client = fs.readFileSync("assets/booking-selections.js", "utf8");
const billing = fs.readFileSync("assets/booking-billing.js", "utf8");
const css = fs.readFileSync("assets/booking-selections.css", "utf8");
const backend = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const billingBackend = fs.readFileSync("infrastructure/auth-api/tour-manager-billing.mjs", "utf8");

for (const status of ["Not contacted", "Email prepared", "Email sent", "Reply received", "Interested", "Negotiating", "Date proposed", "Confirmed", "Declined", "No response"]) {
  assert.match(client, new RegExp(status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Missing booking status: ${status}`);
}
for (const id of ["tourManagerTitle", "tmSelected", "tmSent", "tmReplies", "tmConfirmed", "tmTotalCost", "tmProjectedResult", "tmBookingSpend", "tourManagerCalendar", "tmDistanceKm", "tmFuelUse", "tmRoomRate", "tmContingency"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Missing Tour Manager dashboard control: ${id}`);
}
assert.match(client, /confirmationEvidence/, "The client must capture confirmation evidence");
assert.match(backend, /confirmed performance requires a show date and written confirmation evidence/i, "The API must reject unsupported confirmations");
assert.match(backend, /tourBudgetEstimate/, "The API must calculate tour expenses");
assert.match(backend, /bookingEmails.*1\.5/s, "The estimate must include $1.50 successfully sent emails");
assert.match(billingBackend, /GET" && path === "\/tour-manager\/outreach"/, "The billing API must expose authenticated outreach history");
assert.match(billingBackend, /include its exact public link/, "Booking emails must include the saved public EPK link");
assert.match(billing, /danzstak-tour-manager-billing/, "Billing and outreach totals must update the dashboard");
assert.match(css, /@media\(max-width:390px\)/, "The dashboard must have a narrow-phone layout");
assert.match(html, /booking-billing\.js\?v=8/);
assert.match(html, /booking-selections\.css\?v=16/);
assert.match(html, /booking-selections\.js\?v=24/);

console.log("Tour Manager dashboard checks passed: complete booking states, confirmation evidence, EPK enforcement, outreach history, expense totals, calendar, and mobile layout.");
