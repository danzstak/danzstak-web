import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const TOUR_MANAGER_EMAIL_PRICE_ID = "price_1UXjMtFgtfNMBXOVCLeEk8vI";
export const TOUR_MANAGER_PRODUCT_ID = "prod_VYr5JIwpaFSX7b";
export const TOUR_MANAGER_EMAIL_UNIT_CENTS = 150;
export const BOOKING_CONTACT_PRICE_ID = "price_1UXkB5FgtfNMBXOVVeUOGJjX";
export const BOOKING_CONTACT_PRODUCT_ID = "prod_VYruR0GLph8xsy";
export const BOOKING_CONTACT_UNIT_CENTS = 75;
export const PHONE_NUMBER_PRICE_ID = "price_1UXjlYFgtfNMBXOVD42xjrTc";
export const PHONE_NUMBER_PRODUCT_ID = "prod_VYrUnT8yvXS0Ek";
export const PHONE_NUMBER_UNIT_CENTS = 300;
export const TEST_TOUR_MANAGER_EMAIL_PRICE_ID = "price_1UXoMtFgtfNMBXOV1fqlkuRf";
export const TEST_TOUR_MANAGER_PRODUCT_ID = "prod_VYwFT1LQyqjsxc";
export const TEST_BOOKING_CONTACT_PRICE_ID = "price_1UXoMsFgtfNMBXOVSmnWDFGa";
export const TEST_BOOKING_CONTACT_PRODUCT_ID = "prod_VYwF2z3cYoe72u";
export const TEST_PHONE_NUMBER_PRICE_ID = "price_1UXoMuFgtfNMBXOVNxfRWRDp";
export const TEST_PHONE_NUMBER_PRODUCT_ID = "prod_VYwFZRXzQ3dNNv";
export const SYNC_NETWORK_NUMBER_UNIT_CENTS = 300;
export const TEST_SYNC_NETWORK_NUMBER_PRICE_ID = "price_1UadinDoNxcsrqZsYdYyJxAB";
export const TEST_SYNC_NETWORK_NUMBER_PRODUCT_ID = "prod_VbrRRYRnBc56Qt";
const LIVE_STRIPE_CATALOG = Object.freeze({
  tour: { priceId: TOUR_MANAGER_EMAIL_PRICE_ID, productId: TOUR_MANAGER_PRODUCT_ID },
  contact: { priceId: BOOKING_CONTACT_PRICE_ID, productId: BOOKING_CONTACT_PRODUCT_ID },
  phone: { priceId: PHONE_NUMBER_PRICE_ID, productId: PHONE_NUMBER_PRODUCT_ID }
});
const TEST_STRIPE_CATALOG = Object.freeze({
  tour: { priceId: TEST_TOUR_MANAGER_EMAIL_PRICE_ID, productId: TEST_TOUR_MANAGER_PRODUCT_ID },
  contact: { priceId: TEST_BOOKING_CONTACT_PRICE_ID, productId: TEST_BOOKING_CONTACT_PRODUCT_ID },
  phone: { priceId: TEST_PHONE_NUMBER_PRICE_ID, productId: TEST_PHONE_NUMBER_PRODUCT_ID }
});
const TEST_SYNC_NETWORK_CATALOG = Object.freeze({
  priceId: TEST_SYNC_NETWORK_NUMBER_PRICE_ID,
  productId: TEST_SYNC_NETWORK_NUMBER_PRODUCT_ID
});
function stripeCatalog(livemode) { return livemode ? LIVE_STRIPE_CATALOG : TEST_STRIPE_CATALOG; }
const PRODUCT = "tour_manager_booking_email";
const CONTACT_PRODUCT = "booking_contact_unlock";
const PHONE_PRODUCT = "danzstak_phone_activation";
const SYNC_NETWORK_PRODUCT = "danzstak_sync_network_alias";
const CREDIT_KEY = "TOUR_MANAGER#BOOKING_EMAIL_CREDITS";
const PROFESSIONAL_KEY = "TOUR_MANAGER#PROFESSIONAL_ENTITLEMENT";
const PHONE_ENTITLEMENT_KEY = "PHONE#ACTIVATION_ENTITLEMENT";
const SYNC_NETWORK_ENTITLEMENT_KEY = "SYNC#NETWORK_ALIAS_ENTITLEMENT";
const SYNC_NETWORK_ALIAS_OWNER = "SYNC#NETWORK_ALIAS";
const BOOKING_WORKSPACE_KEY = "booking-workspace-v1";
const EVENT_OWNER = "STRIPE#TOUR_MANAGER_EVENTS";
const SUPPRESSION_OWNER = "TOUR_MANAGER#GLOBAL_SUPPRESSION";
const OPT_OUT_TOKEN_OWNER = "TOUR_MANAGER#OPT_OUT_TOKEN";
const PROVIDER_MESSAGE_OWNER = "TOUR_MANAGER#PROVIDER_MESSAGE";
const PROVIDER_EVENT_OWNER = "TOUR_MANAGER#PROVIDER_EVENT";
const DANZSTAK_POSTAL_ADDRESS = "DanzStak LLC, 2063 Main St. #237, Oakley, CA 94561, USA";
const MAX_CREDITS_PER_CHECKOUT = 500;
export const MAX_NEW_PITCHES_PER_24_HOURS = 20;
export const BOOKING_CONTACT_COOLDOWN_SECONDS = 30 * 24 * 60 * 60;
const WEBHOOK_TYPES = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "charge.refunded"]);
const securityHeaders = { "content-type": "application/json", "cache-control": "no-store", "strict-transport-security": "max-age=63072000; includeSubDomains; preload", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer" };

function response(statusCode, data, headers = {}) { return { statusCode, headers: { ...securityHeaders, ...headers }, body: JSON.stringify(data) }; }
function rawBody(event) { if (typeof event?.body !== "string") return ""; return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body; }
function parseBody(event) { try { return JSON.parse(rawBody(event) || "{}"); } catch { return null; } }
function validUserId(value) { return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value); }
function checkoutKey(userId, sessionId) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#CHECKOUT#${sessionId}` } }; }
function creditKey(userId) { return { userId: { S: userId }, tourId: { S: CREDIT_KEY } }; }
function professionalKey(userId) { return { userId: { S: userId }, tourId: { S: PROFESSIONAL_KEY } }; }
function phoneEntitlementKey(userId) { return { userId: { S: userId }, tourId: { S: PHONE_ENTITLEMENT_KEY } }; }
function syncNetworkEntitlementKey(userId) { return { userId: { S: userId }, tourId: { S: SYNC_NETWORK_ENTITLEMENT_KEY } }; }
function syncNetworkAliasKey(alias) { return { userId: { S: SYNC_NETWORK_ALIAS_OWNER }, tourId: { S: alias } }; }
function eventKey(eventId) { return { userId: { S: EVENT_OWNER }, tourId: { S: eventId } }; }
function ledgerKey(userId, at, id) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#LEDGER#${at}#${id}` } }; }
function sendKey(userId, id) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${id}` } }; }
function outreachHourKey(userId, at) { const hour = Math.floor(at / 3600000); return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#OUTREACH_HOUR#${String(hour).padStart(12, "0")}` } }; }
function normalizedRecipientHash(value) { return createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex"); }
function recipientCooldownKey(userId, recipient) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#RECIPIENT_COOLDOWN#${normalizedRecipientHash(recipient)}` } }; }
function suppressionKey(recipient) { return { userId: { S: SUPPRESSION_OWNER }, tourId: { S: normalizedRecipientHash(recipient) } }; }
function providerMessageKey(messageId) { return { userId: { S: PROVIDER_MESSAGE_OWNER }, tourId: { S: createHash("sha256").update(String(messageId || "")).digest("hex") } }; }
function providerEventKey(eventId) { return { userId: { S: PROVIDER_EVENT_OWNER }, tourId: { S: createHash("sha256").update(String(eventId || "")).digest("hex") } }; }
function optOutTokenHash(token) { return createHash("sha256").update(`tour-manager-opt-out:${String(token || "")}`).digest("hex"); }
function optOutTokenKey(token) { return { userId: { S: OPT_OUT_TOKEN_OWNER }, tourId: { S: optOutTokenHash(token) } }; }
function optOutFooter(token) { return `${DANZSTAK_POSTAL_ADDRESS}\nReply or offer dates securely: https://danzstak.com/booking-reply.html#token=${token}\nDon't want booking pitches through DanzStak? Opt out: https://danzstak.com/booking-opt-out.html#token=${token}`; }
function outreachWindow(items, at) {
  const currentHour = Math.floor(at / 3600000), oldestHour = currentHour - 23;
  let previousHourCount = 0, currentHourCount = 0;
  for (const item of items || []) {
    const bucket = Number(String(item.tourId?.S || "").slice("TOUR_MANAGER#OUTREACH_HOUR#".length)), count = Number(item.sendCount?.N || 0);
    if (!Number.isInteger(bucket) || bucket < oldestHour || bucket > currentHour || !Number.isFinite(count) || count < 0) continue;
    if (bucket === currentHour) currentHourCount += count; else previousHourCount += count;
  }
  return { previousHourCount, currentHourCount, total: previousHourCount + currentHourCount };
}
function contactUnlockKey(userId, venueKey) { return { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#CONTACT_UNLOCK#${venueKey}` } }; }
function validVenueKey(value) { return typeof value === "string" && /^[a-f0-9]{20}$/.test(value); }
function validSyncNetworkAlias(value) { return typeof value === "string" && /^DS-[1-9][0-9]{2}-[0-9]{4}$/.test(value); }

export function generateSyncNetworkAlias(bytes = randomBytes(4)) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) throw new TypeError("Four random bytes are required");
  const value = 1_000_000 + (bytes.readUInt32BE(0) % 9_000_000);
  const digits = String(value);
  return `DS-${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function verifyStripeSignature(payload, header, secret, currentTime = Date.now(), toleranceSeconds = 300) {
  if (typeof payload !== "string" || !payload || typeof header !== "string" || !secret?.startsWith("whsec_")) return false;
  const values = header.split(",").map(value => value.trim()), timestamp = values.find(value => value.startsWith("t="))?.slice(2), signatures = values.filter(value => value.startsWith("v1=")).map(value => value.slice(3));
  if (!/^\d{10,}$/.test(timestamp || "") || !signatures.length) return false;
  const age = Math.abs(Math.floor(currentTime / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some(signature => { if (!/^[a-f0-9]{64}$/i.test(signature)) return false; const candidate = Buffer.from(signature, "hex"); return candidate.length === expected.length && timingSafeEqual(candidate, expected); });
}

export function createTourManagerBilling({ db, commands, authenticate, corsHeaders, tableName, sendBookingEmail, sendBookingReply, validateOutreachEpkLink, env = process.env, fetcher = fetch, clock = Date.now, aliasGenerator = generateSyncNetworkAlias }) {
  const { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand } = commands;
  const testMode = () => env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
  const paymentsAllowed = () => Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET) && (testMode() || (env.TOUR_MANAGER_LIVE_PAYMENTS === "true" && env.STRIPE_SECRET_KEY.startsWith("sk_live_")));
  const expectedStripeAccountId = () => String(env.STRIPE_EXPECTED_ACCOUNT_ID || "").trim();
  const syncNetworkPaymentsAllowed = () => env.SYNC_NETWORK_NUMBER_TEST_CHECKOUT_ENABLED === "true" && testMode() && paymentsAllowed() && env.STRIPE_SYNC_NETWORK_WEBHOOK_SECRET?.startsWith("whsec_") && /^acct_[a-zA-Z0-9]+$/.test(expectedStripeAccountId());
  const nowIso = () => new Date(clock()).toISOString();
  const browserHeaders = event => corsHeaders(event.headers?.origin || event.headers?.Origin);
  let verifiedStripeAccountId = "";

  async function providerEvents(event) {
    const records = Array.isArray(event?.Records) ? event.Records : [];
    if (!records.length || records.some(record => record?.EventSource !== "aws:sns" || typeof record?.Sns?.Message !== "string")) return null;
    let processed = 0, ignored = 0, duplicates = 0;
    for (const record of records) {
      let notification;
      try { notification = JSON.parse(record.Sns.Message); } catch { ignored += 1; continue; }
      const type = String(notification?.eventType || notification?.notificationType || "").toLowerCase();
      const messageId = String(notification?.mail?.messageId || "").trim();
      if (!/^[a-zA-Z0-9._-]{8,200}$/.test(messageId) || !["delivery", "bounce", "complaint"].includes(type)) { ignored += 1; continue; }
      const mapping = await db.send(new GetItemCommand({ TableName: tableName, Key: providerMessageKey(messageId), ConsistentRead: true })), tags = notification?.mail?.tags || {}, item = mapping.Item || { artistId: { S: String(tags.DanzStakArtistId?.[0] || "") }, sendId: { S: String(tags.DanzStakSendId?.[0] || "") }, recipientHash: { S: String(tags.DanzStakRecipientHash?.[0] || "") } };
      if (!validUserId(item?.artistId?.S) || !/^[a-zA-Z0-9_-]{16,100}$/.test(item?.sendId?.S || "") || !/^[a-f0-9]{64}$/.test(item?.recipientHash?.S || "")) { ignored += 1; continue; }
      if (type === "bounce" && String(notification?.bounce?.bounceType || "").toLowerCase() !== "permanent") { ignored += 1; continue; }
      const eventId = String(record.Sns.MessageId || `${type}:${messageId}:${notification?.mail?.timestamp || ""}`), at = nowIso(), status = type === "delivery" ? "delivered" : type === "bounce" ? "bounced" : "complained";
      const transaction = [
        { Put: { TableName: tableName, Item: { ...providerEventKey(eventId), eventType: { S: type }, providerMessageHash: { S: providerMessageKey(messageId).tourId.S }, processedAt: { S: at } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: sendKey(item.artistId.S, item.sendId.S), UpdateExpression: "SET #status = :status, providerEventAt = :at", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": { S: status }, ":at": { S: at } } } }
      ];
      if (type !== "delivery") transaction.push({ Put: { TableName: tableName, Item: { userId: { S: SUPPRESSION_OWNER }, tourId: { S: item.recipientHash.S }, reason: { S: type === "bounce" ? "permanent_bounce" : "provider_complaint" }, source: { S: "ses_event" }, optedOutAt: { S: at } } } });
      try { await db.send(new TransactWriteItemsCommand({ TransactItems: transaction })); processed += 1; }
      catch (error) {
        const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: providerEventKey(eventId), ConsistentRead: true }));
        if (duplicate.Item) { duplicates += 1; continue; }
        throw error;
      }
    }
    return { processed, ignored, duplicates };
  }

  async function stripe(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await fetcher(`https://api.stripe.com/v1${path}`, { ...options, signal: controller.signal, headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(options.headers || {}) } });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) { const error = new Error("Stripe request failed"); error.statusCode = result.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function stripeAccountMatches() {
    const expected = expectedStripeAccountId();
    if (!/^acct_[a-zA-Z0-9]+$/.test(expected) || !paymentsAllowed()) return false;
    if (verifiedStripeAccountId === expected) return true;
    try {
      const account = await stripe("/account");
      if (account?.id !== expected) return false;
      verifiedStripeAccountId = expected;
      return true;
    } catch {
      return false;
    }
  }

  async function checkout(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    if (!paymentsAllowed()) return response(503, { error: "Tour Manager payments are not configured for testing." }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const body = parseBody(event), quantity = Number(body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CREDITS_PER_CHECKOUT) return response(400, { error: `Choose 1 to ${MAX_CREDITS_PER_CHECKOUT} booking emails.` }, headers);
    const catalog = stripeCatalog(!testMode()), requestId = randomUUID(), form = new URLSearchParams({ mode: "payment", "line_items[0][price]": catalog.tour.priceId, "line_items[0][quantity]": String(quantity), client_reference_id: userId, "metadata[product]": PRODUCT, "metadata[userId]": userId, "metadata[priceId]": catalog.tour.priceId, "metadata[quantity]": String(quantity), success_url: "https://danzstak.com/booking-selections.html?credits=success", cancel_url: "https://danzstak.com/booking-selections.html?credits=cancelled" });
    const session = await stripe("/checkout/sessions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `tour-manager-${userId}-${requestId}` }, body: form.toString() });
    if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(session.id || "") || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe returned an invalid Checkout session");
    await db.send(new PutItemCommand({ TableName: tableName, Item: { ...checkoutKey(userId, session.id), sessionId: { S: session.id }, status: { S: "pending" }, quantity: { N: String(quantity) }, priceId: { S: catalog.tour.priceId }, environment: { S: testMode() ? "test" : "live" }, createdAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(userId)" }));
    return response(200, { checkoutUrl: session.url, quantity, unitAmountCents: TOUR_MANAGER_EMAIL_UNIT_CENTS, currency: "usd", testMode: testMode() }, headers);
  }

  async function contactCheckout(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    if (!paymentsAllowed()) return response(503, { error: "Booking contact payments are not configured for testing." }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const venueKey = String(parseBody(event)?.venueKey || "").trim();
    if (!validVenueKey(venueKey)) return response(400, { error: "Choose a saved venue contact." }, headers);
    const entitlement = await db.send(new GetItemCommand({ TableName: tableName, Key: contactUnlockKey(userId, venueKey), ConsistentRead: true }));
    if (entitlement.Item?.status?.S === "active") return response(200, { unlocked: true, venueKey }, headers);
    const workspace = await db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY } }, ConsistentRead: true }));
    let plan = {}; try { plan = JSON.parse(workspace.Item?.plan?.S || "{}"); } catch { plan = {}; }
    const venue = (plan.venues || []).find(item => item?.venueKey === venueKey);
    if (!venue || !(venue.emails || []).length && !(venue.phones || []).length) return response(409, { error: "Save this venue and its public booking contact before unlocking it." }, headers);
    const catalog = stripeCatalog(!testMode()), requestId = randomUUID(), form = new URLSearchParams({ mode: "payment", "line_items[0][price]": catalog.contact.priceId, "line_items[0][quantity]": "1", client_reference_id: userId, "metadata[product]": CONTACT_PRODUCT, "metadata[userId]": userId, "metadata[priceId]": catalog.contact.priceId, "metadata[venueKey]": venueKey, success_url: `https://danzstak.com/booking-selections.html?contact=success&venueKey=${encodeURIComponent(venueKey)}`, cancel_url: `https://danzstak.com/booking-selections.html?contact=cancelled&venueKey=${encodeURIComponent(venueKey)}` });
    const session = await stripe("/checkout/sessions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `contact-unlock-${userId}-${venueKey}-${requestId}` }, body: form.toString() });
    if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(session.id || "") || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe returned an invalid Checkout session");
    await db.send(new PutItemCommand({ TableName: tableName, Item: { ...checkoutKey(userId, session.id), sessionId: { S: session.id }, status: { S: "pending" }, product: { S: CONTACT_PRODUCT }, venueKey: { S: venueKey }, venueName: { S: String(venue.name || "Venue").slice(0, 160) }, priceId: { S: catalog.contact.priceId }, environment: { S: testMode() ? "test" : "live" }, createdAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(userId)" }));
    return response(200, { checkoutUrl: session.url, venueKey, unitAmountCents: BOOKING_CONTACT_UNIT_CENTS, currency: "usd", testMode: testMode() }, headers);
  }

  async function phoneCheckout(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    if (env.PHONE_ACTIVATION_CHECKOUT_ENABLED !== "true") return response(503, { error: "Carrier phone activation is not available." }, headers);
    if (!paymentsAllowed()) return response(503, { error: "Phone activation payments are not configured for testing." }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const entitlement = await db.send(new GetItemCommand({ TableName: tableName, Key: phoneEntitlementKey(userId), ConsistentRead: true }));
    if (["pending_provisioning", "active"].includes(entitlement.Item?.status?.S)) {
      return response(200, { entitled: true, status: entitlement.Item.status.S }, headers);
    }
    const catalog = stripeCatalog(!testMode()), requestId = randomUUID();
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": catalog.phone.priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: userId,
      "metadata[product]": PHONE_PRODUCT,
      "metadata[userId]": userId,
      "metadata[priceId]": catalog.phone.priceId,
      success_url: "https://danzstak.com/messages.html?phone=payment-success",
      cancel_url: "https://danzstak.com/messages.html?phone=payment-cancelled"
    });
    const session = await stripe("/checkout/sessions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `phone-activation-${userId}-${requestId}` }, body: form.toString() });
    if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(session.id || "") || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe returned an invalid Checkout session");
    await db.send(new PutItemCommand({ TableName: tableName, Item: { ...checkoutKey(userId, session.id), sessionId: { S: session.id }, status: { S: "pending" }, product: { S: PHONE_PRODUCT }, priceId: { S: catalog.phone.priceId }, environment: { S: testMode() ? "test" : "live" }, createdAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(userId)" }));
    return response(200, { checkoutUrl: session.url, unitAmountCents: PHONE_NUMBER_UNIT_CENTS, currency: "usd", testMode: testMode() }, headers);
  }

  async function phoneEntitlement(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: phoneEntitlementKey(userId), ConsistentRead: true }));
    return response(200, {
      entitled: ["pending_provisioning", "active"].includes(found.Item?.status?.S),
      status: found.Item?.status?.S || "not_purchased",
      provisioned: found.Item?.status?.S === "active",
      unitAmountCents: PHONE_NUMBER_UNIT_CENTS,
      currency: "usd",
      priceId: stripeCatalog(!testMode()).phone.priceId
    }, headers);
  }

  async function syncNetworkCheckout(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    if (!syncNetworkPaymentsAllowed()) return response(503, { error: "DanzStak Network number checkout is available in Test Mode only." }, headers);
    if (!await stripeAccountMatches()) return response(503, { error: "DanzStak payments are not connected to the approved Stripe account." }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const entitlement = await db.send(new GetItemCommand({ TableName: tableName, Key: syncNetworkEntitlementKey(userId), ConsistentRead: true }));
    if (entitlement.Item?.status?.S === "active" && validSyncNetworkAlias(entitlement.Item?.alias?.S)) {
      return response(200, { entitled: true, status: "active", alias: entitlement.Item.alias.S, testMode: true }, headers);
    }
    const returnBaseUrl = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(String(env.SYNC_NETWORK_NUMBER_RETURN_BASE_URL || ""))
      ? String(env.SYNC_NETWORK_NUMBER_RETURN_BASE_URL).replace(/\/$/, "")
      : "https://danzstak.com";
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": TEST_SYNC_NETWORK_CATALOG.priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: userId,
      "metadata[product]": SYNC_NETWORK_PRODUCT,
      "metadata[userId]": userId,
      "metadata[priceId]": TEST_SYNC_NETWORK_CATALOG.priceId,
      success_url: `${returnBaseUrl}/messages.html?sync-number=payment-success`,
      cancel_url: `${returnBaseUrl}/messages.html?sync-number=payment-cancelled`
    });
    const session = await stripe("/checkout/sessions", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `sync-network-number-${userId}` }, body: form.toString() });
    if (!/^cs_test_[a-zA-Z0-9]+$/.test(session.id || "") || !session.url?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe returned an invalid Checkout session");
    const existingCheckout = await db.send(new GetItemCommand({ TableName: tableName, Key: checkoutKey(userId, session.id), ConsistentRead: true }));
    if (!existingCheckout.Item) {
      await db.send(new PutItemCommand({ TableName: tableName, Item: { ...checkoutKey(userId, session.id), sessionId: { S: session.id }, status: { S: "pending" }, product: { S: SYNC_NETWORK_PRODUCT }, priceId: { S: TEST_SYNC_NETWORK_CATALOG.priceId }, environment: { S: "test" }, createdAt: { S: nowIso() } }, ConditionExpression: "attribute_not_exists(userId)" }));
    } else if (existingCheckout.Item.product?.S !== SYNC_NETWORK_PRODUCT || existingCheckout.Item.priceId?.S !== TEST_SYNC_NETWORK_CATALOG.priceId) {
      throw new Error("Stored Checkout binding does not match the DanzStak Network number product");
    }
    return response(200, { checkoutUrl: session.url, unitAmountCents: SYNC_NETWORK_NUMBER_UNIT_CENTS, currency: "usd", testMode: true }, headers);
  }

  async function syncNetworkEntitlement(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const found = await db.send(new GetItemCommand({ TableName: tableName, Key: syncNetworkEntitlementKey(userId), ConsistentRead: true }));
    const active = found.Item?.status?.S === "active" && validSyncNetworkAlias(found.Item?.alias?.S);
    return response(200, {
      entitled: active,
      status: found.Item?.status?.S || "not_purchased",
      alias: active ? found.Item.alias.S : "",
      network: "sync_only",
      carrierNumber: false,
      receivesSms: false,
      emergencyCalling: false,
      deviceOtpRequired: true,
      checkoutAvailable: env.SYNC_NETWORK_NUMBER_TEST_CHECKOUT_ENABLED === "true",
      unitAmountCents: SYNC_NETWORK_NUMBER_UNIT_CENTS,
      currency: "usd",
      testMode: true,
      priceId: TEST_SYNC_NETWORK_CATALOG.priceId
    }, headers);
  }

  async function contactUnlocks(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const result = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :userId AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":userId": { S: userId }, ":prefix": { S: "TOUR_MANAGER#CONTACT_UNLOCK#" } }, ConsistentRead: true, Limit: 200 }));
    const venueKeys = (result.Items || []).filter(item => item.status?.S === "active" && validVenueKey(item.venueKey?.S)).map(item => item.venueKey.S);
    return response(200, { venueKeys, unitAmountCents: BOOKING_CONTACT_UNIT_CENTS, currency: "usd", priceId: stripeCatalog(!testMode()).contact.priceId }, headers);
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
    return response(200, { bookingEmailCredits: Number(found.Item?.credits?.N || 0), purchasedCredits: Number(found.Item?.purchasedCredits?.N || 0), sentEmails: Number(found.Item?.sentEmails?.N || 0), reservedCredits: Number(found.Item?.reservedCredits?.N || 0), unitAmountCents: TOUR_MANAGER_EMAIL_UNIT_CENTS, currency: "usd", priceId: stripeCatalog(!testMode()).tour.priceId, activity }, headers);
  }

  async function outreach(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const result = await db.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "userId = :userId AND begins_with(tourId, :prefix)",
      ExpressionAttributeValues: { ":userId": { S: userId }, ":prefix": { S: "TOUR_MANAGER#EMAIL_SEND#" } },
      ConsistentRead: true,
      ScanIndexForward: false,
      Limit: 200
    }));
    const messages = (result.Items || []).map(item => ({
      id: String(item.tourId?.S || "").slice("TOUR_MANAGER#EMAIL_SEND#".length),
      venueKey: item.venueKey?.S || "",
      venueName: item.venueName?.S || "Venue",
      recipient: item.recipient?.S || "",
      subject: item.subject?.S || "",
      status: item.status?.S || "unknown",
      createdAt: item.createdAt?.S || "",
      sentAt: item.sentAt?.S || "",
      providerAcceptedAt: item.providerAcceptedAt?.S || "",
      repliedAt: item.repliedAt?.S || "",
      followUpTo: item.followUpTo?.S || ""
    }));
    const replyResult = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :userId AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":userId": { S: userId }, ":prefix": { S: "TOUR_MANAGER#BOOKING_REPLY#" } }, ConsistentRead: true, ScanIndexForward: false, Limit: 200 }));
    const replies = (replyResult.Items || []).map(item => ({ id: item.tourId?.S || "", outreachId: item.outreachId?.S || "", venueKey: item.venueKey?.S || "", direction: item.direction?.S === "outbound" ? "outbound" : "inbound", action: item.action?.S || "reply", content: item.content?.S || "", proposedDate: item.proposedDate?.S || "", status: item.status?.S || "received", appliedStatus: item.appliedStatus?.S || "", appliedAt: item.appliedAt?.S || "", createdAt: item.createdAt?.S || "" }));
    return response(200, { messages, replies }, headers);
  }

  async function outreachPreflight(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const body = parseBody(event), venueKey = String(body?.venueKey || "").trim(), to = String(body?.to || "").trim().toLowerCase(), outreachId = String(body?.outreachId || "").trim(), followUpTo = String(body?.followUpTo || "").trim();
    if (!venueKey || venueKey.length > 240 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !/^[a-zA-Z0-9_-]{16,100}$/.test(outreachId)) return response(400, { error: "Choose a saved venue, public booking email, and valid outreach draft." }, headers);
    const preflightMs = clock(), [workspace, contactAccess, suppressed, cooldown, hourly] = await Promise.all([
      db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY } }, ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: contactUnlockKey(userId, venueKey), ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: suppressionKey(to), ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: recipientCooldownKey(userId, to), ConsistentRead: true })),
      db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :userId AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":userId": { S: userId }, ":prefix": { S: "TOUR_MANAGER#OUTREACH_HOUR#" } }, ConsistentRead: true, ScanIndexForward: false, Limit: 48 }))
    ]);
    let plan = {}; try { plan = JSON.parse(workspace.Item?.plan?.S || "{}"); } catch { plan = {}; }
    const venue = (plan.venues || []).find(item => item?.venueKey === venueKey && (item.emails || []).some(email => String(email).toLowerCase() === to));
    if (!venue) return response(409, { error: "Save this venue and its public booking email before review." }, headers);
    if (contactAccess.Item?.status?.S !== "active") return response(402, { error: "Unlock this venue's booking contact before review." }, headers);
    if (suppressed.Item) return response(409, { error: "This contact opted out of DanzStak booking pitches and cannot be emailed." }, headers);
    let followUpSource;
    if (followUpTo) {
      if (!/^[a-zA-Z0-9_-]{16,100}$/.test(followUpTo)) return response(400, { error: "Choose a valid booking thread to follow up." }, headers);
      followUpSource = (await db.send(new GetItemCommand({ TableName: tableName, Key: sendKey(userId, followUpTo), ConsistentRead: true }))).Item;
      const due = String(venue.booking?.followUp || ""), today = new Date(preflightMs).toISOString().slice(0, 10);
      if (!followUpSource || followUpSource.venueKey?.S !== venueKey || followUpSource.recipient?.S !== to) return response(409, { error: "This follow-up does not match the saved venue thread." }, headers);
      if (!due || due > today) return response(409, { error: "This follow-up is not due yet." }, headers);
      if (followUpSource.repliedAt?.S) return response(409, { error: "This venue already replied. Continue the existing thread instead of sending a follow-up." }, headers);
      if (followUpSource.followUpSendId?.S) return response(409, { error: "The one allowed follow-up has already been prepared or sent." }, headers);
      if (!["sent", "delivered"].includes(followUpSource.status?.S || "")) return response(409, { error: "Only a successfully submitted booking pitch can be followed up." }, headers);
    } else if (Number(cooldown.Item?.nextAllowedAt?.N || 0) > Math.floor(preflightMs / 1000)) return response(409, { error: "This booking contact was already pitched in the last 30 days. Continue the existing thread instead." }, headers);
    if (outreachWindow(hourly.Items, preflightMs).total >= MAX_NEW_PITCHES_PER_24_HOURS) return response(429, { error: "You reached the 20 new booking pitches allowed in 24 hours. Try again after an earlier pitch leaves the window." }, headers);
    const token = randomBytes(32).toString("hex"), createdAt = new Date(preflightMs).toISOString(), expiresAt = Math.floor(preflightMs / 1000) + 400 * 86400;
    await db.send(new PutItemCommand({ TableName: tableName, Item: { ...optOutTokenKey(token), artistId: { S: userId }, outreachId: { S: outreachId }, venueKey: { S: venueKey }, recipientHash: { S: normalizedRecipientHash(to) }, ...(followUpTo ? { followUpTo: { S: followUpTo } } : {}), createdAt: { S: createdAt }, expiresAt: { N: String(expiresAt) } }, ConditionExpression: "attribute_not_exists(userId)" }));
    return response(200, { footer: optOutFooter(token), suppressionChecked: true }, headers);
  }

  async function optOut(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const token = String(parseBody(event)?.token || "").trim();
    if (!/^[a-f0-9]{64}$/.test(token)) return response(400, { error: "This opt-out link is invalid or expired." }, headers);
    const tokenResult = await db.send(new GetItemCommand({ TableName: tableName, Key: optOutTokenKey(token), ConsistentRead: true })), item = tokenResult.Item, currentSeconds = Math.floor(clock() / 1000);
    if (!item || Number(item.expiresAt?.N || 0) <= currentSeconds || !/^[a-f0-9]{64}$/.test(item.recipientHash?.S || "")) return response(400, { error: "This opt-out link is invalid or expired." }, headers);
    const key = { userId: { S: SUPPRESSION_OWNER }, tourId: { S: item.recipientHash.S } }, optedOutAt = nowIso();
    try {
      await db.send(new PutItemCommand({ TableName: tableName, Item: { ...key, reason: { S: "recipient_opt_out" }, source: { S: "booking_email_footer" }, optedOutAt: { S: optedOutAt } }, ConditionExpression: "attribute_not_exists(userId)" }));
      return response(200, { optedOut: true, alreadyOptedOut: false }, headers);
    } catch (error) {
      const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
      if (existing.Item) return response(200, { optedOut: true, alreadyOptedOut: true }, headers);
      throw error;
    }
  }

  async function externalReply(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const body = parseBody(event), token = String(body?.token || "").trim(), content = String(body?.content || "").trim(), proposedDate = String(body?.proposedDate || "").trim(), action = ["reply", "interested", "offer_date", "confirm_date", "pass"].includes(String(body?.action)) ? String(body.action) : "reply", clientMessageId = String(body?.clientMessageId || "").trim();
    const dateAction = action === "offer_date" || action === "confirm_date";
    if (!/^[a-f0-9]{64}$/.test(token) || content.length < 1 || content.length > 4000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(clientMessageId) || (proposedDate && !/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) || (dateAction && !/^\d{4}-\d{2}-\d{2}$/.test(proposedDate))) return response(400, { error: "Write a reply of 1 to 4,000 characters and include a valid date when offering or confirming one." }, headers);
    const tokenResult = await db.send(new GetItemCommand({ TableName: tableName, Key: optOutTokenKey(token), ConsistentRead: true })), item = tokenResult.Item, nowSeconds = Math.floor(clock() / 1000);
    if (!item || !validUserId(item.artistId?.S) || !/^[a-zA-Z0-9_-]{16,100}$/.test(item.outreachId?.S || "") || Number(item.expiresAt?.N || 0) <= nowSeconds) return response(400, { error: "This secure reply link is invalid or expired." }, headers);
    const at = nowIso(), replyKey = { userId: { S: item.artistId.S }, tourId: { S: `TOUR_MANAGER#BOOKING_REPLY#${item.outreachId.S}#${clientMessageId}` } };
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...replyKey, outreachId: { S: item.outreachId.S }, venueKey: { S: item.venueKey?.S || "" }, direction: { S: "inbound" }, action: { S: action }, content: { S: content }, ...(proposedDate ? { proposedDate: { S: proposedDate } } : {}), createdAt: { S: at } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: sendKey(item.artistId.S, item.outreachId.S), UpdateExpression: "SET #status = :replied, repliedAt = :at", ConditionExpression: "attribute_exists(userId)", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":replied": { S: "replied" }, ":at": { S: at } } } }
      ] }));
      return response(201, { received: true }, headers);
    } catch (error) {
      const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: replyKey, ConsistentRead: true }));
      if (duplicate.Item) return response(200, { received: true, duplicate: true }, headers);
      throw error;
    }
  }

  async function artistReply(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    if (typeof sendBookingReply !== "function") return response(503, { error: "Booking reply delivery is not configured." }, headers);
    const body = parseBody(event), outreachId = String(body?.outreachId || "").trim(), content = String(body?.content || "").trim(), clientMessageId = String(body?.clientMessageId || "").trim();
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(outreachId) || !/^[a-zA-Z0-9_-]{16,100}$/.test(clientMessageId) || content.length < 1 || content.length > 4000) return response(400, { error: "Write a reply of 1 to 4,000 characters for a valid booking thread." }, headers);
    const source = await db.send(new GetItemCommand({ TableName: tableName, Key: sendKey(userId, outreachId), ConsistentRead: true })), message = source.Item, to = String(message?.recipient?.S || "").trim().toLowerCase();
    if (!message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return response(404, { error: "This booking thread is unavailable." }, headers);
    if (["bounced", "complained", "opted_out"].includes(message.status?.S || "")) return response(409, { error: "This contact cannot receive another message." }, headers);
    const suppressed = await db.send(new GetItemCommand({ TableName: tableName, Key: suppressionKey(to), ConsistentRead: true }));
    if (suppressed.Item) return response(409, { error: "This contact opted out or cannot receive another message." }, headers);
    const at = nowIso(), replyKey = { userId: { S: userId }, tourId: { S: `TOUR_MANAGER#BOOKING_REPLY#${outreachId}#artist#${clientMessageId}` } }, item = { ...replyKey, outreachId: { S: outreachId }, venueKey: { S: message.venueKey?.S || "" }, direction: { S: "outbound" }, action: { S: "reply" }, content: { S: content }, status: { S: "sending" }, createdAt: { S: at } };
    try {
      await db.send(new PutItemCommand({ TableName: tableName, Item: item, ConditionExpression: "attribute_not_exists(userId)" }));
    } catch (error) {
      const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: replyKey, ConsistentRead: true }));
      if (existing.Item) return response(existing.Item.status?.S === "sent" ? 200 : 202, { status: existing.Item.status?.S || "pending", duplicate: true }, headers);
      throw error;
    }
    try {
      const delivery = await sendBookingReply({ userId, outreachId, artistName: message.artistName?.S || "Artist", venueName: message.venueName?.S || "Venue", to, subject: message.subject?.S || "Booking pitch", message: content, replyToken: message.replyToken?.S || "" });
      if (!delivery?.messageId) throw new Error("Email provider did not accept the reply");
      const sentAt = nowIso();
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: replyKey, UpdateExpression: "SET #status = :sent, sentAt = :sentAt, providerMessageId = :messageId", ConditionExpression: "#status = :sending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sent": { S: "sent" }, ":sending": { S: "sending" }, ":sentAt": { S: sentAt }, ":messageId": { S: delivery.messageId } } }));
      return response(200, { status: "sent" }, headers);
    } catch (error) {
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: replyKey, UpdateExpression: "SET #status = :review, failedAt = :at", ConditionExpression: "#status = :sending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":review": { S: "reconciliation_required" }, ":sending": { S: "sending" }, ":at": { S: nowIso() } } })).catch(() => null);
      return response(502, { error: "The email provider did not confirm this reply. It was not retried, preventing a duplicate. Check the thread before trying again." }, headers);
    }
  }

  async function useProposedDate(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const body = parseBody(event), outreachId = String(body?.outreachId || "").trim(), replyId = String(body?.replyId || "").trim(), confirmDate = body?.confirm === true;
    const prefix = `TOUR_MANAGER#BOOKING_REPLY#${outreachId}#`;
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(outreachId) || !replyId.startsWith(prefix) || replyId.length > 260 || replyId.includes("#artist#")) return response(400, { error: "Choose a valid venue date offer." }, headers);
    const [replyResult, workspaceResult] = await Promise.all([
      db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: replyId } }, ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY } }, ConsistentRead: true }))
    ]);
    const offer = replyResult.Item, workspace = workspaceResult.Item, proposedDate = offer?.proposedDate?.S || "", venueKey = offer?.venueKey?.S || "";
    const expectedAction = confirmDate ? "confirm_date" : "offer_date";
    if (offer?.direction?.S !== "inbound" || offer?.action?.S !== expectedAction || !/^\d{4}-\d{2}-\d{2}$/.test(proposedDate) || !venueKey) return response(409, { error: confirmDate ? "This reply does not contain a written venue date confirmation." : "This reply does not contain a usable venue date offer." }, headers);
    let plan; try { plan = JSON.parse(workspace?.plan?.S || ""); } catch { plan = null; }
    const venue = plan?.venues?.find(item => item?.venueKey === venueKey);
    if (!venue || !workspace?.revision?.S) return response(409, { error: "Save this venue in Tour Manager before adding its proposed date." }, headers);
    const replySummary = String(offer.content?.S || "").slice(0, 3000);
    const status = confirmDate ? "Confirmed" : "Date proposed";
    if (offer.appliedStatus?.S) {
      if (offer.appliedStatus.S !== status) return response(409, { error: "This venue reply was already applied with a different booking status." }, headers);
      return response(200, { saved: true, duplicate: true, proposedDate, venueName: String(venue.name || "Venue"), status, revision: workspace.revision.S }, headers);
    }
    venue.booking = { ...(venue.booking || {}), status, showDate: proposedDate, replySummary, ...(confirmDate ? { confirmationEvidence: `Venue confirmed ${proposedDate}: ${replySummary}`.slice(0, 3000) } : {}) };
    const revision = randomUUID(), at = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...workspace, userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY }, plan: { S: JSON.stringify(plan) }, revision: { S: revision }, updatedAt: { S: at } }, ConditionExpression: "revision = :revision", ExpressionAttributeValues: { ":revision": { S: workspace.revision.S } } } },
        { Update: { TableName: tableName, Key: { userId: { S: userId }, tourId: { S: replyId } }, UpdateExpression: "SET appliedStatus = :status, appliedAt = :at", ConditionExpression: "attribute_exists(userId) AND attribute_not_exists(appliedStatus)", ExpressionAttributeValues: { ":status": { S: status }, ":at": { S: at } } } }
      ] }));
    } catch (error) {
      return response(409, { error: "Your Tour Manager changed on another device. Reload it, then add this date again." }, headers);
    }
    return response(200, { saved: true, proposedDate, venueName: String(venue.name || "Venue"), status, revision }, headers);
  }

  async function useVenueReplyStatus(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    const body = parseBody(event), outreachId = String(body?.outreachId || "").trim(), replyId = String(body?.replyId || "").trim();
    const prefix = `TOUR_MANAGER#BOOKING_REPLY#${outreachId}#`;
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(outreachId) || !replyId.startsWith(prefix) || replyId.length > 260 || replyId.includes("#artist#")) return response(400, { error: "Choose a valid venue reply." }, headers);
    const [replyResult, workspaceResult] = await Promise.all([
      db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: replyId } }, ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY } }, ConsistentRead: true }))
    ]);
    const venueReply = replyResult.Item, workspace = workspaceResult.Item, venueKey = venueReply?.venueKey?.S || "";
    const statusByAction = { interested: "Interested", pass: "Declined" }, status = statusByAction[venueReply?.action?.S || ""];
    if (venueReply?.direction?.S !== "inbound" || !status || !venueKey) return response(409, { error: "This reply does not contain an interest or pass decision." }, headers);
    let plan; try { plan = JSON.parse(workspace?.plan?.S || ""); } catch { plan = null; }
    const venue = plan?.venues?.find(item => item?.venueKey === venueKey);
    if (!venue || !workspace?.revision?.S) return response(409, { error: "Save this venue in Tour Manager before updating its booking status." }, headers);
    if (venueReply.appliedStatus?.S) {
      if (venueReply.appliedStatus.S !== status) return response(409, { error: "This venue reply was already applied with a different booking status." }, headers);
      return response(200, { saved: true, duplicate: true, status, venueName: String(venue.name || "Venue"), revision: workspace.revision.S }, headers);
    }
    venue.booking = { ...(venue.booking || {}), status, replySummary: String(venueReply.content?.S || "").slice(0, 3000) };
    if (status === "Declined") {
      delete venue.booking.showDate;
      delete venue.booking.confirmationEvidence;
    }
    const revision = randomUUID(), at = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...workspace, userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY }, plan: { S: JSON.stringify(plan) }, revision: { S: revision }, updatedAt: { S: at } }, ConditionExpression: "revision = :revision", ExpressionAttributeValues: { ":revision": { S: workspace.revision.S } } } },
        { Update: { TableName: tableName, Key: { userId: { S: userId }, tourId: { S: replyId } }, UpdateExpression: "SET appliedStatus = :status, appliedAt = :at", ConditionExpression: "attribute_exists(userId) AND attribute_not_exists(appliedStatus)", ExpressionAttributeValues: { ":status": { S: status }, ":at": { S: at } } } }
      ] }));
    } catch (error) {
      return response(409, { error: "Your Tour Manager changed on another device. Reload it, then review this reply again." }, headers);
    }
    return response(200, { saved: true, status, venueName: String(venue.name || "Venue"), revision }, headers);
  }

  async function loadVerifiedSession(session, expectedLive) {
    const catalog = stripeCatalog(expectedLive), userId = session.client_reference_id, lines = session.line_items?.data, line = Array.isArray(lines) && lines.length === 1 ? lines[0] : null, quantity = Number(line?.quantity), metadata = session.metadata || {};
    const valid = session.mode === "payment" && session.livemode === expectedLive && validUserId(userId) && metadata.product === PRODUCT && metadata.userId === userId && metadata.priceId === catalog.tour.priceId && Number(metadata.quantity) === quantity && line?.price?.id === catalog.tour.priceId && line?.price?.product === catalog.tour.productId && line?.price?.currency === "usd" && Number(line?.price?.unit_amount) === TOUR_MANAGER_EMAIL_UNIT_CENTS && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_CREDITS_PER_CHECKOUT && session.currency === "usd" && Number(session.amount_total) === quantity * TOUR_MANAGER_EMAIL_UNIT_CENTS;
    if (!valid) return null;
    const pending = await db.send(new GetItemCommand({ TableName: tableName, Key: checkoutKey(userId, session.id), ConsistentRead: true })), item = pending.Item;
    return item?.sessionId?.S === session.id && item.priceId?.S === catalog.tour.priceId && Number(item.quantity?.N) === quantity && item.environment?.S === (expectedLive ? "live" : "test") ? { session, userId, quantity } : null;
  }

  async function loadVerifiedContactSession(session, expectedLive) {
    const catalog = stripeCatalog(expectedLive), userId = session.client_reference_id, metadata = session.metadata || {}, venueKey = String(metadata.venueKey || ""), lines = session.line_items?.data, line = Array.isArray(lines) && lines.length === 1 ? lines[0] : null;
    const valid = session.mode === "payment" && session.livemode === expectedLive && validUserId(userId) && validVenueKey(venueKey) && metadata.product === CONTACT_PRODUCT && metadata.userId === userId && metadata.priceId === catalog.contact.priceId && Number(line?.quantity) === 1 && line?.price?.id === catalog.contact.priceId && line?.price?.product === catalog.contact.productId && line?.price?.currency === "usd" && Number(line?.price?.unit_amount) === BOOKING_CONTACT_UNIT_CENTS && session.currency === "usd" && Number(session.amount_total) === BOOKING_CONTACT_UNIT_CENTS;
    if (!valid) return null;
    const pending = await db.send(new GetItemCommand({ TableName: tableName, Key: checkoutKey(userId, session.id), ConsistentRead: true })), item = pending.Item;
    return item?.sessionId?.S === session.id && item.product?.S === CONTACT_PRODUCT && item.venueKey?.S === venueKey && item.priceId?.S === catalog.contact.priceId && item.environment?.S === (expectedLive ? "live" : "test") ? { session, userId, venueKey, product: CONTACT_PRODUCT } : null;
  }

  async function loadVerifiedPhoneSession(session, expectedLive) {
    const catalog = stripeCatalog(expectedLive), userId = session.client_reference_id, metadata = session.metadata || {}, lines = session.line_items?.data, line = Array.isArray(lines) && lines.length === 1 ? lines[0] : null;
    const valid = session.mode === "payment" && session.livemode === expectedLive && validUserId(userId) && metadata.product === PHONE_PRODUCT && metadata.userId === userId && metadata.priceId === catalog.phone.priceId && Number(line?.quantity) === 1 && line?.price?.id === catalog.phone.priceId && line?.price?.product === catalog.phone.productId && line?.price?.currency === "usd" && Number(line?.price?.unit_amount) === PHONE_NUMBER_UNIT_CENTS && session.currency === "usd" && Number(session.amount_total) === PHONE_NUMBER_UNIT_CENTS;
    if (!valid) return null;
    const pending = await db.send(new GetItemCommand({ TableName: tableName, Key: checkoutKey(userId, session.id), ConsistentRead: true })), item = pending.Item;
    return item?.sessionId?.S === session.id && item.product?.S === PHONE_PRODUCT && item.priceId?.S === catalog.phone.priceId && item.environment?.S === (expectedLive ? "live" : "test") ? { session, userId, product: PHONE_PRODUCT } : null;
  }

  async function loadVerifiedSyncNetworkSession(session, expectedLive) {
    if (expectedLive) return null;
    const userId = session.client_reference_id, metadata = session.metadata || {}, lines = session.line_items?.data, line = Array.isArray(lines) && lines.length === 1 ? lines[0] : null;
    const valid = session.mode === "payment" && session.livemode === false && validUserId(userId) && metadata.product === SYNC_NETWORK_PRODUCT && metadata.userId === userId && metadata.priceId === TEST_SYNC_NETWORK_CATALOG.priceId && Number(line?.quantity) === 1 && line?.price?.id === TEST_SYNC_NETWORK_CATALOG.priceId && line?.price?.product === TEST_SYNC_NETWORK_CATALOG.productId && line?.price?.currency === "usd" && Number(line?.price?.unit_amount) === SYNC_NETWORK_NUMBER_UNIT_CENTS && session.currency === "usd" && Number(session.amount_total) === SYNC_NETWORK_NUMBER_UNIT_CENTS;
    if (!valid) return null;
    const pending = await db.send(new GetItemCommand({ TableName: tableName, Key: checkoutKey(userId, session.id), ConsistentRead: true })), item = pending.Item;
    return item?.sessionId?.S === session.id && item.product?.S === SYNC_NETWORK_PRODUCT && item.priceId?.S === TEST_SYNC_NETWORK_CATALOG.priceId && item.environment?.S === "test" ? { session, userId, product: SYNC_NETWORK_PRODUCT } : null;
  }

  async function loadVerifiedKnownSession(session, expectedLive) {
    if (session?.metadata?.product === CONTACT_PRODUCT) return loadVerifiedContactSession(session, expectedLive);
    if (session?.metadata?.product === PHONE_PRODUCT) return loadVerifiedPhoneSession(session, expectedLive);
    if (session?.metadata?.product === SYNC_NETWORK_PRODUCT) return loadVerifiedSyncNetworkSession(session, expectedLive);
    return loadVerifiedSession(session, expectedLive);
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
    const processedAt = nowIso(), priceId = stripeCatalog(verified.session.livemode).tour.priceId;
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :paid, paidAt = :paidAt", ConditionExpression: "#status <> :paid AND sessionId = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":paid": { S: "paid" }, ":paidAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Update: { TableName: tableName, Key: creditKey(verified.userId), UpdateExpression: "ADD credits :quantity, purchasedCredits :quantity SET updatedAt = :updatedAt, lastSessionId = :sessionId", ExpressionAttributeValues: { ":quantity": { N: String(verified.quantity) }, ":updatedAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Update: { TableName: tableName, Key: professionalKey(verified.userId), UpdateExpression: "SET #status = :active, paymentMethod = :stripe, paymentReference = :sessionId, priceId = :priceId, activatedAt = if_not_exists(activatedAt, :activatedAt), updatedAt = :activatedAt", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":active": { S: "active" }, ":stripe": { S: "stripe" }, ":sessionId": { S: verified.session.id }, ":priceId": { S: priceId }, ":activatedAt": { S: processedAt } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "purchase" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: String(verified.quantity) }, status: { S: "settled" }, description: { S: `${verified.quantity} booking email credits purchased` }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) { const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true })); if (duplicate.Item) return false; throw error; }
    return true;
  }

  async function grantContactUnlock(notification, verified) {
    const processedAt = nowIso(), priceId = stripeCatalog(verified.session.livemode).contact.priceId;
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :paid, paidAt = :paidAt", ConditionExpression: "#status <> :paid AND sessionId = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":paid": { S: "paid" }, ":paidAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Put: { TableName: tableName, Item: { ...contactUnlockKey(verified.userId, verified.venueKey), venueKey: { S: verified.venueKey }, status: { S: "active" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, priceId: { S: priceId }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "contact_unlock" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "settled" }, description: { S: "Booking contact unlocked" }, venueKey: { S: verified.venueKey }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) { const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true })); if (duplicate.Item) return false; throw error; }
    return true;
  }

  async function grantPhoneEntitlement(notification, verified) {
    const processedAt = nowIso(), priceId = stripeCatalog(verified.session.livemode).phone.priceId;
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :paid, paidAt = :paidAt", ConditionExpression: "#status <> :paid AND sessionId = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":paid": { S: "paid" }, ":paidAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Put: { TableName: tableName, Item: { ...phoneEntitlementKey(verified.userId), status: { S: "pending_provisioning" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, priceId: { S: priceId }, purchasedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "phone_activation_purchase" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "pending_provisioning" }, description: { S: "DANZSTAK phone activation purchased; provider provisioning pending" }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) { const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true })); if (duplicate.Item) return false; throw error; }
    return true;
  }

  async function recordDuplicateSyncNetworkPurchase(notification, verified, entitlement) {
    const processedAt = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt }, status: { S: "duplicate_purchase_review" } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :paid, paidAt = :paidAt, duplicatePurchase = :duplicate", ConditionExpression: "#status <> :paid AND sessionId = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":paid": { S: "paid" }, ":paidAt": { S: processedAt }, ":duplicate": { BOOL: true }, ":sessionId": { S: verified.session.id } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "sync_network_alias_duplicate_purchase" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "manual_refund_required" }, description: { S: "Duplicate DanzStak Network number purchase requires refund review" }, alias: { S: entitlement.alias.S }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) {
      const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true }));
      if (!duplicate.Item) throw error;
    }
    return { granted: false, alias: entitlement.alias.S, duplicatePurchase: true };
  }

  async function grantSyncNetworkEntitlement(notification, verified) {
    const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: syncNetworkEntitlementKey(verified.userId), ConsistentRead: true }));
    if (existing.Item?.status?.S === "active" && validSyncNetworkAlias(existing.Item?.alias?.S)) return recordDuplicateSyncNetworkPurchase(notification, verified, existing.Item);
    const processedAt = nowIso();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const alias = String(aliasGenerator()).toUpperCase();
      if (!validSyncNetworkAlias(alias)) throw new Error("DanzStak Network alias generator returned an invalid value");
      try {
        await db.send(new TransactWriteItemsCommand({ TransactItems: [
          { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
          { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :paid, paidAt = :paidAt", ConditionExpression: "#status <> :paid AND sessionId = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":paid": { S: "paid" }, ":paidAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
          { Put: { TableName: tableName, Item: { ...syncNetworkAliasKey(alias), alias: { S: alias }, ownerUserId: { S: verified.userId }, status: { S: "active" }, assignedAt: { S: processedAt }, paymentReference: { S: verified.session.id } }, ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(tourId)" } },
          { Put: { TableName: tableName, Item: { ...syncNetworkEntitlementKey(verified.userId), alias: { S: alias }, status: { S: "active" }, network: { S: "sync_only" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, priceId: { S: TEST_SYNC_NETWORK_CATALOG.priceId }, purchasedAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(tourId)" } },
          { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "sync_network_alias_purchase" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "active" }, description: { S: "DanzStak Network number assigned for SYNC-only use" }, alias: { S: alias }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
        ] }));
        return { granted: true, alias, duplicatePurchase: false };
      } catch (error) {
        const processed = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true }));
        if (processed.Item) {
          const entitlement = await db.send(new GetItemCommand({ TableName: tableName, Key: syncNetworkEntitlementKey(verified.userId), ConsistentRead: true }));
          return { granted: false, alias: validSyncNetworkAlias(entitlement.Item?.alias?.S) ? entitlement.Item.alias.S : "", duplicatePurchase: false };
        }
        const collision = await db.send(new GetItemCommand({ TableName: tableName, Key: syncNetworkAliasKey(alias), ConsistentRead: true }));
        if (collision.Item) continue;
        throw error;
      }
    }
    throw new Error("Could not allocate a unique DanzStak Network number");
  }

  async function recordRefundReview(notification, verified, charge) {
    const processedAt = nowIso();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt }, status: { S: "partial_refund_review" } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "partial_refund" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "manual_review" }, description: { S: `Partial Stripe refund requires review (${Number(charge.amount_refunded || 0)} of ${Number(charge.amount || 0)} cents)` }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) { const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true })); if (!duplicate.Item) throw error; }
  }

  async function revokeRefundedPurchase(notification, verified) {
    const processedAt = nowIso(), items = [
      { Put: { TableName: tableName, Item: { ...eventKey(notification.id), sessionId: { S: verified.session.id }, eventType: { S: notification.type }, processedAt: { S: processedAt }, status: { S: "refunded" } }, ConditionExpression: "attribute_not_exists(userId)" } },
      { Update: { TableName: tableName, Key: checkoutKey(verified.userId, verified.session.id), UpdateExpression: "SET #status = :refunded, refundedAt = :refundedAt", ConditionExpression: "#status = :paid", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":refunded": { S: "refunded" }, ":refundedAt": { S: processedAt }, ":paid": { S: "paid" } } } }
    ];
    if (verified.product === CONTACT_PRODUCT) {
      items.push(
        { Update: { TableName: tableName, Key: contactUnlockKey(verified.userId, verified.venueKey), UpdateExpression: "SET #status = :refunded, refundedAt = :refundedAt", ConditionExpression: "paymentReference = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":refunded": { S: "refunded" }, ":refundedAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "contact_unlock_refund" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "refunded" }, description: { S: "Booking contact unlock refunded and access removed" }, venueKey: { S: verified.venueKey }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      );
    } else if (verified.product === PHONE_PRODUCT) {
      items.push(
        { Update: { TableName: tableName, Key: phoneEntitlementKey(verified.userId), UpdateExpression: "SET #status = :refunded, refundedAt = :refundedAt, provisioningActionRequired = :required", ConditionExpression: "paymentReference = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":refunded": { S: "refunded" }, ":refundedAt": { S: processedAt }, ":required": { BOOL: true }, ":sessionId": { S: verified.session.id } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "phone_activation_refund" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "refunded" }, description: { S: "Phone activation payment refunded; provider follow-up required" }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      );
    } else if (verified.product === SYNC_NETWORK_PRODUCT) {
      const entitlement = await db.send(new GetItemCommand({ TableName: tableName, Key: syncNetworkEntitlementKey(verified.userId), ConsistentRead: true }));
      const ownsEntitlement = entitlement.Item?.paymentReference?.S === verified.session.id && validSyncNetworkAlias(entitlement.Item?.alias?.S);
      if (ownsEntitlement) {
        items.push(
          { Update: { TableName: tableName, Key: syncNetworkEntitlementKey(verified.userId), UpdateExpression: "SET #status = :refunded, refundedAt = :refundedAt", ConditionExpression: "paymentReference = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":refunded": { S: "refunded" }, ":refundedAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
          { Update: { TableName: tableName, Key: syncNetworkAliasKey(entitlement.Item.alias.S), UpdateExpression: "SET #status = :retired, retiredAt = :retiredAt", ConditionExpression: "ownerUserId = :owner AND paymentReference = :sessionId", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":retired": { S: "retired" }, ":retiredAt": { S: processedAt }, ":owner": { S: verified.userId }, ":sessionId": { S: verified.session.id } } } },
          { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "sync_network_alias_refund" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "refunded" }, description: { S: "DanzStak Network number refunded and retired" }, alias: { S: entitlement.Item.alias.S }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
        );
      } else {
        items.push({ Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "sync_network_alias_duplicate_refund" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: "0" }, status: { S: "refunded" }, description: { S: "Duplicate DanzStak Network number purchase refunded; active alias unchanged" }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } });
      }
    } else {
      items.push(
        { Update: { TableName: tableName, Key: creditKey(verified.userId), UpdateExpression: "ADD credits :minusQuantity, purchasedCredits :minusQuantity SET updatedAt = :updatedAt, lastRefundedSessionId = :sessionId", ExpressionAttributeValues: { ":minusQuantity": { N: String(-verified.quantity) }, ":updatedAt": { S: processedAt }, ":sessionId": { S: verified.session.id } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(verified.userId, processedAt, notification.id), entryType: { S: "purchase_refund" }, paymentMethod: { S: "stripe" }, paymentReference: { S: verified.session.id }, delta: { N: String(-verified.quantity) }, status: { S: "refunded" }, description: { S: `${verified.quantity} booking email credits refunded` }, createdAt: { S: processedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      );
      const professional = await db.send(new GetItemCommand({ TableName: tableName, Key: professionalKey(verified.userId), ConsistentRead: true }));
      if (professional.Item?.paymentReference?.S === verified.session.id) {
        items.push({ Update: { TableName: tableName, Key: professionalKey(verified.userId), UpdateExpression: "SET #status = :refunded, refundedAt = :refundedAt, updatedAt = :refundedAt", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":refunded": { S: "refunded" }, ":refundedAt": { S: processedAt } } } });
      }
    }
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: items }));
    } catch (error) {
      const duplicate = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true }));
      if (duplicate.Item) return false;
      throw error;
    }
    return true;
  }

  async function webhook(event) {
    if (!paymentsAllowed()) return response(503, { error: "Tour Manager payment webhook is not configured." });
    const payload = rawBody(event), signature = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
    const webhookSecret = event?.rawPath === "/sync-network-number/stripe/webhook"
      ? env.STRIPE_SYNC_NETWORK_WEBHOOK_SECRET
      : env.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET;
    if (!payload || Buffer.byteLength(payload) > 65536 || !verifyStripeSignature(payload, signature, webhookSecret, clock())) return response(400, { error: "Invalid Stripe signature." });
    let notification; try { notification = JSON.parse(payload); } catch { return response(400, { error: "Invalid Stripe event." }); }
    if (!WEBHOOK_TYPES.has(notification.type)) return response(200, { received: true, ignored: true });
    const supplied = notification.data?.object;
    if (!/^evt_[a-zA-Z0-9]+$/.test(notification.id || "")) return response(400, { error: "Invalid Stripe event." });
    const processed = await db.send(new GetItemCommand({ TableName: tableName, Key: eventKey(notification.id), ConsistentRead: true }));
    if (processed.Item) return response(200, { received: true, duplicate: true });
    const expectedLive = env.STRIPE_SECRET_KEY.startsWith("sk_live_");
    if (notification.livemode !== expectedLive) return response(400, { error: "Stripe environment mismatch." });
    if (notification.type === "charge.refunded") {
      if (!/^ch_[a-zA-Z0-9]+$/.test(supplied?.id || "") || !/^pi_[a-zA-Z0-9]+$/.test(supplied?.payment_intent || "") || supplied.currency !== "usd") return response(400, { error: "Invalid Stripe refund event." });
      const sessions = await stripe(`/checkout/sessions?payment_intent=${encodeURIComponent(supplied.payment_intent)}&limit=2&expand%5B%5D=data.line_items`);
      const session = Array.isArray(sessions.data) && sessions.data.length === 1 ? sessions.data[0] : null;
      const verified = session ? await loadVerifiedKnownSession(session, expectedLive) : null;
      if (!verified || verified.session.payment_status !== "paid" || verified.session.status !== "complete" || Number(supplied.amount) !== Number(verified.session.amount_total) || !Number.isInteger(Number(supplied.amount_refunded)) || Number(supplied.amount_refunded) < 1 || Number(supplied.amount_refunded) > Number(supplied.amount)) return response(409, { error: "No matching refundable DANZSTAK purchase." });
      if (verified.product === SYNC_NETWORK_PRODUCT && !await stripeAccountMatches()) return response(503, { error: "DanzStak payments are not connected to the approved Stripe account." });
      if (Number(supplied.amount_refunded) !== Number(supplied.amount)) {
        await recordRefundReview(notification, verified, supplied);
        return response(200, { received: true, refundReviewRequired: true, accessChanged: false });
      }
      const revoked = await revokeRefundedPurchase(notification, verified);
      return response(200, { received: true, refunded: revoked, duplicate: !revoked });
    }
    if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(supplied?.id || "")) return response(400, { error: "Invalid Stripe event." });
    const session = await stripe(`/checkout/sessions/${encodeURIComponent(supplied.id)}?expand%5B%5D=line_items`);
    if (session.id !== supplied.id) return response(409, { error: "No matching Tour Manager checkout." });
    const verified = await loadVerifiedKnownSession(session, expectedLive);
    if (!verified) return response(409, { error: "No matching Tour Manager checkout." });
    if (verified.product === SYNC_NETWORK_PRODUCT && !await stripeAccountMatches()) return response(503, { error: "DanzStak payments are not connected to the approved Stripe account." });
    if (notification.type === "checkout.session.completed" && verified.session.payment_status !== "paid") { await markCheckoutEvent(notification, verified, "awaiting_payment"); return response(200, { received: true, awaitingPayment: true }); }
    if (notification.type === "checkout.session.async_payment_failed" || notification.type === "checkout.session.expired") { await markCheckoutEvent(notification, verified, notification.type.endsWith("failed") ? "payment_failed" : "expired"); return response(200, { received: true, creditsIssued: 0 }); }
    if (verified.session.payment_status !== "paid" || verified.session.status !== "complete") return response(409, { error: "Stripe has not verified a completed payment." });
    if (verified.product === CONTACT_PRODUCT) {
      const granted = await grantContactUnlock(notification, verified);
      return response(200, { received: true, contactUnlocked: granted, venueKey: verified.venueKey, duplicate: !granted });
    }
    if (verified.product === PHONE_PRODUCT) {
      const granted = await grantPhoneEntitlement(notification, verified);
      return response(200, { received: true, phoneActivationEntitled: granted, provisioningStatus: "pending_provisioning", duplicate: !granted });
    }
    if (verified.product === SYNC_NETWORK_PRODUCT) {
      const assigned = await grantSyncNetworkEntitlement(notification, verified);
      return response(200, { received: true, syncNetworkNumberAssigned: assigned.granted, alias: assigned.alias, duplicate: !assigned.granted, duplicatePurchase: assigned.duplicatePurchase });
    }
    const granted = await grantCredits(notification, verified);
    return response(200, { received: true, creditsIssued: granted ? verified.quantity : 0, duplicate: !granted });
  }

  async function sendEmail(event) {
    const headers = browserHeaders(event);
    if (!headers?.["access-control-allow-origin"]) return response(403, { error: "Forbidden origin" }, headers);
    const userId = await authenticate(event);
    if (!validUserId(userId)) return response(401, { error: "Authentication required." }, headers);
    if (typeof sendBookingEmail !== "function") return response(503, { error: "Booking email delivery is not configured." }, headers);
    const body = parseBody(event), venueKey = String(body?.venueKey || "").trim(), to = String(body?.to || "").trim().toLowerCase(), subject = String(body?.subject || "").trim(), message = String(body?.message || "").trim(), id = String(body?.idempotencyKey || "").trim(), followUpTo = String(body?.followUpTo || "").trim(), template = ["band", "dj", "festival"].includes(String(body?.template)) ? String(body.template) : "custom";
    if (body?.artistApproved !== true) return response(400, { error: "Review the exact recipient and message, then approve this email before sending." }, headers);
    if (!venueKey || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || subject.length < 3 || subject.length > 180 || message.length < 20 || message.length > 5000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(id) || followUpTo && !/^[a-zA-Z0-9_-]{16,100}$/.test(followUpTo)) return response(400, { error: "Choose a saved venue, reviewed email, subject, message, and valid send identifier." }, headers);
    const workspace = await db.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: BOOKING_WORKSPACE_KEY } }, ConsistentRead: true }));
    let plan = {}; try { plan = JSON.parse(workspace.Item?.plan?.S || "{}"); } catch { plan = {}; }
    const venue = (plan.venues || []).find(item => item?.venueKey === venueKey && (item.emails || []).some(email => String(email).toLowerCase() === to)), artistName = String(plan.artist?.name || "").trim(), epk = String(plan.artist?.epk || "").trim();
    if (!venue) return response(409, { error: "Save this venue and its public booking email to your account before sending." }, headers);
    const contactAccess = await db.send(new GetItemCommand({ TableName: tableName, Key: contactUnlockKey(userId, venueKey), ConsistentRead: true }));
    if (contactAccess.Item?.status?.S !== "active") return response(402, { error: "Unlock this venue's booking contact before sending." }, headers);
    if (!artistName) return response(409, { error: "Add your act name and save the booking workspace before sending." }, headers);
    if (!/^https:\/\//i.test(epk)) return response(409, { error: "Publish and save the artist EPK before sending." }, headers);
    if (typeof validateOutreachEpkLink === "function") {
      const validShare = await validateOutreachEpkLink({ userId, venueKey, outreachId: id, message });
      if (!validShare) return response(409, { error: "Preview a current private EPK link for this venue before sending." }, headers);
    } else if (!message.includes(epk)) return response(409, { error: "Publish and save the artist EPK, then include its exact public link in the reviewed email." }, headers);
    const key = sendKey(userId, id), existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    if (existing.Item) return response(existing.Item.status?.S === "sent" ? 200 : 202, { status: existing.Item.status?.S || "pending", duplicate: true, messageId: existing.Item.providerMessageId?.S || "" }, headers);
    const reservationMs = clock(), reservationSeconds = Math.floor(reservationMs / 1000), reservedAt = new Date(reservationMs).toISOString(), hourKey = outreachHourKey(userId, reservationMs), cooldownKey = recipientCooldownKey(userId, to);
    const footerToken = message.match(/https:\/\/danzstak\.com\/booking-opt-out\.html#token=([a-f0-9]{64})/)?.[1] || "";
    if (!footerToken || !message.includes(DANZSTAK_POSTAL_ADDRESS)) return response(409, { error: "Preview the required DanzStak postal and opt-out footer before sending." }, headers);
    const [hourlyResult, cooldownResult, suppressedResult, footerResult] = await Promise.all([
      db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :userId AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":userId": { S: userId }, ":prefix": { S: "TOUR_MANAGER#OUTREACH_HOUR#" } }, ConsistentRead: true, ScanIndexForward: false, Limit: 48 })),
      db.send(new GetItemCommand({ TableName: tableName, Key: cooldownKey, ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: suppressionKey(to), ConsistentRead: true })),
      db.send(new GetItemCommand({ TableName: tableName, Key: optOutTokenKey(footerToken), ConsistentRead: true }))
    ]);
    if (suppressedResult.Item) return response(409, { error: "This contact opted out of DanzStak booking pitches and cannot be emailed." }, headers);
    const footerItem = footerResult.Item;
    if (!footerItem || footerItem.artistId?.S !== userId || footerItem.outreachId?.S !== id || footerItem.venueKey?.S !== venueKey || footerItem.recipientHash?.S !== normalizedRecipientHash(to) || Number(footerItem.expiresAt?.N || 0) <= reservationSeconds || (footerItem.followUpTo?.S || "") !== followUpTo) return response(409, { error: "Preview a current opt-out footer for this exact venue and recipient before sending." }, headers);
    let followUpSource;
    if (followUpTo) {
      followUpSource = (await db.send(new GetItemCommand({ TableName: tableName, Key: sendKey(userId, followUpTo), ConsistentRead: true }))).Item;
      const due = String(venue.booking?.followUp || ""), today = new Date(reservationMs).toISOString().slice(0, 10);
      if (!followUpSource || followUpSource.venueKey?.S !== venueKey || followUpSource.recipient?.S !== to || !due || due > today || followUpSource.repliedAt?.S || followUpSource.followUpSendId?.S || !["sent", "delivered"].includes(followUpSource.status?.S || "")) return response(409, { error: "This follow-up is no longer eligible. Reload the booking thread before sending." }, headers);
    }
    const { previousHourCount, currentHourCount, total: recentOutreachCount } = outreachWindow(hourlyResult.Items, reservationMs);
    if (recentOutreachCount >= MAX_NEW_PITCHES_PER_24_HOURS) return response(429, { error: "You reached the 20 new booking pitches allowed in 24 hours. Try again after an earlier pitch leaves the window." }, headers);
    const cooldownUntil = Number(cooldownResult.Item?.nextAllowedAt?.N || 0);
    if (!followUpTo && cooldownUntil > reservationSeconds) return response(409, { error: "This booking contact was already pitched in the last 30 days. Continue the existing thread instead.", availableAt: new Date(cooldownUntil * 1000).toISOString() }, headers);
    const currentHourAllowance = MAX_NEW_PITCHES_PER_24_HOURS - previousHourCount, cooldownExpiresAt = reservationSeconds + BOOKING_CONTACT_COOLDOWN_SECONDS;
    try {
      const reservationItems = [
        { ConditionCheck: { TableName: tableName, Key: suppressionKey(to), ConditionExpression: "attribute_not_exists(userId)" } },
        { ConditionCheck: { TableName: tableName, Key: optOutTokenKey(footerToken), ConditionExpression: "artistId = :artistId AND outreachId = :outreachId AND venueKey = :venueKey AND recipientHash = :recipientHash AND expiresAt > :now", ExpressionAttributeValues: { ":artistId": { S: userId }, ":outreachId": { S: id }, ":venueKey": { S: venueKey }, ":recipientHash": { S: normalizedRecipientHash(to) }, ":now": { N: String(reservationSeconds) } } } },
        { Update: { TableName: tableName, Key: creditKey(userId), UpdateExpression: "ADD credits :minusOne, reservedCredits :one SET updatedAt = :updatedAt", ConditionExpression: "credits >= :one", ExpressionAttributeValues: { ":minusOne": { N: "-1" }, ":one": { N: "1" }, ":updatedAt": { S: reservedAt } } } },
        { Update: { TableName: tableName, Key: hourKey, UpdateExpression: "ADD sendCount :one SET updatedAt = :updatedAt, expiresAt = :expiresAt", ConditionExpression: "attribute_not_exists(sendCount) OR sendCount < :allowance", ExpressionAttributeValues: { ":one": { N: "1" }, ":allowance": { N: String(currentHourAllowance) }, ":updatedAt": { S: reservedAt }, ":expiresAt": { N: String(reservationSeconds + 31 * 86400) } } } },
        { Put: { TableName: tableName, Item: { ...key, status: { S: "reserved" }, venueKey: { S: venueKey }, venueName: { S: String(venue.name || "Venue").slice(0, 160) }, artistName: { S: artistName.slice(0, 160) }, recipient: { S: to }, subject: { S: subject }, message: { S: message }, template: { S: template }, replyToken: { S: footerToken }, ...(followUpTo ? { followUpTo: { S: followUpTo } } : {}), artistApprovedAt: { S: reservedAt }, createdAt: { S: reservedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(userId, reservedAt, id), entryType: { S: "email_reservation" }, delta: { N: "-1" }, status: { S: "reserved" }, description: { S: `Booking email reserved for ${String(venue.name || "venue").slice(0, 160)}` }, createdAt: { S: reservedAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ];
      if (followUpTo) reservationItems.splice(4, 0, { Update: { TableName: tableName, Key: sendKey(userId, followUpTo), UpdateExpression: "SET followUpSendId = :sendId, followUpReservedAt = :at", ConditionExpression: "attribute_exists(userId) AND attribute_not_exists(followUpSendId) AND attribute_not_exists(repliedAt) AND (#status = :sent OR #status = :delivered)", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sendId": { S: id }, ":at": { S: reservedAt }, ":sent": { S: "sent" }, ":delivered": { S: "delivered" } } } });
      else reservationItems.splice(4, 0, { Put: { TableName: tableName, Item: { ...cooldownKey, recipientHash: { S: normalizedRecipientHash(to) }, venueKey: { S: venueKey }, sendId: { S: id }, createdAt: { S: reservedAt }, nextAllowedAt: { N: String(cooldownExpiresAt) }, expiresAt: { N: String(cooldownExpiresAt) } }, ConditionExpression: "attribute_not_exists(userId) OR nextAllowedAt <= :now", ExpressionAttributeValues: { ":now": { N: String(reservationSeconds) } } } });
      await db.send(new TransactWriteItemsCommand({ TransactItems: reservationItems }));
    } catch (error) {
      const [raced, latestHour, latestCooldown, latestCredit, latestFollowUpSource] = await Promise.all([
        db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true })),
        db.send(new GetItemCommand({ TableName: tableName, Key: hourKey, ConsistentRead: true })),
        db.send(new GetItemCommand({ TableName: tableName, Key: cooldownKey, ConsistentRead: true })),
        db.send(new GetItemCommand({ TableName: tableName, Key: creditKey(userId), ConsistentRead: true })),
        followUpTo ? db.send(new GetItemCommand({ TableName: tableName, Key: sendKey(userId, followUpTo), ConsistentRead: true })) : Promise.resolve({})
      ]);
      if (raced.Item) return response(202, { status: raced.Item.status?.S || "pending", duplicate: true }, headers);
      if (previousHourCount + Number(latestHour.Item?.sendCount?.N || 0) >= MAX_NEW_PITCHES_PER_24_HOURS) return response(429, { error: "You reached the 20 new booking pitches allowed in 24 hours. Try again after an earlier pitch leaves the window." }, headers);
      const nextAllowedAt = Number(latestCooldown.Item?.nextAllowedAt?.N || 0);
      if (!followUpTo && nextAllowedAt > reservationSeconds) return response(409, { error: "This booking contact was already pitched in the last 30 days. Continue the existing thread instead.", availableAt: new Date(nextAllowedAt * 1000).toISOString() }, headers);
      if (followUpTo && (latestFollowUpSource.Item?.followUpSendId?.S || latestFollowUpSource.Item?.repliedAt?.S)) return response(409, { error: latestFollowUpSource.Item.repliedAt?.S ? "This venue replied before the follow-up was sent. Continue the booking thread instead." : "The one allowed follow-up has already been prepared or sent." }, headers);
      if (Number(latestCredit.Item?.credits?.N || 0) < 1) return response(402, { error: "Not enough booking-email credits." }, headers);
      throw error;
    }
    let providerAccepted = false;
    try {
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: key, UpdateExpression: "SET #status = :sending, sendingAt = :at", ConditionExpression: "#status = :reserved", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sending": { S: "sending" }, ":reserved": { S: "reserved" }, ":at": { S: nowIso() } } }));
      const delivery = await sendBookingEmail({ userId, sendId: id, artistName, venueName: venue.name, to, subject, message, replyToken: footerToken });
      if (!delivery?.messageId) throw new Error("Email provider did not accept the message");
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: key, UpdateExpression: "SET #status = :accepted, providerAcceptedAt = :at, providerMessageId = :messageId", ConditionExpression: "#status = :sending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":accepted": { S: "provider_accepted" }, ":sending": { S: "sending" }, ":at": { S: nowIso() }, ":messageId": { S: delivery.messageId } } }));
      providerAccepted = true;
      const sentAt = nowIso();
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: key, UpdateExpression: "SET #status = :sent, sentAt = :at", ConditionExpression: "#status = :accepted", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sent": { S: "sent" }, ":accepted": { S: "provider_accepted" }, ":at": { S: sentAt } } } },
        { Put: { TableName: tableName, Item: { ...providerMessageKey(delivery.messageId), artistId: { S: userId }, sendId: { S: id }, recipientHash: { S: normalizedRecipientHash(to) }, createdAt: { S: sentAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Update: { TableName: tableName, Key: creditKey(userId), UpdateExpression: "ADD sentEmails :one, reservedCredits :minusOne SET updatedAt = :at", ExpressionAttributeValues: { ":one": { N: "1" }, ":minusOne": { N: "-1" }, ":at": { S: sentAt } } } },
        { Put: { TableName: tableName, Item: { ...ledgerKey(userId, sentAt, `${id}-sent`), entryType: { S: "email_sent" }, delta: { N: "0" }, status: { S: "settled" }, description: { S: `Booking email sent to ${String(venue.name || "venue").slice(0, 160)}` }, createdAt: { S: sentAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
      return response(200, { status: "sent", messageId: delivery.messageId }, headers);
    } catch (error) {
      if (providerAccepted) return response(202, { status: "provider_accepted", message: "The provider accepted the email. Credit reconciliation is pending; this request will not send again." }, headers);
      const state = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
      if (state.Item?.status?.S === "sending" && !state.Item?.providerMessageId?.S) {
        const restoredAt = nowIso();
        const restoreItems = [
          { Update: { TableName: tableName, Key: key, UpdateExpression: "SET #status = :restored, failedAt = :at", ConditionExpression: "#status = :sending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":restored": { S: "restored" }, ":sending": { S: "sending" }, ":at": { S: restoredAt } } } },
          { Update: { TableName: tableName, Key: creditKey(userId), UpdateExpression: "ADD credits :one, reservedCredits :minusOne SET updatedAt = :at", ExpressionAttributeValues: { ":one": { N: "1" }, ":minusOne": { N: "-1" }, ":at": { S: restoredAt } } } },
          { Update: { TableName: tableName, Key: hourKey, UpdateExpression: "ADD sendCount :minusOne SET updatedAt = :at", ConditionExpression: "sendCount >= :one", ExpressionAttributeValues: { ":minusOne": { N: "-1" }, ":one": { N: "1" }, ":at": { S: restoredAt } } } },
          { Put: { TableName: tableName, Item: { ...ledgerKey(userId, restoredAt, `${id}-restore`), entryType: { S: "email_restored" }, delta: { N: "1" }, status: { S: "restored" }, description: { S: `Credit restored after ${String(venue.name || "venue").slice(0, 160)} email failed` }, createdAt: { S: restoredAt } }, ConditionExpression: "attribute_not_exists(userId)" } }
        ];
        if (followUpTo) restoreItems.splice(3, 0, { Update: { TableName: tableName, Key: sendKey(userId, followUpTo), UpdateExpression: "REMOVE followUpSendId, followUpReservedAt", ConditionExpression: "followUpSendId = :sendId", ExpressionAttributeValues: { ":sendId": { S: id } } } });
        else restoreItems.splice(3, 0, { Delete: { TableName: tableName, Key: cooldownKey, ConditionExpression: "sendId = :sendId", ExpressionAttributeValues: { ":sendId": { S: id } } } });
        await db.send(new TransactWriteItemsCommand({ TransactItems: restoreItems }));
      }
      return response(502, { error: "The email provider did not accept the booking email. Your credit was restored." }, headers);
    }
  }

  return async function handle(event) {
    const providerResponse = await providerEvents(event);
    if (providerResponse) return providerResponse;
    const method = event?.requestContext?.http?.method, path = event?.rawPath;
    if (method === "POST" && ["/tour-manager/stripe/webhook", "/sync-network-number/stripe/webhook"].includes(path)) return webhook(event);
    if (method === "POST" && path === "/tour-manager/checkout") return checkout(event);
    if (method === "POST" && path === "/tour-manager/contact-unlock/checkout") return contactCheckout(event);
    if (method === "GET" && path === "/tour-manager/contact-unlocks") return contactUnlocks(event);
    if (method === "POST" && path === "/phone-number/checkout") return phoneCheckout(event);
    if (method === "GET" && path === "/phone-number/entitlement") return phoneEntitlement(event);
    if (method === "POST" && path === "/sync-network-number/checkout") return syncNetworkCheckout(event);
    if (method === "GET" && path === "/sync-network-number/entitlement") return syncNetworkEntitlement(event);
    if (method === "GET" && path === "/tour-manager/credits") return credits(event);
    if (method === "GET" && path === "/tour-manager/outreach") return outreach(event);
    if (method === "POST" && path === "/tour-manager/outreach/preflight") return outreachPreflight(event);
    if (method === "POST" && path === "/tour-manager/opt-out") return optOut(event);
    if (method === "POST" && path === "/tour-manager/reply") return externalReply(event);
    if (method === "POST" && path === "/tour-manager/outreach/reply") return artistReply(event);
    if (method === "POST" && path === "/tour-manager/outreach/use-date") return useProposedDate(event);
    if (method === "POST" && path === "/tour-manager/outreach/use-status") return useVenueReplyStatus(event);
    if (method === "POST" && path === "/tour-manager/emails/send") return sendEmail(event);
    return null;
  };
}

export { normalizedRecipientHash, outreachHourKey, outreachWindow, recipientCooldownKey, suppressionKey, providerMessageKey, providerEventKey, optOutTokenHash, optOutFooter };
