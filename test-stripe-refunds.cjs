"use strict";

const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

(async () => {
  const billing = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const userId = "user_12345678", now = 1793700000000;
  const keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const cloneRecords = records => new Map([...records].map(([key, value]) => [key, structuredClone(value)]));

  function makeService({ product = "credits", quantity = 3, amountRefunded, amount } = {}) {
    const records = new Map();
    const sessionId = product === "contact" ? "cs_test_contactrefund" : product === "phone" ? "cs_test_phonerefund" : "cs_test_creditrefund";
    const venueKey = "b".repeat(20);
    const price = product === "contact" ? billing.BOOKING_CONTACT_PRICE_ID : product === "phone" ? billing.PHONE_NUMBER_PRICE_ID : billing.TOUR_MANAGER_EMAIL_PRICE_ID;
    const productId = product === "contact" ? billing.BOOKING_CONTACT_PRODUCT_ID : product === "phone" ? billing.PHONE_NUMBER_PRODUCT_ID : billing.TOUR_MANAGER_PRODUCT_ID;
    const unitAmount = product === "contact" ? billing.BOOKING_CONTACT_UNIT_CENTS : product === "phone" ? billing.PHONE_NUMBER_UNIT_CENTS : billing.TOUR_MANAGER_EMAIL_UNIT_CENTS;
    const productName = product === "contact" ? "booking_contact_unlock" : product === "phone" ? "danzstak_phone_activation" : "tour_manager_booking_email";
    const total = amount ?? unitAmount * quantity;
    const checkout = {
      userId: { S: userId }, tourId: { S: `TOUR_MANAGER#CHECKOUT#${sessionId}` }, sessionId: { S: sessionId }, status: { S: "paid" },
      priceId: { S: price }, environment: { S: "test" }, ...(product === "credits" ? { quantity: { N: String(quantity) } } : { product: { S: productName } }),
      ...(product === "contact" ? { venueKey: { S: venueKey } } : {})
    };
    records.set(keyOf(checkout), checkout);
    if (product === "credits") {
      records.set(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`, { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#BOOKING_EMAIL_CREDITS" }, credits: { N: String(quantity) }, purchasedCredits: { N: String(quantity) } });
      records.set(`${userId}|TOUR_MANAGER#PROFESSIONAL_ENTITLEMENT`, { userId: { S: userId }, tourId: { S: "TOUR_MANAGER#PROFESSIONAL_ENTITLEMENT" }, status: { S: "active" }, paymentReference: { S: sessionId } });
    } else if (product === "contact") {
      records.set(`${userId}|TOUR_MANAGER#CONTACT_UNLOCK#${venueKey}`, { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#CONTACT_UNLOCK#${venueKey}` }, venueKey: { S: venueKey }, status: { S: "active" }, paymentReference: { S: sessionId } });
    } else {
      records.set(`${userId}|PHONE#ACTIVATION_ENTITLEMENT`, { userId: { S: userId }, tourId: { S: "PHONE#ACTIVATION_ENTITLEMENT" }, status: { S: "pending_provisioning" }, paymentReference: { S: sessionId } });
    }

    const db = { async send(command) {
      if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
      if (command instanceof QueryCommand) {
        const prefix = command.input.ExpressionAttributeValues[":prefix"]?.S || command.input.ExpressionAttributeValues[":ledger"]?.S || "";
        return { Items: [...records.values()].filter(item => item.userId?.S === userId && item.tourId?.S.startsWith(prefix)) };
      }
      if (!(command instanceof TransactWriteItemsCommand)) throw new Error(`Unexpected command ${command.constructor.name}`);
      const next = cloneRecords(records);
      for (const operation of command.input.TransactItems) {
        if (operation.Put) {
          const key = keyOf(operation.Put.Item);
          if (operation.Put.ConditionExpression && next.has(key)) throw Object.assign(new Error("duplicate"), { name: "TransactionCanceledException" });
          next.set(key, structuredClone(operation.Put.Item));
          continue;
        }
        const update = operation.Update, key = keyOf(update.Key), item = next.get(key) || structuredClone(update.Key), values = update.ExpressionAttributeValues || {};
        if (update.ConditionExpression?.includes("#status = :paid") && item.status?.S !== "paid") throw Object.assign(new Error("not paid"), { name: "TransactionCanceledException" });
        if (update.ConditionExpression?.includes("paymentReference = :sessionId") && item.paymentReference?.S !== values[":sessionId"]?.S) throw Object.assign(new Error("wrong payment"), { name: "TransactionCanceledException" });
        if (values[":minusQuantity"]) {
          item.credits = { N: String(Number(item.credits?.N || 0) + Number(values[":minusQuantity"].N)) };
          item.purchasedCredits = { N: String(Number(item.purchasedCredits?.N || 0) + Number(values[":minusQuantity"].N)) };
        }
        if (values[":refunded"]) item.status = structuredClone(values[":refunded"]);
        if (values[":refundedAt"]) item.refundedAt = structuredClone(values[":refundedAt"]);
        if (values[":required"]) item.provisioningActionRequired = structuredClone(values[":required"]);
        next.set(key, item);
      }
      records.clear(); for (const [key, value] of next) records.set(key, value);
      return {};
    } };

    const session = {
      id: sessionId, mode: "payment", payment_status: "paid", status: "complete", livemode: false, client_reference_id: userId,
      currency: "usd", amount_total: total,
      metadata: { product: productName, userId, priceId: price, ...(product === "credits" ? { quantity: String(quantity) } : {}), ...(product === "contact" ? { venueKey } : {}) },
      line_items: { data: [{ quantity, price: { id: price, product: productId, currency: "usd", unit_amount: unitAmount } }] }
    };
    const fetcher = async url => {
      if (url.includes("/checkout/sessions?payment_intent=")) return { ok: true, json: async () => ({ data: [session] }) };
      throw new Error(`Unexpected Stripe request: ${url}`);
    };
    const env = { STRIPE_SECRET_KEY: "sk_test_example", STRIPE_TOUR_MANAGER_WEBHOOK_SECRET: "whsec_example" };
    const service = billing.createTourManagerBilling({ db, commands, authenticate: async () => userId, corsHeaders: () => ({ "access-control-allow-origin": "https://danzstak.com" }), tableName: "Tours", env, fetcher, clock: () => now });
    const chargeAmount = total, refunded = amountRefunded ?? chargeAmount;
    const notification = { id: `evt_refund${product}${refunded}`, type: "charge.refunded", livemode: false, data: { object: { id: `ch_${product}refund`, payment_intent: `pi_${product}refund`, currency: "usd", amount: chargeAmount, amount_refunded: refunded } } };
    const payload = JSON.stringify(notification), timestamp = Math.floor(now / 1000);
    const signature = `t=${timestamp},v1=${createHmac("sha256", env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex")}`;
    const event = { requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/stripe/webhook", headers: { "stripe-signature": signature }, body: payload };
    return { service, event, records, sessionId, venueKey, userId };
  }

  const credits = makeService();
  let result = JSON.parse((await credits.service(credits.event)).body);
  assert.equal(result.refunded, true);
  assert.equal(credits.records.get(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`).credits.N, "0");
  assert.equal(credits.records.get(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`).purchasedCredits.N, "0");
  assert.equal(credits.records.get(`${userId}|TOUR_MANAGER#PROFESSIONAL_ENTITLEMENT`).status.S, "refunded");
  assert.equal(credits.records.get(`${userId}|TOUR_MANAGER#CHECKOUT#${credits.sessionId}`).status.S, "refunded");
  result = JSON.parse((await credits.service(credits.event)).body);
  assert.equal(result.duplicate, true, "a repeated refund webhook must not deduct credits twice");
  assert.equal(credits.records.get(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`).credits.N, "0");

  const partial = makeService({ amountRefunded: 150 });
  result = JSON.parse((await partial.service(partial.event)).body);
  assert.equal(result.refundReviewRequired, true);
  assert.equal(result.accessChanged, false);
  assert.equal(partial.records.get(`${userId}|TOUR_MANAGER#BOOKING_EMAIL_CREDITS`).credits.N, "3");
  assert.equal(partial.records.get(`${userId}|TOUR_MANAGER#PROFESSIONAL_ENTITLEMENT`).status.S, "active");

  const contact = makeService({ product: "contact", quantity: 1 });
  result = JSON.parse((await contact.service(contact.event)).body);
  assert.equal(result.refunded, true);
  assert.equal(contact.records.get(`${userId}|TOUR_MANAGER#CONTACT_UNLOCK#${contact.venueKey}`).status.S, "refunded");
  const unlocks = JSON.parse((await contact.service({ requestContext: { http: { method: "GET" } }, rawPath: "/tour-manager/contact-unlocks", headers: { origin: "https://danzstak.com" } })).body);
  assert.deepEqual(unlocks.venueKeys, [], "a refunded contact must no longer be returned as unlocked");

  const phone = makeService({ product: "phone", quantity: 1 });
  result = JSON.parse((await phone.service(phone.event)).body);
  assert.equal(result.refunded, true);
  const phoneItem = phone.records.get(`${userId}|PHONE#ACTIVATION_ENTITLEMENT`);
  assert.equal(phoneItem.status.S, "refunded");
  assert.equal(phoneItem.provisioningActionRequired.BOOL, true);
  const phoneStatus = JSON.parse((await phone.service({ requestContext: { http: { method: "GET" } }, rawPath: "/phone-number/entitlement", headers: { origin: "https://danzstak.com" } })).body);
  assert.equal(phoneStatus.entitled, false);

  console.log("Stripe refund checks passed: full credit reversal, entitlement revocation, partial-refund review, duplicate protection, contact removal, and phone-provider follow-up.");
})().catch(error => { console.error(error); process.exit(1); });
