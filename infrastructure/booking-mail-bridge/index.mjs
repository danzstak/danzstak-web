import { createHash } from "node:crypto";
import { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";

const region = process.env.DATA_REGION || "us-west-1";
const db = new DynamoDBClient({ region, maxAttempts: 5 });
const s3 = new S3Client({ region: process.env.AWS_REGION, maxAttempts: 5 });
const lambda = new LambdaClient({ region: process.env.PUSH_FUNCTION_REGION || region, maxAttempts: 5 });
const tableName = process.env.TOURS_TABLE;
const bucket = process.env.INBOUND_BUCKET;
const prefix = process.env.INBOUND_PREFIX || "booking-replies/";
const domain = (process.env.BOOKING_REPLY_DOMAIN || "reply.danzstak.com").toLowerCase();
const hash = value => createHash("sha256").update(value).digest("hex");
const clean = (value, maximum = 12000) => String(value || "").trim().slice(0, maximum);

async function deliverPushJob(client, notifier, owner, conversationId, messageId) {
  if (!process.env.PUSH_FUNCTION_NAME && notifier === lambda) return { skipped: true };
  const key = { userId: { S: owner }, tourId: { S: `BOOKING_PUSH#${messageId}` } };
  const result = await notifier.send(new InvokeCommand({ FunctionName: process.env.PUSH_FUNCTION_NAME, InvocationType: "RequestResponse", Payload: Buffer.from(JSON.stringify({ source: "danzstak.booking-mail", userId: owner, conversationId })) }));
  if (result.FunctionError) throw new Error("Booking push worker rejected the notification");
  await client.send(new UpdateItemCommand({ TableName: tableName, Key: key, UpdateExpression: "SET #status = :sent, deliveredAt = :at", ConditionExpression: "#status = :pending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":sent": { S: "sent" }, ":pending": { S: "pending" }, ":at": { S: new Date().toISOString() } } }));
  return { sent: true };
}

export function inboundAlias(recipients, expectedDomain = domain) {
  for (const recipient of recipients || []) {
    const match = String(recipient).toLowerCase().match(/^reply\+([a-z0-9_-]{32})@(.+)$/i);
    if (match && match[2] === expectedDomain) return { token: match[1], hash: hash(match[1]) };
  }
  return null;
}

export function acceptableVerdicts(receipt) {
  if (receipt?.spamVerdict?.status !== "PASS" || receipt?.virusVerdict?.status !== "PASS") return false;
  return [receipt?.spfVerdict?.status, receipt?.dkimVerdict?.status, receipt?.dmarcVerdict?.status].includes("PASS");
}

export function confirmedAppointment(content, reference = new Date()) {
  const text = clean(content), lower = text.toLowerCase();
  const confirmation = /\b(confirmed|we(?:'re| are) booked|date is set|see you (?:on|at)|happy to confirm|locked in)\b/.test(lower);
  const uncertain = /\b(maybe|tentative|possibly|might|could|hold|if available|not confirmed)\b/.test(lower);
  const iso = text.match(/\b20\d{2}-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])\b/)?.[0] || "";
  const names = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const named = text.match(new RegExp(`\\b(${names.join("|")})\\s+([0-2]?\\d|3[01])(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?`, "i"));
  let date = iso;
  if (!date && named) {
    const month = names.indexOf(named[1].toLowerCase()), year = Number(named[3] || reference.getUTCFullYear()), value = new Date(Date.UTC(year, month, Number(named[2])));
    if (value.getUTCMonth() === month) date = value.toISOString().slice(0, 10);
  }
  const clock = text.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)\b/i);
  let time = "";
  if (clock) { let hour = Number(clock[1]); if (clock[3].toLowerCase() === "pm" && hour < 12) hour += 12; if (clock[3].toLowerCase() === "am" && hour === 12) hour = 0; time = `${String(hour).padStart(2,"0")}:${clock[2] || "00"}`; }
  return { status: confirmation && date && !uncertain ? "confirmed" : (confirmation || date ? "needs-clarification" : "none"), date, time };
}

async function bodyText(stream) { return stream.transformToString ? stream.transformToString() : new Promise((resolve, reject) => { const parts = []; stream.on("data", part => parts.push(part)); stream.on("end", () => resolve(Buffer.concat(parts))); stream.on("error", reject); }); }

export async function processSesRecord(record, dependencies = {}) {
  const receipt = record?.ses?.receipt, mail = record?.ses?.mail;
  if (!mail?.messageId || !acceptableVerdicts(receipt)) return { accepted: false, reason: "mail-authentication" };
  const alias = inboundAlias(receipt.recipients);
  if (!alias) return { accepted: false, reason: "unknown-recipient" };
  const client = dependencies.db || db, storage = dependencies.s3 || s3, notifier = dependencies.lambda || lambda, parser = dependencies.parse || simpleParser;
  const aliasRecord = await client.send(new GetItemCommand({ TableName: tableName, Key: { userId: { S: "BOOKING_MAIL_ALIAS" }, tourId: { S: alias.hash } }, ConsistentRead: true })), route = aliasRecord.Item;
  if (!route || route.status?.S !== "active") return { accepted: false, reason: "inactive-alias" };
  const source = String(mail.source || "").trim().toLowerCase();
  if (!source || source !== route.expectedSender?.S) return { accepted: false, reason: "sender-mismatch" };
  const eventKey = { userId: { S: "BOOKING_MAIL_EVENT" }, tourId: { S: mail.messageId } };
  const duplicate = await client.send(new GetItemCommand({ TableName: tableName, Key: eventKey, ConsistentRead: true }));
  if (duplicate.Item) {
    const owner = duplicate.Item.ownerUserId?.S, conversationId = duplicate.Item.conversationId?.S;
    if (owner && conversationId) await deliverPushJob(client, notifier, owner, conversationId, mail.messageId).catch(() => {});
    return { accepted: true, duplicate: true };
  }
  const object = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: `${prefix}${mail.messageId}` }));
  const parsed = await parser(await bodyText(object.Body), { skipHtmlToText: false, maxHtmlLengthToParse: 262144 });
  const content = clean(parsed.text || parsed.html || "");
  if (!content) return { accepted: false, reason: "empty-message" };
  const owner = route.ownerUserId.S, conversationId = route.conversationId.S, receivedAt = new Date(mail.timestamp || Date.now()).toISOString(), appointment = confirmedAppointment(content, new Date(receivedAt)), messageId = `in-${mail.messageId}`;
  const appointmentMap = { M: { status: { S: appointment.status }, date: { S: appointment.date }, time: { S: appointment.time }, sourceMessageId: { S: messageId } } };
  const values = { ":at": { S: receivedAt }, ":preview": { S: clean(content, 140) }, ":one": { N: "1" }, ":external": { S: clean(parsed.messageId || mail.messageId, 500) }, ":appointment": appointmentMap, ":route": { BOOL: appointment.status === "confirmed" } };
  await client.send(new TransactWriteItemsCommand({ TransactItems: [
    { Put: { TableName: tableName, Item: { ...eventKey, ownerUserId: { S: owner }, conversationId: { S: conversationId }, processedAt: { S: receivedAt } }, ConditionExpression: "attribute_not_exists(userId)" } },
    { Put: { TableName: tableName, Item: { userId: { S: owner }, tourId: { S: `BOOKING_CHAT_MESSAGE#${conversationId}#${receivedAt}#${messageId}` }, conversationId: { S: conversationId }, messageId: { S: messageId }, direction: { S: "inbound" }, transport: { S: "email" }, content: { S: content }, subject: { S: clean(parsed.subject, 180) }, externalMessageId: { S: clean(parsed.messageId || mail.messageId, 500) }, sender: { S: source }, createdAt: { S: receivedAt }, appointment: appointmentMap }, ConditionExpression: "attribute_not_exists(userId)" } },
    { Put: { TableName: tableName, Item: { userId: { S: owner }, tourId: { S: `BOOKING_PUSH#${mail.messageId}` }, type: { S: "booking_reply" }, title: { S: "New booking reply" }, body: { S: "A booking contact replied in DanzStak Chat." }, conversationId: { S: conversationId }, createdAt: { S: receivedAt }, status: { S: "pending" } }, ConditionExpression: "attribute_not_exists(userId)" } },
    { Update: { TableName: tableName, Key: { userId: { S: owner }, tourId: { S: `BOOKING_CHAT#${conversationId}` } }, UpdateExpression: "SET lastMessageAt = :at, updatedAt = :at, preview = :preview, lastExternalMessageId = :external, appointment = :appointment, routeRecalculationRequired = :route ADD unread :one", ConditionExpression: "recipient = :sender", ExpressionAttributeValues: { ...values, ":sender": { S: source } } } }
  ] }));
  await deliverPushJob(client, notifier, owner, conversationId, mail.messageId);
  return { accepted: true, conversationId, appointment: appointment.status };
}

export const handler = async event => {
  if (!tableName || !bucket) throw new Error("Booking mail bridge configuration is incomplete");
  const results = [];
  for (const record of event?.Records || []) if (record.eventSource === "aws:ses") results.push(await processSesRecord(record));
  return { results };
};
