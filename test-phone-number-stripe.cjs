const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

(async () => {
  const {
    createTourManagerBilling,
    TEST_PHONE_NUMBER_PRICE_ID: PHONE_NUMBER_PRICE_ID,
    TEST_PHONE_NUMBER_PRODUCT_ID: PHONE_NUMBER_PRODUCT_ID,
    PHONE_NUMBER_UNIT_CENTS
  } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, TransactWriteItemsCommand };
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item);
      if (records.has(key)) throw new Error("duplicate put");
      records.set(key, structuredClone(command.input.Item));
      return {};
    }
    if (command instanceof TransactWriteItemsCommand) {
      const [eventWrite, checkoutWrite, entitlementWrite, ledgerWrite] = command.input.TransactItems;
      const eventKey = keyOf(eventWrite.Put.Item);
      if (records.has(eventKey)) { const error = new Error("duplicate"); error.name = "TransactionCanceledException"; throw error; }
      records.set(eventKey, structuredClone(eventWrite.Put.Item));
      const checkout = records.get(keyOf(checkoutWrite.Update.Key));
      checkout.status = checkoutWrite.Update.ExpressionAttributeValues[":paid"];
      records.set(keyOf(entitlementWrite.Put.Item), structuredClone(entitlementWrite.Put.Item));
      records.set(keyOf(ledgerWrite.Put.Item), structuredClone(ledgerWrite.Put.Item));
      return {};
    }
    throw new Error("Unexpected command");
  } };
  const userId = "user_12345678", now = 1793700000000;
  const env = { STRIPE_SECRET_KEY: "sk_test_example", STRIPE_TOUR_MANAGER_WEBHOOK_SECRET: "whsec_example" };
  let checkoutForm;
  const stripeSession = {
    id: "cs_test_phone123", mode: "payment", payment_status: "paid", status: "complete", livemode: false,
    client_reference_id: userId, currency: "usd", amount_total: PHONE_NUMBER_UNIT_CENTS,
    metadata: { product: "danzstak_phone_activation", userId, priceId: PHONE_NUMBER_PRICE_ID },
    line_items: { data: [{ quantity: 1, price: { id: PHONE_NUMBER_PRICE_ID, product: PHONE_NUMBER_PRODUCT_ID, currency: "usd", unit_amount: PHONE_NUMBER_UNIT_CENTS } }] }
  };
  const fetcher = async (url, options = {}) => {
    if (url.endsWith("/checkout/sessions")) {
      checkoutForm = new URLSearchParams(options.body);
      return { ok: true, json: async () => ({ id: stripeSession.id, url: "https://checkout.stripe.com/c/pay/phone123" }) };
    }
    if (url.includes(`/checkout/sessions/${stripeSession.id}`)) return { ok: true, json: async () => stripeSession };
    throw new Error(`Unexpected Stripe request: ${url}`);
  };
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const service = createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders, tableName: "Tours", env, fetcher, clock: () => now });
  const event = (method, path, body = "", headers = { origin: "https://danzstak.com" }) => ({ requestContext: { http: { method } }, rawPath: path, headers, body });

  const checkout = await service(event("POST", "/phone-number/checkout"));
  assert.equal(checkout.statusCode, 200);
  assert.equal(checkoutForm.get("line_items[0][price]"), PHONE_NUMBER_PRICE_ID);
  assert.equal(checkoutForm.get("line_items[0][quantity]"), "1");
  assert.equal(checkoutForm.get("metadata[product]"), "danzstak_phone_activation");

  const notification = { id: "evt_phone123", type: "checkout.session.completed", livemode: false, data: { object: { id: stripeSession.id } } };
  const payload = JSON.stringify(notification), timestamp = Math.floor(now / 1000);
  const signature = `t=${timestamp},v1=${createHmac("sha256", env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex")}`;
  const fulfilled = await service(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": signature }));
  assert.equal(fulfilled.statusCode, 200);
  assert.equal(JSON.parse(fulfilled.body).phoneActivationEntitled, true);
  const entitlement = records.get(`${userId}|PHONE#ACTIVATION_ENTITLEMENT`);
  assert.equal(entitlement.status.S, "pending_provisioning");
  assert.equal(entitlement.priceId.S, PHONE_NUMBER_PRICE_ID);

  const duplicate = await service(event("POST", "/tour-manager/stripe/webhook", payload, { "stripe-signature": signature }));
  assert.equal(JSON.parse(duplicate.body).duplicate, true);
  const status = JSON.parse((await service(event("GET", "/phone-number/entitlement"))).body);
  assert.equal(status.entitled, true);
  assert.equal(status.provisioned, false, "Payment must not claim carrier provisioning succeeded");
  assert.equal(status.status, "pending_provisioning");
  console.log("Phone-number Stripe checks passed: fixed product and amount, signed fulfillment, duplicate protection, and provider-provisioning gate.");
})().catch(error => { console.error(error); process.exit(1); });
