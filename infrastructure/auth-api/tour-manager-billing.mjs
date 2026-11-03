import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const TOUR_MANAGER_EMAIL_PRICE_ID = "price_1UXjMtFgtfNMBXOVCLeEk8vI";
export const TOUR_MANAGER_EMAIL_UNIT_CENTS = 150;
const PRODUCT = "tour_manager_booking_email";
const CREDIT_KEY = "TOUR_MANAGER#BOOKING_EMAIL_CREDITS";
const EVENT_OWNER = "STRIPE#TOUR_MANAGER_EVENTS";
const MAX_CREDITS_PER_CHECKOUT = 500;

const securityHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};

function response(statusCode, data, headers = {}) {
  return { statusCode, headers: { ...securityHeaders, ...headers }, body: JSON.stringify(data) };
}

function rawBody(event) {
  if (typeof event?.body !== "string") return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

export function verifyStripeSignature(payload, header, secret, currentTime = Date.now(), toleranceSeconds = 300) {
  if (typeof payload !== "string" || !payload || typeof header !== "string" || !secret?.startsWith("whsec_")) return false;
  const values = header.split(",").map(value => value.trim());
  const timestamp = values.find(value => value.startsWith("t="))?.slice(2);
  const signatures = values.filter(value => value.startsWith("v1=")).map(value => value.slice(3));
  if (!/^\d{10,}$/.test(timestamp || "") || !signatures.length) return false;
  const age = Math.abs(Math.floor(currentTime / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

function validUserId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function checkoutKey(userId, sessionId) {
  return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#CHECKOUT#${sessionId}` } };
}

function creditKey(userId) {
  return { userId: { S: userId }, tourId: { S: CREDIT_KEY } };
}

function eventKey(eventId) {
  return { userId: { S: EVENT_OWNER }, tourId: { S: eventId } };
}

export function createTourManagerBilling({ db, commands, authenticate, corsHeaders, tableName, env = process.env, fetcher = fetch, clock = Date.now }) {
  const { GetItemCommand, PutItemCommand, TransactWriteItemsCommand } = commands;
  const liveEnabled = () => env.TOUR_MANAGER_LIVE_PAYMENTS === "true";
  const configured = () => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET);
  const testMode = () => env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
  const paymentsAllowed = () => configured() && (testMode() || (liveEnabled() && env.STRIPE_SECRET_KEY.startsWith("sk_live_")));

  async function stripe(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await fetcher(`https://api.stripe.com/v1${path}`, {
        ...options,
        signal: controller.signal,
        headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(options.headers || {}) }
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) {
        const error = new Error("Stripe request failed");
        error.statusCode = result.status;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkout(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    const headers = corsHeaders(origin);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    if (!paymentsAllowed()) return response(503, { error: "Tour Manager payments are not configured for testing." }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    let body;
    try { body = JSON.parse(rawBody(event) || "{}"); } catch { return response(400, { error: "Invalid JSON request." }, headers); }
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CREDITS_PER_CHECKOUT) return response(400, { error: `Choose 1 to ${MAX_CREDITS_PER_CHECKOUT} booking emails.` }, headers);
    const requestId = randomUUID();
    const form = new URLSearchParams({
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price]": TOUR_MANAGER_EMAIL_PRICE_ID,
      "line_items[0][quantity]": String(quantity),
      client_reference_id: userId,
      "metadata[product]": PRODUCT,
      "metadata[userId]": userId,
      "metadata[priceId]": TOUR_MANAGER_EMAIL_PRICE_ID,
      "metadata[quantity]": String(quantity),
      success_url: "https://danzstak.com/booking.html?credits=success",
      cancel_url: "https://danzstak.com/booking.html?credits=cancelled"
    });
    const session = await stripe("/checkout/sessions", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `tour-manager-${userId}-${requestId}` },
      body: form.toString()
    });
    if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(session.id || "") || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe returned an invalid Checkout session");
    const createdAt = new Date(clock()).toISOString();
    await db.send(new PutItemCommand({
      TableName: tableName,
      Item: { ...checkoutKey(userId, session.id), sessionId: { S: session.id }, status: { S: "pending" }, quantity: { N: String(quantity) }, priceId: { S: TOUR_MANAGER_EMAIL_PRICE_ID }, environment: { S: testMode() ? "test" : "live" }, createdAt: { S: createdAt } },
      ConditionExpression: "attribute_not_exists(userId)"
    }));
    return response(200, { checkoutUrl: session.url, quantity, unitAmountCents: TOUR_MANAGER_EMAIL_UNIT_CENTS, currency: "usd", testMode: testMode() }, headers);
  }

  async function credits(event) {
    const origin = event.headers?.origin || event.headers?.Origin;
    const headers = corsHeaders(origin);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: creditKey(userId), ConsistentRead: true }));
    return response(200, { bookingEmailCredits: Number(found.Item?.credits?.N || 0), unitAmountCents: TOUR_MANAGER_EMAIL_UNIT_CENTS, currency: "usd", priceId: TOUR_MANAGER_EMAIL_PRICE_ID }, headers);
  }

  async function webhook(event) {
    if (!paymentsAllowed()) return response(503, { error: "Tour Manager payment webhook is not configured." });
    const payload = rawBody(event);
    const signature = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
    if (!payload || Buffer.byteLength(payload) > 65536 || !verifyStripeSignature(payload, signature, env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET, clock())) return response(400, { error: "Invalid Stripe signature." });
    let notification;
    try { notification = JSON.parse(payload); } catch { return response(400, { error: "Invalid Stripe event." }); }
    if (notification.type !== "checkout.session.completed") return response(200, { received: true, ignored: true });
    if (!/^evt_[a-zA-Z0-9]+$/.test(notification.id || "")) return response(400, { error: "Invalid Stripe event identifier." });
    const supplied = notification.data?.object;
    if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(supplied?.id || "")) return response(400, { error: "Invalid Checkout session." });

    const processed = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true }));
    if (processed.Item) return response(200, { received: true, duplicate: true });

    const session = await stripe(`/checkout/sessions/${encodeURIComponent(supplied.id)}?expand%5B%5D=line_items`);
    const userId = session.client_reference_id;
    const item = session.line_items?.data;
    const line = Array.isArray(item) && item.length === 1 ? item[0] : null;
    const quantity = Number(line?.quantity);
    const expectedAmount = quantity * TOUR_MANAGER_EMAIL_UNIT_CENTS;
    const expectedLive = env.STRIPE_SECRET_KEY.startsWith("sk_live_");
    const metadata = session.metadata || {};
    if (session.id !== supplied.id || session.mode !== "payment" || session.payment_status !== "paid" || session.status !== "complete" || session.livemode !== expectedLive || notification.livemode !== expectedLive || !validUserId(userId) || metadata.product !== PRODUCT || metadata.userId !== userId || metadata.priceId !== TOUR_MANAGER_EMAIL_PRICE_ID || Number(metadata.quantity) !== quantity || line?.price?.id !== TOUR_MANAGER_EMAIL_PRICE_ID || line?.price?.currency !== "usd" || Number(line?.price?.unit_amount) !== TOUR_MANAGER_EMAIL_UNIT_CENTS || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CREDITS_PER_CHECKOUT || session.currency !== "usd" || Number(session.amount_total) !== expectedAmount) {
      return response(400, { error: "Checkout payment did not match the Tour Manager credit purchase." });
    }

    const pending = await db.send(new GetItemCommand({ TableName: tableName, Key: checkoutKey(userId, session.id), ConsistentRead: true }));
    if (pending.Item?.status?.S !== "pending" || pending.Item.sessionId?.S !== session.id || pending.Item.priceId?.S !== TOUR_MANAGER_EMAIL_PRICE_ID || Number(pending.Item.quantity?.N) !== quantity || pending.Item.environment?.S !== (expectedLive ? "live" : "test")) return response(409, { error: "No matching pending Tour Manager checkout." });

    const processedAt = new Date(clock()).toISOString();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: session.id }, processedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: checkoutKey(userId, session.id), UpdateExpression: "SET #status = :paid, paidAt = :paidAt", ConditionExpression: "#status = :pending AND sessionId = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":paid": { S: "paid" }, ":pending": { S: "pending" }, ":paidAt": { S: processedAt }, ":sessionId": { S: session.id } } } },
        { Update: { TableName: tableName, Key: creditKey(userId), UpdateExpression: "ADD credits :quantity SET updatedAt = :updatedAt, lastSessionId = :sessionId", ExpressionAttributeValues: { ":quantity": { N: String(quantity) }, ":updatedAt": { S: processedAt }, ":sessionId": { S: session.id } } } }
      ] }));
    } catch (error) {
      const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true }));
      if (duplicate.Item) return response(200, { received: true, duplicate: true });
      throw error;
    }
    return response(200, { received: true, creditsIssued: quantity });
  }

  return async function handle(event) {
    const method = event?.requestContext?.http?.method;
    const path = event?.rawPath;
    if (method === "POST" && path === "/tour-manager/stripe/webhook") return webhook(event);
    if (method === "POST" && path === "/tour-manager/checkout") return checkout(event);
    if (method === "GET" && path === "/tour-manager/credits") return credits(event);
    return null;
  };
}
