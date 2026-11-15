// SYNC device registration by email code (worldwide fallback while carrier SMS is unavailable).
// The code goes ONLY to the signed-in account's own email address. It is bound to the
// current device's one-time server challenge and, once confirmed, issues the same
// short-lived, single-use DEVICE_GRANT record that SMS confirmation issues.
// Phone verification records are never read or changed here.
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { deviceChallengeDigest, safeDigestEqual } from "./personal-phone-verification.mjs";

const CODE = /^\d{6}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const recordKey = userId => ({ recordKey: { S: `EMAIL_DEVICE#${userId}` } });
const num = (item, name) => Number(item?.[name]?.N || 0);
const str = (item, name) => String(item?.[name]?.S || "");

export const emailDevicePolicy = Object.freeze({ codeDigits: 6, validityMinutes: 10, maximumAttempts: 5, resendCooldownSeconds: 60, maximumSendsPerHour: 3, maximumSendsPerDay: 6 });

export function maskEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}•••@${domain}`;
}

function codeDigest(secret, userId, challengeId, code) {
  return createHmac("sha256", secret).update(`email-device:${userId}:${challengeId}:${code}`).digest("hex");
}

function serviceError(message, statusCode, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; return error; }

export function createEmailDeviceDynamoAdapter({ db, tableName, commands, now = () => Date.now() }) {
  const { GetItemCommand, TransactWriteItemsCommand, UpdateItemCommand, DeleteItemCommand } = commands;
  const rate = (key, maximum, ttl) => ({ Update: { TableName: tableName, Key: { recordKey: { S: key } }, UpdateExpression: "ADD #count :one SET #ttl = :ttl", ConditionExpression: "attribute_not_exists(#count) OR #count < :maximum", ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" }, ExpressionAttributeValues: { ":one": { N: "1" }, ":maximum": { N: String(maximum) }, ":ttl": { N: String(ttl) } } } });
  async function get(userId) {
    const item = (await db.send(new GetItemCommand({ TableName: tableName, Key: recordKey(userId), ConsistentRead: true }))).Item;
    if (!item) return null;
    return { userId: str(item, "userId"), challengeId: str(item, "challengeId"), challengeHash: str(item, "challengeHash"), status: str(item, "status"), expiresAt: num(item, "expiresAt"), resendAfter: num(item, "resendAfter"), attempts: num(item, "attempts"), maskedEmail: str(item, "maskedEmail"), deviceChallengeId: str(item, "deviceChallengeId"), deviceChallengeHash: str(item, "deviceChallengeHash") };
  }
  async function reserve(record, requestKey = "") {
    const seconds = Math.floor(now() / 1000), hour = Math.floor(now() / 3600000), day = Math.floor(now() / 86400000);
    const items = [
      rate(`RATE#EMAIL_DEVICE#${record.userId}#HOUR#${hour}`, emailDevicePolicy.maximumSendsPerHour, seconds + 7200),
      rate(`RATE#EMAIL_DEVICE#${record.userId}#DAY#${day}`, emailDevicePolicy.maximumSendsPerDay, seconds + 172800)
    ];
    if (requestKey) items.push(rate(`RATE#EMAIL_DEVICE_REQUEST#${requestKey}#HOUR#${hour}`, 12, seconds + 7200));
    items.push({ Put: { TableName: tableName, Item: { ...recordKey(record.userId), recordType: { S: "email_device_challenge" }, userId: { S: record.userId }, challengeId: { S: record.challengeId }, challengeHash: { S: record.challengeHash }, status: { S: "pending" }, expiresAt: { N: String(record.expiresAt) }, resendAfter: { N: String(record.resendAfter) }, attempts: { N: "0" }, maskedEmail: { S: record.maskedEmail }, deviceChallengeId: { S: record.deviceChallengeId }, deviceChallengeHash: { S: record.deviceChallengeHash }, ttl: { N: String(record.expiresAt + 86400) } } } });
    try { await db.send(new TransactWriteItemsCommand({ TransactItems: items })); return true; }
    catch (error) { if (["TransactionCanceledException", "ConditionalCheckFailedException"].includes(error?.name)) return false; throw error; }
  }
  async function cancel(record) {
    await db.send(new DeleteItemCommand({ TableName: tableName, Key: recordKey(record.userId), ConditionExpression: "challengeId = :c", ExpressionAttributeValues: { ":c": { S: record.challengeId } } })).catch(() => null);
  }
  async function failedAttempt(record) {
    await db.send(new UpdateItemCommand({ TableName: tableName, Key: recordKey(record.userId), UpdateExpression: "ADD attempts :one", ConditionExpression: "challengeId = :c AND #s = :p AND attempts < :max", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":one": { N: "1" }, ":c": { S: record.challengeId }, ":p": { S: "pending" }, ":max": { N: String(emailDevicePolicy.maximumAttempts) } } })).catch(() => null);
  }
  async function consume(record, grant) {
    const items = [
      { Delete: { TableName: tableName, Key: recordKey(record.userId), ConditionExpression: "challengeId = :c AND #s = :p", ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":c": { S: record.challengeId }, ":p": { S: "pending" } } } },
      { Put: { TableName: tableName, Item: { recordKey: { S: `DEVICE_GRANT#${grant.grantId}` }, recordType: { S: "device_enrollment_grant" }, userId: { S: record.userId }, grantTokenHash: { S: grant.grantTokenHash }, deviceChallengeId: { S: record.deviceChallengeId }, deviceChallengeHash: { S: record.deviceChallengeHash }, maskedNumber: { S: "" }, verificationChannel: { S: "email" }, verifiedAt: { S: grant.verifiedAt }, expiresAt: { N: String(grant.expiresAt) }, ttl: { N: String(grant.expiresAt + 86400) } }, ConditionExpression: "attribute_not_exists(recordKey)" } }
    ];
    try { await db.send(new TransactWriteItemsCommand({ TransactItems: items })); return true; }
    catch (error) { if (["TransactionCanceledException", "ConditionalCheckFailedException"].includes(error?.name)) return false; throw error; }
  }
  return { get, reserve, cancel, failedAttempt, consume };
}

export function createEmailDeviceVerification({ adapter, sender, secret, enabled = false, now = () => Date.now(), createCode = () => String(randomInt(0, 1000000)).padStart(6, "0"), createId = randomUUID }) {
  if (!adapter || !sender || !secret) throw new TypeError("Email device verification dependencies are required");

  async function send({ userId, email, deviceChallengeId = "", deviceChallenge = "", requestKey = "" }) {
    if (!enabled) throw serviceError("Email codes for SYNC are not switched on yet. No email was sent.", 503, "provider_unavailable");
    const address = String(email || "").trim().toLowerCase();
    if (!EMAIL.test(address)) throw serviceError("Your account has no usable email address.", 409, "no_account_email");
    const deviceChallengeHash = deviceChallengeDigest(deviceChallengeId, deviceChallenge);
    const previous = await adapter.get(userId), seconds = Math.floor(now() / 1000);
    if (previous?.status === "pending" && previous.resendAfter > seconds) throw serviceError("Wait a minute before requesting another code.", 429, "resend_cooldown");
    const code = createCode(), challengeId = createId();
    const record = { userId, challengeId, challengeHash: codeDigest(secret, userId, challengeId, code), expiresAt: seconds + emailDevicePolicy.validityMinutes * 60, resendAfter: seconds + emailDevicePolicy.resendCooldownSeconds, maskedEmail: maskEmail(address), deviceChallengeId, deviceChallengeHash };
    if (!await adapter.reserve(record, requestKey)) throw serviceError("Too many code requests. Try again later.", 429, "rate_limited");
    try { await sender.send({ email: address, code }); }
    catch { await adapter.cancel(record); throw serviceError("The email could not be sent. This device is still not registered.", 503, "send_failed"); }
    return { state: "pending", channel: "email", maskedEmail: record.maskedEmail, expiresAt: new Date(record.expiresAt * 1000).toISOString(), resendAfter: new Date(record.resendAfter * 1000).toISOString() };
  }

  async function confirm({ userId, code, deviceChallengeId = "", deviceChallenge = "" }) {
    const record = await adapter.get(userId), seconds = Math.floor(now() / 1000);
    if (!record || record.status !== "pending") throw serviceError("This code is no longer active. Request a new one.", 409, "used");
    if (record.expiresAt <= seconds) throw serviceError("That code expired. Request a new email.", 410, "expired");
    if (record.attempts >= emailDevicePolicy.maximumAttempts) throw serviceError("Too many incorrect codes. Request a new email later.", 429, "attempts");
    const supplied = CODE.test(String(code || "")) ? codeDigest(secret, userId, record.challengeId, String(code)) : "";
    if (!supplied || !safeDigestEqual(supplied, record.challengeHash)) { await adapter.failedAttempt(record); throw serviceError("That code is incorrect.", 400, "invalid"); }
    if (record.deviceChallengeId !== deviceChallengeId || record.deviceChallengeHash !== deviceChallengeDigest(deviceChallengeId, deviceChallenge)) throw serviceError("This code belongs to a different device registration.", 409, "device_mismatch");
    const grantId = createId(), grantToken = randomBytes(32).toString("base64url");
    const grant = { grantId, grantTokenHash: createHash("sha256").update(grantToken).digest("hex"), verifiedAt: new Date(now()).toISOString(), expiresAt: seconds + 300 };
    if (!await adapter.consume(record, grant)) throw serviceError("This code is no longer active. Request a new one.", 409, "challenge_changed");
    return { state: "verified", channel: "email", deviceGrantId: grantId, deviceGrantToken: grantToken, deviceGrantExpiresAt: new Date(grant.expiresAt * 1000).toISOString() };
  }

  return { send, confirm };
}
