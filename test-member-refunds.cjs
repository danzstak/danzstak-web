"use strict";

// Owner policy 2026-11-15: unused purchases refund at price minus Stripe's fee, after the member accepts
// the exact amount; once the service is used (emails sent, contact shown) there is no refund.
const assert = require("node:assert/strict");

(async () => {
  const billing = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const userId = "user_12345678", sessionId = "cs_test_member1";
  const keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const n = v => Number(v?.N || 0);

  function makeHarness({ sentEmails = 0, reserved = 0, credits = 3, refundFails = false } = {}) {
    const records = new Map();
    records.set(`${userId}|TOUR_MANAGER#CHECKOUT#${sessionId}`, { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#CHECKOUT#${sessionId}` }, sessionId: { S: sessionId }, status: { S: "paid" }, quantity: { N: "3" }, sentEmailsAtPayment: { N: "0" }, amountPaidCents: { N: "450" } });
    records.set(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`, { credits: { N: String(credits) }, purchasedCredits: { N: "3" }, sentEmails: { N: String(sentEmails) }, reservedCredits: { N: String(reserved) } });
    const applyUpdate = (input) => {
      const item = structuredClone(records.get(keyOf(input.Key)) || {}), v = input.ExpressionAttributeValues || {};
      const cond = input.ConditionExpression || "";
      if (cond.includes("#status = :paid") && item.status?.S !== "paid") throw new Error("cond");
      if (cond.includes("#status = :refunding") && item.status?.S !== "refunding") throw new Error("cond");
      if (cond.includes("credits >= :quantity") && (n(item.credits) < n(v[":quantity"]) || n(item.sentEmails) > n(v[":usage"]) || n(item.reservedCredits) > 0)) throw new Error("cond");
      const expr = input.UpdateExpression;
      for (const m of expr.matchAll(/(\w+) (:\w+)/g)) if (/^ADD/.test(expr) || expr.includes(`ADD ${m[1]}`) || expr.includes(`, ${m[1]} ${m[2]}`)) { if (["credits", "purchasedCredits"].includes(m[1])) item[m[1]] = { N: String(n(item[m[1]]) + n(v[m[2]])) }; }
      for (const m of expr.matchAll(/(#status|\w+) = (:\w+)/g)) item[m[1] === "#status" ? "status" : m[1]] = structuredClone(v[m[2]]);
      return item;
    };
    const db = { send: async command => {
      const input = command.input;
      if (command instanceof GetItemCommand) return { Item: structuredClone(records.get(keyOf(input.Key))) };
      if (command instanceof QueryCommand) return { Items: [...records.entries()].filter(([k]) => k.startsWith(`${userId}|TOUR_MANAGER#CHECKOUT#`)).map(([, v]) => structuredClone(v)) };
      if (command instanceof PutItemCommand) { records.set(keyOf(input.Item), structuredClone(input.Item)); return {}; }
      if (command instanceof TransactWriteItemsCommand) {
        const next = new Map();
        for (const op of input.TransactItems) {
          if (op.Update) next.set(keyOf(op.Update.Key), applyUpdate(op.Update));
          if (op.Put) next.set(keyOf(op.Put.Item), structuredClone(op.Put.Item));
        }
        for (const [k, v] of next) records.set(k, v);
        return {};
      }
      throw new Error("unexpected command");
    } };
    const stripeCalls = [];
    const fetcher = async (url, options = {}) => {
      stripeCalls.push({ url, method: options.method || "GET", body: options.body || "" });
      if (url.endsWith(`/checkout/sessions/${sessionId}`)) return { ok: true, json: async () => ({ id: sessionId, client_reference_id: userId, payment_status: "paid", payment_intent: "pi_member1" }) };
      if (url.includes("/payment_intents/pi_member1")) return { ok: true, json: async () => ({ latest_charge: { id: "ch_member1", amount: 450, amount_refunded: 0, balance_transaction: { fee: 43 } } }) };
      if (url.endsWith("/charges/ch_member1")) return { ok: true, json: async () => ({ id: "ch_member1" }) };
      if (url.endsWith("/refunds")) return refundFails ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, json: async () => ({ id: "re_member1" }) };
      throw new Error(`unexpected Stripe call ${url}`);
    };
    const env = { STRIPE_SECRET_KEY: "sk_test_example", STRIPE_TOUR_MANAGER_WEBHOOK_SECRET: "whsec_example" };
    const service = billing.createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders: () => ({ "access-control-allow-origin": "https://danzstak.com" }), tableName: "Tours", env, fetcher });
    const call = async (path, body) => { const r = await service({ requestContext: { http: { method: body ? "POST" : "GET" } }, rawPath: path, headers: { origin: "https://danzstak.com" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
    return { call, records, stripeCalls };
  }

  // Unused purchase: quote shows price minus fee; nothing changes until the member accepts.
  let h = makeHarness();
  let r = await h.call("/tour-manager/refunds/quote", { sessionId });
  assert.deepEqual([r.body.refundable, r.body.paidCents, r.body.feeCents, r.body.refundCents], [true, 450, 43, 407]);
  assert.equal(r.body.paymentIntent, undefined, "internal Stripe ids are not exposed");
  r = await h.call("/tour-manager/refunds/accept", { sessionId, acceptedRefundCents: 407 });
  assert.equal(r.status, 400, "the member must explicitly accept");
  r = await h.call("/tour-manager/refunds/accept", { sessionId, accept: true, acceptedRefundCents: 450 });
  assert.equal(r.status, 409, "accepting a different amount than the quote is refused");
  assert.equal(h.stripeCalls.some(c => c.url.endsWith("/refunds")), false);
  r = await h.call("/tour-manager/refunds/accept", { sessionId, accept: true, acceptedRefundCents: 407 });
  assert.equal(r.status, 200); assert.equal(r.body.refundCents, 407);
  const refundCall = h.stripeCalls.find(c => c.url.endsWith("/refunds"));
  assert.match(refundCall.body, /amount=407/); assert.match(refundCall.body, /danzstak_refund_policy%5D=member_request/);
  assert.equal(h.records.get(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`).credits.N, "0");
  assert.equal(h.records.get(`${userId}|TOUR_MANAGER#CHECKOUT#${sessionId}`).status.S, "refunded");
  r = await h.call("/tour-manager/refunds/accept", { sessionId, accept: true, acceptedRefundCents: 407 });
  assert.equal(r.status, 409, "a purchase refunds only once");

  // Used the service (an email was sent after paying): no refund.
  h = makeHarness({ sentEmails: 1, credits: 2 });
  r = await h.call("/tour-manager/refunds/quote", { sessionId });
  assert.equal(r.body.refundable, false);
  r = await h.call("/tour-manager/refunds/accept", { sessionId, accept: true, acceptedRefundCents: 407 });
  assert.equal(r.status, 409); assert.equal(h.stripeCalls.some(c => c.url.endsWith("/refunds")), false);

  // An email being sent right now also counts as use.
  h = makeHarness({ reserved: 1, credits: 2 });
  r = await h.call("/tour-manager/refunds/quote", { sessionId });
  assert.equal(r.body.refundable, false);

  // Stripe failure: credits and purchase are restored.
  h = makeHarness({ refundFails: true });
  r = await h.call("/tour-manager/refunds/accept", { sessionId, accept: true, acceptedRefundCents: 407 });
  assert.equal(r.status, 502);
  assert.equal(h.records.get(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`).credits.N, "3");
  assert.equal(h.records.get(`${userId}|TOUR_MANAGER#CHECKOUT#${sessionId}`).status.S, "paid");

  // Purchase list.
  h = makeHarness();
  r = await h.call("/tour-manager/refunds");
  assert.equal(r.body.purchases.length, 1); assert.equal(r.body.purchases[0].sessionId, sessionId);

  // Production regression (2026-11-15): the Lambda only loads Stripe secrets for listed routes.
  const index = require("node:fs").readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  const stripeRoutes = index.match(/\[([^\]]*"\/tour-manager\/checkout"[^\]]*)\]\.includes\(path\)\) await ensureStripeSecrets/)?.[1] || "";
  for (const route of ["/tour-manager/refunds/quote", "/tour-manager/refunds/accept"]) assert.ok(stripeRoutes.includes(`"${route}"`), `${route} must load Stripe secrets`);

  console.log("Member refund checks passed: fee-deducted quote, explicit acceptance, exact-amount match, no refund after use, single refund, Stripe-failure rollback.");
})().catch(error => { console.error(error); process.exit(1); });
