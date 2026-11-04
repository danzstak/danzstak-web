# DANZSTAK Quality Assurance Policy

Status: **MANDATORY**  
Applies to: every DANZSTAK feature, fix, release, infrastructure change, and emergency patch  
Standard: **TEST. TEST. TEST. DEPLOY. TEST AGAIN.**

## Definition of done

A change is not complete because it compiles, exists in Git, or works on one developer's device. It is complete only when:

1. the affected behavior works;
2. the affected interface has been rendered and inspected at the required viewports;
3. connected DANZSTAK workflows still work;
4. deployment evidence identifies the exact released commit;
5. the live site and PWA have been checked after deployment; and
6. no unresolved release-blocking defect remains.

Planned, partially tested, blocked, and development-only work must be labeled honestly. A nonfunctional control, silent failure, overlapping primary mobile screen, broken workflow, security regression, payment error, or material visual defect blocks release.

## The three required test stages

### Test 1: functional

- Exercise every changed control, API, persistence operation, permission boundary, error state, and user workflow.
- Add a regression test for every fixed defect when practical.
- Verify both success and failure paths. Never infer database persistence from a successful UI response.
- Use Stripe Test Mode, controlled mailboxes, synthetic accounts, and isolated data for integration tests. Never create a real charge or send unsolicited outreach.
- Confirm destructive actions and account isolation explicitly.

### Test 2: visual

- Render every affected page in a real browser; source inspection is not visual verification.
- Test at 320, 360, 375, 390, 414, 430, 768, and 1024 CSS pixels, plus a representative desktop width.
- Inspect alignment, typography, touch targets, overflow, safe areas, loading states, media aspect ratios, focus visibility, keyboard behavior, and screen-reader labels.
- Capture evidence for material UI changes and compare the mobile result with the SFScoop PWA quality benchmark.
- Mobile must show one primary screen at a time. Chat, Friends, Notifications, Menu, and professional tools must not overlap.
- Media must align with the feed grid, reactions must keep counts beside their icons, and navigation must remain compact.

### Test 3: integration

- Run the complete local regression suite, not only tests for the changed file.
- Verify authentication, social feed, Chat, notifications, media, Stripe, Booking Agent, EPK, Tour Manager, and PWA behavior wherever the change can affect them.
- Check account isolation, idempotency, retries, provider failures, and network recovery.
- Verify service-worker and hosting-cache compatibility before release.
- A failing critical integration check stops deployment.

## Release severity and gates

| Severity | Meaning | Release action |
| --- | --- | --- |
| Critical | Security/privacy failure, data loss, incorrect payment or entitlement, cross-account exposure, unusable authentication, or primary production outage | Stop or roll back immediately |
| High | Broken core workflow, overlapping mobile screen, inaccessible primary control, persistent send/save failure, or stale PWA preventing the release | Stop deployment |
| Medium | Material defect with a safe workaround | Document, assign an owner, and obtain release approval |
| Low | Minor cosmetic or nonblocking issue | Document and schedule |

No critical or high failure may be waived by a successful build.

## Pre-deployment gate

The release owner must complete `docs/RELEASE-CHECKLIST.md` and record:

- scope and changed features;
- exact branch and commit;
- functional, visual, integration, security, and accessibility evidence;
- passed, failed, and not-run tests;
- known issues and rollback procedure;
- database or infrastructure migration impact; and
- explicit release decision.

If any required evidence is unavailable, record **NOT TESTED** rather than assuming success.

## Deployment and post-deployment gate

After the pre-deployment gate passes:

1. build the exact reviewed commit;
2. deploy through the established AWS workflow;
3. record the deployment job and timestamp;
4. verify the deployed commit and application version;
5. verify Amplify/CDN delivery and cache headers;
6. verify the service worker, cache version, and installed-PWA update path without deleting user drafts;
7. test the live critical path on mobile and desktop;
8. inspect application errors and service health; and
9. roll back when a critical post-deployment check fails.

CloudFront must not be claimed when the project uses an Amplify-managed CDN and no customer-managed distribution exists.

## Daily production health checks

The scheduled workflow `.github/workflows/daily-production-health.yml` runs `scripts/production-health-check.cjs`. It is deliberately read-only and checks public availability, core page delivery, PWA manifest validity, service-worker delivery/cache identity, versioned feed assets, and public professional-tool shells.

The monitor:

- uses only safe HTTP GET requests;
- has read-only repository permissions;
- contains no payment, email-send, post-creation, database-write, or account-mutation operation;
- fails the workflow when a critical public check fails, allowing normal GitHub Actions failure notifications to alert maintainers; and
- can be run manually before and after a release.

The same workflow contains an opt-in authenticated job that runs `scripts/authenticated-production-health-check.cjs`. It requires two owner-approved, isolated synthetic accounts whose 64-character mobile session tokens are stored only in the `DANZSTAK_SYNTHETIC_SESSION_A` and `DANZSTAK_SYNTHETIC_SESSION_B` repository secrets. The job remains disabled unless the repository variable `DANZSTAK_AUTHENTICATED_HEALTH_ENABLED` is exactly `true`.

When enabled, the authenticated monitor verifies two independent sessions, creates a private synthetic post, reads it back, sends a uniquely marked Chat message between the two synthetic friends, observes the recipient notification, removes the message for both accounts, removes the post, and verifies both removals. Cleanup also runs after failures. It does not create Checkout Sessions, charge a card, send email, use real customer accounts, or publish synthetic content.

Authenticated EPK persistence, Booking Agent account state, and Tour Manager account state are **NOT YET INCLUDED** in the daily monitor. The two isolated accounts and their repository secrets must be provisioned and the opt-in variable enabled before sign-in, post, Chat and notification coverage may be represented as active production monitoring. Until then, those checks remain mandatory release checks.

Stripe daily monitoring must never create a Checkout Session or charge. Signed webhook processing, entitlement changes, refunds, and email delivery are tested in controlled Test Mode release tests, not by the public daily monitor.

## Defect handling and continuous improvement

For every material defect:

1. reproduce it and preserve evidence;
2. identify the root cause rather than stacking a conflicting workaround;
3. fix the underlying problem;
4. add a regression test where practical;
5. repeat functional, visual, and integration testing;
6. deploy only after gates pass; and
7. verify the live correction.

Temporary mitigations must have an owner, removal condition, and tracked follow-up. Repeated CSS overrides without resolving the originating layout constraint are not an acceptable final fix.

## Evidence and truthful reporting

`docs/DANZSTAK-DEVELOPMENT-REPORT.md` is the factual status record. Use only **COMPLETE**, **IN PROGRESS**, **BLOCKED**, and **NOT STARTED**. Reports must distinguish local, isolated AWS Test Mode, staging, and production evidence. Never publish secrets, tokens, private user data, webhook signing secrets, or customer messages.

This policy is permanent. Exceptions require an explicit owner decision recorded in the release checklist; critical security, privacy, payment, or data-integrity gates cannot be waived.
