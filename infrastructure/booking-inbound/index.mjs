import { createHash } from "node:crypto";
import { DynamoDBClient, GetItemCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { headerValue, decodePart, cleanReply, receiptIsSafe } from "./mime.mjs";

const inboundRegion = process.env.AWS_REGION || "us-east-1";
const appRegion = process.env.APP_REGION || "us-west-1";
const bucket = process.env.INBOUND_BUCKET || "";
const tableName = process.env.TOURS_TABLE || "DANZSTAK-Tours";
const s3 = new S3Client({ region: inboundRegion, maxAttempts: 3 });
const db = new DynamoDBClient({ region: appRegion, maxAttempts: 3 });
const TOKEN_OWNER = "TOUR_MANAGER#OPT_OUT_TOKEN";
const MAX_RAW_BYTES = 2 * 1024 * 1024;

const hash = value => createHash("sha256").update(String(value || "")).digest("hex");
const tokenKey = token => ({ userId: { S: TOKEN_OWNER }, tourId: { S: hash(`tour-manager-opt-out:${token}`) } });
const sendKey = (artistId, outreachId) => ({ userId: { S: artistId }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${outreachId}` } });
const normalizeEmail = value => String(value || "").match(/<?([^\s<>@]+@[^\s<>@]+)>?/i)?.[1]?.toLowerCase() || "";

export async function handler(event) {
  const record = event?.Records?.[0]?.ses, messageId = record?.mail?.messageId || "", receipt = record?.receipt;
  if (!bucket || !messageId || !receiptIsSafe(receipt)) return { accepted: false };
  const routedAddress = (receipt.recipients || []).map(normalizeEmail).find(address => /^[a-f0-9]{64}@reply\.danzstak\.com$/.test(address));
  if (!routedAddress) return { accepted: false };
  const token = routedAddress.split("@")[0], route = (await db.send(new GetItemCommand({ TableName: tableName, Key: tokenKey(token), ConsistentRead: true }))).Item;
  if (!route?.artistId?.S || !route?.outreachId?.S || Number(route.expiresAt?.N || 0) <= Math.floor(Date.now() / 1000)) return { accepted: false };
  const source = (await db.send(new GetItemCommand({ TableName: tableName, Key: sendKey(route.artistId.S, route.outreachId.S), ConsistentRead: true }))).Item;
  if (!source) return { accepted: false };
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: `incoming/${messageId}` }));
  const bytes = await object.Body.transformToByteArray();
  if (bytes.byteLength > MAX_RAW_BYTES) return { accepted: false };
  const raw = Buffer.from(bytes).toString("utf8"), sender = normalizeEmail(record.mail?.source || headerValue(raw, "From"));
  if (!sender || sender !== normalizeEmail(source.recipient?.S)) return { accepted: false, review: "sender_mismatch" };
  const content = cleanReply(decodePart(raw));
  if (!content) return { accepted: false };
  const at = new Date().toISOString(), dedupe = hash(messageId), replyKey = { userId: { S: route.artistId.S }, tourId: { S: `TOUR_MANAGER#BOOKING_REPLY#${route.outreachId.S}#email#${dedupe}` } };
  try {
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Put: { TableName: tableName, Item: { ...replyKey, outreachId: { S: route.outreachId.S }, venueKey: { S: route.venueKey?.S || "" }, direction: { S: "inbound" }, action: { S: "reply" }, content: { S: content }, source: { S: "email" }, sender: { S: sender }, providerMessageId: { S: messageId }, createdAt: { S: at } }, ConditionExpression: "attribute_not_exists(userId)" } },
      { Update: { TableName: tableName, Key: sendKey(route.artistId.S, route.outreachId.S), UpdateExpression: "SET #status = :replied, repliedAt = :at", ConditionExpression: "attribute_exists(userId)", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":replied": { S: "replied" }, ":at": { S: at } } } }
    ] }));
    return { accepted: true };
  } catch (error) {
    const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: replyKey, ConsistentRead: true }));
    if (existing.Item) return { accepted: true, duplicate: true };
    throw error;
  }
}
