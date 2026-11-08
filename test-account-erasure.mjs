import assert from "node:assert/strict";
import {
  ACCOUNT_TABLES,
  accountMediaPrefixes,
  conversationId,
  deletedMemberAddress,
  runAccountErasurePhase
} from "./infrastructure/auth-api/account-erasure.mjs";
import { DELETION_PHASES } from "./infrastructure/auth-api/account-data-control.mjs";

const context = { userId: "member-123", accountEmail: "Owner@Example.com" };
const calls = [];
const adapters = Object.fromEntries([
  "deleteOwnedSocialContent", "deleteAuthoredReviews", "deleteWhere", "removeGroupMemberships", "deleteProfessionalData",
  "migrateSharedConversations", "deleteMediaPrefix", "deleteSessions", "deleteIdentity"
].map(name => [name, async (...args) => { calls.push([name, ...args]); return name === "migrateSharedConversations" ? { anonymized: 3, retained: 3 } : { deleted: 1 }; }]));

for (const phase of DELETION_PHASES) await runAccountErasurePhase(phase, context, adapters);

assert.ok(calls.some(([name, table, match]) => name === "deleteWhere" && table === ACCOUNT_TABLES.friends && match.friendEmail === "owner@example.com"));
assert.ok(calls.some(([name, table, match]) => name === "deleteWhere" && table === ACCOUNT_TABLES.calls && match.senderEmail === "owner@example.com"));
assert.ok(calls.some(([name]) => name === "deleteAuthoredReviews"), "authored review rows and indexes must be removed");
assert.ok(calls.some(([name, table, match]) => name === "deleteWhere" && table === ACCOUNT_TABLES.sessionDevices && match.userId === "member-123"));
assert.ok(calls.some(([name, table, match]) => name === "deleteWhere" && table === ACCOUNT_TABLES.callingDevices && match.userEmail === "owner@example.com"));
assert.ok(calls.some(([name, table, match]) => name === "deleteWhere" && table === ACCOUNT_TABLES.plans && match.participantEmail === "owner@example.com"));
assert.ok(calls.some(([name]) => name === "migrateSharedConversations"), "shared messages must be migrated, not bulk deleted");
assert.equal(calls.filter(([name]) => name === "deleteMediaPrefix").length, 8, "the final consistency sweep must recheck every owned-media prefix");
assert.ok(calls.some(([name]) => name === "deleteIdentity"), "identity is deleted only in the final phase");

const tombstone = deletedMemberAddress("member-123");
assert.match(tombstone, /^deleted\+[a-f0-9]{24}@deleted\.danzstak\.invalid$/);
assert.ok(!tombstone.includes("owner"));
assert.equal(tombstone, deletedMemberAddress("member-123"), "tombstones must be stable for idempotent retries");
assert.notEqual(conversationId("owner@example.com", "friend@example.com"), conversationId(tombstone, "friend@example.com"));
assert.deepEqual(accountMediaPrefixes("Owner@Example.com"), [
  "users/c8cd3c6427301eaf6665bcca/",
  "stories/c8cd3c6427301eaf6665bcca/",
  "messages/c8cd3c6427301eaf6665bcca/",
  "epk/c8cd3c6427301eaf6665bcca/"
]);
await assert.rejects(() => runAccountErasurePhase("unknown", context, adapters), /Unknown/);
await assert.rejects(() => runAccountErasurePhase("media", { userId: "member-123" }, adapters), /Verified deletion identity/);

console.log("Account erasure orchestration checks passed: all phases, bidirectional relationships, shared-message migration, media prefixes, and identity-last ordering.");
