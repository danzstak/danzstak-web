const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

(async () => {
  const {
    createTourManagerBilling,
    TEST_SYNC_NETWORK_NUMBER_PRICE_ID,
    TEST_SYNC_NETWORK_NUMBER_PRODUCT_ID,
    SYNC_NETWORK_NUMBER_UNIT_CENTS
  } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");

  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, TransactWriteItemsCommand };
  const records = new Map();
  const keyOf = key => `${key.userId.S}|${key.tourId.S}`;

  function conditionalFailure() {
    const error = new Error("Conditional request failed");
    error.name = "TransactionCanceledException";
    return error;
  }

  function put(input, target) {
    const key = keyOf(input.Item);
    if (input.ConditionExpression?.includes("attribute_not_exists") && target.has(key)) throw conditionalFailure();
    target.set(key, structuredClone(input.Item));
  }

  function update(input, target) {
    const key = keyOf(input.Key), item = target.get(key);
    if (!item) throw conditionalFailure();
    const values = input.ExpressionAttributeValues || {};
    if (input.ConditionExpression?.includes("#status <> :paid") && item.status?.S === values[":paid"]?.S) throw conditionalFailure();
    if (input.ConditionExpression?.includes("#status = :paid") && item.status?.S !== values[":paid"]?.S) throw conditionalFailure();
    if (input.ConditionExpression?.includes("sessionId = :sessionId") && item.sessionId?.S !== values[":sessionId"]?.S) throw conditionalFailure();
    if (input.ConditionExpression?.includes("paymentReference = :sessionId") && item.paymentReference?.S !== values[":sessionId"]?.S) throw conditionalFailure();
    if (input.ConditionExpression?.includes("ownerUserId = :owner") && item.ownerUserId?.S !== values[":owner"]?.S) throw conditionalFailure();
    const names = input.ExpressionAttributeNames || {};
    const assignments = String(input.UpdateExpression || "").replace(/^SET\s+/, "").split(",");
    for (const assignment of assignments) {
      const match = assignment.trim().match(/^([^\s]+)\s*=\s*(:[A-Za-z0-9]+)$/);
      if (!match || !values[match[2]]) continue;
      const field = names[match[1]] || match[1];
      item[field] = structuredClone(values[match[2]]);
    }
    target.set(key, item);
  }

  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: structuredClone(records.get(keyOf(command.input.Key))) };
    if (command instanceof PutItemCommand) { put(command.input, records); return {}; }
    if (command instanceof TransactWriteItemsCommand) {
      const staged = new Map([...records].map(([key, value]) => [key, structuredClone(value)]));
      for (const action of command.input.TransactItems) {
        if (action.Put) put(action.Put, staged);
        else if (action.Update) update(action.Update, staged);
        else throw new Error("Unexpected transaction action");
      }
      records.clear();
      for (const [key, value] of staged) records.set(key, value);
      return {};
    }
    throw new Error(`Unexpected command: ${command.constructor.name}`);
  } };

  const users = ["owner_12345678", "buyer_87654321"];
  let activeUser = users[0], sessionNumber = 0;
  const sessions = new Map(), checkoutForms = [];
  const expectedAccount = "acct_DanzStakTest123";
  const now = Date.parse("2026-11-11T12:00:00.000Z");
  const env = {
    STRIPE_SECRET_KEY: "sk_test_example",
    STRIPE_TOUR_MANAGER_WEBHOOK_SECRET: "whsec_example",
    STRIPE_SYNC_NETWORK_WEBHOOK_SECRET: "whsec_sync_network_example",
    STRIPE_EXPECTED_ACCOUNT_ID: expectedAccount,
    SYNC_NETWORK_NUMBER_TEST_CHECKOUT_ENABLED: "true",
    SYNC_NETWORK_NUMBER_RETURN_BASE_URL: "https://review.danzstak.com"
  };
  const aliasSequence = ["DS-123-1234", "DS-123-1234", "DS-987-6543"];

  const fetcher = async (url, options = {}) => {
    if (url.endsWith("/account")) return { ok: true, json: async () => ({ id: expectedAccount, livemode: false }) };
    if (url.endsWith("/checkout/sessions") && options.method === "POST") {
      const form = new URLSearchParams(options.body);
      checkoutForms.push(form);
      sessionNumber += 1;
      const id = `cs_test_ds${sessionNumber}`;
      const session = {
        id, mode: "payment", payment_status: "paid", status: "complete", livemode: false,
        client_reference_id: activeUser, currency: "usd", amount_total: SYNC_NETWORK_NUMBER_UNIT_CENTS,
        payment_intent: `pi_ds${sessionNumber}`,
        metadata: { product: "danzstak_sync_network_alias", userId: activeUser, priceId: TEST_SYNC_NETWORK_NUMBER_PRICE_ID },
        line_items: { data: [{ quantity: 1, price: { id: TEST_SYNC_NETWORK_NUMBER_PRICE_ID, product: TEST_SYNC_NETWORK_NUMBER_PRODUCT_ID, currency: "usd", unit_amount: SYNC_NETWORK_NUMBER_UNIT_CENTS } }] }
      };
      sessions.set(id, session);
      return { ok: true, json: async () => ({ id, url: `https://checkout.stripe.com/c/pay/${id}` }) };
    }
    const sessionId = [...sessions.keys()].find(id => url.includes(`/checkout/sessions/${id}`));
    if (sessionId) return { ok: true, json: async () => sessions.get(sessionId) };
    const paymentIntent = [...sessions.values()].find(session => url.includes(encodeURIComponent(session.payment_intent)));
    if (url.includes("/checkout/sessions?payment_intent=") && paymentIntent) return { ok: true, json: async () => ({ data: [paymentIntent] }) };
    throw new Error(`Unexpected Stripe request: ${url}`);
  };
  const corsHeaders = origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {};
  const service = createTourManagerBilling({
    db, commands, authenticate: async () => activeUser, corsHeaders, tableName: "Tours", env, fetcher,
    clock: () => now, aliasGenerator: () => aliasSequence.shift()
  });
  const request = (method, path, body = "", headers = { origin: "https://danzstak.com" }) => ({ requestContext: { http: { method } }, rawPath: path, headers, body });
  const signedEvent = async (id, type, object, livemode = false) => {
    const payload = JSON.stringify({ id, type, livemode, data: { object } });
    const timestamp = Math.floor(now / 1000);
    const signature = `t=${timestamp},v1=${createHmac("sha256", env.STRIPE_SYNC_NETWORK_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex")}`;
    return service(request("POST", "/sync-network-number/stripe/webhook", payload, { "stripe-signature": signature }));
  };

  const legacyCarrier = await service(request("POST", "/phone-number/checkout"));
  assert.equal(legacyCarrier.statusCode, 503, "carrier-number checkout must stay disabled");

  const firstCheckout = await service(request("POST", "/sync-network-number/checkout"));
  assert.equal(firstCheckout.statusCode, 200);
  assert.equal(checkoutForms[0].get("line_items[0][price]"), TEST_SYNC_NETWORK_NUMBER_PRICE_ID);
  assert.equal(checkoutForms[0].get("line_items[0][quantity]"), "1");
  assert.equal(checkoutForms[0].get("metadata[product]"), "danzstak_sync_network_alias");
  assert.equal(checkoutForms[0].get("client_reference_id"), users[0]);
  assert.equal(checkoutForms[0].get("success_url"), "https://review.danzstak.com/messages.html?sync-number=payment-success");
  assert.equal(checkoutForms[0].get("cancel_url"), "https://review.danzstak.com/messages.html?sync-number=payment-cancelled");
  const firstSession = sessions.get("cs_test_ds1");
  const firstPaid = await signedEvent("evt_dsfirst", "checkout.session.completed", { id: firstSession.id });
  const firstResult = JSON.parse(firstPaid.body);
  assert.equal(firstResult.syncNetworkNumberAssigned, true);
  assert.equal(firstResult.alias, "DS-123-1234");

  const firstDuplicate = await signedEvent("evt_dsfirst", "checkout.session.completed", { id: firstSession.id });
  assert.equal(JSON.parse(firstDuplicate.body).duplicate, true, "same webhook event must be idempotent");
  assert.equal([...records.values()].filter(item => item.ownerUserId?.S === users[0] && item.alias?.S).length, 1);

  const ownerStatus = JSON.parse((await service(request("GET", "/sync-network-number/entitlement"))).body);
  assert.equal(ownerStatus.alias, "DS-123-1234");
  assert.equal(ownerStatus.carrierNumber, false);
  assert.equal(ownerStatus.receivesSms, false);
  assert.equal(ownerStatus.emergencyCalling, false);
  assert.equal(ownerStatus.deviceOtpRequired, true, "DS alias must never bypass per-device OTP");

  activeUser = users[1];
  const privateStatus = JSON.parse((await service(request("GET", "/sync-network-number/entitlement"))).body);
  assert.equal(privateStatus.alias, "", "another account must not see an owner's DS alias");
  const secondCheckout = await service(request("POST", "/sync-network-number/checkout"));
  assert.equal(secondCheckout.statusCode, 200);
  const secondPaid = await signedEvent("evt_dssecond", "checkout.session.completed", { id: "cs_test_ds2" });
  const secondResult = JSON.parse(secondPaid.body);
  assert.equal(secondResult.alias, "DS-987-6543", "a collision must retry with a different alias");
  assert.notEqual(secondResult.alias, ownerStatus.alias);

  const refund = { id: "ch_dsfirst", payment_intent: firstSession.payment_intent, currency: "usd", amount: 300, amount_refunded: 300 };
  const refunded = await signedEvent("evt_dsrefund", "charge.refunded", refund);
  assert.equal(JSON.parse(refunded.body).refunded, true);
  activeUser = users[0];
  const retiredStatus = JSON.parse((await service(request("GET", "/sync-network-number/entitlement"))).body);
  assert.equal(retiredStatus.entitled, false);
  assert.equal(retiredStatus.alias, "", "refunded aliases must stop being served");
  assert.equal(records.get("SYNC#NETWORK_ALIAS|DS-123-1234").status.S, "retired", "refunded alias must be retired, not recycled");

  const mismatchedEnv = { ...env, STRIPE_EXPECTED_ACCOUNT_ID: "acct_WrongAccount" };
  const mismatched = createTourManagerBilling({ db, commands, authenticate: async () => users[0], corsHeaders, tableName: "Tours", env: mismatchedEnv, fetcher, clock: () => now });
  const rejected = await mismatched(request("POST", "/sync-network-number/checkout"));
  assert.equal(rejected.statusCode, 503, "Stripe account mismatch must fail closed");

  console.log("SYNC Network number Stripe checks passed: DanzStak Test catalog binding, private unique aliases, collision retry, webhook idempotency, refund retirement, legacy carrier gate, and mandatory device OTP.");
})().catch(error => { console.error(error); process.exit(1); });
