"use strict";

const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

(async () => {
  const module = await import("./infrastructure/auth-api/marketplace-payments.mjs");
  const { createMarketplacePayments, marketplaceFeeCents, sellerPayoutCents, verifyStripeSignature } = module;
  assert.equal(marketplaceFeeCents(2_500), 125);
  assert.equal(sellerPayoutCents(2_500, 500), 2_875, "seller receives item less 5% plus all shipping");
  assert.throws(() => marketplaceFeeCents(12.5), /integer cents/);

  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand };
  const records = new Map(), keyOf = value => `${value.pk.S}|${value.sk.S}`;
  const clone = value => structuredClone(value);

  function condition(input, source) {
    const current = source.get(keyOf(input.Key || input.Item));
    const expression = input.ConditionExpression || "";
    if (expression === "attribute_not_exists(pk)" && current) throw Object.assign(new Error("exists"), { name:"ConditionalCheckFailedException" });
    if (expression.includes("#status = :status") && current?.status?.S !== input.ExpressionAttributeValues[":status"].S) throw Object.assign(new Error("status"), { name:"ConditionalCheckFailedException" });
    if (expression.includes("#status = :pending") && current?.status?.S !== input.ExpressionAttributeValues[":pending"].S) throw Object.assign(new Error("status"), { name:"ConditionalCheckFailedException" });
    if (expression.includes("#status = :held") && current?.status?.S !== input.ExpressionAttributeValues[":held"].S) throw Object.assign(new Error("status"), { name:"ConditionalCheckFailedException" });
    if (expression.includes("#status = :shipped") && current?.status?.S !== input.ExpressionAttributeValues[":shipped"].S) throw Object.assign(new Error("status"), { name:"ConditionalCheckFailedException" });
    if (expression.includes("inventoryRestored = :false") && current?.inventoryRestored?.BOOL !== false) throw Object.assign(new Error("restored"), { name:"ConditionalCheckFailedException" });
    if (expression.includes("inventory >= :one") && Number(current?.inventory?.N || 0) < Number(input.ExpressionAttributeValues[":one"].N)) throw Object.assign(new Error("stock"), { name:"ConditionalCheckFailedException" });
    if (expression.includes("#status = :published") && current?.status?.S !== input.ExpressionAttributeValues[":published"].S) throw Object.assign(new Error("published"), { name:"ConditionalCheckFailedException" });
  }
  function applyPut(input, source) { condition(input, source); source.set(keyOf(input.Item), clone(input.Item)); }
  function applyUpdate(input, source) {
    condition(input, source); const key = keyOf(input.Key), current = clone(source.get(key)); if (!current) throw Object.assign(new Error("missing"), { name:"ConditionalCheckFailedException" });
    current.inventory = { N:String(Number(current.inventory.N) + Number(input.ExpressionAttributeValues[input.UpdateExpression.includes(":minusOne") ? ":minusOne" : ":one"].N)) };
    current.updatedAt = clone(input.ExpressionAttributeValues[":at"]); source.set(key, current);
  }
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item:clone(records.get(keyOf(command.input.Key))) };
    if (command instanceof PutItemCommand) { applyPut(command.input, records); return {}; }
    if (command instanceof QueryCommand) {
      const partition = command.input.ExpressionAttributeValues[":pk"].S;
      const items = [...records.values()].filter(item => item.pk?.S === partition && item.sk?.S?.startsWith("ORDER#")).sort((left,right) => right.sk.S.localeCompare(left.sk.S));
      return { Items:clone(items) };
    }
    if (command instanceof TransactWriteItemsCommand) {
      const staged = new Map([...records.entries()].map(([key, value]) => [key, clone(value)]));
      try { for (const operation of command.input.TransactItems) { if (operation.Put) applyPut(operation.Put, staged); else if (operation.Update) applyUpdate(operation.Update, staged); else throw new Error("Unsupported operation"); } }
      catch (error) { error.name = "TransactionCanceledException"; throw error; }
      records.clear(); for (const [key, value] of staged) records.set(key, value); return {};
    }
    throw new Error(`Unexpected ${command.constructor.name}`);
  } };

  const sellerId = "seller_12345678", buyerId = "buyer_12345678", productId = "11111111-1111-4111-8111-111111111111";
  const now = "2026-11-10T12:00:00.000Z";
  records.set(`SHOP#${sellerId}|META`, { pk:{S:`SHOP#${sellerId}`}, sk:{S:"META"}, ownerId:{S:sellerId}, name:{S:"Seller shop"}, status:{S:"published"} });
  const product = { pk:{S:`SHOP#${sellerId}`}, sk:{S:`PRODUCT#${productId}`}, productId:{S:productId}, ownerId:{S:sellerId}, title:{S:"Tour shirt"}, priceCents:{N:"2500"}, shippingCents:{N:"500"}, inventory:{N:"2"}, status:{S:"published"}, currency:{S:"usd"}, updatedAt:{S:now} };
  records.set(keyOf(product), clone(product)); records.set(`BAZAAR|PRODUCT#${productId}`, { ...clone(product), pk:{S:"BAZAAR"}, shopName:{S:"Seller shop"} });

  let signedIn = sellerId, transferRequest, refundRequest;
  const stripe = {
    async createConnectedAccount() { return { id:"acct_test_seller", details_submitted:false, payouts_enabled:false, capabilities:{transfers:"pending"} }; },
    async retrieveAccount() { return { id:"acct_test_seller", details_submitted:true, payouts_enabled:true, capabilities:{transfers:"active"} }; },
    async createAccountLink() { return { url:"https://connect.stripe.com/test/onboarding" }; },
    async createCheckoutSession(order) { return { id:"cs_test_marketplace", url:"https://checkout.stripe.com/c/pay/test" , order}; },
    async retrieveCheckoutSession() { return { id:"cs_test_marketplace", livemode:false, payment_status:"paid", amount_total:3000, currency:"usd", payment_intent:"pi_test_marketplace", metadata:{orderId:activeOrderId}, collected_information:{shipping_details:{name:"Test Buyer",address:{line1:"1 Test Way",city:"Seattle",state:"WA",postal_code:"98101",country:"US"}}} }; },
    async retrievePaymentIntent() { return { id:"pi_test_marketplace", status:"succeeded", amount_received:3000, latest_charge:"ch_test_marketplace" }; },
    async createTransfer(order, destination, charge) { transferRequest={order,destination,charge}; return {id:"tr_test_marketplace"}; },
    async createRefund(order) { refundRequest=order; return {id:"re_test_marketplace",status:"succeeded"}; }
  };
  const corsHeaders = origin => origin === "https://danzstak.com" ? {"access-control-allow-origin":origin} : {};
  const service = createMarketplacePayments({ db, commands, authenticate:async()=>signedIn, corsHeaders, tableName:"Marketplace", stripe, env:{STRIPE_MARKETPLACE_WEBHOOK_SECRET:"whsec_test_marketplace"}, clock:()=>Date.parse(now) });
  const event = (method, path, body, headers={origin:"https://danzstak.com"}) => ({ requestContext:{http:{method}}, rawPath:path, headers, body:body === undefined ? "" : JSON.stringify(body) });
  const bodyOf = result => JSON.parse(result.body);

  const missingStatus = bodyOf(await service(event("GET", "/marketplace/seller/status"))).seller;
  assert.equal(missingStatus.connected, false);
  const onboard = await service(event("POST", "/marketplace/seller/onboarding", {}));
  assert.equal(onboard.statusCode, 200);
  assert.match(bodyOf(onboard).onboardingUrl, /^https:\/\/connect\.stripe\.com/);
  const ready = bodyOf(await service(event("GET", "/marketplace/seller/status"))).seller;
  assert.equal(ready.ready, true);

  signedIn = buyerId;
  const checkout = await service(event("POST", "/marketplace/checkout", {productId}));
  assert.equal(checkout.statusCode, 201);
  assert.equal(bodyOf(checkout).mode, "test");
  assert.match(bodyOf(checkout).checkoutUrl, /^https:\/\/checkout\.stripe\.com/);
  const activeOrderId = bodyOf(checkout).order.id;
  assert.equal(records.get(`SHOP#${sellerId}|PRODUCT#${productId}`).inventory.N, "1", "checkout reserves seller stock");
  assert.equal(records.get(`BAZAAR|PRODUCT#${productId}`).inventory.N, "1", "checkout reserves Bazaar stock");

  const webhookSecret = "whsec_test_marketplace";
  const stripeEvent = { id:"evt_test_marketplace_paid", type:"checkout.session.completed", data:{object:{id:"cs_test_marketplace",metadata:{orderId:activeOrderId}}} };
  const payload = JSON.stringify(stripeEvent), timestamp = Math.floor(Date.parse(now)/1000), signature = createHmac("sha256",webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
  assert.equal(verifyStripeSignature(Buffer.from(payload),`t=${timestamp},v1=${signature}`,webhookSecret,timestamp),true);
  const webhook = event("POST", "/marketplace/stripe/webhook", undefined, {"stripe-signature":`t=${timestamp},v1=${signature}`});
  webhook.body = payload;
  const handled = await service(webhook);
  assert.equal(handled.statusCode, 200);
  assert.equal(records.get(`ORDER#${activeOrderId}|META`).status.S, "paid_held");
  const duplicate = await service(webhook); assert.equal(bodyOf(duplicate).duplicate, true, "duplicate webhook is idempotent");

  signedIn = sellerId;
  const sellerOrders = bodyOf(await service({...event("GET", "/marketplace/orders"),queryStringParameters:{role:"seller"}})).orders;
  assert.equal(sellerOrders.length, 1, "seller can see the paid order without knowing its ID");
  assert.equal(sellerOrders[0].status, "paid_held");
  assert.equal(sellerOrders[0].shipping.postalCode, "98101", "seller can see the verified checkout shipping address");
  const shipped = await service(event("POST", `/marketplace/orders/${activeOrderId}/ship`, {carrier:"UPS",trackingNumber:"1ZTEST"}));
  assert.equal(shipped.statusCode, 200);
  signedIn = buyerId;
  const delivered = await service(event("POST", `/marketplace/orders/${activeOrderId}/confirm-delivery`, {}));
  assert.equal(delivered.statusCode, 200);
  assert.equal(transferRequest.order.sellerPayoutCents, 2875);
  assert.equal(transferRequest.destination, "acct_test_seller");
  assert.equal(transferRequest.charge, "ch_test_marketplace");
  const duplicateDelivery = await service(event("POST", `/marketplace/orders/${activeOrderId}/confirm-delivery`, {}));
  assert.equal(bodyOf(duplicateDelivery).alreadyConfirmed, true, "delivery confirmation cannot duplicate payout");

  const refundOrderId = "22222222-2222-4222-8222-222222222222";
  records.set(`ORDER#${refundOrderId}|META`, { ...clone(records.get(`ORDER#${activeOrderId}|META`)), pk:{S:`ORDER#${refundOrderId}`}, orderId:{S:refundOrderId}, status:{S:"paid_held"}, paymentIntentId:{S:"pi_test_refund"}, inventoryRestored:{BOOL:false} });
  signedIn = sellerId;
  const refunded = await service(event("POST", `/marketplace/orders/${refundOrderId}/refund`, {}));
  assert.equal(refunded.statusCode, 200); assert.equal(bodyOf(refunded).refunded, true); assert.equal(refundRequest.paymentIntentId, "pi_test_refund");
  assert.equal(records.get(`ORDER#${refundOrderId}|META`).status.S, "refunded");

  console.log("Marketplace payment checks passed: Test Mode seller onboarding, exact 5% item-only fee, inventory reservation, signed/idempotent webhook, held funds, shipping, one-time delivery payout and refund restoration.");
})().catch(error => { console.error(error); process.exit(1); });
