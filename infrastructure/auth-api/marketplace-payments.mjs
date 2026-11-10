import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const SECURITY_HEADERS = Object.freeze({
  "content-type": "application/json",
  "cache-control": "no-store",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
});

const PRODUCT_ID = /^[a-f0-9-]{36}$/i;
const ORDER_ID = /^[a-f0-9-]{36}$/i;
const MEMBER_ID = /^[A-Za-z0-9_-]{8,128}$/;
const STRIPE_ID = /^(?:acct|cs_test|pi|ch|tr|re|evt)_[A-Za-z0-9_]+$/;
const STRIPE_API = "https://api.stripe.com";

function response(statusCode, data, headers = {}) {
  return { statusCode, headers: { ...SECURITY_HEADERS, ...headers }, body: JSON.stringify(data) };
}

function parseBody(event) {
  try {
    const raw = event?.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event?.body || "{}";
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rawBody(event) {
  return event?.isBase64Encoded ? Buffer.from(event.body || "", "base64") : Buffer.from(event?.body || "", "utf8");
}

function shopKey(ownerId) { return { pk: { S: `SHOP#${ownerId}` }, sk: { S: "META" } }; }
function productKey(ownerId, productId) { return { pk: { S: `SHOP#${ownerId}` }, sk: { S: `PRODUCT#${productId}` } }; }
function bazaarKey(productId) { return { pk: { S: "BAZAAR" }, sk: { S: `PRODUCT#${productId}` } }; }
function connectKey(ownerId) { return { pk: { S: `SHOP#${ownerId}` }, sk: { S: "STRIPE_CONNECT" } }; }
function orderKey(orderId) { return { pk: { S: `ORDER#${orderId}` }, sk: { S: "META" } }; }
function sellerOrdersKey(sellerId, createdAt, orderId) { return { pk: { S: `SELLER#${sellerId}` }, sk: { S: `ORDER#${createdAt}#${orderId}` } }; }
function buyerOrdersKey(buyerId, createdAt, orderId) { return { pk: { S: `BUYER#${buyerId}` }, sk: { S: `ORDER#${createdAt}#${orderId}` } }; }
function webhookKey(eventId) { return { pk: { S: `STRIPE_EVENT#${eventId}` }, sk: { S: "MARKETPLACE" } }; }
function string(item, name) { return item?.[name]?.S || ""; }
function number(item, name) { const value = Number(item?.[name]?.N); return Number.isFinite(value) ? value : 0; }
function bool(item, name) { return item?.[name]?.BOOL === true; }

export function marketplaceFeeCents(itemPriceCents) {
  if (!Number.isSafeInteger(itemPriceCents) || itemPriceCents < 0) throw new TypeError("Item price must be integer cents");
  return Math.round(itemPriceCents * 5 / 100);
}

export function sellerPayoutCents(itemPriceCents, shippingCents) {
  if (!Number.isSafeInteger(shippingCents) || shippingCents < 0) throw new TypeError("Shipping must be integer cents");
  return itemPriceCents - marketplaceFeeCents(itemPriceCents) + shippingCents;
}

function connectView(item) {
  return {
    connected: Boolean(string(item, "stripeAccountId")),
    ready: bool(item, "ready"),
    detailsSubmitted: bool(item, "detailsSubmitted"),
    payoutsEnabled: bool(item, "payoutsEnabled"),
    transfersActive: bool(item, "transfersActive"),
    mode: "test",
    updatedAt: string(item, "updatedAt")
  };
}

function orderView(item) {
  return {
    id: string(item, "orderId"),
    productId: string(item, "productId"),
    productTitle: string(item, "productTitle"),
    buyerId: string(item, "buyerId"),
    sellerId: string(item, "sellerId"),
    itemPriceCents: number(item, "itemPriceCents"),
    shippingCents: number(item, "shippingCents"),
    totalCents: number(item, "totalCents"),
    feeCents: number(item, "feeCents"),
    sellerPayoutCents: number(item, "sellerPayoutCents"),
    currency: string(item, "currency") || "usd",
    status: string(item, "status"),
    trackingNumber: string(item, "trackingNumber"),
    carrier: string(item, "carrier"),
    createdAt: string(item, "createdAt"),
    updatedAt: string(item, "updatedAt")
  };
}

function signatureHeader(event) {
  return event?.headers?.["stripe-signature"] || event?.headers?.["Stripe-Signature"] || "";
}

export function verifyStripeSignature(payload, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Buffer.isBuffer(payload) || !secret?.startsWith("whsec_")) return false;
  const parts = String(header || "").split(",").map(value => value.trim());
  const timestamp = Number(parts.find(value => value.startsWith("t="))?.slice(2));
  const signatures = parts.filter(value => value.startsWith("v1=")).map(value => value.slice(3));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || !signatures.length) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload.toString("utf8")}`).digest("hex");
  return signatures.some(value => {
    try {
      const left = Buffer.from(value, "hex"), right = Buffer.from(expected, "hex");
      return left.length === right.length && timingSafeEqual(left, right);
    } catch { return false; }
  });
}

export function createStripeClient({ env = process.env, fetchImpl = fetch }) {
  async function request(path, { method = "GET", params, idempotencyKey } = {}) {
    const key = env.STRIPE_SECRET_KEY || "";
    if (!/^sk_test_/.test(key)) throw new Error("Marketplace checkout requires the DANZSTAK Test Mode key.");
    const headers = { authorization: `Bearer ${key}` };
    let body;
    if (params) {
      body = new URLSearchParams();
      for (const [name, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") body.append(name, String(value));
      }
      headers["content-type"] = "application/x-www-form-urlencoded";
    }
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const result = await fetchImpl(`${STRIPE_API}${path}`, { method, headers, body });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) {
      const error = new Error(data?.error?.message || "Stripe request failed.");
      error.code = data?.error?.code || "stripe_error";
      error.status = result.status;
      throw error;
    }
    return data;
  }
  return {
    createConnectedAccount(ownerId) {
      return request("/v1/accounts", { method: "POST", idempotencyKey: `marketplace-account-${ownerId}`, params: {
        type: "express", country: "US", "capabilities[transfers][requested]": "true",
        "business_profile[product_description]": "Physical goods sold through a DanzStak member shop",
        "metadata[danzstak_member_id]": ownerId
      } });
    },
    retrieveAccount(accountId) { return request(`/v1/accounts/${encodeURIComponent(accountId)}`); },
    createAccountLink(accountId, refreshUrl, returnUrl) {
      return request("/v1/account_links", { method: "POST", params: { account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: "account_onboarding" } });
    },
    createCheckoutSession(order, product) {
      const params = {
        mode: "payment", "payment_method_types[0]": "card", client_reference_id: order.buyerId,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        "shipping_address_collection[allowed_countries][0]": "US",
        success_url: `https://danzstak.com/product.html?id=${encodeURIComponent(order.productId)}&order=${encodeURIComponent(order.id)}&checkout=success`,
        cancel_url: `https://danzstak.com/product.html?id=${encodeURIComponent(order.productId)}&order=${encodeURIComponent(order.id)}&checkout=cancelled`,
        "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][unit_amount]": order.itemPriceCents,
        "line_items[0][price_data][product_data][name]": product.title, "line_items[0][quantity]": 1,
        "metadata[orderId]": order.id, "metadata[productId]": order.productId, "metadata[buyerId]": order.buyerId,
        "metadata[sellerId]": order.sellerId, "metadata[itemPriceCents]": order.itemPriceCents,
        "metadata[shippingCents]": order.shippingCents, "metadata[feeCents]": order.feeCents,
        "payment_intent_data[transfer_group]": `ORDER_${order.id}`,
        "payment_intent_data[metadata][orderId]": order.id
      };
      if (order.shippingCents > 0) Object.assign(params, {
        "line_items[1][price_data][currency]": "usd", "line_items[1][price_data][unit_amount]": order.shippingCents,
        "line_items[1][price_data][product_data][name]": "Shipping", "line_items[1][quantity]": 1
      });
      return request("/v1/checkout/sessions", { method: "POST", idempotencyKey: `marketplace-checkout-${order.id}`, params });
    },
    retrieveCheckoutSession(sessionId) { return request(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`); },
    retrievePaymentIntent(paymentIntentId) { return request(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`); },
    createTransfer(order, destination, sourceCharge) {
      return request("/v1/transfers", { method: "POST", idempotencyKey: `marketplace-payout-${order.id}`, params: {
        amount: order.sellerPayoutCents, currency: "usd", destination, source_transaction: sourceCharge,
        transfer_group: `ORDER_${order.id}`, "metadata[orderId]": order.id
      } });
    },
    createRefund(order) {
      return request("/v1/refunds", { method: "POST", idempotencyKey: `marketplace-refund-${order.id}`, params: {
        payment_intent: order.paymentIntentId, reason: "requested_by_customer", "metadata[orderId]": order.id
      } });
    }
  };
}

export function createMarketplacePayments({ db, commands, authenticate, corsHeaders, tableName, env = process.env, stripe, clock = Date.now }) {
  const { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand } = commands;
  const stripeClient = stripe || createStripeClient({ env });
  const nowIso = () => new Date(clock()).toISOString();
  const browserHeaders = event => corsHeaders(event?.headers?.origin || event?.headers?.Origin);

  async function userId(event) {
    const value = await authenticate(event);
    return MEMBER_ID.test(String(value || "")) ? String(value) : "";
  }

  async function requireMember(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return { error: response(403, { error: "Forbidden origin" }, headers) };
    const id = await userId(event);
    if (!id) return { error: response(401, { error: "Sign in to continue." }, headers) };
    return { id, headers };
  }

  async function get(key) {
    return (await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }))).Item;
  }

  async function put(item, conditionExpression, expressionAttributeNames, expressionAttributeValues) {
    await db.send(new PutItemCommand({ TableName: tableName, Item: item, ConditionExpression: conditionExpression, ExpressionAttributeNames: expressionAttributeNames, ExpressionAttributeValues: expressionAttributeValues }));
  }

  function orderProjection(item, key, role) {
    return { ...item, ...key, entityType: { S: "marketplace_order_projection" }, orderRole: { S: role } };
  }

  function orderCopies(item) {
    const createdAt = string(item, "createdAt"), orderId = string(item, "orderId");
    return [
      orderProjection(item, sellerOrdersKey(string(item, "sellerId"), createdAt, orderId), "seller"),
      orderProjection(item, buyerOrdersKey(string(item, "buyerId"), createdAt, orderId), "buyer")
    ];
  }

  async function putOrder(item, conditionExpression, expressionAttributeNames, expressionAttributeValues) {
    const [sellerCopy, buyerCopy] = orderCopies(item);
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: item, ConditionExpression: conditionExpression, ExpressionAttributeNames: expressionAttributeNames, ExpressionAttributeValues: expressionAttributeValues } },
      { Put: { TableName: tableName, Item: sellerCopy } },
      { Put: { TableName: tableName, Item: buyerCopy } }
    ] }));
  }

  function connectItem(ownerId, account, previous = {}) {
    const transfersActive = account?.capabilities?.transfers === "active";
    const ready = Boolean(account?.details_submitted && account?.payouts_enabled && transfersActive);
    return {
      ...connectKey(ownerId), entityType: { S: "stripe_connect" }, ownerId: { S: ownerId },
      stripeAccountId: { S: account.id }, detailsSubmitted: { BOOL: account.details_submitted === true },
      payoutsEnabled: { BOOL: account.payouts_enabled === true }, transfersActive: { BOOL: transfersActive }, ready: { BOOL: ready },
      createdAt: previous.createdAt || { S: nowIso() }, updatedAt: { S: nowIso() }
    };
  }

  async function sellerStatus(event) {
    const access = await requireMember(event); if (access.error) return access.error;
    const record = await get(connectKey(access.id));
    if (!record) return response(200, { seller: connectView(null) }, access.headers);
    try {
      const account = await stripeClient.retrieveAccount(string(record, "stripeAccountId"));
      const updated = connectItem(access.id, account, record);
      await put(updated);
      return response(200, { seller: connectView(updated) }, access.headers);
    } catch {
      return response(503, { error: "Seller payout status is temporarily unavailable. No listing or payout was changed." }, access.headers);
    }
  }

  async function sellerOnboarding(event) {
    const access = await requireMember(event); if (access.error) return access.error;
    const shop = await get(shopKey(access.id));
    if (!shop) return response(409, { error: "Open your shop before setting up payouts." }, access.headers);
    let record = await get(connectKey(access.id));
    try {
      let account;
      if (record && string(record, "stripeAccountId")) account = await stripeClient.retrieveAccount(string(record, "stripeAccountId"));
      else {
        account = await stripeClient.createConnectedAccount(access.id);
        record = connectItem(access.id, account);
        await put(record, "attribute_not_exists(pk)");
      }
      const updated = connectItem(access.id, account, record || {});
      await put(updated);
      if (bool(updated, "ready")) return response(200, { seller: connectView(updated), ready: true }, access.headers);
      const link = await stripeClient.createAccountLink(account.id, "https://danzstak.com/store.html?manage=1&payout=refresh", "https://danzstak.com/store.html?manage=1&payout=return");
      return response(200, { seller: connectView(updated), onboardingUrl: link.url }, access.headers);
    } catch (error) {
      return response(502, { error: error.message || "Seller payout setup could not start." }, access.headers);
    }
  }

  function orderItem(order, status = "checkout_pending") {
    const at = nowIso();
    return {
      ...orderKey(order.id), entityType: { S: "marketplace_order" }, orderId: { S: order.id }, productId: { S: order.productId },
      productTitle: { S: order.productTitle }, buyerId: { S: order.buyerId }, sellerId: { S: order.sellerId },
      itemPriceCents: { N: String(order.itemPriceCents) }, shippingCents: { N: String(order.shippingCents) },
      totalCents: { N: String(order.totalCents) }, feeCents: { N: String(order.feeCents) }, sellerPayoutCents: { N: String(order.sellerPayoutCents) },
      currency: { S: "usd" }, status: { S: status }, inventoryRestored: { BOOL: false }, createdAt: { S: at }, updatedAt: { S: at }
    };
  }

  async function restoreInventory(item, nextStatus) {
    if (!item || bool(item, "inventoryRestored")) return item;
    const sellerId = string(item, "sellerId"), productId = string(item, "productId"), currentStatus = string(item, "status");
    const restored = { ...item, status: { S: nextStatus }, inventoryRestored: { BOOL: true }, updatedAt: { S: nowIso() } };
    const [sellerCopy, buyerCopy] = orderCopies(restored);
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: productKey(sellerId, productId), UpdateExpression: "ADD inventory :one SET updatedAt = :at", ExpressionAttributeValues: { ":one": { N: "1" }, ":at": { S: nowIso() } } } },
        { Update: { TableName: tableName, Key: bazaarKey(productId), UpdateExpression: "ADD inventory :one SET updatedAt = :at", ExpressionAttributeValues: { ":one": { N: "1" }, ":at": { S: nowIso() } } } },
        { Put: { TableName: tableName, Item: restored, ConditionExpression: "#status = :status AND inventoryRestored = :false", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": { S: currentStatus }, ":false": { BOOL: false } } } },
        { Put: { TableName: tableName, Item: sellerCopy } },
        { Put: { TableName: tableName, Item: buyerCopy } }
      ] }));
      return restored;
    } catch (error) {
      if (["ConditionalCheckFailedException", "TransactionCanceledException"].includes(error?.name)) return await get(orderKey(string(item, "orderId")));
      throw error;
    }
  }

  async function checkout(event) {
    const access = await requireMember(event); if (access.error) return access.error;
    const body = parseBody(event), productId = String(body?.productId || "");
    if (!PRODUCT_ID.test(productId)) return response(400, { error: "Choose a valid product." }, access.headers);
    const projection = await get(bazaarKey(productId));
    if (!projection || string(projection, "status") !== "published" || number(projection, "inventory") < 1) return response(409, { error: "This item is no longer available." }, access.headers);
    const sellerId = string(projection, "ownerId");
    if (!MEMBER_ID.test(sellerId) || sellerId === access.id) return response(409, { error: "You cannot buy an item from your own shop." }, access.headers);
    const connect = await get(connectKey(sellerId));
    if (!connect || !bool(connect, "ready")) return response(409, { error: "This seller is still completing secure payout setup." }, access.headers);
    const itemPriceCents = number(projection, "priceCents"), shippingCents = number(projection, "shippingCents");
    const order = {
      id: randomUUID(), productId, productTitle: string(projection, "title"), buyerId: access.id, sellerId,
      itemPriceCents, shippingCents, totalCents: itemPriceCents + shippingCents,
      feeCents: marketplaceFeeCents(itemPriceCents), sellerPayoutCents: sellerPayoutCents(itemPriceCents, shippingCents)
    };
    let item = orderItem(order);
    try {
      const [sellerCopy, buyerCopy] = orderCopies(item);
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: productKey(sellerId, productId), UpdateExpression: "ADD inventory :minusOne SET updatedAt = :at", ConditionExpression: "#status = :published AND inventory >= :one", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":minusOne": { N: "-1" }, ":one": { N: "1" }, ":published": { S: "published" }, ":at": { S: nowIso() } } } },
        { Update: { TableName: tableName, Key: bazaarKey(productId), UpdateExpression: "ADD inventory :minusOne SET updatedAt = :at", ConditionExpression: "#status = :published AND inventory >= :one", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":minusOne": { N: "-1" }, ":one": { N: "1" }, ":published": { S: "published" }, ":at": { S: nowIso() } } } },
        { Put: { TableName: tableName, Item: item, ConditionExpression: "attribute_not_exists(pk)" } },
        { Put: { TableName: tableName, Item: sellerCopy } },
        { Put: { TableName: tableName, Item: buyerCopy } }
      ] }));
    } catch (error) {
      if (["ConditionalCheckFailedException", "TransactionCanceledException"].includes(error?.name)) return response(409, { error: "That item sold out while checkout was opening. Reload the Bazaar." }, access.headers);
      throw error;
    }
    try {
      const session = await stripeClient.createCheckoutSession(order, { title: order.productTitle });
      if (!/^cs_test_/.test(session.id || "") || !/^https:\/\/checkout\.stripe\.com\//.test(session.url || "")) throw new Error("Stripe returned an invalid Test Mode Checkout Session.");
      item = { ...item, checkoutSessionId: { S: session.id }, checkoutUrl: { S: session.url }, updatedAt: { S: nowIso() } };
      await putOrder(item, "#status = :pending", { "#status": "status" }, { ":pending": { S: "checkout_pending" } });
      return response(201, { checkoutUrl: session.url, order: orderView(item), mode: "test" }, access.headers);
    } catch (error) {
      await restoreInventory(item, "checkout_failed");
      return response(502, { error: error.message || "Checkout could not be opened. Your card was not charged." }, access.headers);
    }
  }

  async function readOrder(event, orderId) {
    const access = await requireMember(event); if (access.error) return access.error;
    if (!ORDER_ID.test(orderId)) return response(400, { error: "Valid order required." }, access.headers);
    const item = await get(orderKey(orderId));
    if (!item) return response(404, { error: "Order not found." }, access.headers);
    if (![string(item, "buyerId"), string(item, "sellerId")].includes(access.id)) return response(403, { error: "You cannot view this order." }, access.headers);
    return response(200, { order: orderView(item) }, access.headers);
  }

  async function listOrders(event) {
    const access = await requireMember(event); if (access.error) return access.error;
    const role = event?.queryStringParameters?.role === "buyer" ? "buyer" : "seller";
    const partition = role === "buyer" ? `BUYER#${access.id}` : `SELLER#${access.id}`;
    const result = await db.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :order)",
      ExpressionAttributeValues: { ":pk": { S: partition }, ":order": { S: "ORDER#" } },
      ScanIndexForward: false,
      Limit: 100,
      ConsistentRead: true
    }));
    const orders = (result.Items || []).map(item => {
      const view = orderView(item);
      if (role === "seller" && string(item, "shippingAddress")) {
        try { view.shipping = JSON.parse(string(item, "shippingAddress")); } catch { /* Ignore malformed legacy data. */ }
      }
      return view;
    });
    return response(200, { role, orders }, access.headers);
  }

  async function shipOrder(event, orderId) {
    const access = await requireMember(event); if (access.error) return access.error;
    const item = await get(orderKey(orderId));
    if (!item) return response(404, { error: "Order not found." }, access.headers);
    if (string(item, "sellerId") !== access.id) return response(403, { error: "Only the seller can mark this order shipped." }, access.headers);
    if (string(item, "status") !== "paid_held") return response(409, { error: "Only a paid, held order can be shipped." }, access.headers);
    const body = parseBody(event), tracking = String(body?.trackingNumber || "").trim().slice(0, 120), carrier = String(body?.carrier || "").trim().slice(0, 80);
    if (!tracking || !carrier) return response(400, { error: "Carrier and tracking number are required." }, access.headers);
    const updated = { ...item, status: { S: "shipped" }, trackingNumber: { S: tracking }, carrier: { S: carrier }, shippedAt: { S: nowIso() }, updatedAt: { S: nowIso() } };
    try { await putOrder(updated, "#status = :held", { "#status": "status" }, { ":held": { S: "paid_held" } }); }
    catch (error) { if (error?.name === "ConditionalCheckFailedException") return response(409, { error: "This order changed on another device." }, access.headers); throw error; }
    return response(200, { order: orderView(updated) }, access.headers);
  }

  async function confirmDelivery(event, orderId) {
    const access = await requireMember(event); if (access.error) return access.error;
    const item = await get(orderKey(orderId));
    if (!item) return response(404, { error: "Order not found." }, access.headers);
    if (string(item, "buyerId") !== access.id) return response(403, { error: "Only the buyer can confirm receipt." }, access.headers);
    if (string(item, "status") === "delivered_paid_out") return response(200, { order: orderView(item), alreadyConfirmed: true }, access.headers);
    if (string(item, "status") !== "shipped") return response(409, { error: "This order is not ready for delivery confirmation." }, access.headers);
    const connect = await get(connectKey(string(item, "sellerId")));
    const destination = string(connect, "stripeAccountId"), chargeId = string(item, "chargeId");
    if (!bool(connect, "ready") || !/^acct_/.test(destination) || !/^ch_/.test(chargeId)) return response(503, { error: "Seller payout details are not ready. Funds remain held." }, access.headers);
    const order = { ...orderView(item), paymentIntentId: string(item, "paymentIntentId") };
    try {
      const transfer = await stripeClient.createTransfer(order, destination, chargeId);
      if (!/^tr_/.test(transfer.id || "")) throw new Error("Stripe did not confirm the seller transfer.");
      const updated = { ...item, status: { S: "delivered_paid_out" }, transferId: { S: transfer.id }, deliveredAt: { S: nowIso() }, paidOutAt: { S: nowIso() }, updatedAt: { S: nowIso() } };
      await putOrder(updated, "#status = :shipped", { "#status": "status" }, { ":shipped": { S: "shipped" } });
      return response(200, { order: orderView(updated) }, access.headers);
    } catch (error) {
      return response(502, { error: `${error.message || "Seller payout failed."} Funds remain held; retry is safe.` }, access.headers);
    }
  }

  async function refundOrder(event, orderId) {
    const access = await requireMember(event); if (access.error) return access.error;
    const item = await get(orderKey(orderId));
    if (!item) return response(404, { error: "Order not found." }, access.headers);
    if (string(item, "sellerId") !== access.id) return response(403, { error: "Only the seller can refund this order before payout." }, access.headers);
    if (!["paid_held", "shipped"].includes(string(item, "status"))) return response(409, { error: "This order cannot be refunded in its current state." }, access.headers);
    try {
      const refund = await stripeClient.createRefund({ ...orderView(item), paymentIntentId: string(item, "paymentIntentId") });
      if (refund.status === "succeeded") {
        const refunded = await restoreInventory(item, "refunded");
        return response(200, { order: orderView(refunded), refunded: true }, access.headers);
      }
      const updated = { ...item, status: { S: "refund_pending" }, refundId: { S: refund.id }, updatedAt: { S: nowIso() } };
      await putOrder(updated, "#status = :status", { "#status": "status" }, { ":status": { S: string(item, "status") } });
      return response(200, { order: orderView(updated), refundPending: true }, access.headers);
    } catch (error) { return response(502, { error: error.message || "Refund could not be started." }, access.headers); }
  }

  async function completePayment(eventObject) {
    const sessionId = eventObject?.id || "", orderId = eventObject?.metadata?.orderId || "";
    if (!/^cs_test_/.test(sessionId) || !ORDER_ID.test(orderId)) throw new Error("Checkout metadata is invalid");
    let item = await get(orderKey(orderId));
    if (!item || string(item, "checkoutSessionId") !== sessionId) throw new Error("Checkout does not match an order");
    if (string(item, "status") === "paid_held") return;
    if (string(item, "status") !== "checkout_pending") throw new Error("Order is not awaiting payment");
    const session = await stripeClient.retrieveCheckoutSession(sessionId);
    if (session.livemode || session.payment_status !== "paid" || Number(session.amount_total) !== number(item, "totalCents") || session.currency !== "usd" || session.metadata?.orderId !== orderId) throw new Error("Server-side payment verification failed");
    const intent = await stripeClient.retrievePaymentIntent(session.payment_intent);
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
    if (!/^pi_/.test(intent.id || "") || !/^ch_/.test(chargeId || "") || intent.status !== "succeeded" || Number(intent.amount_received) !== number(item, "totalCents")) throw new Error("Payment Intent verification failed");
    const shipping = session.collected_information?.shipping_details || session.shipping_details || {};
    const address = shipping.address || {};
    if (!String(address.line1 || "").trim() || !String(address.country || "").trim()) throw new Error("Checkout shipping address is missing");
    const shippingAddress = {
      name: String(shipping.name || "").slice(0, 120),
      line1: String(address.line1 || "").slice(0, 160),
      line2: String(address.line2 || "").slice(0, 160),
      city: String(address.city || "").slice(0, 120),
      state: String(address.state || "").slice(0, 80),
      postalCode: String(address.postal_code || "").slice(0, 24),
      country: String(address.country || "").slice(0, 2)
    };
    item = { ...item, status: { S: "paid_held" }, paymentIntentId: { S: intent.id }, chargeId: { S: chargeId }, shippingAddress: { S: JSON.stringify(shippingAddress) }, paidAt: { S: nowIso() }, updatedAt: { S: nowIso() } };
    await putOrder(item, "#status = :pending", { "#status": "status" }, { ":pending": { S: "checkout_pending" } });
  }

  async function failPayment(eventObject, nextStatus) {
    const orderId = eventObject?.metadata?.orderId || "";
    if (!ORDER_ID.test(orderId)) return;
    const item = await get(orderKey(orderId));
    if (item && string(item, "status") === "checkout_pending") await restoreInventory(item, nextStatus);
  }

  async function completeRefund(eventObject) {
    const orderId = eventObject?.metadata?.orderId || "";
    if (!ORDER_ID.test(orderId)) return;
    const item = await get(orderKey(orderId));
    if (!item || !["refund_pending", "paid_held", "shipped"].includes(string(item, "status"))) return;
    await restoreInventory(item, "refunded");
  }

  async function webhook(event) {
    const payload = rawBody(event), secret = env.STRIPE_MARKETPLACE_WEBHOOK_SECRET || "";
    if (!verifyStripeSignature(payload, signatureHeader(event), secret, Math.floor(clock() / 1000))) return response(400, { error: "Invalid Stripe signature." });
    let stripeEvent; try { stripeEvent = JSON.parse(payload.toString("utf8")); } catch { return response(400, { error: "Invalid Stripe event." }); }
    if (!/^evt_/.test(stripeEvent?.id || "")) return response(400, { error: "Invalid Stripe event." });
    if (await get(webhookKey(stripeEvent.id))) return response(200, { received: true, duplicate: true });
    try {
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(stripeEvent.type)) await completePayment(stripeEvent.data?.object);
      else if (stripeEvent.type === "checkout.session.expired") await failPayment(stripeEvent.data?.object, "checkout_expired");
      else if (stripeEvent.type === "checkout.session.async_payment_failed") await failPayment(stripeEvent.data?.object, "payment_failed");
      else if (["refund.created", "refund.updated", "charge.refunded"].includes(stripeEvent.type)) await completeRefund(stripeEvent.data?.object);
      await put({ ...webhookKey(stripeEvent.id), entityType: { S: "stripe_event" }, eventType: { S: String(stripeEvent.type || "") }, processedAt: { S: nowIso() }, expiresAt: { N: String(Math.floor(clock() / 1000) + 90 * 24 * 60 * 60) } }, "attribute_not_exists(pk)");
      return response(200, { received: true });
    } catch (error) {
      return response(500, { error: "Stripe event processing failed safely." });
    }
  }

  return async function marketplacePayments(event) {
    const method = event?.requestContext?.http?.method || "", path = event?.rawPath || "";
    if (method === "POST" && path === "/marketplace/stripe/webhook") return webhook(event);
    if (method === "GET" && path === "/marketplace/seller/status") return sellerStatus(event);
    if (method === "POST" && path === "/marketplace/seller/onboarding") return sellerOnboarding(event);
    if (method === "POST" && path === "/marketplace/checkout") return checkout(event);
    if (method === "GET" && path === "/marketplace/orders") return listOrders(event);
    const order = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})$/i);
    if (method === "GET" && order) return readOrder(event, order[1]);
    const ship = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})\/ship$/i);
    if (method === "POST" && ship) return shipOrder(event, ship[1]);
    const delivery = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})\/confirm-delivery$/i);
    if (method === "POST" && delivery) return confirmDelivery(event, delivery[1]);
    const refund = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})\/refund$/i);
    if (method === "POST" && refund) return refundOrder(event, refund[1]);
    return null;
  };
}

export { shopKey, productKey, bazaarKey, connectKey, orderKey, sellerOrdersKey, buyerOrdersKey, webhookKey, orderView, connectView };
