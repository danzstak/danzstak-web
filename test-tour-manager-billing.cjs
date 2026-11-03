const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

(async () => {
  const { createTourManagerBilling, verifyStripeSignature, TOUR_MANAGER_EMAIL_PRICE_ID, TOUR_MANAGER_PRODUCT_ID, TOUR_MANAGER_EMAIL_UNIT_CENTS } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, TransactWriteItemsCommand };
  const records = new Map();
  const keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item);
      if (command.input.ConditionExpression && records.has(key)) { const error = new Error("exists"); error.name = "ConditionalCheckFailedException"; throw error; }
      records.set(key, structuredClone(command.input.Item)); return {};
    }
    if (command instanceof TransactWriteItemsCommand) {
      const eventPut = command.input.TransactItems[0].Put;
      if (records.has(keyOf(eventPut.Item))) { const error = new Error("duplicate"); error.name = "TransactionCanceledException"; throw error; }
      const checkoutUpdate = command.input.TransactItems[1].Update;
      const checkout = records.get(keyOf(checkoutUpdate.Key));
      if (!checkout || checkout.status.S === "paid") { const error = new Error("not pending"); error.name = "TransactionCanceledException"; throw error; }
      records.set(keyOf(eventPut.Item), structuredClone(eventPut.Item));
      checkout.status = checkoutUpdate.ExpressionAttributeValues[":status"] || checkoutUpdate.ExpressionAttributeValues[":paid"];
      if (checkoutUpdate.ExpressionAttributeValues[":paidAt"]) checkout.paidAt = checkoutUpdate.ExpressionAttributeValues[":paidAt"];
      if (command.input.TransactItems[2]?.Update) {
        const creditUpdate = command.input.TransactItems[2].Update;
        const creditKey = keyOf(creditUpdate.Key), credit = records.get(creditKey) || structuredClone(creditUpdate.Key);
        credit.credits = { N: String(Number(credit.credits?.N || 0) + Number(creditUpdate.ExpressionAttributeValues[":quantity"].N)) };
        credit.purchasedCredits = { N: String(Number(credit.purchasedCredits?.N || 0) + Number(creditUpdate.ExpressionAttributeValues[":quantity"].N)) };
        records.set(creditKey, credit);
      }
      if (command.input.TransactItems[3]?.Update) {
        const entitlementUpdate = command.input.TransactItems[3].Update;
        const entitlement = records.get(keyOf(entitlementUpdate.Key)) || structuredClone(entitlementUpdate.Key);
        entitlement.status = entitlementUpdate.ExpressionAttributeValues[":active"];
        records.set(keyOf(entitlementUpdate.Key), entitlement);
      }
      if (command.input.TransactItems[4]?.Put) records.set(keyOf(command.input.TransactItems[4].Put.Item), structuredClone(command.input.TransactItems[4].Put.Item));
      return {};
    }
    throw new Error("Unexpected command");
  }};

  const now = 1793700000000;
  const env = { STRIPE_SECRET_KEY: "sk_test_example", STRIPE_TOUR_MANAGER_WEBHOOK_SECRET: "whsec_example" };
  let createdForm, sessionOverrides = {};
  const session = () => ({
    id: "cs_test_credit123", mode: "payment", payment_status: "paid", status: "complete", livemode: false,
    client_reference_id: "user_12345678", currency: "usd", amount_total: 450,
    metadata: { product: "tour_manager_booking_email", userId: "user_12345678", priceId: TOUR_MANAGER_EMAIL_PRICE_ID, quantity: "3" },
    line_items: { data: [{ quantity: 3, price: { id: TOUR_MANAGER_EMAIL_PRICE_ID, product: TOUR_MANAGER_PRODUCT_ID, currency: "usd", unit_amount: TOUR_MANAGER_EMAIL_UNIT_CENTS } }] },
    ...sessionOverrides
  });
  const fetcher = async (url, options = {}) => {
    if (url.endsWith("/checkout/sessions")) {
      createdForm = new URLSearchParams(options.body);
      return { ok: true, json: async () => ({ id: "cs_test_credit123", url: "https://checkout.stripe.com/c/pay/test123" }) };
    }
    if (url.includes("/checkout/sessions/cs_test_credit123")) return { ok: true, json: async () => session() };
    throw new Error(`Unexpected Stripe request: ${url}`);
  };
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const service = createTourManagerBilling({ db, commands, authenticate: async () => "user_12345678", corsHeaders, tableName: "Tours", env, fetcher, clock: () => now });
  const event = (method, path, body = "", headers = { origin: "https://danzstak.com" }) => ({ requestContext: { http: { method } }, rawPath: path, headers, body });

  const checkout = await service(event("POST", "/tour-manager/checkout", JSON.stringify({ quantity: 3 })));
  assert.equal(checkout.statusCode, 200);
  assert.equal(createdForm.get("line_items[0][price]"), TOUR_MANAGER_EMAIL_PRICE_ID);
  assert.equal(createdForm.get("line_items[0][quantity]"), "3");
  assert.equal(createdForm.get("metadata[userId]"), "user_12345678");
  assert.equal((await service(event("POST", "/tour-manager/checkout", JSON.stringify({ quantity: 0 })))).statusCode, 400);
  assert.equal((await service(event("POST", "/tour-manager/checkout", JSON.stringify({ quantity: 3 }), { origin: "https://evil.example" }))).statusCode, 403);

  const stripeEvent = { id: "evt_credit123", type: "checkout.session.completed", livemode: false, data: { object: { id: "cs_test_credit123" } } };
  const payload = JSON.stringify(stripeEvent), timestamp = Math.floor(now / 1000);
  const signed = body => `t=${timestamp},v1=${createHmac("sha256", env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex")}`;
  assert.equal(verifyStripeSignature(payload, signed(payload), env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET, now), true);
  assert.equal(verifyStripeSignature(payload, signed(payload), env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET, now + 301000), false);
  assert.equal((await service(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": "t=1,v1=bad" }))).statusCode, 400);

  sessionOverrides = { payment_status: "unpaid" };
  const awaiting = await service(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": signed(payload) }));
  assert.equal(awaiting.statusCode, 200);
  assert.equal(JSON.parse(awaiting.body).awaitingPayment, true);
  assert.equal(records.get("user_12345678|TOUR_MANAGER#BOOKING_EMAIL_CREDITS"), undefined);

  sessionOverrides = {};
  const asyncEvent = { ...stripeEvent, id: "evt_credit456", type: "checkout.session.async_payment_succeeded" };
  const asyncPayload = JSON.stringify(asyncEvent);
  const paid = await service(event("POST", "/tour-manager/stripe/webhook", asyncPayload, { "stripe-signature": signed(asyncPayload) }));
  assert.equal(paid.statusCode, 200);
  assert.equal(JSON.parse(paid.body).creditsIssued, 3);
  assert.equal(records.get("user_12345678|TOUR_MANAGER#BOOKING_EMAIL_CREDITS").credits.N, "3");
  assert.equal(records.get("user_12345678|TOUR_MANAGER#PROFESSIONAL_ENTITLEMENT").status.S, "active");
  const duplicate = await service(event("POST", "/tour-manager/stripe/webhook", asyncPayload, { "stripe-signature": signed(asyncPayload) }));
  assert.equal(JSON.parse(duplicate.body).duplicate, true);
  assert.equal(records.get("user_12345678|TOUR_MANAGER#BOOKING_EMAIL_CREDITS").credits.N, "3", "Stripe retries must not issue credits twice");

  const balance = await service(event("GET", "/tour-manager/credits"));
  assert.equal(JSON.parse(balance.body).bookingEmailCredits, 3);

  const disabled = createTourManagerBilling({ db, commands, authenticate: async () => "user_12345678", corsHeaders, tableName: "Tours", env: {}, fetcher, clock: () => now });
  assert.equal((await disabled(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": signed(payload) }))).statusCode, 503);
  console.log("Tour Manager Stripe checks passed: fixed Price ID, delayed-payment handling, pending-checkout binding, atomic ledger credits, test-mode gate, and retry idempotency.");
})().catch(error => { console.error(error); process.exit(1); });
