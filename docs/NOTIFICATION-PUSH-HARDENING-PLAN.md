# Notification push hardening plan

Status: **PLAN ONLY — OWNER REVIEW REQUIRED BEFORE CODE OR AWS CHANGES**  
Issue: [#20](https://github.com/danzstak/danzstak-web/issues/20)

## Evidence and root cause

- `infrastructure/call-signaling/template.yaml` owns Web Push subscriptions, encryption, localization and delivery. It currently sends push for calls, direct messages and friend requests.
- `infrastructure/auth-api/index.mjs` owns durable reaction, comment, reply and tag notifications. It writes those records to the engagement-notification table but never asks the Web Push service to deliver them.
- `assets/feed-enhancements.js` correctly merges social and engagement notices in the in-app Notifications screen. `service-worker.js` safely displays and deep-links a received push. The missing link is server-to-server delivery after an engagement notification is durably written.
- A browser-only patch cannot solve this: closed/background PWAs need a server push. Do not claim the installed phone is alerted until a real provider accepts the push and a real device displays it.

## Proposed implementation

### Phase 1 — durable private push outbox (1–2 days)

1. Add one encrypted-at-rest SQS queue and dead-letter queue to the existing signaling infrastructure. Pass only bounded routing metadata: recipient account key, notification type, actor member ID, post ID and event ID. Do not put post/comment text, email addresses or session data in the queue.
2. Grant the Auth API only `sqs:SendMessage` to that queue. After the engagement notification write succeeds, enqueue one event with a deterministic deduplication key. A queue failure must not roll back the in-app notification.
3. Let the existing signaling Lambda consume the queue and reuse its Web Push subscription, localization and stale-endpoint cleanup code. Use neutral lock-screen copy such as “Mary interacted with your post”; never expose private post/comment content.
4. Use the existing event ID as the notification tag so provider/Lambda retries replace the same alert rather than creating duplicates. Deep-link only to the validated same-origin post route.

Likely files: `infrastructure/call-signaling/template.yaml`, `infrastructure/auth-api/template.yaml`, `infrastructure/auth-api/index.mjs`, deployment parameter wiring, and focused infrastructure/domain tests.

### Phase 2 — user control and honest states (1 day)

1. Add an **Activity alerts** setting beside the existing call/message alert controls. Default it on only for a member who has explicitly enabled browser notifications; never trigger a permission prompt from background code.
2. Enforce the setting in the signaling Lambda before delivery. Keep in-app notifications independent so disabling phone alerts does not hide account activity.
3. Keep blocked-member enforcement at notification creation and delivery. If a relationship changes before queue consumption, fail closed rather than alerting the recipient.

Likely files: settings API/schema in `infrastructure/call-signaling/template.yaml`, the existing device-settings UI/localization, and alert-preference tests.

### Phase 3 — staging and real-device proof (1 day plus owner/device availability)

1. Use two controlled accounts: create reaction, comment, reply and tag events; confirm one durable in-app notice and one provider-accepted push per event.
2. Verify Android Chrome and installed Android PWA in foreground, background and locked-screen states. Test eligible installed iPhone PWA separately and record the exact OS/browser limitations.
3. Tap each notification and verify the correct post opens after authentication. Test stale/removed/private posts, denied permission, expired subscriptions, retry, duplicate queue delivery and blocked users.
4. Confirm no post/comment body, email address or private identifier appears in queue logs, lock-screen copy or public URLs.
5. Re-run the call-notification path for both **voice and video** on two real accounts and two real devices: camera/microphone permission, incoming alert, answer/decline, remote video in both directions, two-way audible voice, mute/camera controls, hangup, network loss and complete media cleanup. Browser automation may prove signaling/UI state, but it is not accepted as proof that a physical video call works.

## Reliability, cost and rollback

- SQS decouples feed writes from provider latency and supplies bounded retries plus a dead-letter trail. The Auth API remains usable if push delivery is unavailable.
- Batch the queue consumer and cap concurrency so a burst of reactions cannot exhaust Lambda or provider capacity. Apply the existing endpoint cleanup for HTTP 404/410 responses.
- Expected early-stage SQS/Lambda request cost is small, but current `us-west-1` pricing and expected event volume must be recorded before deployment. No paid service or production stack change occurs without owner approval.
- Rollback disables the event-source mapping and queue producer while leaving durable in-app notifications unchanged.

## Required tests

- one durable engagement write produces one bounded outbox event;
- repeated delivery is idempotent and does not create multiple visible alerts;
- reaction removal produces no new push;
- blocked users and disabled Activity alerts produce no push;
- unsafe/private copy and unvalidated deep links never reach the service worker;
- stale subscriptions are deleted; temporary provider failures retry and reach the DLQ after the configured limit;
- existing call, direct-message and friend-request push tests remain green;
- complete `test-regressions.ps1`, infrastructure validation and service-worker tests pass;
- browser notification-click tests plus real installed-phone staging evidence are attached before any release.
- voice and video call notification entry remains green, including actual two-device camera and two-way-audio evidence rather than DOM-only assertions.

## Acceptance boundary

Code completion is not product completion. Issue #20 remains open until a staging build proves an in-app activity event from one controlled member becomes exactly one phone alert for another controlled member, with correct deep linking and privacy, on actual supported devices. No production deployment is included in this plan.
