# Notification push hardening plan

Status: **PLAN ONLY — OWNER REVIEW REQUIRED BEFORE CODE OR AWS CHANGES**  
Issue: [#20](https://github.com/danzstak/danzstak-web/issues/20)

## Evidence and root cause

- `infrastructure/call-signaling/template.yaml` owns Web Push subscriptions, encryption, localization and delivery. It currently sends push for calls, direct messages and friend requests.
- `infrastructure/auth-api/index.mjs` owns durable reaction, comment, reply and tag notifications. It writes those records to the engagement-notification table but never asks the Web Push service to deliver them.
- `assets/feed-enhancements.js` correctly merges social and engagement notices in the in-app Notifications screen. `service-worker.js` safely displays and deep-links a received push. The missing link is server-to-server delivery after an engagement notification is durably written.
- A browser-only patch cannot solve this: closed/background PWAs need a server push. Do not claim the installed phone is alerted until a real provider accepts the push and a real device displays it.

## Proposed implementation

### Phase 1 — transactionally durable private push outbox (1–2 days)

1. In the same DynamoDB transaction that creates the durable engagement notification, write a bounded outbox record keyed by the notification event ID. A committed in-app notification can therefore never exist without its recoverable push intent. Pass only routing metadata: recipient account key, notification type, actor member ID, post ID and event ID. Do not store post/comment text, email addresses or session data in the outbox.
2. Enable a DynamoDB Stream on the notification table and let a small dispatcher publish new outbox records to an encrypted FIFO SQS queue with the event ID as its deduplication and message-group key. Add a dead-letter queue and alarm. A dispatcher crash or SQS outage leaves the outbox record replayable; an observable reconciliation job re-enqueues records that have no dispatch receipt after a bounded interval.
3. Let the existing signaling Lambda consume the queue and reuse its Web Push subscription, localization and stale-endpoint cleanup code. Before provider delivery, conditionally claim a durable delivery-ledger record by event ID. Replayed queue records that already reached a terminal state are acknowledged without another provider request.
4. Do not claim impossible end-to-end exactly-once phone delivery. The internal pipeline is at-least-once with durable deduplication. A worker crash after provider acceptance but before recording success can retry; the same event ID is also the service-worker notification `tag`, so supported devices replace the prior alert rather than stacking it. Record provider acceptance separately from device display, which only physical-device evidence can prove.
5. Deep-link only to a validated same-origin post route. Opening the link must pass the same signed-in authorization and current audience/block checks as opening the post normally.

Likely files: `infrastructure/call-signaling/template.yaml`, `infrastructure/auth-api/template.yaml`, `infrastructure/auth-api/index.mjs`, deployment parameter wiring, and focused infrastructure/domain tests.

### Phase 2 — user control and honest states (1 day)

1. Add an explicit, easily reversible **Activity alerts** setting beside the existing call/message alert controls. Browser notification permission or an existing call/message subscription is not consent for this new category. Existing members and subscriptions default Activity alerts to off until the member enables it; never trigger a permission prompt from background code.
2. Default lock-screen copy to a generic privacy-safe label such as “New DanzStak activity.” Actor names are a separate opt-in detail preference and post/comment bodies are never included.
3. Enforce both preferences in the signaling Lambda immediately before delivery. Keep in-app notifications independent so disabling phone alerts does not hide account activity.
4. Recheck the post's current audience and the blocked relationship at delivery time. If access changed after creation, mark the delivery suppressed and fail closed rather than alerting the recipient.

Likely files: settings API/schema in `infrastructure/call-signaling/template.yaml`, the existing device-settings UI/localization, and alert-preference tests.

### Phase 3 — staging and real-device proof (1 day plus owner/device availability)

1. Use two controlled accounts: create reaction, comment, reply and tag events; confirm one durable in-app notice and one provider-accepted push per event.
2. Verify Android Chrome and installed Android PWA in foreground, background and locked-screen states. Test eligible installed iPhone PWA separately and record the exact OS/browser limitations.
3. Tap each notification and verify the correct post opens after authentication. Test stale/removed/private posts, denied permission, expired subscriptions, retry, duplicate queue delivery and blocked users.
4. Confirm no post/comment body, email address or private identifier appears in queue logs, lock-screen copy or public URLs.
5. Re-run the call-notification path for both **voice and video** on two real accounts and two real devices: camera/microphone permission, incoming alert, answer/decline, remote video in both directions, two-way audible voice, mute/camera controls, hangup, network loss and complete media cleanup. Browser automation may prove signaling/UI state, but it is not accepted as proof that a physical video call works.

## Reliability, cost and rollback

- The transactional outbox separates durable feed writes from provider latency without introducing a notification-commit/SQS-send loss window. DynamoDB Streams and FIFO SQS provide bounded replay; the delivery ledger, reconciliation path and dead-letter alarm make failures observable.
- Batch the queue consumer and cap concurrency so a burst of reactions cannot exhaust Lambda or provider capacity. Apply the existing endpoint cleanup for HTTP 404/410 responses.
- Expected early-stage SQS/Lambda request cost is small, but current `us-west-1` pricing and expected event volume must be recorded before deployment. No paid service or production stack change occurs without owner approval.
- Rollback disables the stream dispatcher and queue consumer while leaving durable in-app notifications unchanged. Outbox records remain recoverable if the owner later re-enables delivery.

## Required tests

- one DynamoDB transaction produces the engagement notification and its bounded outbox record, or neither;
- a simulated crash after notification commit but before queue publication is recovered by stream replay or reconciliation;
- duplicate stream records and duplicate queue messages make at most one active delivery claim;
- a worker crash after Web Push provider acceptance is retried with the same event ID/tag and is reported honestly as provider-accepted rather than proven device-displayed;
- reaction removal produces no new push;
- blocked users, private/inaccessible posts and disabled Activity alerts produce no push;
- existing subscribers remain opted out of Activity alerts until they explicitly enable the category;
- generic lock-screen copy is the default and actor-name disclosure requires its own opt-in;
- unsafe/private copy and unvalidated deep links never reach the service worker;
- stale subscriptions are deleted; temporary provider failures retry and reach the DLQ after the configured limit; a controlled replay does not bypass the durable delivery ledger;
- existing call, direct-message and friend-request push tests remain green;
- complete `test-regressions.ps1`, infrastructure validation and service-worker tests pass;
- browser notification-click tests plus real installed-phone staging evidence are attached before any release.
- voice and video call notification entry remains green, including actual two-device camera and two-way-audio evidence rather than DOM-only assertions.

## Acceptance boundary

Code completion is not product completion. Issue #20 remains open until a staging build proves an in-app activity event from one controlled member becomes exactly one phone alert for another controlled member, with correct deep linking and privacy, on actual supported devices. No production deployment is included in this plan.
