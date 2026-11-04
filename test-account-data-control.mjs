import assert from "node:assert/strict";
import {
  DELETION_CONFIRMATION,
  DELETION_PHASES,
  RETENTION_EXCEPTIONS,
  beginDeletionPhase,
  cancelDeletionRequest,
  completeDeletionPhase,
  createDeletionRequest,
  deletionRequestKey,
  publicDeletionStatus
} from "./infrastructure/auth-api/account-data-control.mjs";

const requestedAt = 1_800_000_000;
const request = createDeletionRequest({
  userId: "cognito-user-1",
  accountEmail: "Owner@Example.com",
  confirmation: DELETION_CONFIRMATION,
  proofVerified: true,
  requestId: "d27a1d17-3c85-4d90-a1c2-5f3c0beff112",
  now: requestedAt
});

assert.equal(request.accountEmail, "owner@example.com");
assert.equal(request.status, "request_received");
assert.equal(publicDeletionStatus(request, requestedAt).label, "Request received");
assert.equal(publicDeletionStatus(request, requestedAt).canCancel, true);
assert.equal(beginDeletionPhase(request, requestedAt).phase, null, "grace period must block processing");
assert.match(deletionRequestKey("cognito-user-1"), /^account-deletion:[a-f0-9]{64}$/);
assert.ok(RETENTION_EXCEPTIONS.some(item => item.category.includes("Messages")));

assert.throws(() => createDeletionRequest({
  userId: "cognito-user-1",
  accountEmail: "owner@example.com",
  confirmation: DELETION_CONFIRMATION,
  proofVerified: false,
  now: requestedAt
}), /Recent account verification/);
assert.throws(() => createDeletionRequest({
  userId: "cognito-user-1",
  accountEmail: "owner@example.com",
  confirmation: "delete",
  proofVerified: true,
  now: requestedAt
}), /phrase does not match/);

const cancelled = cancelDeletionRequest(request, requestedAt + 60);
assert.equal(cancelled.status, "cancelled");
assert.throws(() => cancelDeletionRequest(request, request.graceEndsAt), /can no longer/);

let active = request;
for (const expectedPhase of DELETION_PHASES) {
  const claim = beginDeletionPhase(active, active.graceEndsAt + active.phaseIndex + 1);
  assert.equal(claim.phase, expectedPhase);
  active = completeDeletionPhase(claim.request, claim.phase, claim.request.updatedAt + 1);
}
assert.equal(active.status, "completed_limited_retention");
assert.ok(active.completedAt);
assert.equal(publicDeletionStatus(active, active.completedAt).label, "Completed — limited retention");
assert.throws(() => completeDeletionPhase(request, "media", requestedAt), /stale or out of order/);

console.log("Account data-control checks passed: reauth, confirmation, grace, cancellation, ordered resumable phases, completion, and retention disclosure.");
