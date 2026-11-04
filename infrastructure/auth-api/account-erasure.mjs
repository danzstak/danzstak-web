import { createHash } from "node:crypto";
import { DELETION_PHASES } from "./account-data-control.mjs";

export const ACCOUNT_TABLES = Object.freeze({
  posts: "DANZSTAK-Posts",
  comments: "DANZSTAK-Comments",
  reactions: "DANZSTAK-Reactions",
  notifications: "DANZSTAK-EngagementNotifications",
  friends: "DANZSTAK-Friends",
  stories: "DANZSTAK-Stories",
  groups: "DANZSTAK-GroupMembers",
  tours: "DANZSTAK-Tours",
  settings: "DanzStak-UserSettings",
  profileNames: "DanzStak-ProfileNames",
  presence: "DANZSTAK-Presence",
  pushSubscriptions: "DANZSTAK-PushSubscriptions",
  calls: "DANZSTAK-CallSignals",
  conversations: "DanzStak-Conversations",
  messages: "DanzStak-Messages",
  messageReactions: "DanzStak-MessageReactions"
});

export function deletedMemberAddress(userId) {
  if (typeof userId !== "string" || !userId) throw new TypeError("A user ID is required");
  const digest = createHash("sha256").update(`deleted-member:${userId}`).digest("hex").slice(0, 24);
  return `deleted+${digest}@deleted.danzstak.invalid`;
}

export function conversationId(left, right) {
  return createHash("sha256").update([left, right].sort().join("|")).digest("hex");
}

export function accountMediaPrefixes(accountEmail) {
  if (typeof accountEmail !== "string" || !accountEmail.includes("@")) throw new TypeError("A verified account email is required");
  const owner = createHash("sha256").update(accountEmail.trim().toLowerCase()).digest("hex").slice(0, 24);
  return [`users/${owner}/`, `stories/${owner}/`, `messages/${owner}/`, `epk/${owner}/`];
}

function requireAdapter(adapters, name) {
  if (typeof adapters?.[name] !== "function") throw new TypeError(`Account erasure adapter ${name} is required`);
  return adapters[name];
}

export async function runAccountErasurePhase(phase, context, adapters) {
  if (!DELETION_PHASES.includes(phase)) throw new Error("Unknown account erasure phase");
  const userId = String(context?.userId || "");
  const accountEmail = String(context?.accountEmail || "").trim().toLowerCase();
  if (!userId || !accountEmail.includes("@")) throw new Error("Verified deletion identity is required");
  const summary = { phase, deleted: 0, anonymized: 0, retained: 0 };
  const collect = result => {
    summary.deleted += Number(result?.deleted || 0);
    summary.anonymized += Number(result?.anonymized || 0);
    summary.retained += Number(result?.retained || 0);
  };

  if (phase === "social_content") {
    collect(await requireAdapter(adapters, "deleteOwnedSocialContent")({ userId, accountEmail }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.comments, { userId, accountEmail }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.reactions, { userId, accountEmail, actorUserId: userId }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.notifications, { userEmail: accountEmail, actorEmail: accountEmail }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.stories, { userEmail: accountEmail }));
  } else if (phase === "connections_and_groups") {
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.friends, { userEmail: accountEmail, friendEmail: accountEmail }));
    collect(await requireAdapter(adapters, "removeGroupMemberships")({ userId, accountEmail }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.calls, { recipientEmail: accountEmail, senderEmail: accountEmail }));
  } else if (phase === "professional_tools") {
    collect(await requireAdapter(adapters, "deleteProfessionalData")({ userId, accountEmail }));
  } else if (phase === "private_account_data") {
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.settings, { userEmail: accountEmail }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.profileNames, { userEmail: accountEmail }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.presence, { email: accountEmail }));
    collect(await requireAdapter(adapters, "deleteWhere")(ACCOUNT_TABLES.pushSubscriptions, { userEmail: accountEmail }));
  } else if (phase === "shared_conversations") {
    collect(await requireAdapter(adapters, "migrateSharedConversations")({
      userId,
      accountEmail,
      tombstoneEmail: deletedMemberAddress(userId),
      conversationId
    }));
  } else if (phase === "media") {
    for (const prefix of accountMediaPrefixes(accountEmail)) collect(await requireAdapter(adapters, "deleteMediaPrefix")(prefix));
  } else if (phase === "sessions_and_identity") {
    collect(await requireAdapter(adapters, "deleteSessions")({ userId }));
    collect(await requireAdapter(adapters, "deleteIdentity")({ userId }));
  }
  return summary;
}
