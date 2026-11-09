# DANZSTAK Release Checklist

Copy this file into the release record or complete a versioned release-specific copy. Do not replace unknown results with assumptions.

## Release identity

- Release name/version: `________________`
- Release owner: `________________`
- Date: `________________`
- Branch: `________________`
- Reviewed commit SHA: `________________`
- Production commit SHA: `NOT DEPLOYED`
- Deployment timestamp (UTC): `NOT DEPLOYED`
- AWS deployment job/ID: `NOT DEPLOYED`
- PWA cache version: `________________`
- Rollback commit/artifact: `________________`

## Scope

- [ ] Features and fixes are listed.
- [ ] Files, services, data models, and infrastructure affected are listed.
- [ ] Out-of-scope work and known limitations are listed.
- [ ] No unrelated unfinished work is included.
- [ ] Security, privacy, payment, email, and migration risks were reviewed.

Changed features:

`________________________________________________________________`

Known issues and blockers:

`________________________________________________________________`

## Test 1 — functional

- [ ] Every changed control and workflow was exercised.
- [ ] Success, empty, loading, network-failure, permission, and retry states were checked.
- [ ] Persistence was verified by reading saved state after reload/sign-in where applicable.
- [ ] Account isolation and authorization were tested where applicable.
- [ ] A regression test was added for every fixed defect where practical.
- [ ] Payments used Stripe Test Mode only; no real charge was created.
- [ ] Email tests used controlled recipients; no unsolicited message was sent.

Commands/tests and results:

`________________________________________________________________`

## Test 2 — visual and accessibility

- [ ] Affected pages were rendered in a real browser.
- [ ] 320, 360, 375, 390, 414, 430, 768, and 1024px widths were checked.
- [ ] A representative desktop width was checked.
- [ ] No horizontal overflow, clipped content, overlapping primary screens, or unexpected wrapping remains.
- [ ] Images and video preserve the intended aspect ratio and grid alignment.
- [ ] Keyboard focus, labels, touch targets, and destructive confirmations were checked.
- [ ] Mobile screenshots were compared with the approved professional quality benchmark.

Screenshot/evidence paths:

`________________________________________________________________`

## Test 3 — integration and security

- [ ] `./test-regressions.ps1` passed.
- [ ] Authentication and session behavior passed where affected.
- [ ] Feed, Chat, notifications, and media passed where affected.
- [ ] Stripe, entitlements, refunds, and idempotency passed where affected.
- [ ] Booking Agent, EPK, and Tour Manager passed where affected.
- [ ] Service-worker and cache compatibility passed.
- [ ] Secret scanning/log review found no credential or private-data exposure.

Failures or tests not run:

`________________________________________________________________`

## Release decision

- [ ] All required tests passed.
- [ ] No critical or high defect remains.
- [ ] Medium/low known issues have owners and follow-up records.
- [ ] Rollback is possible and documented.
- [ ] **APPROVED TO DEPLOY** by: `________________`

If any required item above is unchecked, status is **NO TEST PASS, NO DEPLOY**.

## Deployment

- [ ] The exact reviewed commit was built.
- [ ] The established AWS deployment workflow succeeded.
- [ ] The deployed commit and build version were verified.
- [ ] Amplify/CDN delivery and cache headers were verified.
- [ ] Service-worker activation and PWA cache migration were verified.
- [ ] User drafts/offline data were preserved.

Deployment evidence:

`________________________________________________________________`

## Test again — production

- [ ] Website availability and core pages passed.
- [ ] Authentication passed with a controlled account.
- [ ] Feed loaded and controlled post persistence passed when in scope.
- [ ] Chat and notifications passed with controlled accounts when in scope.
- [ ] Media rendered correctly on mobile and desktop.
- [ ] Booking Agent, EPK, and Tour Manager smoke tests passed when in scope.
- [ ] Stripe webhook health was verified without a real charge.
- [ ] Android Chrome/installed PWA passed or is explicitly marked **NOT TESTED**.
- [ ] iPhone Safari/installed PWA passed or is explicitly marked **NOT TESTED**.
- [ ] Production logs and service health show no release regression.

Production evidence and device results:

`________________________________________________________________`

## Closure or rollback

- Final status: `COMPLETE / ROLLED BACK / BLOCKED`
- Rollback procedure used or ready: `________________`
- Follow-up issues: `________________`
- Development report updated: `YES / NO`
