"use strict";
// Task 12 PR 2: ticket checkout shows the buyer fee as its own Stripe line, and tickets are issued only when
// Stripe collected exactly the ticket price plus that fee.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
(async () => {
  const m = await import("./infrastructure/auth-api/ticket-orders.mjs");
  const S = v => ({ S: v }), N = v => ({ N: String(v) });
  const eventId = "11111111-1111-4111-8111-111111111111", tierId = "22222222-2222-4222-8222-222222222222";
  const items = new Map([
    [`EVENT#${eventId}|META`, { status: S("published"), ticketSalesEnabled: { BOOL: true }, namedTickets: { BOOL: false }, organizerId: S("promoter-1234"), startsAt: S("2099-01-01T20:00:00.000Z"), title: S("Gig") }],
    [`EVENT#${eventId}|TIER#${tierId}`, { status: S("on_sale"), capacity: N(100), sold: N(0), reserved: N(0), priceCents: N(1250), name: S("GA") }],
    ["SELLER#promoter-1234|PAYOUTS", { status: S("active") }]
  ]);
  const key = k => `${k.pk.S}|${k.sk.S}`;
  const writes = [];
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {} class PutItemCommand extends Command {} class QueryCommand extends Command {}
  class UpdateItemCommand extends Command {} class TransactWriteItemsCommand extends Command {}
  const db = { async send(c) {
    if (c instanceof GetItemCommand) return { Item: items.get(key(c.input.Key)) };
    if (c instanceof TransactWriteItemsCommand) { writes.push(c.input.TransactItems); for (const t of c.input.TransactItems) if (t.Put) items.set(key(t.Put.Item), t.Put.Item); return {}; }
    if (c instanceof UpdateItemCommand) return {};
    throw new Error("unexpected " + c.constructor.name);
  } };
  let form;
  const fetchImpl = async (url, options) => { form = new URLSearchParams(options.body); return { ok: true, json: async () => ({ id: "cs_test_tickets", url: "https://checkout.stripe.com/c/pay/x" }) }; };
  const secret = "whsec_test", t = 1800000000;
  const orders = m.createTicketOrders({ db, commands: { GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, TransactWriteItemsCommand }, authenticate: async () => "buyer-12345", corsHeaders: o => ({ "access-control-allow-origin": o }), tableName: "T", getStripeKey: async () => "sk_test_x", getWebhookSecret: async () => secret, emailForUser: async () => "fan@example.com", sendTicketEmail: async () => {}, renderQr: async () => Buffer.from(""), fetchImpl, clock: () => t * 1000, env: {} });

  // Two $12.50 tickets = $25.00 subtotal: fee = $1.50 + $1 = $2.50, total $27.50.
  const res = await orders({ requestContext: { http: { method: "POST" } }, rawPath: `/marketplace/events/${eventId}/checkout`, headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ tierId, quantity: 2 }) });
  assert.equal(res.statusCode, 200);
  const out = JSON.parse(res.body);
  assert.deepEqual([out.subtotalCents, out.feeCents, out.totalCents], [2500, 250, 2750]);
  assert.equal(form.get("line_items[0][quantity]"), "2");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "1250", "the ticket line is the promoter's price");
  assert.equal(form.get("line_items[1][price_data][product_data][name]"), "DanzStak fee", "the fee is its own receipt line");
  assert.equal(form.get("line_items[1][price_data][unit_amount]"), "250");
  assert.equal(form.get("line_items[1][quantity]"), "1");
  const order = items.get(`ORDER#${out.orderId}|META`);
  assert.deepEqual([order.subtotalCents.N, order.feeCents.N, order.totalCents.N, order.payoutCents.N], ["2500", "250", "2750", "2500"], "promoter payout is the full ticket price");

  const webhook = amount => {
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: { danzstak_kind: "event_tickets", danzstak_order: out.orderId }, payment_status: "paid", amount_total: amount, currency: "usd", payment_intent: "pi_x" } } });
    const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    return orders({ requestContext: { http: { method: "POST" } }, rawPath: "/marketplace/stripe/webhook", headers: { "stripe-signature": `t=${t},v1=${sig}` }, body });
  };
  const before = writes.length;
  await webhook(2500);
  assert.equal(writes.length, before, "price without the fee issues no tickets");
  await webhook(2751);
  assert.equal(writes.length, before, "a wrong total issues no tickets");
  await webhook(2750);
  assert.equal(writes.length, before + 1, "exact price + fee issues the tickets");
  assert.equal(writes.at(-1).filter(x => x.Put?.Item?.entityType?.S === "ticket").length, 2);
  console.log("Ticket fee line checks passed: separate DanzStak fee line, full price to the promoter, webhook total must equal price + fee.");
})().catch(e => { console.error(e); process.exit(1); });
