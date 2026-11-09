# DanzStak unified mobile/SYNC/Booking release candidate

Status: **STAGING VERIFIED — NO TEST PASS, NO PRODUCTION DEPLOY**  
Prepared: 2026-11-08  
Release owner: Shawn  
Branch: `codex/release-candidate-2026-11-08`  
Reviewed implementation: `cd590e7`
Base/rollback commit: `04d41cccea19da3999e2ae69845532ce32b16e3f`  
PWA cache: `danzstak-shell-v778`
Production commit/deployment: **UNCHANGED / NOT DEPLOYED**

## Scope

- [x] Compact phone header, labeled Pivot entry points, Dailies presentation and fluid Feed layout.
- [x] Feed media coordinator: silent startup, one audible player, viewport pause/handoff and background pause.
- [x] SYNC foreground-call recovery and controlled two-party audio/video call path.
- [x] Feed foreground call polling and decline authenticate with the registered installation instead of failing behind a generic push alert.
- [x] Signed-in device/session security controls.
- [x] Reconciled Booking workspace, route research, venue selection and tour-cost presentation.
- [x] Versioned PWA assets and service-worker cache assertions.
- [x] Functional Friends workflow: accept, remove with confirmation, discover and send request, with 44px controls at phone, tablet and desktop widths.
- [x] Review screenshots and factual development-report evidence.
- [x] Dailies uses the member's real profile photo as full rounded-square artwork with no exposed backing panel; the compact date/Scene/Take clapper is fully over the lower-left of the image. The visible fallback remains in place until the signed portrait has actually loaded.
- [x] Legacy/local profile identities recover the member's real Dailies and composer photo from same-device profile media or an owned saved post instead of displaying a generic `D`.
- [x] The optional phone notification prompt is a compact touch-safe strip above the bottom navigation instead of covering the Feed.
- [x] Public EPKs keep the booking page clean when the optional Reviews service is empty or unavailable; real reviews and the eligible member composer remain available when their verified data loads.
- [x] Public EPK media starts as fast provider link cards; a booker explicitly loads one external player, backgrounding unloads it, and no provider frame receives autoplay permission.
- [x] One-page EPK press output is exactly one Letter page, keeps the bounded booking essentials, and prints on a clean white page outside the selected artist look.
- [x] Published EPKs hand off to the Booking workspace; a waiting venue reply opens from Booking or Artist HQ in the exact private SYNC Bookings thread.
- [x] An EPK handed to Booking now continues through an explicit **Choose venues** action, which becomes **Add venues** after the artist has selected clubs.
- [x] Sourced Club Finder results can be added directly to the booking list; the visible selected count and **Review selected clubs** continuation open the real saved-venue workspace without requiring the advanced map drawer.
- [x] **Preview exact email** saves the artist's current venue date and pitch first, stops safely if that save fails, then opens the exact recipient/message approval without requiring a long scroll back to account controls.
- [x] **Unlock booking contact · $0.75** saves dirty venue facts before Checkout, waits for the verified webhook entitlement on return, removes payment state from the URL and restores focus to the purchased venue.

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
- [x] Hosted EPK PDF generation produced one page, enforced private-download permissions and passed visual inspection without clipping, overlap, gray application canvas or a second page.
- [ ] Physical-device ringing and conversation quality — **OWNER PHONE GATE PENDING**.

## Test 2 — visual and accessibility

- [x] Core social mobile passed 37 page/viewport combinations on staging, including Settings and the open Menu at every phone width.
- [x] Friends passed the stateful workflow and fluid-layout gate at 320, 360, 390, 430, 768 and 1366px on local and hosted staging.
- [x] Pivot/Profile Pivot passed at 320, 360, 390, 414, 430 and 1366px.
- [x] The Roll passed at 320, 360, 390, 414, 430 and 1366px.
- [x] Account security passed at 320, 360, 390, 414, 430, 768, 1024 and 1366px.
- [x] Booking passed at 320, 360, 390, 430, 768 and 1366px.
- [x] Artist HQ to the exact waiting SYNC booking thread passed at 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px.
- [x] The connected EPK-to-Booking workflow and its primary venue-discovery continuation passed at 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px locally and on hosted staging.
- [x] The primary Club Finder venue-selection matrix and connected EPK → search → select → review journey passed three consecutive local runs plus a hosted run at 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px. The gate verifies direct Add/Remove controls, synchronized state, 44px targets, selected-count visibility and the final saved venue card.
- [x] The selected-venue save-and-preview matrix passed three consecutive local runs plus a hosted run at 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px. It proves failed saves cannot create private EPK shares or email, and successful review preserves exact-recipient approval, 44px targets, one-send behavior and saved status.
- [x] The contact-unlock Checkout/return matrix passed three consecutive local runs plus a hosted run at 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px. It proves save-before-Checkout ordering, delayed-webhook recovery, URL cleanup, exact venue focus, contact visibility, 44px targets and no horizontal overflow.
- [x] Dailies portrait/clapper geometry passed locally and on hosted staging at 320, 360, 390, 414, 430 and 1366px. The gate rejects a gray/white backing box and rejects any clapper positioned beside or below the portrait.
- [x] Public EPKs passed all four genre looks at 390 and 1366px with the optional Reviews failure surface absent. The successful Reviews path separately passed at 320, 360, 390, 414, 430 and 1366px.
- [x] Public EPK media passed all four looks at 390 and 1366px with zero eager iframes; the Techno 390px interaction loaded exactly one frame and removed it on page hide.
- [x] Mix density passed at 320, 360, 390, 414, 430 and 1366px; tablet layout passed at 701, 768, 820, 880 and 1024px; the shared fluid-layout gate passed eleven product surfaces at 390 and 1366px.
- [x] Automated checks found no release-blocking horizontal overflow, clipped primary action or overlapping primary mobile screen in the tested matrices.
- [x] Representative 320px Home, 390px SYNC, 320px Moving Day, 320px Roll and 390px media-coordinator captures were visually inspected.
- [ ] A separate hosted 375px capture was not generated by every focused suite. Shared 375px responsive checks pass in the full regression gate, but this is not represented as equivalent to physical-device acceptance.

Evidence: `docs/screenshots/release-candidate/`, including `core-social-fluid-settings/` and `friends-fluid/`, plus `docs/screenshots/issue-55-booking-workspace/`, `docs/screenshots/issue-78-account-security/` and `docs/screenshots/roll-launcher-pointer/`.

## Test 3 — integration, security and staging

- [x] GitHub Review checks run `42545364309` concluded `success` in all five jobs at exact implementation head `6d7986d726be5b4d2f452ebf2dac08f04c9b965e`; the subsequent `f0fe3d2` commit stabilizes the hosted pointer target in the same passing browser regression without changing application behavior. Review run `42547834364` also concluded `success` in all five jobs at `f973a26fcb43c3ffacda7f39cb054e7111a80318` after the mandatory browser-call job was expanded to include foreground ringtone/device-authentication and nine-width audio-output recovery on every review.
- [x] Feed, Friends, Notifications, Profile, SYNC, Pivot, The Roll, Booking and EPK shells returned HTTP 200 from staging.
- [x] Delivered Feed assets include mobile-design CSS `v17`, Feed art-direction CSS `v28`, Feed enhancement CSS `v508`, Feed enhancement JavaScript `v542`, identity-media recovery `v2`, Pivot `v2`, alert CSS `v236`, and PWA bootstrap `v428`.
- [x] Delivered service worker reports `danzstak-shell-v778`; no-cache probes confirm `assets/booking-discovery.js?v=4`, `assets/booking-discovery.css?v=3`, `assets/booking-map.js?v=449`, `assets/booking-workspace.css?v=8`, `assets/booking-billing.js?v=6`, `assets/booking-selections.js?v=22`, `assets/booking-selections.css?v=14`, `assets/epk.css?v=9`, `assets/call-devices.js?v=2`, `assets/incoming-calls.js?v=301` and the matching current Feed assets.
- [x] A fresh hosted browser context registered and activated the staging service worker, created the versioned shell cache, and controlled the next page load without clearing user storage.
- [x] Required authentication, account-isolation, accessibility, link/privacy, Booking, EPK, Tour Manager, Stripe Test Mode and PWA regressions passed in the full gate.
- [x] No credential, password, session token, webhook secret or private customer data is recorded in the branch evidence.
- [x] No-cache hosted probes return `danzstak-shell-v778`, `assets/booking-discovery.js?v=4`, `assets/booking-discovery.css?v=3`, `assets/booking-map.js?v=449`, `assets/booking-workspace.css?v=8`, `assets/booking-billing.js?v=6`, `assets/booking-selections.js?v=22`, `assets/booking-selections.css?v=14`, `assets/artist-hq.js?v=2`, `assets/epk.css?v=9` and the matching current Feed assets. The authenticated foreground-call matrix passes directly against the hosted review origin at 320, 360, 390, 414, 430 and 1366px. The connected EPK-to-venue-selection, selected-venue save-and-preview, and contact-unlock return journeys pass at all nine required widths. The load-gated Dailies portrait matrix passed three consecutive runs at 320, 390 and 1366px. The hosted one-page PDF is exactly one page and was visually inspected. The staging branch remains separate from production.

Staging PWA: <https://review.danzstak.com/feed.html?view=hq&release=cd590e7>

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
