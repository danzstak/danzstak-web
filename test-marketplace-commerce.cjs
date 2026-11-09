const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

(async () => {
  const {
    createMarketplaceCommerce,
    marketplaceAmounts,
    createSfsDexQuote,
    createSfsSolanaPayUrl,
    verifyEasyPostSignature,
    orderKey,
    payoutKey,
    trackerKey,
    chargeKey,
    SFS_MINT,
    SFS_PAIR,
    SFS_SETTLEMENT_WALLET,
    SFS_SETTLEMENT_TOKEN_ACCOUNT,
    WRAPPED_SOL_MINT
  } = await import("./infrastructure/auth-api/marketplace-commerce.mjs");

  assert.deepEqual(marketplaceAmounts(2_000, 500), { itemPriceCents: 2_000, shippingCents: 500, platformFeeCents: 100, sellerPayoutCents: 2_400, subtotalCents: 2_500 });
  assert.deepEqual(marketplaceAmounts(100, 1_500), { itemPriceCents: 100, shippingCents: 1_500, platformFeeCents: 5, sellerPayoutCents: 1_595, subtotalCents: 1_600 }, "shipping passes through to the seller and is not in DanzStak's 5% fee base");
  assert.throws(() => marketplaceAmounts(1.5, 0), /integer cents/);

  const quoteTime = Date.parse("2026-11-09T16:24:03.255Z");
  const dexPair = {
    schemaVersion: "1.0.0",
    pairs: [{
      chainId: "solana",
      dexId: "raydium",
      pairAddress: SFS_PAIR,
      baseToken: { address: SFS_MINT, symbol: "SFS" },
      quoteToken: { address: WRAPPED_SOL_MINT, symbol: "SOL" },
      priceUsd: "0.3011",
      priceNative: "0.003450",
      liquidity: { usd: 9638.91 }
    }]
  };
  const sfsQuote = createSfsDexQuote({ pairResponse: dexPair, usdCents: 2500, fetchedAt: quoteTime });
  assert.equal(sfsQuote.tokenAmount, "83.03", "SFS amount rounds up to the next Token-2022 smallest unit");
  assert.equal(sfsQuote.tokenAmountSmallestUnits, "8303");
  assert.equal(sfsQuote.sfsPerSol, "289.8551", "the displayed SFS/SOL ratio is derived from the live pair rather than fixed at 300");
  assert.equal(sfsQuote.expiresAt, "2026-11-09T16:27:03.255Z", "SFS market quotes expire after three minutes");
  assert.equal(sfsQuote.destinationTokenAccount, SFS_SETTLEMENT_TOKEN_ACCOUNT);
  assert.throws(() => createSfsDexQuote({ pairResponse: { pairs: [{ ...dexPair.pairs[0], pairAddress: "WrongPair1111111111111111111111111111111111" }] }, usdCents: 2500, fetchedAt: quoteTime }), /wrong SFS market/);
  assert.throws(() => createSfsDexQuote({ pairResponse: { pairs: [{ ...dexPair.pairs[0], liquidity: { usd: 4999.99 } }] }, usdCents: 2500, fetchedAt: quoteTime }), /liquidity/);
  assert.throws(() => createSfsDexQuote({ pairResponse: dexPair, usdCents: 9639, fetchedAt: quoteTime }), /too large/, "an order above 1% of pool liquidity is not quoted");
  const reference = "8Cx5YqBgS43uqDrBzeSpDyBoQSp9fH71SwQ1e39m631C";
  const paymentUrl = createSfsSolanaPayUrl({ quote: sfsQuote, reference, memoReference: "order_12345678" });
  assert.equal(paymentUrl.startsWith(`solana:${SFS_SETTLEMENT_WALLET}?`), true, "Solana Pay uses the native settlement wallet as recipient");
  const paymentParameters = new URLSearchParams(paymentUrl.split("?")[1]);
  assert.equal(paymentParameters.get("amount"), "83.03");
  assert.equal(paymentParameters.get("spl-token"), SFS_MINT);
  assert.equal(paymentParameters.get("reference"), reference);
  assert.equal(paymentUrl.includes(SFS_SETTLEMENT_TOKEN_ACCOUNT), false, "the derived token account is verified server-side, not used as the Solana Pay recipient");

  const currentTime = Date.parse("2026-11-09T12:00:30Z"), timestamp = "Sun, 09 Nov 2026 12:00:00 +0000", requestPath = "/marketplace/shipping/webhook", payload = '{"id":"evt_test"}', secret = "shipping-webhook-secret";
  const signed = createHmac("sha256", secret).update(`${timestamp}POST${requestPath}${payload}`).digest("hex");
  assert.equal(verifyEasyPostSignature({ payload, requestPath, timestamp, signedPath: requestPath, signature: `hmac-sha256-hex=${signed}`, secret, currentTime }), true);
  assert.equal(verifyEasyPostSignature({ payload, requestPath, timestamp, signedPath: "/wrong", signature: `hmac-sha256-hex=${signed}`, secret, currentTime }), false);
  assert.equal(verifyEasyPostSignature({ payload, requestPath, timestamp, signedPath: requestPath, signature: `hmac-sha256-hex=${signed}`, secret, currentTime: currentTime + 61_000 }), false, "stale shipping webhooks are rejected");

  class GetItemCommand { constructor(input) { this.input = input; } }
  class PutItemCommand { constructor(input) { this.input = input; } }
  class UpdateItemCommand { constructor(input) { this.input = input; } }
  class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
  const commands = { GetItemCommand, PutItemCommand, UpdateItemCommand, TransactWriteItemsCommand };
  const key = value => `${value.pk.S}|${value.sk.S}`;
  const clone = value => value ? structuredClone(value) : undefined;
  const values = expression => expression || {};

  class FakeDb {
    constructor() { this.items = new Map(); }
    get(value) { return this.items.get(key(value)); }
    set(value) { this.items.set(key(value), clone(value)); }
    applyUpdate(input) {
      const item = this.get(input.Key);
      if (!item) throw Object.assign(new Error("missing item"), { name: "ConditionalCheckFailedException" });
      const expression = input.UpdateExpression, attrs = values(input.ExpressionAttributeValues), at = attrs[":at"];
      if (expression.includes("reservedInventory = if_not_exists")) {
        const reserved = Number(item.reservedInventory?.N || 0), inventory = Number(item.inventory?.N || 0);
        if (reserved >= inventory || item.status?.S !== "published") throw Object.assign(new Error("sold"), { name: "TransactionCanceledException" });
        item.reservedInventory = { N: String(reserved + 1) };
      } else if (expression.includes("inventory = :zero")) {
        item.inventory = { N: "0" };
        item.reservedInventory = { N: String(Number(item.reservedInventory?.N || 0) - 1) };
        item.status = { S: "sold_out" };
        delete item.bazaarPk; delete item.bazaarSk;
      } else if (expression.includes("inventory = inventory - :one")) {
        item.inventory = { N: String(Number(item.inventory.N) - 1) };
        item.reservedInventory = { N: String(Number(item.reservedInventory?.N || 0) - 1) };
      } else if (expression.includes("reservedInventory = reservedInventory - :one")) {
        item.reservedInventory = { N: String(Number(item.reservedInventory?.N || 0) - 1) };
      }

      if (expression.includes("checkoutSessionId = :session")) {
        item.checkoutSessionId = clone(attrs[":session"]); item.checkoutUrl = clone(attrs[":url"]); item.status = clone(attrs[":open"]);
      }
      if (expression.includes("#status = :status") && attrs[":status"]) {
        item.status = clone(attrs[":status"]); item.reservationReleased = attrs[":yes"] ? clone(attrs[":yes"]) : item.reservationReleased;
      }
      if (expression.includes("#status = :paid")) {
        item.status = clone(attrs[":paid"]); item.payoutStatus = clone(attrs[":pending"]); item.paymentIntentId = clone(attrs[":intent"]); item.chargeId = clone(attrs[":charge"]); item.taxCents = clone(attrs[":tax"]); item.paidAt = clone(attrs[":at"]);
      }
      if (expression.includes("#status = :shipped")) {
        item.status = clone(attrs[":shipped"]); item.trackerId = clone(attrs[":tracker"]); item.trackingCode = clone(attrs[":code"]); item.carrier = clone(attrs[":carrier"]); item.shippedAt = clone(attrs[":at"]);
      }
      if (expression.includes("payoutStatus = :transfer")) {
        item.payoutStatus = clone(attrs[":transfer"]); item.deliveryConfirmedAt = clone(attrs[":delivered"]); item.deliverySource = clone(attrs[":source"]);
      }
      if (expression.includes("#status = :deliveredStatus")) {
        if (input.ConditionExpression && item.payoutStatus?.S !== attrs[":pending"]?.S) throw Object.assign(new Error("payout state changed"), { name: "ConditionalCheckFailedException" });
        item.status = clone(attrs[":deliveredStatus"]); item.payoutStatus = clone(attrs[":released"]); item.transferId = clone(attrs[":transfer"]); item.deliveredAt = clone(attrs[":deliveredAt"]); item.payoutReleasedAt = clone(attrs[":at"]);
      }
      if (expression.includes("#status = :refunded")) {
        item.status = clone(attrs[":refunded"]); item.payoutStatus = clone(attrs[":cancelled"]); item.refundReversalId = clone(attrs[":reversal"]); item.refundedAt = clone(attrs[":at"]);
      }
      if (expression.includes("#status = :disputed")) {
        item.status = clone(attrs[":disputed"]); item.payoutStatus = clone(attrs[":blocked"]); item.disputeId = clone(attrs[":dispute"]); item.disputeReversalId = clone(attrs[":reversal"]);
      }
      if (at) item.updatedAt = clone(at);
      this.set(item);
    }
    async send(command) {
      if (command instanceof GetItemCommand) return { Item: clone(this.get(command.input.Key)) };
      if (command instanceof PutItemCommand) {
        if (command.input.ConditionExpression && this.get(command.input.Item)) throw Object.assign(new Error("duplicate"), { name: "ConditionalCheckFailedException" });
        this.set(command.input.Item); return {};
      }
      if (command instanceof UpdateItemCommand) { this.applyUpdate(command.input); return {}; }
      if (command instanceof TransactWriteItemsCommand) {
        for (const operation of command.input.TransactItems) {
          if (operation.Put) {
            if (operation.Put.ConditionExpression && this.get(operation.Put.Item)) throw Object.assign(new Error("duplicate"), { name: "TransactionCanceledException" });
            this.set(operation.Put.Item);
          } else if (operation.Update) this.applyUpdate(operation.Update);
        }
        return {};
      }
      throw new Error(`Unsupported command ${command.constructor.name}`);
    }
  }

  const db = new FakeDb(), sellerId = "seller_12345678", buyerId = "buyer_12345678", outsiderId = "outsider_12345678", productId = "11111111-1111-4111-8111-111111111111", orderId = "22222222-2222-4222-8222-222222222222";
  db.set({ pk: { S: `SHOP#${sellerId}` }, sk: { S: "META" }, status: { S: "published" }, name: { S: "Artist Shop" } });
  db.set({ pk: { S: `SHOP#${sellerId}` }, sk: { S: `PRODUCT#${productId}` }, status: { S: "published" }, title: { S: "Tour print" }, inventory: { N: "1" }, revision: { N: "1" }, priceCents: { N: "2000" }, shippingCents: { N: "500" }, bazaarPk: { S: "BAZAAR#PUBLISHED" }, bazaarSk: { S: "2026#item" } });
  db.set({ ...payoutKey(sellerId), stripeAccountId: { S: "acct_seller12345678" }, status: { S: "ready" }, payoutsEnabled: { BOOL: true }, livemode: { BOOL: false } });

  let signedIn = buyerId, stripeTransferCalls = 0, stripeReversalCalls = 0, transferBody = "", checkoutBody = "";
  const fetcher = async (url, options = {}) => {
    if (url.endsWith("/v2/core/accounts") && options.method === "POST") return { ok: true, json: async () => ({
      id: "acct_newseller12345678",
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "pending" } } } } },
      requirements: { entries: [{ minimum_deadline: { status: "currently_due" } }] }
    }) };
    if (url.includes("/v2/core/accounts/acct_newseller12345678")) return { ok: true, json: async () => ({
      id: "acct_newseller12345678",
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } } },
      requirements: { entries: [] }
    }) };
    if (url.endsWith("/v2/core/account_links") && options.method === "POST") return { ok: true, json: async () => ({ url: "https://connect.stripe.com/setup/test-onboarding", expires_at: Math.floor(currentTime / 1000) + 300 }) };
    if (url.includes("/v2/core/accounts/acct_seller12345678")) return { ok: true, json: async () => ({
      id: "acct_seller12345678",
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } } },
      requirements: { entries: [] }
    }) };
    if (url.endsWith("/v1/checkout/sessions") && options.method === "POST") {
      checkoutBody = options.body;
      return { ok: true, json: async () => ({ id: "cs_test_checkout12345678", url: "https://checkout.stripe.com/c/pay/test" }) };
    }
    if (url.includes("/v1/checkout/sessions/cs_test_checkout12345678")) return { ok: true, json: async () => ({
      id: "cs_test_checkout12345678", livemode: false, mode: "payment", status: "complete", payment_status: "paid", currency: "usd",
      amount_subtotal: 2000, amount_total: 2500, total_details: { amount_tax: 0, amount_shipping: 500 }, client_reference_id: buyerId,
      metadata: { orderId, buyerId, sellerId, productId }, payment_intent: { id: "pi_payment12345678", latest_charge: { id: "ch_charge12345678" } }
    }) };
    if (url.endsWith("/v2/trackers")) return { ok: true, json: async () => ({ id: "trk_tracker12345678", object: "Tracker", tracking_code: "9400111899223856928499", carrier: "USPS" }) };
    if (url.endsWith("/v1/transfers")) {
      stripeTransferCalls += 1; transferBody = options.body;
      return { ok: true, json: async () => ({ id: "tr_transfer12345678", amount: 2400, destination: "acct_seller12345678" }) };
    }
    if (url.includes("/v1/charges/ch_charge12345678")) return { ok: true, json: async () => ({ id: "ch_charge12345678", amount: 2500, amount_refunded: 2500, refunded: true }) };
    if (url.includes("/v1/disputes/dp_dispute12345678")) return { ok: true, json: async () => ({ id: "dp_dispute12345678", charge: "ch_dispute12345678", status: "needs_response" }) };
    if (url.includes("/v1/transfers/tr_transfer12345678/reversals")) {
      stripeReversalCalls += 1;
      return { ok: true, json: async () => ({ id: "trr_reversal12345678", amount: 2400 }) };
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  const env = { STRIPE_SECRET_KEY: "sk_test_marketplace", STRIPE_MARKETPLACE_WEBHOOK_SECRET: "whsec_marketplace", MARKETPLACE_CHECKOUT_ENABLED: "true", MARKETPLACE_SHIPPING_COUNTRIES: "US,CA", EASYPOST_API_KEY: "EZAK_test", EASYPOST_WEBHOOK_SECRET: secret };
  const service = createMarketplaceCommerce({ db, commands, authenticate: async () => signedIn, corsHeaders: origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {}, tableName: "Market", env, fetcher, clock: () => currentTime, uuid: () => orderId });
  const apiEvent = (method, path, body, headers = {}) => ({ rawPath: path, requestContext: { http: { method } }, headers: { origin: "https://danzstak.com", ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });

  const checkout = await service(apiEvent("POST", "/marketplace/checkout", { sellerId, productId }));
  assert.equal(checkout.statusCode, 201);
  assert.equal(JSON.parse(checkout.body).platformFeeCents, 100, "the buyer-facing checkout summary uses 5% of the item price only");
  const checkoutForm = new URLSearchParams(checkoutBody);
  assert.equal(checkoutForm.get("line_items[0][price_data][unit_amount]"), "2000", "the item is the canonical Checkout line item");
  assert.equal(checkoutForm.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), "500", "seller shipping is a separate canonical Checkout amount");
  assert.equal(db.get({ pk: { S: `SHOP#${sellerId}` }, sk: { S: `PRODUCT#${productId}` } }).reservedInventory.N, "1");
  assert.equal(db.get(orderKey(orderId)).status.S, "checkout_open");

  const stripePayload = JSON.stringify({ id: "evt_checkout12345678", type: "checkout.session.completed", data: { object: { id: "cs_test_checkout12345678" } } });
  const stripeTimestamp = Math.floor(currentTime / 1000), stripeSignature = createHmac("sha256", env.STRIPE_MARKETPLACE_WEBHOOK_SECRET).update(`${stripeTimestamp}.${stripePayload}`).digest("hex");
  const paid = await service(apiEvent("POST", "/marketplace/stripe/webhook", stripePayload, { origin: undefined, "stripe-signature": `t=${stripeTimestamp},v1=${stripeSignature}` }));
  assert.equal(paid.statusCode, 200);
  assert.equal(db.get(orderKey(orderId)).status.S, "paid_pending_shipment");
  assert.equal(db.get(orderKey(orderId)).chargeId.S, "ch_charge12345678", "the Charge ID—not the PaymentIntent—is stored as the later transfer source_transaction");
  assert.equal(db.get({ pk: { S: `SHOP#${sellerId}` }, sk: { S: `PRODUCT#${productId}` } }).inventory.N, "0");

  signedIn = sellerId;
  const tracked = await service(apiEvent("POST", `/marketplace/orders/${orderId}/tracking`, { trackingCode: "9400111899223856928499", carrier: "USPS" }));
  assert.equal(tracked.statusCode, 200);
  assert.equal(db.get(trackerKey("trk_tracker12345678")).orderId.S, orderId);

  const deliveredPayload = JSON.stringify({ id: "evt_delivery12345678", object: "Event", description: "tracker.updated", result: { id: "trk_tracker12345678", object: "Tracker", status: "delivered", updated_at: "2026-11-09T12:00:20Z" } });
  const deliverySignature = createHmac("sha256", secret).update(`${timestamp}POST${requestPath}${deliveredPayload}`).digest("hex");
  const delivery = await service(apiEvent("POST", requestPath, deliveredPayload, { origin: undefined, "x-timestamp": timestamp, "x-path": requestPath, "x-hmac-signature-v2": `hmac-sha256-hex=${deliverySignature}` }));
  assert.equal(delivery.statusCode, 200);
  assert.equal(db.get(orderKey(orderId)).status.S, "delivered");
  assert.equal(db.get(orderKey(orderId)).payoutStatus.S, "released");
  assert.equal(stripeTransferCalls, 1);
  const transfer = new URLSearchParams(transferBody);
  assert.equal(transfer.get("amount"), "2400", "seller receives item price minus 5% plus all shipping");
  assert.equal(transfer.get("source_transaction"), "ch_charge12345678");
  assert.equal(transfer.get("destination"), "acct_seller12345678");

  const duplicateDelivery = await service(apiEvent("POST", requestPath, deliveredPayload, { origin: undefined, "x-timestamp": timestamp, "x-path": requestPath, "x-hmac-signature-v2": `hmac-sha256-hex=${deliverySignature}` }));
  assert.equal(duplicateDelivery.statusCode, 200);
  assert.equal(stripeTransferCalls, 1, "a duplicate delivery webhook cannot issue a second seller transfer");

  const disputedOrderId = "33333333-3333-4333-8333-333333333333";
  db.set({ ...orderKey(disputedOrderId), orderId: { S: disputedOrderId }, buyerId: { S: buyerId }, sellerId: { S: sellerId }, chargeId: { S: "ch_dispute12345678" }, status: { S: "paid_pending_shipment" }, payoutStatus: { S: "pending_delivery" }, itemPriceCents: { N: "2000" }, shippingCents: { N: "500" }, sellerPayoutCents: { N: "2400" }, subtotalCents: { N: "2500" }, taxCents: { N: "0" } });
  db.set({ ...chargeKey("ch_dispute12345678"), orderId: { S: disputedOrderId } });
  const disputePayload = JSON.stringify({ id: "evt_dispute12345678", type: "charge.dispute.created", data: { object: { id: "dp_dispute12345678" } } });
  const disputeSignature = createHmac("sha256", env.STRIPE_MARKETPLACE_WEBHOOK_SECRET).update(`${stripeTimestamp}.${disputePayload}`).digest("hex");
  const disputed = await service(apiEvent("POST", "/marketplace/stripe/webhook", disputePayload, { origin: undefined, "stripe-signature": `t=${stripeTimestamp},v1=${disputeSignature}` }));
  assert.equal(disputed.statusCode, 200);
  assert.equal(db.get(orderKey(disputedOrderId)).status.S, "disputed");
  assert.equal(db.get(orderKey(disputedOrderId)).payoutStatus.S, "blocked", "a dispute blocks an unreleased seller payout");
  assert.equal(stripeReversalCalls, 0, "a payout that was never released does not create a transfer reversal");

  const refundPayload = JSON.stringify({ id: "evt_refund12345678", type: "charge.refunded", data: { object: { id: "ch_charge12345678" } } });
  const refundSignature = createHmac("sha256", env.STRIPE_MARKETPLACE_WEBHOOK_SECRET).update(`${stripeTimestamp}.${refundPayload}`).digest("hex");
  const refund = await service(apiEvent("POST", "/marketplace/stripe/webhook", refundPayload, { origin: undefined, "stripe-signature": `t=${stripeTimestamp},v1=${refundSignature}` }));
  assert.equal(refund.statusCode, 200);
  assert.equal(db.get(orderKey(orderId)).status.S, "refunded");
  assert.equal(db.get(orderKey(orderId)).payoutStatus.S, "cancelled");
  assert.equal(stripeReversalCalls, 1, "a full refund reverses a seller transfer that was already released");
  const duplicateRefund = await service(apiEvent("POST", "/marketplace/stripe/webhook", refundPayload, { origin: undefined, "stripe-signature": `t=${stripeTimestamp},v1=${refundSignature}` }));
  assert.equal(duplicateRefund.statusCode, 200);
  assert.equal(stripeReversalCalls, 1, "a duplicate refund webhook cannot reverse the same seller transfer twice");

  signedIn = outsiderId;
  assert.equal((await service(apiEvent("GET", `/marketplace/orders/${orderId}`))).statusCode, 404, "orders are private to buyer and seller");
  signedIn = buyerId;
  const buyerOrder = await service(apiEvent("GET", `/marketplace/orders/${orderId}`));
  assert.equal(buyerOrder.statusCode, 200);
  assert.equal(JSON.parse(buyerOrder.body).order.sellerPayoutCents, undefined, "buyer responses do not expose seller payout accounting");

  const newSellerId = "new_seller_12345678";
  signedIn = newSellerId;
  const onboarding = await service(apiEvent("POST", "/marketplace/payouts/onboarding", { country: "US" }));
  assert.equal(onboarding.statusCode, 201);
  assert.equal(JSON.parse(onboarding.body).onboardingUrl, "https://connect.stripe.com/setup/test-onboarding");
  assert.equal(db.get(payoutKey(newSellerId, false)).status.S, "onboarding", "new sellers remain pending until Stripe activates transfers");
  const connected = await service(apiEvent("GET", "/marketplace/payouts/status"));
  assert.equal(connected.statusCode, 200);
  assert.equal(JSON.parse(connected.body).ready, true);
  assert.equal(db.get(payoutKey(newSellerId, false)).status.S, "ready", "server-side Stripe verification enables the seller payout account");

  const invalidStripe = await service(apiEvent("POST", "/marketplace/stripe/webhook", stripePayload, { origin: undefined, "stripe-signature": "invalid" }));
  assert.equal(invalidStripe.statusCode, 400);
  const invalidShipping = await service(apiEvent("POST", requestPath, deliveredPayload, { origin: undefined, "x-timestamp": timestamp, "x-path": requestPath, "x-hmac-signature-v2": "hmac-sha256-hex=bad" }));
  assert.equal(invalidShipping.statusCode, 401);

  const disabled = createMarketplaceCommerce({ db, commands, authenticate: async () => buyerId, corsHeaders: origin => ({ "access-control-allow-origin": origin }), tableName: "Market", env: { ...env, MARKETPLACE_CHECKOUT_ENABLED: "false" }, fetcher, clock: () => currentTime });
  assert.equal((await disabled(apiEvent("POST", "/marketplace/checkout", { sellerId, productId }))).statusCode, 503, "commerce remains fail-closed until explicitly enabled");

  class CheckoutFailureDb extends FakeDb {
    async send(command) {
      if (!this.failedCheckoutWrite && command instanceof UpdateItemCommand && command.input.UpdateExpression.includes("checkoutUrl = :url")) {
        this.failedCheckoutWrite = true;
        throw Object.assign(new Error("simulated ledger write failure"), { name: "InternalServerError" });
      }
      return super.send(command);
    }
  }
  const failedDb = new CheckoutFailureDb(), failedOrderId = "44444444-4444-4444-8444-444444444444";
  failedDb.set({ pk: { S: `SHOP#${sellerId}` }, sk: { S: "META" }, status: { S: "published" } });
  failedDb.set({ pk: { S: `SHOP#${sellerId}` }, sk: { S: `PRODUCT#${productId}` }, status: { S: "published" }, title: { S: "Test print" }, inventory: { N: "1" }, revision: { N: "1" }, priceCents: { N: "2000" }, shippingCents: { N: "500" } });
  failedDb.set({ ...payoutKey(sellerId, false), stripeAccountId: { S: "acct_seller12345678" }, status: { S: "ready" }, payoutsEnabled: { BOOL: true }, livemode: { BOOL: false } });
  let expiredSessions = 0;
  const failureFetcher = async (url, options = {}) => {
    if (url.includes("/v2/core/accounts/acct_seller12345678")) return fetcher(url, options);
    if (url.endsWith("/v1/checkout/sessions")) return { ok: true, json: async () => ({ id: "cs_test_orphan12345678", url: "https://checkout.stripe.com/c/pay/orphan" }) };
    if (url.endsWith("/v1/checkout/sessions/cs_test_orphan12345678/expire")) {
      expiredSessions += 1;
      return { ok: true, json: async () => ({ id: "cs_test_orphan12345678", status: "expired" }) };
    }
    throw new Error(`Unexpected failure-test fetch ${url}`);
  };
  const failureService = createMarketplaceCommerce({ db: failedDb, commands, authenticate: async () => buyerId, corsHeaders: origin => ({ "access-control-allow-origin": origin }), tableName: "Market", env, fetcher: failureFetcher, clock: () => currentTime, uuid: () => failedOrderId });
  const failedCheckout = await failureService(apiEvent("POST", "/marketplace/checkout", { sellerId, productId }));
  assert.equal(failedCheckout.statusCode, 502);
  assert.equal(expiredSessions, 1, "a Stripe Session is expired when its ledger write fails");
  assert.equal(failedDb.get({ pk: { S: `SHOP#${sellerId}` }, sk: { S: `PRODUCT#${productId}` } }).reservedInventory.N, "0", "inventory is released only after the orphan Checkout Session is expired");
  assert.equal(failedDb.get(orderKey(failedOrderId)).status.S, "checkout_failed");

  const raceDb = new FakeDb(), raceOrderId = "55555555-5555-4555-8555-555555555555", raceTrackerId = "trk_race12345678";
  raceDb.set({ ...orderKey(raceOrderId), orderId: { S: raceOrderId }, buyerId: { S: buyerId }, sellerId: { S: sellerId }, status: { S: "shipped" }, payoutStatus: { S: "pending_delivery" }, sellerPayoutCents: { N: "2400" }, stripeAccountId: { S: "acct_seller12345678" }, chargeId: { S: "ch_race12345678" }, transferGroup: { S: "DS_ORDER_RACE" }, trackerId: { S: raceTrackerId } });
  raceDb.set({ ...trackerKey(raceTrackerId), orderId: { S: raceOrderId } });
  let raceTransfers = 0, raceReversals = 0;
  const raceFetcher = async (url) => {
    if (url.endsWith("/v1/transfers")) {
      raceTransfers += 1;
      const changed = raceDb.get(orderKey(raceOrderId));
      changed.status = { S: "disputed" }; changed.payoutStatus = { S: "blocked" }; raceDb.set(changed);
      return { ok: true, json: async () => ({ id: "tr_race12345678", amount: 2400, destination: "acct_seller12345678" }) };
    }
    if (url.includes("/v1/transfers/tr_race12345678/reversals")) {
      raceReversals += 1;
      return { ok: true, json: async () => ({ id: "trr_race12345678", amount: 2400 }) };
    }
    throw new Error(`Unexpected race-test fetch ${url}`);
  };
  const raceService = createMarketplaceCommerce({ db: raceDb, commands, authenticate: async () => buyerId, corsHeaders: origin => ({ "access-control-allow-origin": origin }), tableName: "Market", env, fetcher: raceFetcher, clock: () => currentTime });
  const racePayload = JSON.stringify({ id: "evt_race12345678", object: "Event", description: "tracker.updated", result: { id: raceTrackerId, object: "Tracker", status: "delivered", updated_at: "2026-11-09T12:00:25Z" } });
  const raceSignature = createHmac("sha256", secret).update(`${timestamp}POST${requestPath}${racePayload}`).digest("hex");
  const racedDelivery = await raceService(apiEvent("POST", requestPath, racePayload, { origin: undefined, "x-timestamp": timestamp, "x-path": requestPath, "x-hmac-signature-v2": `hmac-sha256-hex=${raceSignature}` }));
  assert.equal(racedDelivery.statusCode, 503);
  assert.equal(raceTransfers, 1);
  assert.equal(raceReversals, 1, "a refund/dispute race after transfer creation is compensated immediately");
  assert.equal(raceDb.get(orderKey(raceOrderId)).payoutStatus.S, "blocked", "the race cannot overwrite the refund or dispute block");

  console.log("Marketplace commerce tests passed: item-only 5% fee, Connect onboarding, inventory reservation, verified payment, signed delivery, dispute/refund handling, one-time seller transfer and account isolation.");
})().catch(error => { console.error(error); process.exit(1); });
