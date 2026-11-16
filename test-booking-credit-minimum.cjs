"use strict";
// Task 12 PR 4: booking emails are bought 20 at a time minimum (owner 2026-11-16).
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const billing = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  const { buyerFees } = await import("./infrastructure/auth-api/fees.mjs");
  assert.equal(billing.MIN_CREDITS_PER_CHECKOUT, 20);
  const subtotal = billing.MIN_CREDITS_PER_CHECKOUT * billing.TOUR_MANAGER_EMAIL_UNIT_CENTS;
  assert.equal(subtotal, 3000, "20 x $1.50 = $30.00");
  assert.equal(subtotal + buyerFees(subtotal), 3180, "20 pitches cost $31.80, no $1 fee");
  const source = fs.readFileSync("infrastructure/auth-api/tour-manager-billing.mjs", "utf8");
  assert.match(source, /quantity < MIN_CREDITS_PER_CHECKOUT \|\| quantity > MAX_CREDITS_PER_CHECKOUT/, "checkout creation enforces the minimum");
  assert.match(source, /minimumQuantity: \{ N: String\(MIN_CREDITS_PER_CHECKOUT\) \}/, "the pending checkout records the minimum");
  assert.match(source, /quantity >= Number\(item\.minimumQuantity\?\.N \|\| 1\)/, "the webhook enforces the recorded minimum");
  const page = fs.readFileSync("booking-selections.html", "utf8"), ui = fs.readFileSync("assets/booking-billing.js", "utf8"), cards = fs.readFileSync("assets/booking-selections.js", "utf8");
  assert.match(page, /id="bookingCreditQuantity" type="number" min="20" max="500" value="20"/, "picker starts at 20");
  assert.match(page, />Minimum 20 pitches</, "UI says Minimum 20 pitches");
  assert.match(ui, /count < MIN_CREDITS/, "the browser refuses fewer than 20 before checkout");
  assert.match(ui, /quantity:count = MIN_CREDITS/, "default checkout quantity is 20");
  assert.match(cards, /quantity:20, venueKey/, "the zero-credit prompt buys the 20 minimum");
  assert.doesNotMatch(cards, /quantity:1, venueKey/);
  console.log("Booking-credit minimum checks passed: 20 per purchase ($31.80) in checkout, webhook and UI.");
})().catch(e => { console.error(e); process.exit(1); });
