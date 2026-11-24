"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
(async () => {
  const m = await import("./infrastructure/auth-api/ticket-orders.mjs");
  // pure rules
  assert.match(m.ticketCode(), /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/, "door-readable codes without 0/O/1/I/L");
  assert.equal(m.feeCents(5000), 300, "buyer fee is 6% of the ticket price at $30+");
  assert.equal(m.feeCents(1000), 160, "under $30 the buyer also pays the $1 processing fee");
  assert.equal(m.cleanName("  Shawn   Example "), "Shawn Example");
  assert.equal(m.cleanName("x"), null); assert.equal(m.cleanName("<script>"), null);
  assert.equal(m.releaseAfter({ startsAt: "2026-12-01T20:00:00.000Z", endsAt: "2026-12-02T02:00:00.000Z" }), "2026-12-05T02:00:00.000Z", "promoter is paid 3 days after the event ends");
  const secret = "whsec_test", body = '{"x":1}', t = 1800000000;
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(m.verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t), true);
  assert.equal(m.verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret, t), false, "tampered payload rejected");
  assert.equal(m.verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 1000), false, "replayed webhook rejected");
  // checkout guardrails
  const S = v => ({ S: v });
  const items = {
    "EVENT#11111111-1111-4111-8111-111111111111|META": { status: S("published"), ticketSalesEnabled: { BOOL: true }, namedTickets: { BOOL: true }, organizerId: S("promoter-1234"), startsAt: S("2099-01-01T20:00:00.000Z"), title: S("Gig") },
    "EVENT#11111111-1111-4111-8111-111111111111|TIER#22222222-2222-4222-8222-222222222222": { status: S("on_sale"), capacity: { N: "100" }, sold: { N: "0" }, reserved: { N: "0" }, priceCents: { N: "2000" }, name: S("GA") }
  };
  const db = { async send(c) { if (c.constructor.name === "GetItemCommand") return { Item: items[c.input.Key.pk.S + "|" + c.input.Key.sk.S] }; throw new Error("unexpected write " + c.constructor.name); } };
  class GetItemCommand { constructor(i) { this.input = i; } }
  const orders = m.createTicketOrders({ db, commands: { GetItemCommand }, authenticate: async e => e.user, corsHeaders: o => o === "https://danzstak.com" ? { "access-control-allow-origin": o } : {}, tableName: "T", getStripeKey: async () => "sk_test_x", getWebhookSecret: async () => secret, emailForUser: async () => "fan@example.com", sendTicketEmail: async () => {}, renderQr: async () => Buffer.from(""), fetchImpl: async () => { throw new Error("no stripe in this test"); }, clock: () => t * 1000, env: {} });
  const ev = (b, user = "buyer-12345", origin = "https://danzstak.com") => ({ requestContext: { http: { method: "POST" } }, rawPath: "/marketplace/events/11111111-1111-4111-8111-111111111111/checkout", headers: { origin }, body: JSON.stringify(b), user });
  const tier = "22222222-2222-4222-8222-222222222222";
  let r = await orders(ev({ tierId: tier, quantity: 2 }, "buyer-12345", "https://evil.example")); assert.equal(r.statusCode, 403);
  r = await orders(ev({ tierId: tier, quantity: 2 }, "")); assert.equal(r.statusCode, 401);
  r = await orders(ev({ tierId: tier, quantity: 11 })); assert.equal(r.statusCode, 400, "max 10 per order");
  r = await orders(ev({ tierId: tier, quantity: 2, attendees: ["Ana Rossi"] })); assert.equal(r.statusCode, 400, "every named ticket needs a legal name");
  r = await orders(ev({ tierId: tier, quantity: 2, attendees: ["Ana Rossi", "Luca Bianchi"] })); assert.equal(r.statusCode, 409, "unverified promoters cannot sell");
  assert.match(JSON.parse(r.body).error, /payout verification/);
  // webhook: bad signature rejected, other kinds ignored
  const wh = (payload, header) => ({ requestContext: { http: { method: "POST" } }, rawPath: "/marketplace/stripe/webhook", headers: { "stripe-signature": header }, body: payload });
  r = await orders(wh(body, `t=${t},v1=deadbeef`)); assert.equal(r.statusCode, 400);
  const other = JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: { danzstak_kind: "booking_credits" } } } });
  r = await orders(wh(other, `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${other}`).digest("hex")}`)); assert.equal(JSON.parse(r.body).ignored, true, "other Stripe products are not touched");
  console.log("Ticket order checks passed: buyer-paid 6% fee (+$1 under $30), 3-day release, named tickets, verified promoters only, signed webhooks, door-readable codes.");
})().catch(e => { console.error(e); process.exit(1); });
