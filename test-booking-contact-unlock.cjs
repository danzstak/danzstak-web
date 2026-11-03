const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

(async () => {
  const { createTourManagerBilling, TEST_BOOKING_CONTACT_PRICE_ID: BOOKING_CONTACT_PRICE_ID, TEST_BOOKING_CONTACT_PRODUCT_ID: BOOKING_CONTACT_PRODUCT_ID, BOOKING_CONTACT_UNIT_CENTS } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const userId = "user_12345678", venueKey = "a".repeat(20);
  records.set(`${userId}|booking-workspace-v1`, { userId: { S: userId }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ venues: [{ venueKey, name: "Test Club", emails: ["booking@example.com"], phones: ["+1 555 555 0100"] }] }) } });
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item);
      if (command.input.ConditionExpression && records.has(key)) throw Object.assign(new Error("exists"), { name: "ConditionalCheckFailedException" });
      records.set(key, structuredClone(command.input.Item)); return {};
    }
    if (command instanceof QueryCommand) {
      const prefix = command.input.ExpressionAttributeValues[":prefix"]?.S || command.input.ExpressionAttributeValues[":ledger"]?.S || "";
      return { Items: [...records.values()].filter(item => item.userId?.S === userId && item.tourId?.S.startsWith(prefix)) };
    }
    if (command instanceof TransactWriteItemsCommand) {
      const items = command.input.TransactItems;
      const first = items[0].Put, firstKey = keyOf(first.Item);
      if (records.has(firstKey)) throw Object.assign(new Error("duplicate"), { name: "TransactionCanceledException" });
      const checkoutUpdate = items[1].Update, checkout = records.get(keyOf(checkoutUpdate.Key));
      if (!checkout || checkout.status?.S === "paid") throw Object.assign(new Error("checkout state"), { name: "TransactionCanceledException" });
      records.set(firstKey, structuredClone(first.Item));
      checkout.status = { S: "paid" };
      if (items[2]?.Put) records.set(keyOf(items[2].Put.Item), structuredClone(items[2].Put.Item));
      if (items[3]?.Put) records.set(keyOf(items[3].Put.Item), structuredClone(items[3].Put.Item));
      return {};
    }
    throw new Error(`Unexpected command ${command.constructor.name}`);
  }};
  const now = 1793700000000, env = { STRIPE_SECRET_KEY: "sk_test_example", STRIPE_TOUR_MANAGER_WEBHOOK_SECRET: "whsec_example" };
  let createdForm, amount = BOOKING_CONTACT_UNIT_CENTS;
  const stripeSession = () => ({ id: "cs_test_contact123", mode: "payment", payment_status: "paid", status: "complete", livemode: false, client_reference_id: userId, currency: "usd", amount_total: amount, metadata: { product: "booking_contact_unlock", userId, priceId: BOOKING_CONTACT_PRICE_ID, venueKey }, line_items: { data: [{ quantity: 1, price: { id: BOOKING_CONTACT_PRICE_ID, product: BOOKING_CONTACT_PRODUCT_ID, currency: "usd", unit_amount: amount } }] } });
  const fetcher = async (url, options = {}) => {
    if (url.endsWith("/checkout/sessions")) { createdForm = new URLSearchParams(options.body); return { ok: true, json: async () => ({ id: "cs_test_contact123", url: "https://checkout.stripe.com/c/pay/contact123" }) }; }
    if (url.includes("/checkout/sessions/cs_test_contact123")) return { ok: true, json: async () => stripeSession() };
    throw new Error(`Unexpected Stripe request: ${url}`);
  };
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const service = createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders, tableName: "Tours", env, fetcher, clock: () => now });
  const event = (method, path, body = "", headers = { origin: "https://danzstak.com" }) => ({ requestContext: { http: { method } }, rawPath: path, headers, body });

  const checkout = await service(event("POST", "/tour-manager/contact-unlock/checkout", JSON.stringify({ venueKey })));
  assert.equal(checkout.statusCode, 200);
  assert.equal(createdForm.get("line_items[0][price]"), BOOKING_CONTACT_PRICE_ID);
  assert.equal(createdForm.get("line_items[0][quantity]"), "1");
  assert.equal(createdForm.get("metadata[venueKey]"), venueKey);
  assert.match(createdForm.get("success_url"), /contact=success/);
  assert.equal((await service(event("POST", "/tour-manager/contact-unlock/checkout", JSON.stringify({ venueKey }), { origin: "https://evil.example" }))).statusCode, 403);

  const stripeEvent = { id: "evt_contact123", type: "checkout.session.completed", livemode: false, data: { object: { id: "cs_test_contact123" } } };
  const payload = JSON.stringify(stripeEvent), timestamp = Math.floor(now / 1000), signature = body => `t=${timestamp},v1=${createHmac("sha256", env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex")}`;
  amount = 74;
  assert.equal((await service(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": signature(payload) }))).statusCode, 409, "tampered price must not grant access");
  amount = BOOKING_CONTACT_UNIT_CENTS;
  const paid = await service(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": signature(payload) }));
  assert.equal(paid.statusCode, 200);
  assert.equal(JSON.parse(paid.body).contactUnlocked, true);
  assert.equal(records.get(`${userId}|TOUR_MANAGER#CONTACT_UNLOCK#${venueKey}`).status.S, "active");
  const duplicate = await service(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": signature(payload) }));
  assert.equal(JSON.parse(duplicate.body).duplicate, true);
  const unlocks = await service(event("GET", "/tour-manager/contact-unlocks"));
  assert.deepEqual(JSON.parse(unlocks.body).venueKeys, [venueKey]);
  const repeat = await service(event("POST", "/tour-manager/contact-unlock/checkout", JSON.stringify({ venueKey })));
  assert.equal(JSON.parse(repeat.body).unlocked, true, "an active entitlement must not start another charge");
  console.log("Booking contact unlock checks passed: saved-contact validation, fixed $0.75 Price, signed webhook verification, tamper rejection, venue entitlement, duplicate protection, and repeat-purchase prevention.");
})().catch(error => { console.error(error); process.exit(1); });
