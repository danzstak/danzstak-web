# DanzStak unified mobile/SYNC/Booking release candidate

Status: **STAGING VERIFIED — NO TEST PASS, NO PRODUCTION DEPLOY**  
Prepared: 2026-11-08  
Release owner: Shawn  
Branch: `codex/release-candidate-2026-11-08`  
Reviewed implementation: `c5267b681f41c3a01d108b1c5013a19942a5fc31`
Base/rollback commit: `04d41cccea19da3999e2ae69845532ce32b16e3f`  
PWA cache: `danzstak-shell-v764`
Production commit/deployment: **UNCHANGED / NOT DEPLOYED**

## Scope

- [x] Compact phone header, labeled Pivot entry points, Dailies presentation and fluid Feed layout.
- [x] Feed media coordinator: silent startup, one audible player, viewport pause/handoff and background pause.
- [x] SYNC foreground-call recovery and controlled two-party audio/video call path.
- [x] Signed-in device/session security controls.
- [x] Reconciled Booking workspace, route research, venue selection and tour-cost presentation.
- [x] Versioned PWA assets and service-worker cache assertions.
- [x] Functional Friends workflow: accept, remove with confirmation, discover and send request, with 44px controls at phone, tablet and desktop widths.
- [x] Review screenshots and factual development-report evidence.
- [x] Dailies uses the member's real profile photo as full rounded-square artwork with no exposed backing panel; the compact date/Scene/Take clapper is fully over the lower-left of the image.
- [x] Legacy/local profile identities recover the member's real Dailies and composer photo from same-device profile media or an owned saved post instead of displaying a generic `D`.
- [x] The optional phone notification prompt is a compact touch-safe strip above the bottom navigation instead of covering the Feed.
- [x] Public EPKs keep the booking page clean when the optional Reviews service is empty or unavailable; real reviews and the eligible member composer remain available when their verified data loads.
- [x] Public EPK media starts as fast provider link cards; a booker explicitly loads one external player, backgrounding unloads it, and no provider frame receives autoplay permission.

Affected surfaces are static HTML/CSS/browser JavaScript, regression/browser checks, PWA cache metadata, Booking infrastructure source already present in the reviewed branch, and documentation. No production stack, database migration, live Stripe configuration, live email configuration or production branch changed during this review.

Out of scope and still required:

- audible ringing, speaker routing and intelligible conversation on the owner's physical phones;
- installed Android PWA and iPhone Safari/PWA acceptance;
- production merge/deployment and post-production smoke testing;
- claims that headless WebRTC proves carrier-network or every NAT path;
- live Stripe charges or unsolicited booking email.

## Test 1 — functional

- [x] Complete `test-regressions.ps1` gate passed at the implementation head.
- [x] Success and controlled empty/error/retry states were exercised by the focused Feed, Pivot, Roll, account-security and Booking browser suites.
- [x] Controlled two-browser SYNC call completed offer, answer, bidirectional audio/video tracks, connected controls and hangup cleanup.
- [x] Media coordinator verified startup silence, a single audible player, viewport handoff and page-background pause.
- [x] Stripe coverage remained Test Mode regression coverage; no real charge was created.
- [x] No booking outreach or unsolicited email was sent.
- [ ] Physical-device ringing and conversation quality — **OWNER PHONE GATE PENDING**.

## Test 2 — visual and accessibility

- [x] Core social mobile passed 36 page/viewport combinations on staging, including Settings and the open Menu at every phone width.
- [x] Friends passed the stateful workflow and fluid-layout gate at 320, 360, 390, 430, 768 and 1366px on local and hosted staging.
- [x] Pivot/Profile Pivot passed at 320, 360, 390, 414, 430 and 1366px.
- [x] The Roll passed at 320, 360, 390, 414, 430 and 1366px.
- [x] Account security passed at 320, 360, 390, 414, 430, 768, 1024 and 1366px.
- [x] Booking passed at 320, 360, 390, 430, 768 and 1366px.
- [x] Dailies portrait/clapper geometry passed locally and on hosted staging at 320, 360, 390, 414, 430 and 1366px. The gate rejects a gray/white backing box and rejects any clapper positioned beside or below the portrait.
- [x] Public EPKs passed all four genre looks at 390 and 1366px with the optional Reviews failure surface absent. The successful Reviews path separately passed at 320, 360, 390, 414, 430 and 1366px.
- [x] Public EPK media passed all four looks at 390 and 1366px with zero eager iframes; the Techno 390px interaction loaded exactly one frame and removed it on page hide.
- [x] Automated checks found no release-blocking horizontal overflow, clipped primary action or overlapping primary mobile screen in the tested matrices.
- [x] Representative 320px Home, 390px SYNC, 320px Moving Day, 320px Roll and 390px media-coordinator captures were visually inspected.
- [ ] A separate hosted 375px capture was not generated by every focused suite. Shared 375px responsive checks pass in the full regression gate, but this is not represented as equivalent to physical-device acceptance.

Evidence: `docs/screenshots/release-candidate/`, including `core-social-fluid-settings/` and `friends-fluid/`, plus `docs/screenshots/issue-55-booking-workspace/`, `docs/screenshots/issue-78-account-security/` and `docs/screenshots/roll-launcher-pointer/`.

## Test 3 — integration, security and staging

- [x] GitHub Review checks run `42515111340` concluded `success` at exact reviewed branch head `c5267b681f41c3a01d108b1c5013a19942a5fc31`.
- [x] Feed, Friends, Notifications, Profile, SYNC, Pivot, The Roll, Booking and EPK shells returned HTTP 200 from staging.
- [x] Delivered Feed assets include mobile-design CSS `v17`, Feed art-direction CSS `v28`, Feed enhancement CSS `v508`, Feed enhancement JavaScript `v540`, Pivot `v2`, alert CSS `v236`, and PWA bootstrap `v428`.
- [x] Delivered service worker reports `danzstak-shell-v764`; no-cache probes confirm the matching current Feed assets.
- [x] A fresh hosted browser context registered and activated the staging service worker, created the versioned shell cache, and controlled the next page load without clearing user storage.
- [x] Required authentication, account-isolation, accessibility, link/privacy, Booking, EPK, Tour Manager, Stripe Test Mode and PWA regressions passed in the full gate.
- [x] No credential, password, session token, webhook secret or private customer data is recorded in the branch evidence.
- [x] Amplify DEVELOPMENT job `70` deployed exact reviewed head `c5267b681f41c3a01d108b1c5013a19942a5fc31`; no-cache hosted probes return `danzstak-shell-v764` and the matching current Feed assets. The Dailies fallback and compact-alert browser matrices passed directly against the hosted review origin. The staging branch remains separate from production.

Staging PWA: <https://review.danzstak.com/feed.html?release=c5267b6>

## Release decision

- [x] Local and hosted automated gates are green.
- [x] No automated release-blocking defect remains in the tested scope.
- [x] Rollback target is the unchanged production/base commit `04d41cccea19da3999e2ae69845532ce32b16e3f`.
- [ ] Owner installed-PWA/phone walkthrough.
- [ ] Owner go/no-go.
- [ ] Approved to merge/deploy production.

Decision: **HOLD — production remains unchanged until the owner tests the staging PWA on a phone and explicitly gives a go.**

## Required owner walkthrough

1. Open/install the staging PWA and confirm the current shell replaces any older cached staging build.
2. Walk Home → Friends → SYNC → Notifications → Profile → Booking and confirm one primary screen at a time.
3. Start a voice call in both directions and confirm audible incoming ring, microphone, speaker routing and intelligible conversation.
4. Start a video call in both directions and confirm local/remote video, mute/camera controls and clean hangup.
5. Play/unmute one Feed video, scroll to another and confirm no overlapping or background audio.
6. Open Pivot/Moving Day, The Roll, account security and Booking; report any clipped, crowded or confusing control.

Production verification, Android/iPhone installed-PWA results and final status remain **NOT TESTED** until that walkthrough and an authorized production release occur.
