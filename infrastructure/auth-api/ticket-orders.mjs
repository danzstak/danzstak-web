// DanzStak ticket checkout (approved plan: claude/stripe-connect-plan.md). Sandbox only until the owner approves live.
// Buyers pay the ticket price plus DanzStak's fee (task 12: 6% + $1 under $30, its own receipt line) to DanzStak's
// Stripe account; the ticket money is held (ledger status "held") and is
// released to the promoter only by a later release job, 3 days after the event. Tickets are issued only from a
// signature-verified Stripe webhook. Named tickets (default) carry one legal name each and are non-transferable.
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { FEE_PERCENT, SMALL_ORDER_FEE_CENTS, SMALL_ORDER_LIMIT_CENTS, buyerFees } from "./fees.mjs";
export const FEE_LINE_NAME = "DanzStak fee";

const ID = /^[a-f0-9-]{36}$/i;
const MEMBER = /^[A-Za-z0-9_-]{8,128}$/;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L — readable at a club door
export const MAX_TICKETS_PER_ORDER = 10;
// Task 12 (owner 2026-11-16): the buyer pays 6% on top of the ticket price, plus $1 on orders under $30.
// The promoter receives the full ticket price. The rule itself lives in fees.mjs.
export const DANZSTAK_FEE_RATE = FEE_PERCENT / 100;
export const DANZSTAK_SMALL_ORDER_FEE_CENTS = SMALL_ORDER_FEE_CENTS;
export const DANZSTAK_SMALL_ORDER_LIMIT_CENTS = SMALL_ORDER_LIMIT_CENTS;
export const PROBLEM_WINDOW_DAYS = 3;
const APP = "https://danzstak.com";

export function ticketCode(bytes = randomBytes(8)) { let out = ""; for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length]; return out.slice(0, 4) + "-" + out.slice(4, 8); }
export function feeCents(subtotal) { return buyerFees(subtotal); }
export function cleanName(value) { const name = String(value || "").replace(/\s+/g, " ").trim(); return name.length >= 2 && name.length <= 100 && /^[\p{L}\p{M}' .,-]+$/u.test(name) ? name : null; }
export function releaseAfter(event) { const base = new Date(event.endsAt || event.startsAt); return new Date(base.getTime() + PROBLEM_WINDOW_DAYS * 86400000).toISOString(); }

export function verifyStripeSignature(rawBody, header, secret, nowSeconds, tolerance = 300) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(",").map(p => p.split("=")).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const signatures = String(header).split(",").filter(p => p.trim().startsWith("v1=")).map(p => p.trim().slice(3));
  return signatures.some(sig => { const b = Buffer.from(sig, "hex"); return b.length === expected.length && timingSafeEqual(b, expected); });
}

function form(data, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(data)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") form(v, key, out); else out.append(key, String(v));
  }
  return out;
}

export function createTicketOrders({ db, commands, authenticate, corsHeaders, tableName, getStripeKey, getWebhookSecret, emailForUser, sendTicketEmail, renderQr, fetchImpl = fetch, clock = Date.now, env = process.env }) {
  const { GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, TransactWriteItemsCommand } = commands;
  const json = (statusCode, data, headers = {}) => ({ statusCode, headers: { ...headers, "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(data) });
  const S = v => ({ S: String(v) }), N = v => ({ N: String(v) });
  const nowIso = () => new Date(clock()).toISOString();
  const body = event => { try { return JSON.parse(event?.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event?.body || "{}"); } catch { return null; } };

  async function stripeKey() {
    const value = await getStripeKey();
    if (!/^sk_test_|^rk_test_/.test(value || "") && env.MARKETPLACE_PAYOUTS_LIVE !== "approved") throw Object.assign(new Error("Ticket sales are in testing."), { status: 503 });
    return value;
  }
  async function stripe(method, path, data) {
    const response = await fetchImpl("https://api.stripe.com" + path, { method, headers: { Authorization: "Bearer " + await stripeKey(), "Content-Type": "application/x-www-form-urlencoded" }, body: data ? form(data).toString() : undefined });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result?.error?.message || "Stripe request failed."), { status: 502 });
    return result;
  }
  const get = async key => (await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }))).Item;
  const eventKey = id => ({ pk: S(`EVENT#${id}`), sk: S("META") });
  const tierKey = (id, tierId) => ({ pk: S(`EVENT#${id}`), sk: S(`TIER#${tierId}`) });
  const orderKey = id => ({ pk: S(`ORDER#${id}`), sk: S("META") });
  const num = (item, k) => Number(item?.[k]?.N || 0);

  async function signedIn(event) {
    const headers = corsHeaders(event?.headers?.origin || event?.headers?.Origin);
    const userId = String(await authenticate(event) || "");
    return { headers, userId: MEMBER.test(userId) ? userId : "" };
  }

  async function checkout(event, eventId) {
    const { headers, userId } = await signedIn(event);
    if (!headers?.["access-control-allow-origin"]) return json(403, { error: "Forbidden origin" }, headers);
    if (!userId) return json(401, { error: "Sign in to buy tickets." }, headers);
    const request = body(event);
    const quantity = Number(request?.quantity);
    const tierId = String(request?.tierId || "");
    if (!request || !ID.test(tierId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) return json(400, { error: `Choose a ticket type and 1–${MAX_TICKETS_PER_ORDER} tickets.` }, headers);
    const [ev, tier] = await Promise.all([get(eventKey(eventId)), get(tierKey(eventId, tierId))]);
    if (!ev || ev.status?.S !== "published" || ev.ticketSalesEnabled?.BOOL !== true) return json(404, { error: "Tickets are not on sale for this event." }, headers);
    if (!tier || tier.status?.S !== "on_sale") return json(409, { error: "That ticket type is not on sale." }, headers);
    if (new Date(ev.startsAt?.S || 0).getTime() <= clock()) return json(409, { error: "This event has already started." }, headers);
    const named = ev.namedTickets?.BOOL !== false;
    let attendees = [];
    if (named) {
      attendees = Array.isArray(request.attendees) ? request.attendees.map(cleanName) : [];
      if (attendees.length !== quantity || attendees.some(name => !name)) return json(400, { error: "Enter the legal name for every ticket. Named tickets are non-transferable and names are checked at the door." }, headers);
    }
    // Risk control: only Stripe-verified promoters can sell.
    const seller = await get({ pk: S(`SELLER#${ev.organizerId?.S}`), sk: S("PAYOUTS") });
    if (seller?.status?.S !== "active") return json(409, { error: "This promoter hasn't finished payout verification with Stripe yet, so tickets can't be sold here yet." }, headers);
    const capacity = num(tier, "capacity"), sold = num(tier, "sold"), reserved = num(tier, "reserved"), price = num(tier, "priceCents");
    if (capacity - sold - reserved < quantity) return json(409, { error: "Not enough tickets left." }, headers);
    const email = await emailForUser(userId);
    if (!email) return json(409, { error: "Your account needs an email address for your tickets." }, headers);
    const orderId = randomUUID(), at = nowIso(), subtotal = price * quantity, fee = feeCents(subtotal), expires = Math.floor(clock() / 1000) + 31 * 60;
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: tierKey(eventId, tierId), UpdateExpression: "SET reserved = if_not_exists(reserved, :z) + :q", ConditionExpression: "(attribute_not_exists(sold) OR sold = :sold) AND (attribute_not_exists(reserved) OR reserved <= :max) AND #s = :onsale", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":z": N(0), ":q": N(quantity), ":sold": N(sold), ":max": N(capacity - sold - quantity), ":onsale": S("on_sale") } } },
        { Put: { TableName: tableName, Item: { ...orderKey(orderId), entityType: S("ticket_order"), orderId: S(orderId), eventId: S(eventId), tierId: S(tierId), buyerId: S(userId), organizerId: S(ev.organizerId?.S || ""), quantity: N(quantity), unitCents: N(price), subtotalCents: N(subtotal), feeCents: N(fee), totalCents: N(subtotal + fee), payoutCents: N(subtotal), currency: S("usd"), named: { BOOL: named }, attendees: { L: attendees.map(S) }, status: S("pending"), releaseAfter: S(releaseAfter({ startsAt: ev.startsAt?.S, endsAt: ev.endsAt?.S })), createdAt: S(at), updatedAt: S(at) }, ConditionExpression: "attribute_not_exists(pk)" } }
      ] }));
    } catch { return json(409, { error: "Those tickets were just taken. Try again." }, headers); }
    try {
      const session = await stripe("POST", "/v1/checkout/sessions", {
        mode: "payment", client_reference_id: orderId, customer_email: email, expires_at: expires,
        line_items: { 0: { quantity, price_data: { currency: "usd", unit_amount: price, product_data: { name: `${ev.title?.S || "Event"} — ${tier.name?.S || "Ticket"}`.slice(0, 250), tax_code: "txcd_10000000" } } }, ...(fee ? { 1: { quantity: 1, price_data: { currency: "usd", unit_amount: fee, product_data: { name: FEE_LINE_NAME } } } } : {}) },
        payment_intent_data: { transfer_group: `ORDER_${orderId}`, metadata: { danzstak_order: orderId, danzstak_event: eventId } },
        metadata: { danzstak_order: orderId, danzstak_kind: "event_tickets" },
        success_url: `${APP}/event.html?id=${eventId}&order=${orderId}`, cancel_url: `${APP}/event.html?id=${eventId}&order=${orderId}&cancelled=1`
      });
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: orderKey(orderId), UpdateExpression: "SET sessionId = :s", ExpressionAttributeValues: { ":s": S(session.id) } }));
      return json(200, { url: session.url, orderId, subtotalCents: subtotal, feeCents: fee, totalCents: subtotal + fee }, headers);
    } catch (error) {
      await releaseReservation(orderId, "failed");
      return json(error.status || 502, { error: error.status === 503 ? error.message : "Checkout is unavailable right now." }, headers);
    }
  }

  async function releaseReservation(orderId, status) {
    const order = await get(orderKey(orderId));
    if (!order || order.status?.S !== "pending") return;
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: orderKey(orderId), UpdateExpression: "SET #s = :st, updatedAt = :at", ConditionExpression: "#s = :pending", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":st": S(status), ":pending": S("pending"), ":at": S(nowIso()) } } },
        { Update: { TableName: tableName, Key: tierKey(order.eventId.S, order.tierId.S), UpdateExpression: "SET reserved = reserved - :q", ConditionExpression: "reserved >= :q", ExpressionAttributeValues: { ":q": N(num(order, "quantity")) } } }
      ] }));
    } catch {}
  }

  async function fulfil(session) {
    const orderId = session?.metadata?.danzstak_order || session?.client_reference_id;
    if (!ID.test(String(orderId || ""))) return;
    const order = await get(orderKey(orderId));
    if (!order || order.status?.S !== "pending") return; // idempotent: already fulfilled or released
    // Task 12: Stripe must have collected exactly the ticket price plus the buyer fee recorded at checkout.
    const subtotal = num(order, "subtotalCents");
    if (session.payment_status !== "paid" || num(order, "feeCents") !== feeCents(subtotal) || Number(session.amount_total) !== subtotal + feeCents(subtotal) || session.currency !== "usd") return;
    const ev = await get(eventKey(order.eventId.S)), tier = await get(tierKey(order.eventId.S, order.tierId.S));
    const quantity = num(order, "quantity"), named = order.named?.BOOL !== false, attendees = (order.attendees?.L || []).map(v => v.S), at = nowIso();
    const tickets = Array.from({ length: quantity }, (_, i) => ({ code: ticketCode(), name: named ? attendees[i] : "" }));
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Update: { TableName: tableName, Key: orderKey(orderId), UpdateExpression: "SET #s = :held, paymentIntent = :pi, amountTotal = :amt, paidAt = :at, updatedAt = :at, ticketCodes = :codes", ConditionExpression: "#s = :pending", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":held": S("held"), ":pending": S("pending"), ":pi": S(session.payment_intent || ""), ":amt": N(session.amount_total), ":at": S(at), ":codes": { L: tickets.map(t => S(t.code)) } } } },
      { Update: { TableName: tableName, Key: tierKey(order.eventId.S, order.tierId.S), UpdateExpression: "SET reserved = reserved - :q, sold = if_not_exists(sold, :z) + :q", ConditionExpression: "reserved >= :q", ExpressionAttributeValues: { ":q": N(quantity), ":z": N(0) } } },
      ...tickets.map(t => ({ Put: { TableName: tableName, Item: { pk: S(`EVENT#${order.eventId.S}`), sk: S(`TICKET#${t.code}`), entityType: S("ticket"), code: S(t.code), orderId: S(orderId), tierName: S(tier?.name?.S || "Ticket"), attendee: S(t.name), named: { BOOL: named }, status: S("valid"), issuedAt: S(at) }, ConditionExpression: "attribute_not_exists(pk)" } }))
    ] }));
    try {
      const email = await emailForUser(order.buyerId.S);
      if (email) await sendTicketEmail({ to: email, event: { title: ev?.title?.S || "Event", venue: [ev?.venueName?.S, ev?.venueAddress?.S].filter(Boolean).join(", "), startsAt: ev?.startsAt?.S, timezone: ev?.timezone?.S || "UTC" }, tier: tier?.name?.S || "Ticket", named, orderId, tickets: await Promise.all(tickets.map(async t => ({ ...t, qrPng: await renderQr(`DANZSTAK-TICKET:${order.eventId.S}:${t.code}`) }))) });
    } catch (error) { console.error("Ticket email failed", orderId, error?.name || "error"); }
  }

  async function webhook(event) {
    const raw = event?.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : String(event?.body || "");
    const signature = event?.headers?.["stripe-signature"] || event?.headers?.["Stripe-Signature"];
    if (!verifyStripeSignature(raw, signature, await getWebhookSecret(), Math.floor(clock() / 1000))) return json(400, { error: "Invalid signature" });
    let payload; try { payload = JSON.parse(raw); } catch { return json(400, { error: "Invalid payload" }); }
    const object = payload?.data?.object || {};
    if (object?.metadata?.danzstak_kind !== "event_tickets") return json(200, { received: true, ignored: true });
    if (payload.type === "checkout.session.completed" || payload.type === "checkout.session.async_payment_succeeded") await fulfil(object);
    if (payload.type === "checkout.session.expired" || payload.type === "checkout.session.async_payment_failed") await releaseReservation(object?.metadata?.danzstak_order, "expired");
    return json(200, { received: true });
  }

  async function orderView(event, orderId) {
    const { headers, userId } = await signedIn(event);
    if (!userId) return json(401, { error: "Authentication required." }, headers);
    const order = await get(orderKey(orderId));
    if (!order || order.buyerId?.S !== userId) return json(404, { error: "Order not found." }, headers);
    const codes = (order.ticketCodes?.L || []).map(v => v.S);
    const tickets = [];
    for (const code of codes) { const t = await get({ pk: S(`EVENT#${order.eventId.S}`), sk: S(`TICKET#${code}`) }); if (t) tickets.push({ code, name: t.attendee?.S || "", status: t.status?.S || "valid", tier: t.tierName?.S || "" }); }
    return json(200, { order: { id: orderId, status: order.status?.S, quantity: num(order, "quantity"), subtotalCents: num(order, "subtotalCents"), feeCents: num(order, "feeCents"), totalCents: num(order, "subtotalCents") + num(order, "feeCents"), named: order.named?.BOOL !== false, tickets } }, headers);
  }

  async function doorList(event, eventId) {
    const { headers, userId } = await signedIn(event);
    if (!userId) return json(401, { error: "Authentication required." }, headers);
    const ev = await get(eventKey(eventId));
    if (!ev || ev.organizerId?.S !== userId) return json(403, { error: "Only the organizer can see the door list." }, headers);
    const result = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "pk = :pk AND begins_with(sk, :t)", ExpressionAttributeValues: { ":pk": S(`EVENT#${eventId}`), ":t": S("TICKET#") }, ConsistentRead: true }));
    const tickets = (result.Items || []).map(t => ({ code: t.code?.S, name: t.attendee?.S || "", tier: t.tierName?.S || "", status: t.status?.S || "valid", checkedInAt: t.checkedInAt?.S || "" })).sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code));
    return json(200, { event: { title: ev.title?.S, named: ev.namedTickets?.BOOL !== false }, tickets }, headers);
  }

  async function checkIn(event, eventId, code) {
    const { headers, userId } = await signedIn(event);
    if (!headers?.["access-control-allow-origin"]) return json(403, { error: "Forbidden origin" }, headers);
    if (!userId) return json(401, { error: "Authentication required." }, headers);
    const ev = await get(eventKey(eventId));
    if (!ev || ev.organizerId?.S !== userId) return json(403, { error: "Only the organizer can check people in." }, headers);
    try {
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: { pk: S(`EVENT#${eventId}`), sk: S(`TICKET#${code}`) }, UpdateExpression: "SET #s = :in, checkedInAt = :at", ConditionExpression: "#s = :valid", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":in": S("checked_in"), ":valid": S("valid"), ":at": S(nowIso()) } }));
      return json(200, { checkedIn: true }, headers);
    } catch { return json(409, { error: "Ticket not found, already used or refunded." }, headers); }
  }

  return async function ticketOrders(event) {
    const method = event?.requestContext?.http?.method || "", path = event?.rawPath || "";
    if (path === "/marketplace/stripe/webhook" && method === "POST") return webhook(event);
    let m = path.match(/^\/marketplace\/events\/([a-f0-9-]{36})\/checkout$/i); if (m && method === "POST") return checkout(event, m[1]);
    m = path.match(/^\/marketplace\/events\/([a-f0-9-]{36})\/door$/i); if (m && method === "GET") return doorList(event, m[1]);
    m = path.match(/^\/marketplace\/events\/([a-f0-9-]{36})\/door\/([A-Z0-9]{4}-[A-Z0-9]{4})$/); if (m && method === "POST") return checkIn(event, m[1], m[2]);
    m = path.match(/^\/marketplace\/orders\/([a-f0-9-]{36})$/i); if (m && method === "GET") return orderView(event, m[1]);
    return null;
  };
}
