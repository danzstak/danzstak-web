// Owner 2026-11-17: if a venue has not opened the band's private EPK link 30 days after the pitch,
// the band gets its booking-email credit back inside DanzStak (never a Stripe refund).
// One credit per first pitch, once. A reply, a bounce refund or any open before the check means no refund.
export const UNOPENED_REFUND_DAYS = 30;
const SEND_PREFIX = "TOUR_MANAGER#EMAIL_SEND#";
const OUTREACH_PREFIX = "EPK#OUTREACH#";
const CREDIT_KEY = "TOUR_MANAGER#BOOKING_EMAIL_CREDITS";
const SETTLED = new Set(["sent", "delivered"]);

// Pitches that qualify, from the same scan the club stats use.
export function unopenedRefunds(items = [], nowMs = Date.now()) {
  const links = new Map();
  for (const item of items) {
    const tourId = item?.tourId?.S || "";
    if (tourId.startsWith(OUTREACH_PREFIX) && item.shareId?.S) links.set(`${item.userId?.S || ""}#${tourId.slice(OUTREACH_PREFIX.length)}`, item);
  }
  const due = [];
  for (const item of items) {
    const tourId = item?.tourId?.S || "", status = item?.status?.S || "";
    if (!tourId.startsWith(SEND_PREFIX) || item.followUpTo?.S || item.repliedAt?.S || item.unopenedCreditRestoredAt?.S || item.bounceCreditRestoredAt?.S) continue;
    if (!SETTLED.has(status) && status !== "provider_accepted") continue;
    const sendId = tourId.slice(SEND_PREFIX.length), userId = item.userId?.S || "", link = links.get(`${userId}#${sendId}`);
    if (!userId || !link || Number(link.openCount?.N || 0) > 0 || link.creditReturnedAt?.S) continue;
    const sentAt = Date.parse(item.sentAt?.S || item.providerAcceptedAt?.S || item.createdAt?.S || "");
    if (!Number.isFinite(sentAt) || nowMs - sentAt < UNOPENED_REFUND_DAYS * 86400000) continue;
    due.push({ userId, sendId, status, venueName: String(item.venueName?.S || "venue").slice(0, 160) });
  }
  return due;
}

// One transaction: mark the send and the EPK link, give the credit back, write the ledger line.
// Fails as a whole if the venue opened the link, replied or the credit already came back in the meantime.
export function unopenedRefundTransaction(tableName, entry, at) {
  const settled = SETTLED.has(entry.status);
  return [
    { Update: { TableName: tableName, Key: { userId: { S: entry.userId }, tourId: { S: `${SEND_PREFIX}${entry.sendId}` } }, UpdateExpression: "SET unopenedCreditRestoredAt = :at", ConditionExpression: "attribute_not_exists(unopenedCreditRestoredAt) AND attribute_not_exists(bounceCreditRestoredAt) AND attribute_not_exists(repliedAt) AND #status = :status", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":at": { S: at }, ":status": { S: entry.status } } } },
    { Update: { TableName: tableName, Key: { userId: { S: entry.userId }, tourId: { S: `${OUTREACH_PREFIX}${entry.sendId}` } }, UpdateExpression: "SET creditReturnedAt = :at", ConditionExpression: "attribute_exists(shareId) AND (attribute_not_exists(openCount) OR openCount = :zero) AND attribute_not_exists(creditReturnedAt)", ExpressionAttributeValues: { ":at": { S: at }, ":zero": { N: "0" } } } },
    { Update: { TableName: tableName, Key: { userId: { S: entry.userId }, tourId: { S: CREDIT_KEY } }, UpdateExpression: settled ? "ADD credits :one, sentEmails :minusOne SET updatedAt = :at" : "ADD credits :one, reservedCredits :minusOne SET updatedAt = :at", ConditionExpression: settled ? "sentEmails >= :one" : "reservedCredits >= :one", ExpressionAttributeValues: { ":one": { N: "1" }, ":minusOne": { N: "-1" }, ":at": { S: at } } } },
    { Put: { TableName: tableName, Item: { userId: { S: entry.userId }, tourId: { S: `TOUR_MANAGER#LEDGER#${at}#${entry.sendId}-unopened` }, entryType: { S: "email_unopened_restored" }, delta: { N: "1" }, status: { S: "restored" }, description: { S: `Credit returned: ${entry.venueName} did not open your EPK within 30 days` }, createdAt: { S: at } }, ConditionExpression: "attribute_not_exists(userId)" } }
  ];
}
