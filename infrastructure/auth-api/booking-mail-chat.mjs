import { createHash, randomBytes, randomUUID } from "node:crypto";

const CATEGORIES = new Set(["club", "radio", "record-store"]);
const CATEGORY_LABELS = { club: "Club Bookings", radio: "Radio Interviews", "record-store": "Record Stores" };
const ALIAS_OWNER = "BOOKING_MAIL_ALIAS";
const EVENT_OWNER = "BOOKING_MAIL_EVENT";

const clean = (value, maximum = 5000) => String(value || "").trim().slice(0, maximum);
const email = value => { const result = clean(value, 254).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : ""; };
const hash = value => createHash("sha256").update(value).digest("hex");
const conversationKey = (userId, id) => ({ userId: { S: userId }, tourId: { S: `BOOKING_CHAT#${id}` } });
const messageKey = (userId, id, at, messageId) => ({ userId: { S: userId }, tourId: { S: `BOOKING_CHAT_MESSAGE#${id}#${at}#${messageId}` } });
const aliasKey = aliasHash => ({ userId: { S: ALIAS_OWNER }, tourId: { S: aliasHash } });

export function bookingConversationId(userId, category, organizationKey, recipient) {
  return hash(`${userId}\0${category}\0${organizationKey}\0${recipient.toLowerCase()}`).slice(0, 32);
}

export function extractConfirmedAppointment(content, referenceDate = new Date()) {
  const text = clean(content, 12000), lower = text.toLowerCase();
  const confirmed = /\b(confirmed|we(?:'re| are) booked|date is set|see you (?:on|at)|happy to confirm|locked in)\b/.test(lower);
  const tentative = /\b(maybe|tentative|possibly|might|could|hold|if available|not confirmed)\b/.test(lower);
  const iso = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/)?.[0] || "";
  const monthNames = "january|february|march|april|may|june|july|august|september|october|november|december";
  const named = text.match(new RegExp(`\\b(${monthNames})\\s+([0-2]?\\d|3[01])(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?`, "i"));
  let date = iso;
  if (!date && named) {
    const month = monthNames.split("|").indexOf(named[1].toLowerCase()) + 1;
    const year = Number(named[3] || referenceDate.getUTCFullYear());
    const candidate = new Date(Date.UTC(year, month - 1, Number(named[2])));
    if (candidate.getUTCMonth() === month - 1) date = candidate.toISOString().slice(0, 10);
  }
  const timeMatch = text.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i);
  let time = "";
  if (timeMatch && (timeMatch[2] || timeMatch[3])) {
    let hour = Number(timeMatch[1]);
    if (timeMatch[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (timeMatch[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
    time = `${String(hour).padStart(2, "0")}:${timeMatch[2] || "00"}`;
  }
  const status = confirmed && date && !tentative ? "confirmed" : (confirmed || date ? "needs-clarification" : "none");
  return { status, date, time, evidence: status === "none" ? "" : text.slice(0, 1200) };
}

export function createBookingMailChat({ db, commands, authenticate, corsHeaders, tableName, sendExternalReply, env = process.env, clock = Date.now }) {
  const { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand } = commands;
  const replyDomain = clean(env.BOOKING_REPLY_DOMAIN || "reply.danzstak.com", 253).toLowerCase();
  const now = () => new Date(clock()).toISOString();
  const response = (event, statusCode, data) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", ...corsHeaders(event.headers?.origin || event.headers?.Origin) }, body: JSON.stringify(data) });

  async function prepareOutbound({ userId, bookingId, organizationKey, organizationName, recipient, category = "club", subject }) {
    recipient = email(recipient); category = CATEGORIES.has(category) ? category : "club";
    if (!recipient || !userId || !organizationKey) throw new Error("Invalid booking conversation");
    const conversationId = bookingConversationId(userId, category, organizationKey, recipient), key = conversationKey(userId, conversationId);
    const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
    if (existing.Item?.replyAddress?.S) return { conversationId, replyAddress: existing.Item.replyAddress.S };
    const token = randomBytes(24).toString("base64url"), aliasHash = hash(token), replyAddress = `reply+${token}@${replyDomain}`, createdAt = now();
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: { TableName: tableName, Item: { ...key, conversationId: { S: conversationId }, category: { S: category }, categoryLabel: { S: CATEGORY_LABELS[category] }, organizationKey: { S: clean(organizationKey, 160) }, organizationName: { S: clean(organizationName, 160) || "Booking contact" }, recipient: { S: recipient }, replyAddress: { S: replyAddress }, subject: { S: clean(subject, 180) }, lastMessageAt: { S: createdAt }, unread: { N: "0" }, createdAt: { S: createdAt }, updatedAt: { S: createdAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
        { Put: { TableName: tableName, Item: { ...aliasKey(aliasHash), ownerUserId: { S: userId }, conversationId: { S: conversationId }, expectedSender: { S: recipient }, category: { S: category }, bookingId: { S: clean(bookingId, 120) }, createdAt: { S: createdAt }, status: { S: "active" } }, ConditionExpression: "attribute_not_exists(userId)" } }
      ] }));
    } catch (error) {
      if (error.name !== "TransactionCanceledException") throw error;
      const raced = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
      if (!raced.Item?.replyAddress?.S) throw error;
      return { conversationId, replyAddress: raced.Item.replyAddress.S };
    }
    return { conversationId, replyAddress };
  }

  async function recordOutbound({ userId, conversationId, providerMessageId, content, subject }) {
    const createdAt = now(), messageId = `out-${clean(providerMessageId, 200) || randomUUID()}`;
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: { ...messageKey(userId, conversationId, createdAt, messageId), conversationId: { S: conversationId }, messageId: { S: messageId }, direction: { S: "outbound" }, transport: { S: "email" }, content: { S: clean(content, 12000) }, subject: { S: clean(subject, 180) }, providerMessageId: { S: clean(providerMessageId, 200) }, createdAt: { S: createdAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
      { Update: { TableName: tableName, Key: conversationKey(userId, conversationId), UpdateExpression: "SET lastMessageAt = :at, updatedAt = :at, preview = :preview", ExpressionAttributeValues: { ":at": { S: createdAt }, ":preview": { S: clean(content, 140) || "Email sent" } } } }
    ] }));
  }

  async function route(event) {
    const method = event.requestContext?.http?.method, path = event.rawPath;
    if (!["https://danzstak.com", "https://www.danzstak.com"].includes(event.headers?.origin || event.headers?.Origin)) return response(event, 403, { error: "Forbidden origin" });
    const userId = await authenticate(event);
    if (!userId) return response(event, 401, { error: "Authentication required." });
    if (method === "GET" && path === "/tour-manager/booking-conversations") {
      const result = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :user AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":user": { S: userId }, ":prefix": { S: "BOOKING_CHAT#" } }, ConsistentRead: true, Limit: 200 }));
      const conversations = (result.Items || []).map(item => ({ conversationId: item.conversationId?.S || "", category: item.category?.S || "club", categoryLabel: item.categoryLabel?.S || "Club Bookings", organizationName: item.organizationName?.S || "Booking contact", recipient: item.recipient?.S || "", subject: item.subject?.S || "", preview: item.preview?.S || "", unread: Number(item.unread?.N || 0), updatedAt: item.updatedAt?.S || item.createdAt?.S || "", appointment: item.appointment?.M ? { status: item.appointment.M.status?.S || "", date: item.appointment.M.date?.S || "", time: item.appointment.M.time?.S || "" } : null })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return response(event, 200, { conversations, categories: ["Personal", "Club Bookings", "Radio Interviews", "Record Stores"] });
    }
    if (method === "GET" && path === "/tour-manager/booking-messages") {
      const conversationId = clean(event.queryStringParameters?.conversation, 32);
      const owner = await db.send(new GetItemCommand({ TableName: tableName, Key: conversationKey(userId, conversationId), ConsistentRead: true }));
      if (!owner.Item) return response(event, 404, { error: "Conversation not found." });
      const result = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :user AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":user": { S: userId }, ":prefix": { S: `BOOKING_CHAT_MESSAGE#${conversationId}#` } }, ConsistentRead: true, Limit: 100 }));
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: conversationKey(userId, conversationId), UpdateExpression: "SET unread = :zero", ExpressionAttributeValues: { ":zero": { N: "0" } } }));
      return response(event, 200, { messages: (result.Items || []).map(item => ({ messageId: item.messageId?.S || "", direction: item.direction?.S || "inbound", content: item.content?.S || "", subject: item.subject?.S || "", createdAt: item.createdAt?.S || "", transport: "email" })).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
    }
    if (method === "POST" && path === "/tour-manager/booking-messages") {
      let body; try { body = JSON.parse(event.body || "{}"); } catch { return response(event, 400, { error: "Invalid JSON." }); }
      const conversationId = clean(body.conversationId, 32), content = clean(body.content, 12000);
      if (!/^[a-f0-9]{32}$/.test(conversationId) || !content || content.length > 12000) return response(event, 400, { error: "Choose a conversation and enter a reply." });
      const found = await db.send(new GetItemCommand({ TableName: tableName, Key: conversationKey(userId, conversationId), ConsistentRead: true })), item = found.Item;
      if (!item || item.recipient?.S !== email(item.recipient?.S)) return response(event, 404, { error: "Conversation not found." });
      const delivery = await sendExternalReply({ to: item.recipient.S, replyTo: item.replyAddress.S, subject: /^re:/i.test(item.subject?.S || "") ? item.subject.S : `Re: ${item.subject?.S || "Booking inquiry"}`, content, conversationId, externalMessageId: item.lastExternalMessageId?.S || "" });
      if (!delivery?.messageId) return response(event, 502, { error: "The email provider did not accept the reply." });
      await recordOutbound({ userId, conversationId, providerMessageId: delivery.messageId, content, subject: item.subject?.S || "Booking inquiry" });
      return response(event, 201, { sent: true, messageId: delivery.messageId });
    }
    return null;
  }

  return { prepareOutbound, recordOutbound, route };
}

export const bookingMailConstants = { ALIAS_OWNER, EVENT_OWNER, CATEGORY_LABELS };
