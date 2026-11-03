import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const TOUR_MANAGER_EMAIL_PRICE_ID = "price_1UXjMtFgtfNMBXOVCLeEk8vI";
export const TOUR_MANAGER_EMAIL_UNIT_CENTS = 150;
const PRODUCT = "tour_manager_booking_email";
const CREDIT_KEY = "TOUR_MANAGER#BOOKING_EMAIL_CREDITS";
const BOOKING_WORKSPACE_KEY = "booking-workspace-v1";
const EVENT_OWNER = "STRIPE#TOUR_MANAGER_EVENTS";
const MAX_CREDITS_PER_CHECKOUT = 500;
const WEBHOOK_TYPES = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]);
const securityHeaders = { "content-type": "application/json", "cache-control": "no-store", "strict-transport-security": "max-age=63072000; includeSubDomains; preload", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer" };

function response(statusCode, data, headers = {}) { return { statusCode, headers: { ...securityHeaders, ...headers }, body: JSON.stringify(data) }; }
function rawBody(event) { if (typeof event?.body !== "string") return ""; return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body; }
function parseBody(event) { try { return JSON.parse(rawBody(event) || "{}"); } catch { return null; } }
function validUserId(value) { return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value); }
function checkoutKey(userId, sessionId) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#CHECKOUT#${sessionId}` } }; }
function creditKey(userId) { return { userId: { S: userId }, tourId: { S: CREDIT_KEY } }; }
function eventKey(eventId) { return { userId: { S: EVENT_OWNER }, tourId: { S: eventId } }; }
function ledgerKey(userId, at, id) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#LEDGER#${at}#${id}` } }; }
function sendKey(userId, id) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${id}` } }; }

export function verifyStripeSignature(payload, header, secret, currentTime = Date.now(), toleranceSeconds = 300) {
  if (typeof payload !== "string" || !payload || typeof header !== "string" || !secret?.startsWith("whsec_")) return false;
  const values = header.split(",").map(value => value.trim()), timestamp = values.find(value => value.startsWith("t="))?.slice(2), signatures = values.filter(value => value.startsWith("v1=")).map(value => value.slice(3));
  if (!/^\d{10,}$/.test(timestamp || "") || !signatures.length) return false;
  const age = Math.abs(Math.floor(currentTime / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some(signature => { if (!/^[a-f0-9]{64}$/i.test(signature)) return false; const candidate = Buffer.from(signature, "hex"); return candidate.length === expected.length && timingSafeEqual(candidate, expected); });
}

export function createTourManagerBilling({ db, commands, authenticate, corsHeaders, tableName, sendBookingEmail, env = process.env, fetcher = fetch, clock = Date.now }) {
  const { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand } = commands;
  const testMode = () => env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
  const paymentsAllowed = () => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET) && (testMode() || (env.TOUR_MANAGER_LIVE_PAYMENTS === "true" && env.STRIPE_SECRET_KEY.startsWith("sk_live_")));
  const nowIso = () => new Date(clock()).toISOString();
  const browserHeaders = event => corsHeaders(event.headers?.origin || event.headers?.Origin);

  async function stripe(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await fetcher(`https://api.stripe.com/v1${path}`, { ...options, signal: controller.signal, headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(options.headers || {}) } });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) { const error = new Error("Stripe request failed"); error.statusCode = result.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function checkout(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    if (!paymentsAllowed()) return response(503, { error: "Tour Manager payments are not configured for testing." }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const body = parseBody(event), quantity = Number(body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CREDITS_PER_CHECKOUT) return response(400, { error: `Choose 1 to ${MAX_CREDITS_PER_CHECKOUT} booking emails.` }, headers);
    const requestId = randomUUID(), form = new URLSearchParams({ mode: "payment", "line_items[0][price]": TOUR_MANAGER_EMAIL_PRICE_ID, "line_items[0][quantity]": String(quantity), client_reference_id: userId, "metadata[product]": PRODUCT, "metadata[userId]": userId, "metadata[priceId]": TOUR_MANAGER_EMAIL_PRICE_ID, "metadata[quantity]": String(quantity), success_url: "https://danzstak.com/booking-selections.html?credits=success", cancel_url: "https://danzstak.com/booking-selections.html?credits=cancelled" });
    const session = await stripe("/checkout/sessions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `tour-manager-${userId}-${requestId}` }, body: form.toString() });
    if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(session.id || "") || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe returned an invalid Checkout session");
    await db.send(new PutItemCommand({ TableName: tableName, Item: { ...checkoutKey(userId, session.id), sessionId: { S: session.id }, status: { S: "pending" }, quantity: { N: String(quantity) }, priceId: { S: TOUR_MANAGER_EMAIL_PRICE_ID }, environment: { S: testMode() ? "test" : "live" }, createdAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(userId)" }));
    return response(200, { checkoutUrl: session.url, quantity, unitAmountCents: TOUR_MANAGER_EMAIL_UNIT_CENTS, currency: "usd", testMode: testMode() }, headers);
  }

  async function credits(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: creditKey(userId), ConsistentRead: true }));
    let activity = [];
    if (QueryCommand) {
      const history = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :userId AND begins_with(tourId, :ledger)", ExpressionAttributeValues: { ":userId": { S: userId }, ":ledger": { S: "TOUR_MANAGER#LEDGER#" } }, ScanIndexForward: false, Limit: 25 }));
      activity = (history.Items || []).map(item => ({ type: item.entryType?.S || "activity", credits: Number(item.delta?.N || 0), status: item.status?.S || "", description: item.description?.S || "", at: item.createdAt?.S || "" }));
    }
    return response(200, { bookingEmailCredits: Number(found.Item?.credits?.N || 0), purchasedCredits: Number(found.Item?.purchasedCredits?.N || 0), sentEmails: Number(found.Item?.sentEmails?.N || 0), reservedCredits: Number(found.Item?.reservedCredits?.N || 0), unitAmountCents: TOUR_MANAGER_EMAIL_UNIT_CENTS, currency: "usd", priceId: TOUR_MANAGER_EMAIL_PRICE_ID, activity }, headers);
  }

  async function loadVerifiedSession(sessionId, expectedLive) {
    const session = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=line_items`), userId = session.client_reference_id, lines = session.line_items?.data, line = Array.isArray(lines) && lines.length === 1 ? lines[0] : null, quantity = Number(line?.quantity), metadata = session.metadata || {};
    const valid = session.id === sessionId && session.mode === "payment" && session.livemode === expectedLive && validUserId(userId) && metadata.product === PRODUCT && metadata.userId === userId && metadata.priceId === TOUR_MANAGER_EMAIL_PRICE_ID && Number(metadata.quantity) === quantity && line?.price?.id === TOUR_MANAGER_EMAIL_PRICE_ID && line?.price?.currency === "usd" && Number(line?.price?.unit_amount) === TOUR_MANAGER_EMAIL_UNIT_CENTS && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_CREDITS_PER_CHECKOUT && session.currency === "usd" && Number(session.amount_total) === quantity * TOUR_MANAGER_EMAIL_UNIT_CENTS;
    if (!valid) return null;
    const pending = await db.send(new GetItemCommand({ TableName: tableName, Key: checkoutKey(userId, session.id), ConsistentRead: true })), item = pending.Item;
    return item?.sessionId?.S === session.id && item.priceId?.S === TOUR_MANAGER_EMAIL_PRICE_ID && Number(item.quantity?.N) === quantity && item.environment?.S === (expectedLive ? "live" : "test") ? { session, userId, quantity } : null;
  }

  async function markCheckoutEvent(notification, verified, status) {
    const processedAt = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :status, updatedAt = :updatedAt", ConditionExpression: "#status <> :paid", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": { S: status }, ":updatedAt": { S: processedAt }, ":paid": { S: "paid" } } } }
      ] }));
    } catch (error) { const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true })); if (!duplicate.Item) throw error; }
  }

  async function grantCredits(notification, verified) {
    const processedAt = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :paid, paidAt = :paidAt", ConditionExpression: "#status <> :paid AND sessionId = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":paid": { S: "paid" }, ":paidAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Update: { TableName: tableName, Key: creditKey(verified.userId), UpdateExpression: "ADD credits :quantity, purchasedCredits :quantity SET updatedAt = :updatedAt, lastSessionId = :sessionId", ExpressionAttributeValues: { ":quantity": { N: String(verified.quantity) }, ":updatedAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "purchase" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: String(verified.quantity) }, status: { S: "settled" }, description: { S: `${verified.quantity} booking email credits purchased` }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) { const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true })); if (duplicate.Item) return false; throw error; }
    return true;
  }

  async function webhook(event) {
    if (!paymentsAllowed()) return response(503, { error: "Tour Manager payment webhook is not configured." });
    const payload = rawBody(event), signature = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
    if (!payload || Buffer.byteLength(payload) > 65536 || !verifyStripeSignature(payload, signature, env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET, clock())) return response(400, { error: "Invalid Stripe signature." });
    let notification; try { notification = JSON.parse(payload); } catch { return response(400, { error: "Invalid Stripe event." }); }
    if (!WEBHOOK_TYPES.has(notification.type)) return response(200, { received: true, ignored: true });
    const supplied = notification.data?.object;
    if (!/^evt_[a-zA-Z0-9]+$/.test(notification.id || "") || !/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(supplied?.id || "")) return response(400, { error: "Invalid Stripe event." });
    const processed = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true }));
    if (processed.Item) return response(200, { received: true, duplicate: true });
    const expectedLive = env.STRIPE_SECRET_KEY.startsWith("sk_live_");
    if (notification.livemode !== expectedLive) return response(400, { error: "Stripe environment mismatch." });
    const verified = await loadVerifiedSession(supplied.id, expectedLive);
    if (!verified) return response(409, { error: "No matching Tour Manager checkout." });
    if (notification.type === "checkout.session.completed" && verified.session.payment_status !== "paid") { await markCheckoutEvent(notification, verified, "awaiting_payment"); return response(200, { received: true, awaitingPayment: true }); }
    if (notification.type === "checkout.session.async_payment_failed" || notification.type === "checkout.session.expired") { await markCheckoutEvent(notification, verified, notification.type.endsWith("failed") ? "payment_failed" : "expired"); return response(200, { received: true, creditsIssued: 0 }); }
    if (verified.session.payment_status !== "paid" || verified.session.status !== "complete") return response(409, { error: "Stripe has not verified a completed payment." });
    const granted = await grantCredits(notification, verified);
    return response(200, { received: true, creditsIssued: granted ? verified.quantity : 0, duplicate: !granted });
  }

  async function sendEmail(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    if (typeof sendBookingEmail !== "function") return response(503, { error: "Booking email delivery is not configured." }, headers);
    const body = parseBody(event), venueKey = String(body?.venueKey || "").trim(), to = String(body?.to || "").trim().toLowerCase(), subject = String(body?.subject || "").trim(), message = String(body?.message || "").trim(), id = String(body?.idempotencyKey || "").trim();
    if (!venueKey || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || subject.length < 3 || subject.length > 180 || message.length < 20 || message.length > 5000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(id)) return response(400, { error: "Choose a saved venue, reviewed email, subject, message, and valid send identifier." }, headers);
    const workspace = await db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY } }, ConsistentRead: true }));
    let plan = {}; try { plan = JSON.parse(workspace.Item?.plan?.S || "{}"); } catch { plan = {}; }
    const venue = (plan.venues || []).find(item => item?.venueKey === venueKey && (item.emails || []).some(email => String(email).toLowerCase() === to)), artistName = String(plan.artist?.name || "").trim();
    if (!venue) return response(409, { error: "Save this venue and its public booking email to your account before sending." }, headers);
    if (!artistName) return response(409, { error: "Add your act name and save the booking workspace before sending." }, headers);
    const key = sendKey(userId, id), existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    if (existing.Item) return response(existing.Item.status?.S === "sent" ? 200 : 202, { status: existing.Item.status?.S || "pending", duplicate: true, messageId: existing.Item.providerMessageId?.S || "" }, headers);
    const reservedAt = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: creditKey(userId), UpdateExpression: "ADD credits :minusOne, reservedCredits :one SET updatedAt = :updatedAt", ConditionExpression: "credits >= :one", ExpressionAttributeValues: { ":minusOne": { N: "-1" }, ":one": { N: "1" }, ":updatedAt": { S: reservedAt } } } },
        { Put: { TableName: tableName, Item: { ...key, status: { S: "reserved" }, venueKey: { S: venueKey }, venueName: { S: String(venue.name || "Venue").slice(0, 160) }, recipient: { S: to }, subject: { S: subject }, createdAt: { S: reservedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(userId, reservedAt, id), entryType: { S: "email_reservation" }, delta: { N: "-1" }, status: { S: "reserved" }, description: { S: `Booking email reserved for ${String(venue.name || "venue").slice(0, 160)}` }, createdAt: { S: reservedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) { const raced = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true })); if (raced.Item) return response(202, { status: raced.Item.status?.S || "pending", duplicate: true }, headers); return response(402, { error: "Not enough booking-email credits." }, headers); }
    let providerAccepted = false;
    try {
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: key, UpdateExpression: "SET #status = :sending, sendingAt = :at", ConditionExpression: "#status = :reserved", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sending": { S: "sending" }, ":reserved": { S: "reserved" }, ":at": { S: nowIso() } } }));
      const delivery = await sendBookingEmail({ userId, artistName, venueName: venue.name, to, subject, message });
      if (!delivery?.messageId) throw new Error("Email provider did not accept the message");
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: key, UpdateExpression: "SET #status = :accepted, providerAcceptedAt = :at, providerMessageId = :messageId", ConditionExpression: "#status = :sending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":accepted": { S: "provider_accepted" }, ":sending": { S: "sending" }, ":at": { S: nowIso() }, ":messageId": { S: delivery.messageId } } }));
      providerAccepted = true;
      const sentAt = nowIso();
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: key, UpdateExpression: "SET #status = :sent, sentAt = :at", ConditionExpression: "#status = :accepted", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sent": { S: "sent" }, ":accepted": { S: "provider_accepted" }, ":at": { S: sentAt } } } },
        { Update: { TableName: tableName, Key: creditKey(userId), UpdateExpression: "ADD sentEmails :one, reservedCredits :minusOne SET updatedAt = :at", ExpressionAttributeValues: { ":one": { N: "1" }, ":minusOne": { N: "-1" }, ":at": { S: sentAt } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(userId, sentAt, `${id}-sent`), entryType: { S: "email_sent" }, delta: { N: "0" }, status: { S: "settled" }, description: { S: `Booking email sent to ${String(venue.name || "venue").slice(0, 160)}` }, createdAt: { S: sentAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
      return response(200, { status: "sent", messageId: delivery.messageId }, headers);
    } catch (error) {
      if (providerAccepted) return response(202, { status: "provider_accepted", message: "The provider accepted the email. Credit reconciliation is pending; this request will not send again." }, headers);
      const state = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
      if (state.Item?.status?.S === "sending" && !state.Item?.providerMessageId?.S) {
        const restoredAt = nowIso();
        await db.send(new TransactWriteItemsCommand({ TransactItems: [
          { Update: { TableName: tableName, Key: key, UpdateExpression: "SET #status = :restored, failedAt = :at", ConditionExpression: "#status = :sending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":restored": { S: "restored" }, ":sending": { S: "sending" }, ":at": { S: restoredAt } } } },
          { Update: { TableName: tableName, Key: creditKey(userId), UpdateExpression: "ADD credits :one, reservedCredits :minusOne SET updatedAt = :at", ExpressionAttributeValues: { ":one": { N: "1" }, ":minusOne": { N: "-1" }, ":at": { S: restoredAt } } } },
          { Put: { TableName: tableName, Item: { ...ledgerKey(userId, restoredAt, `${id}-restore`), entryType: { S: "email_restored" }, delta: { N: "1" }, status: { S: "restored" }, description: { S: `Credit restored after ${String(venue.name || "venue").slice(0, 160)} email failed` }, createdAt: { S: restoredAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
        ] }));
      }
      return response(502, { error: "The email provider did not accept the booking email. Your credit was restored." }, headers);
    }
  }

  return async function handle(event) {
    const method = event?.requestContext?.http?.method, path = event?.rawPath;
    if (method === "POST" && path === "/tour-manager/stripe/webhook") return webhook(event);
    if (method === "POST" && path === "/tour-manager/checkout") return checkout(event);
    if (method === "GET" && path === "/tour-manager/credits") return credits(event);
    if (method === "POST" && path === "/tour-manager/emails/send") return sendEmail(event);
    return null;
  };
}
