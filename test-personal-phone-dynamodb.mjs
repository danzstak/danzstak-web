import assert from "node:assert/strict";
import { createPersonalPhoneDynamoAdapter, phoneVerificationKeys } from "./infrastructure/auth-api/personal-phone-dynamodb.mjs";

class GetItemCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }

const calls = [];
let accountItem = null;
const db = { async send(command) {
  calls.push(command);
  if (command instanceof GetItemCommand) return { Item: accountItem };
  return {};
} };
const adapter = createPersonalPhoneDynamoAdapter({ db, tableName: "PhoneTable", commands: { GetItemCommand, TransactWriteItemsCommand, UpdateItemCommand }, now: () => Date.parse("2026-11-04T20:00:00Z") });
assert.deepEqual(phoneVerificationKeys.accountKey("member-1"), { recordKey: { S: "ACCOUNT#member-1" } });
assert.deepEqual(phoneVerificationKeys.claimKey("a".repeat(64)), { recordKey: { S: `PHONE#${"a".repeat(64)}` } });

assert.equal(await adapter.getByUser("member-1"), null);
const record = {
  userId: "member-1",
  phoneHash: "a".repeat(64),
  challengeId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  challengeHash: "b".repeat(64),
  status: "pending",
  createdAt: "2026-11-04T20:00:00.000Z",
  expiresAt: 1793823000,
  resendAfter: 1793822460,
  attempts: 0,
  maskedNumber: "•••• 0100",
  requestKey: "c".repeat(64),
  previousPhoneHash: "d".repeat(64),
  previousMaskedNumber: "•••• 9999",
  previousVerifiedAt: "2026-10-01T00:00:00.000Z"
};
assert.deepEqual(await adapter.reserveChallenge(record), { accepted: true });
const reservation = calls.at(-1).input.TransactItems;
assert.equal(reservation.length, 6, "reservation must atomically enforce account, day, number, and request-origin limits plus uniqueness");
assert.equal(reservation.every(operation => (operation.Put || operation.Update || operation.Delete).TableName === "PhoneTable"), true);
assert.match(JSON.stringify(reservation), /RATE#ACCOUNT#member-1#HOUR#/);
assert.match(JSON.stringify(reservation), /RATE#PHONE#/);
assert.match(JSON.stringify(reservation), /RATE#REQUEST#/);
assert.equal(JSON.stringify(reservation).includes("+14155550100"), false, "DynamoDB reservation must not contain plaintext phone numbers");
assert.equal(JSON.stringify(reservation).includes("123456"), false, "DynamoDB reservation must not contain plaintext OTP codes");

accountItem = {
  recordKey: { S: "ACCOUNT#member-1" }, userId: { S: "member-1" }, phoneHash: { S: record.phoneHash }, challengeId: { S: record.challengeId }, challengeHash: { S: record.challengeHash },
  status: { S: "pending" }, createdAt: { S: record.createdAt }, expiresAt: { N: String(record.expiresAt) }, resendAfter: { N: String(record.resendAfter) }, attempts: { N: "2" }, maskedNumber: { S: record.maskedNumber },
  previousPhoneHash: { S: record.previousPhoneHash }, previousMaskedNumber: { S: record.previousMaskedNumber }, previousVerifiedAt: { S: record.previousVerifiedAt }
};
const loaded = await adapter.getByUser("member-1");
assert.equal(loaded.attempts, 2);
assert.equal(loaded.maskedNumber, "•••• 0100");
assert.equal(loaded.previousPhoneHash, "d".repeat(64));

await adapter.markSent(record);
assert.match(calls.at(-1).input.ConditionExpression, /challengeId = :challenge/);
await adapter.recordFailedAttempt(record);
assert.match(calls.at(-1).input.ConditionExpression, /attempts < :maximum/);
assert.equal(await adapter.markVerified(record), true);
const verification = calls.at(-1).input.TransactItems;
assert.equal(verification.length, 3, "replacement verification must remove the previous unique claim atomically");
assert.match(verification[0].Update.UpdateExpression, /REMOVE challengeHash/);
assert.match(verification[1].Update.ConditionExpression, /userId = :userId/);

await adapter.remove("member-1");
const removal = calls.at(-1).input.TransactItems;
assert.equal(removal.length, 2);
assert.match(removal[0].Delete.Key.recordKey.S, /^ACCOUNT#/);
assert.match(removal[1].Delete.Key.recordKey.S, /^PHONE#/);

console.log("Personal phone DynamoDB checks passed: atomic uniqueness, bounded rate scopes, protected records, replacement, confirmation, and removal.");
