import { createHash, randomUUID } from "node:crypto";

export const DELETION_CONFIRMATION = "DELETE MY DANZSTAK ACCOUNT";
export const DELETION_GRACE_SECONDS = 7 * 24 * 60 * 60;

export const DELETION_PHASES = Object.freeze([
  "social_content",
  "connections_and_groups",
  "professional_tools",
  "private_account_data",
  "shared_conversations",
  "media",
  "sessions_and_identity"
]);

export const RETENTION_EXCEPTIONS = Object.freeze([
  {
    category: "Payment and refund records",
    treatment: "Minimized and retained when required for tax, fraud, chargeback, and accounting obligations.",
    maximum: "Applicable legal limitation period"
  },
  {
    category: "Safety, abuse, and legal reports",
    treatment: "Access-restricted retention only when needed to protect members, investigate abuse, or comply with law.",
    maximum: "Case-specific; reviewed when the purpose ends"
  },
  {
    category: "Messages delivered to another member",
    treatment: "The other member's copy is retained with the deleted account identity replaced by a non-identifying tombstone.",
    maximum: "Until the remaining participant deletes their copy"
  },
  {
    category: "Encrypted backups and CDN caches",
    treatment: "Not restored to active service and removed by the normal backup/cache expiry cycle.",
    maximum: "35 days"
  }
]);

function epoch(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError("A valid epoch time is required");
  return Math.floor(number);
}

export function deletionRequestKey(userId) {
  if (typeof userId !== "string" || !userId.trim()) throw new TypeError("A user ID is required");
  return `account-deletion:${createHash("sha256").update(userId).digest("hex")}`;
}

export function createDeletionRequest({ userId, accountEmail, confirmation, proofVerified, requestId, now, graceSeconds = DELETION_GRACE_SECONDS }) {
  if (!proofVerified) throw new Error("Recent account verification is required");
  if (confirmation !== DELETION_CONFIRMATION) throw new Error("The account deletion phrase does not match");
  if (typeof accountEmail !== "string" || !accountEmail.includes("@")) throw new Error("A verified account email is required");
  const requestedAt = epoch(now);
  const normalizedRequestId = typeof requestId === "string" && /^[a-f0-9-]{16,64}$/i.test(requestId) ? requestId.toLowerCase() : randomUUID();
  return {
    requestId: normalizedRequestId,
    userId,
    accountEmail: accountEmail.trim().toLowerCase(),
    status: "request_received",
    phaseIndex: 0,
    requestedAt,
    graceEndsAt: requestedAt + Math.max(3600, epoch(graceSeconds)),
    updatedAt: requestedAt,
    completedAt: null,
    failure: null
  };
}

export function publicDeletionStatus(request, now) {
  if (!request) return {
    status: "not_requested",
    label: "No deletion request",
    canCancel: false,
    retentionExceptions: RETENTION_EXCEPTIONS
  };
  const currentTime = epoch(now);
  const status = request.status || "request_received";
  const labels = {
    request_received: "Request received",
    in_progress: "In progress",
    completed: "Completed",
    completed_limited_retention: "Completed — limited retention",
    cancelled: "Cancelled",
    failed: "Needs attention"
  };
  return {
    requestId: request.requestId,
    status,
    label: labels[status] || "In progress",
    requestedAt: request.requestedAt,
    graceEndsAt: request.graceEndsAt,
    completedAt: request.completedAt || null,
    currentPhase: DELETION_PHASES[request.phaseIndex] || null,
    canCancel: status === "request_received" && currentTime < request.graceEndsAt,
    retentionExceptions: RETENTION_EXCEPTIONS
  };
}

export function cancelDeletionRequest(request, now) {
  const currentTime = epoch(now);
  if (!request || request.status !== "request_received" || currentTime >= request.graceEndsAt) {
    throw new Error("This deletion request can no longer be cancelled");
  }
  return { ...request, status: "cancelled", updatedAt: currentTime };
}

export function beginDeletionPhase(request, now) {
  const currentTime = epoch(now);
  if (!request) throw new Error("Deletion request not found");
  if (request.status === "completed" || request.status === "completed_limited_retention") return { request, phase: null };
  if (request.status === "cancelled") throw new Error("Deletion request was cancelled");
  if (currentTime < request.graceEndsAt) return { request, phase: null };
  const phase = DELETION_PHASES[request.phaseIndex];
  if (!phase) return {
    request: { ...request, status: "completed_limited_retention", completedAt: currentTime, updatedAt: currentTime, failure: null },
    phase: null
  };
  return { request: { ...request, status: "in_progress", updatedAt: currentTime, failure: null }, phase };
}

export function completeDeletionPhase(request, phase, now) {
  const expected = DELETION_PHASES[request?.phaseIndex];
  if (!expected || phase !== expected) throw new Error("Deletion phase is stale or out of order");
  const currentTime = epoch(now);
  const nextIndex = request.phaseIndex + 1;
  const complete = nextIndex >= DELETION_PHASES.length;
  return {
    ...request,
    phaseIndex: nextIndex,
    status: complete ? "completed_limited_retention" : "in_progress",
    completedAt: complete ? currentTime : null,
    updatedAt: currentTime,
    failure: null
  };
}

export function failDeletionPhase(request, phase, error, now) {
  if (DELETION_PHASES[request?.phaseIndex] !== phase) throw new Error("Deletion phase is stale or out of order");
  return {
    ...request,
    status: "failed",
    updatedAt: epoch(now),
    failure: String(error?.message || error || "Deletion phase failed").slice(0, 300)
  };
}
