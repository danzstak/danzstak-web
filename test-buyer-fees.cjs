"use strict";
// Task 12: one buyer-paid fee rule (6% + $1 on orders under $30) shared by every server checkout.
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const f = await import("./infrastructure/auth-api/fees.mjs");
  assert.equal(f.FEE_PERCENT, 6);
  assert.equal(f.buyerFees(500), 130, "$5 AI EPK: 30c + $1");
  assert.equal(500 + f.buyerFees(500), 630, "$5 AI EPK costs $6.30");
  assert.equal(f.buyerFees(2999), 280, "$29.99: $1.80 + $1");
  assert.equal(f.buyerFees(3000), 180, "$30.00: $1.80 only, no $1");
  assert.equal(3000 + f.buyerFees(3000), 3180, "six AI EPKs ($30) cost $31.80");
  assert.equal(f.buyerFees(0), 0, "nothing bought, no fee");
  assert.equal(f.buyerFees(1), 100, "a 1c order: 6% rounds to 0c, plus $1");
  assert.throws(() => f.buyerFees(-1), /integer cents/);
  assert.throws(() => f.buyerFees(12.5), /integer cents/);
  assert.throws(() => f.buyerFees("500"), /integer cents/);

  // Multi-item order crossing $30 drops the $1.
  assert.equal(f.buyerFees(2500), 250, "one $25 item: $1.50 + $1");
  assert.equal(f.buyerFees(2500 * 2), 300, "two $25 items ($50): $3.00, the $1 drops off");

  // Shipping never carries the 6%; the seller gets the full price plus shipping.
  const order = f.orderTotals({ subtotalCents: 2500, shippingCents: 800 });
  assert.deepEqual(order, { subtotalCents: 2500, shippingCents: 800, percentFeeCents: 150, smallOrderFeeCents: 100, feeCents: 250, totalCents: 3550, payoutCents: 3300 });
  assert.equal(f.orderTotals({ subtotalCents: 2500, shippingCents: 5000 }).feeCents, 250, "shipping does not change the fee");
  assert.equal(f.orderTotals({ subtotalCents: 2500, shippingCents: 600 }).smallOrderFeeCents, 100, "shipping does not count toward the $30 line");
  assert.equal(f.orderTotals({ subtotalCents: 4000 }).payoutCents, 4000, "promoter payout equals the ticket price");
  assert.throws(() => f.orderTotals({ subtotalCents: 500, shippingCents: -1 }), /integer cents/);

  // Every server module uses the shared rule, not its own copy.
  for (const file of ["marketplace.mjs", "ticket-orders.mjs"]) {
    const source = fs.readFileSync(`infrastructure/auth-api/${file}`, "utf8");
    assert.match(source, /from "\.\/fees\.mjs"/, `${file} imports the shared fee rule`);
    assert.doesNotMatch(source, /Math\.round\([^)]*0\.06\)|\* 6 \/ 100/, `${file} has no private 6% math`);
  }
  const m = await import("./infrastructure/auth-api/marketplace.mjs");
  const t = await import("./infrastructure/auth-api/ticket-orders.mjs");
  for (const cents of [50, 500, 1999, 2999, 3000, 12345]) {
    assert.equal(m.marketplaceFeeCents(cents), f.buyerFees(cents));
    assert.equal(t.feeCents(cents), f.buyerFees(cents));
  }
  console.log("Buyer-paid fee checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
