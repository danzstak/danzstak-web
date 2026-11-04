# DanzStak account data control

Status: **IN PROGRESS — development design and security foundation only**

This document describes the deletion contract being implemented for GitHub Issue #32. It is not a claim that account deletion is currently available in production.

## Member workflow

1. A signed-in member downloads their portable export before deletion if desired.
2. The member explicitly starts account deletion and signs in again through Cognito.
3. DanzStak binds a one-use ten-minute proof to the same Cognito subject.
4. The member enters `DELETE MY DANZSTAK ACCOUNT` in a separate destructive confirmation.
5. The server records the request atomically and starts a seven-day grace period.
6. The member can cancel during the grace period.
7. A resumable worker processes ordered deletion phases after the grace period.
8. The member receives a receipt that distinguishes active deletion from limited retention.

The UI must use the factual statuses `Request received`, `In progress`, `Completed`, or `Completed — limited retention`. It must never imply that an unprocessed request has erased data.

## Ordered erasure phases

1. Social content owned by the member, plus their comments and reactions.
2. Friend relationships and group memberships, without deleting other members or group content they own.
3. Tours, booking workspaces, EPKs, unpublished shares, and other professional-tool data.
4. Profile, settings, presence, push subscriptions, device state, and other private account data.
5. Conversation state and message reactions; delivered messages retained for another participant are anonymized.
6. Member-owned media and derived copies.
7. Sessions, pending authentication state, and Cognito identity.

Every phase must be idempotent, store progress, retry bounded failures, and resume without repeating destructive side effects.

The source-level orchestration is implemented in `infrastructure/auth-api/account-erasure.mjs`. It intentionally delegates persistence to audited adapters so tests can prove ordering and coverage without touching production accounts. The DynamoDB, S3, and Cognito adapters and scheduled worker must be complete before the routes are deployed.

## Limited-retention exceptions

| Category | Treatment | Maximum / review rule |
|---|---|---|
| Payment and refund records | Minimized and retained only for tax, fraud, chargeback, and accounting obligations. | Applicable legal limitation period. |
| Safety, abuse, and legal reports | Access-restricted retention only when necessary to protect members, investigate abuse, or comply with law. | Case-specific; reviewed when the purpose ends. |
| Messages delivered to another member | The remaining participant's copy is retained with the deleted account identity replaced by a non-identifying tombstone. | Until the remaining participant deletes their copy. |
| Encrypted backups and CDN caches | Never restored to the active service and removed through the normal backup/cache expiry cycle. | 35 days. |

This table must be reviewed against actual AWS backup, CloudFront, Stripe, SES, and provider policies before production activation. If a real retention window is longer, the product disclosure must be corrected rather than understated.

## Security invariants

- Current session plus fresh Cognito authentication are both required.
- The reauthentication proof is HttpOnly, Secure, SameSite=Lax, one-use, user-bound, and expires after ten minutes.
- The exact confirmation phrase is validated server-side.
- Proof consumption and request creation are one DynamoDB transaction.
- Mutations require a trusted DanzStak Origin.
- Request status never exposes the account email or raw provider identifiers.
- Production accounts are never used for automated erasure tests.

## Release gate

Do not expose the Settings deletion control or deploy these routes until the erasure executor, export completeness, synthetic multi-account tests, staging UI, accessibility checks, and rollback/incident procedures are complete.
