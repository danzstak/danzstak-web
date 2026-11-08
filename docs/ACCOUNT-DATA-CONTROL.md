# DanzStak account data control

Status: **IN PROGRESS — development design and security foundation only**

This document describes the deletion contract being implemented for GitHub Issue #32. It is not a claim that account deletion is currently available in production.

## Member workflow

1. A signed-in member downloads their portable export before deletion if desired.
2. The member explicitly starts account deletion and signs in again through Cognito.
3. DanzStak binds a one-use ten-minute proof to the same Cognito subject.
4. The member enters `DELETE MY DANZSTAK ACCOUNT` in a separate destructive confirmation.
5. The server records the permanent request atomically and makes it immediately eligible for the erasure worker. There is no mandatory grace period and no restore path.
6. A resumable worker processes the ordered deletion phases until completion.
7. The member receives a receipt that distinguishes active deletion from limited retention.

The UI must use the factual statuses `Request received`, `In progress`, `Completed`, or `Completed — limited retention`. It must never imply that an unprocessed request has erased data.

## Ordered erasure phases

1. Social content owned by the member, every dependent DanzStak reshare and placement, related notifications/indexes, plus their comments, reactions, and reviews. No deleted-content placeholder remains.
2. Friend relationships and group memberships, without deleting other members or group content they own.
3. Tours, booking workspaces, EPKs, unpublished shares, and other professional-tool data.
4. Profile, settings, presence, push subscriptions, device state, and other private account data.
5. Conversation state and message reactions. Messages and media authored by the deleting member are removed; another participant's independently authored messages remain that participant's content with the deleted recipient identity anonymized.
6. Member-owned media and derived copies.
7. A final consistency sweep repeats the active-data and media phases after every account session has been revoked, catching any write that was already in flight when the member confirmed deletion.
8. Sessions, pending authentication state, and Cognito identity.

Every phase must be idempotent, store progress, retry bounded failures, and resume without repeating destructive side effects.

The source-level orchestration is implemented in `infrastructure/auth-api/account-erasure.mjs`. It intentionally delegates persistence to audited adapters so tests can prove ordering and coverage without touching production accounts. `infrastructure/auth-api/account-erasure-dynamodb.mjs` implements the DynamoDB, S3, and Cognito operations and is tested with synthetic service state. The scheduled worker, least-privilege deployment policy, and isolated AWS integration test must be complete before the routes are deployed.

## Limited-retention exceptions

| Category | Treatment | Maximum / review rule |
|---|---|---|
| Payment and refund records | Minimized and retained only for tax, fraud, chargeback, and accounting obligations. | Applicable legal limitation period. |
| Safety, abuse, and legal reports | Access-restricted retention only when necessary to protect members, investigate abuse, or comply with law. | Case-specific; reviewed when the purpose ends. |
| Messages authored by another member | The other participant's independently authored messages remain their content with the deleted recipient identity replaced by a non-identifying tombstone. Messages and media authored by the deleting member are removed. | Until the remaining participant deletes their own copy. |
| Encrypted backups and CDN caches | Never restored to the active service and removed through the normal backup/cache expiry cycle. | 35 days. |

This table must be reviewed against actual AWS backup, CloudFront, Stripe, SES, and provider policies before production activation. If a real retention window is longer, the product disclosure must be corrected rather than understated.

## Security invariants

- Current session plus fresh Cognito authentication are both required.
- The reauthentication proof is HttpOnly, Secure, SameSite=Lax, one-use, user-bound, and expires after ten minutes.
- The exact confirmation phrase is validated server-side.
- Proof consumption and request creation are one DynamoDB transaction.
- Confirmation revokes every browser and native session and clears the current browser cookies before returning.
- Existing sessions and native exchange codes are refused while a permanent deletion request is active; a new Cognito login cannot recreate the account session.
- Mutations require a trusted DanzStak Origin.
- Request status never exposes the account email or raw provider identifiers.
- Production accounts are never used for automated erasure tests.

## Release gate

Do not expose the Settings deletion control or deploy these routes until the erasure executor, export completeness, synthetic multi-account tests, staging UI, accessibility checks, and rollback/incident procedures are complete.
