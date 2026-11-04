# DANZSTAK development report

## ChatGPT status bridge — 2026-11-04

Status: **CURRENT FOR `danzstak-patch-1`; TEST PAYMENTS ONLY; LIVE PAYMENTS DISABLED**.

### Mobile-first UI and PWA overhaul — 2026-11-04

Status: **COMPLETE AND VISUALLY VERIFIED IN DEVELOPMENT; PRODUCTION DEPLOYMENT BLOCKED BY BRANCH POLICY**.

- **Root cause fixed:** Friends was an in-page workspace while Chat and Notifications each maintained independent fixed-position drawer flags and history entries. Mobile therefore had no single primary-screen owner and could display multiple panels together. The feed now exposes one `data-mobile-screen` state for Home, Friends, Chat, Notifications and Menu; changing destination closes every incompatible drawer/workspace. Mobile Chat navigates to the existing dedicated `messages.html` screen instead of embedding the desktop drawer.
- **Mobile shell corrected:** phones now use a 54px D-logo/search header plus a safe-area-aware five-item bottom navigation for Home, Friends, Chat, Buzz and Menu. Friends and Notifications own their viewport; the menu is one independently scrolling drawer; Chat keeps its full-screen list/conversation states and browser Back behavior. The feed, comments and media retain their existing functions.
- **Reaction alignment corrected:** Like, Dislike and Comment now render separate icon/count spans in a non-wrapping flex control. Counts remain immediately to the right of their icon on the same baseline. Comment reply/delete layout remains a single row with deletion at the far edge.
- **PWA update prepared:** `service-worker.js` advances the shell to `danzstak-shell-v633`; `feed.html` references `feed-enhancements.css?v=485` and `feed-enhancements.js?v=515`. Chat references `direct-messages.js?v=482`. No offline drafts or user data are removed by the cache update.
- **Automated verification passed:** all **245 of 245** JavaScript regression programs, infrastructure validation, release verification and `git diff --check` pass. The Edge/Playwright visual harness passed 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px with no horizontal overflow. It exercises Home → Friends → Notifications → Menu → Chat list → conversation and Back navigation, asserts mutually exclusive screens, and measures icon/count geometry.
- **Development screenshots:** [390px Home](screenshots/mobile-ui/home-390.png), [Friends](screenshots/mobile-ui/friends-390.png), [Notifications](screenshots/mobile-ui/notifications-390.png), [Menu](screenshots/mobile-ui/menu-390.png), [Chat list](screenshots/mobile-ui/chat-list-390.png), [Chat conversation](screenshots/mobile-ui/chat-conversation-390.png), and [reaction alignment](screenshots/mobile-ui/reactions-390.png). Additional captures cover every required width through desktop.
- **Implementation commit:** `4ceab2895cf7aa4b273df1ab5a30507d57c8b862` on `danzstak-patch-1` (with the preceding person-specific Friends accessibility commit `93228bc82b9bb98368821e96343c75a1c5038e13`).
- **Production evidence before deployment:** AWS Amplify app `d31oovi2mos5iz` serves `danzstak.com` from the repository's `main` branch. Its latest successful job is `845` at commit `774fdae8c39222c86660480d8d4c1bf74df5fffe`. The live site still serves cache `danzstak-shell-v617`, CSS `v483`, and JavaScript `v504`, proving that production has not received this mobile release.
- **Deployment blocker:** the established publisher correctly refused to claim success because production Amplify watches `main`, while the verified mobile commit is on `danzstak-patch-1`. That branch is **70 commits ahead of `main`** and contains other reviewed development work. Cherry-picking only the mobile commit onto `main` conflicts in the core feed, message and service-worker files because the mobile fix depends on that accumulated architecture. Fast-forwarding all 70 commits or manually replacing the Amplify production artifact would deploy unrelated work, contrary to this task's deployment safety requirement. Owner approval is required to fast-forward/merge the complete tested branch, or the owner must choose a separate release-integration pass.
- **CloudFront/PWA status:** this account has no customer-managed CloudFront distribution for `danzstak.com`; Amplify Hosting provides the production CDN. Therefore there is no CloudFront invalidation ID to report. No production invalidation or deployment was performed, and no claim is made that installed Android/iPhone PWAs have updated. Physical Android Chrome and iPhone Safari/install verification remains pending until the branch decision and production release.
- **SFScoop-benchmark follow-up:** commit `0eddc4a634e48f6792c3f4de06655d1f01a581b0` adds `assets/mobile-design-system.css` as the shared light-mode token and geometry layer for the feed, Messages, Booking Agent/Tour Manager and EPK. It standardizes the 54px header, 44px touch targets, five-destination bottom navigation, compact card rhythm, non-wrapping reaction geometry and phone-width media gutters without changing Stripe or backend behavior. Booking, Tour Manager and EPK now have the same mobile navigation destinations as the core social screens.
- **Expanded visual evidence:** the automated harness now captures Booking Agent, Tour Manager and EPK at 320, 360, 390 and 414px in addition to the existing feed/core-screen matrix. Representative captures: [Booking Agent at 390px](screenshots/mobile-ui/booking-390.png), [Tour Manager at 390px](screenshots/mobile-ui/tour-manager-390.png), and [EPK at 390px](screenshots/mobile-ui/epk-390.png). All measured pages have no horizontal overflow and the complete regression suite is **246 of 246** programs.
- **Prepared PWA release:** the shared stylesheet is part of the offline shell and the prepared cache is now `danzstak-shell-v635`; feed behavior is versioned as `feed-enhancements.js?v=516`. Production remains on `v617` until the Amplify branch blocker above is resolved.

### Publication verification — 2026-11-04

- **VERIFIED — repository:** development and verification were performed on `danzstak-patch-1`. The latest implementation revision for this update is `cb483714f19cbc167e2316eb2b06621dbeee62fb`; the report-publication commit is the branch head immediately following that revision and is supplied with the GitHub report URL after push.
- **VERIFIED — Stripe account and catalog:** a fresh authenticated Stripe API read identified account `acct_1RRZmKFgtfNMBXOV` with dashboard name **SFScoop**. The three Test Mode Products and Prices listed below are active, `livemode: false`, USD, one-time, have the expected amounts, and each Price points to its documented Product.
- **VERIFIED — webhook registration:** Stripe endpoint `we_1UXoPzFgtfNMBXOV05UR9jPa` is enabled in Test Mode at `https://api.danzstak.com/tour-manager/stripe/webhook` with exactly the five required events documented below.
- **VERIFIED — AWS deployment:** `DANZSTAK-TourManager-Stripe-Test` in `us-west-1` is `Active`, its last update is `Successful`, its runtime is Node.js 20, and `TOUR_MANAGER_LIVE_PAYMENTS=false`. API Gateway still exposes `POST /tour-manager/stripe/webhook`.
- **VERIFIED — secret availability:** AWS Secrets Manager contains both `danzstak/stripe/secret-key` and the separately stored `danzstak/stripe/webhook-secret`. Secret values were neither displayed nor written to this report.
- **VERIFIED — signature rejection:** a fresh unsigned/invalidly signed request to the deployed HTTPS endpoint returned HTTP 400. This confirms fail-closed signature handling at the public receiver.
- **COMPLETE — controlled hosted payment and refund gate:** all three Stripe-hosted Test Mode Checkout payments completed, all three `checkout.session.completed` events were processed once by the signed DANZSTAK webhook, and all three full Test Mode refunds produced the correct product-specific reversal. Live payments remain disabled and this branch remains unmerged from `main` pending owner review.

### Stripe and AWS payment configuration

| Item | Verified status |
| --- | --- |
| Stripe account | **VERIFIED** — SFScoop, account `acct_1RRZmKFgtfNMBXOV` |
| Credential mode | **VERIFIED** — both the configured publishable key and backend secret key are Test Mode credentials for the same SFScoop account. This was confirmed with an authenticated, no-charge Stripe object create/retrieve check; matching `pk_test_`/`sk_test_` prefixes alone were not treated as proof. |
| Booking Contact Unlock | **VERIFIED TEST PRODUCT** — product `prod_VYwF2z3cYoe72u`; price `price_1UXoMsFgtfNMBXOVSmnWDFGa`; USD $0.75; one-time; active; Test Mode |
| Professional Tour Manager | **VERIFIED TEST PRODUCT** — product `prod_VYwFT1LQyqjsxc`; price `price_1UXoMtFgtfNMBXOV1fqlkuRf`; USD $1.50; one-time; active; Test Mode |
| Phone-number activation | **VERIFIED TEST PRODUCT** — product `prod_VYwFZRXzQ3dNNv`; price `price_1UXoMuFgtfNMBXOVNxfRWRDp`; USD $3.00; one-time; active; Test Mode |
| Public webhook URL | `https://api.danzstak.com/tour-manager/stripe/webhook` |
| Stripe webhook endpoint | **DEPLOYED AND ENABLED IN TEST MODE** — endpoint `we_1UXoPzFgtfNMBXOV05UR9jPa` |
| Required webhook events | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded` |
| AWS region and service | `us-west-1`; Lambda `DANZSTAK-TourManager-Stripe-Test`, behind HTTP API Gateway `DANZSTAK-Auth-HTTP-API` (`0872gqal4m`) |
| AWS deployment health | **VERIFIED** — Lambda state `Active`, last update `Successful`, Node.js 20 runtime, and `TOUR_MANAGER_LIVE_PAYMENTS=false` |
| Stripe secret access | **VERIFIED** — the backend secret is accessible from AWS Secrets Manager at `danzstak/stripe/secret-key`. The webhook signing secret exists separately at `danzstak/stripe/webhook-secret`. Secret values are not stored in GitHub, this report, or test output. |

The original Live Mode products and prices remain unchanged. DANZSTAK's isolated Test deployment uses only the Test Mode catalog above, and no Live payment processing has been enabled.

### Checkout, webhook and entitlement verification

- **COMPLETE — automated/local entitlement tests:** correctly signed successful Checkout events grant only the intended entitlement: one selected booking contact, Professional Tour Manager access/credits, or a phone activation in `pending_provisioning`. Failed, expired, tampered and duplicate events grant nothing. Refund handling, partial-refund manual review, duplicate-refund protection and failed-send credit restoration paths pass their focused regression tests.
- **COMPLETE — webhook security checks:** an invalid Stripe signature returns HTTP 400. A correctly signed unpaid test Checkout event returns HTTP 200 without granting an entitlement. An actual Stripe-delivered `checkout.session.expired` event reached the deployed endpoint and created no entitlement.
- **COMPLETE — focused test programs:** `test-tour-manager-billing.cjs`, `test-booking-contact-unlock.cjs`, `test-phone-number-stripe.cjs`, `test-stripe-secret-loading.cjs`, and `test-stripe-refunds.cjs` pass.
- **PASS — hosted successful-card verification:** Booking Contact Unlock, Booking Email Credit/Professional Tour Manager, and Phone Number Activation completed end to end through Stripe-hosted Test Mode Checkout, the deployed signed webhook and DynamoDB. Each Stripe event has `pending_webhooks=0`, each event is recorded once in the webhook-event table, and the resulting entitlement belongs only to its intended product.
- **PASS — hosted refund verification:** one full Test Mode refund per entitlement type was issued. Stripe produced one `charge.refunded` event per purchase with `pending_webhooks=0`; the webhook recorded each event once and applied the expected product-specific reversal.

### Independent payment-state re-verification — 2026-11-04

- **PASS — Stripe source-of-truth rechecked:** all three hosted Checkout Sessions were retrieved again from Stripe with the SFScoop Test Mode credential. Each remains `status=complete`, `payment_status=paid`, `livemode=false`, USD, quantity 1, and bound to the expected Test Price: $0.75 contact unlock, $1.50 booking-email/Professional purchase, and $3.00 phone activation.
- **PASS — successful webhook deliveries rechecked:** the three `checkout.session.completed` events remain Test Mode events with `pending_webhooks=0`. Each event has exactly one processed-event record in DynamoDB and one matching product-specific purchase ledger record. Those records are created only within the signed webhook handler's successful transaction before its HTTP 200 response; no duplicate processed-event record exists.
- **PASS — initial entitlement isolation rechecked:** the contact purchase created only the selected venue entitlement, the booking-email purchase added exactly one credit and activated only the Professional entitlement, and the phone purchase created only a `pending_provisioning` activation entitlement. No product granted another product's entitlement. The phone purchase ledger remains the evidence that provisioning was pending; no telephone number was assigned.
- **PASS — controlled Test Mode refunds rechecked:** Stripe confirms all three full refunds succeeded for exactly 75, 150 and 300 cents and every related `charge.refunded` event has `pending_webhooks=0`. No new refund was issued during this re-verification, and no Live Mode transaction was accessed or changed.
- **PASS — post-refund DynamoDB state rechecked:** the contact entitlement and Professional entitlement are `refunded`; purchased and available booking-email credits are both 0; the phone entitlement is `refunded` with `provisioningActionRequired=true`. Each refund event has one processed-event record and exactly one matching reversal ledger entry. Unrelated entitlements were unchanged.
- **PASS — focused regression rerun:** `test-tour-manager-billing.cjs`, `test-booking-contact-unlock.cjs`, `test-phone-number-stripe.cjs`, `test-stripe-secret-loading.cjs`, `test-stripe-refunds.cjs`, and `git diff --check` pass after the live-state audit.

### Manual Stripe Checkout sessions — 2026-11-04

- **PASS — Booking Contact Unlock:** authenticated Test Mode session `cs_test_a198wBvarNng6MJw3kiqd1TSQ31a3QeCsdIZ3gTCAZJKj61E7mbfbVqlaZ`; USD $0.75; Price `price_1UXoMsFgtfNMBXOVSmnWDFGa`; Product `prod_VYwF2z3cYoe72u`; saved controlled test venue `7a8b9c0d1e2f3a4b5c6d`. Stripe reports `complete/paid`; event `evt_1UXrojFgtfNMBXOVexq4A9dW` has zero pending webhooks; DynamoDB marks the checkout `paid` and the exact selected venue contact `active`; the matching ledger entry is `settled`.
- **PASS — Booking Email Credit and Professional entitlement:** authenticated Test Mode session `cs_test_a12WXMufmdM108ocssWrLJuclWBL9B15KQNhsF9IJi1emRemln354ODDyC`; quantity 1; USD $1.50; Price `price_1UXoMtFgtfNMBXOV1fqlkuRf`; Product `prod_VYwFT1LQyqjsxc`. Stripe reports `complete/paid`; event `evt_1UXrv5FgtfNMBXOVwdZsyWRl` has zero pending webhooks; DynamoDB marks the checkout `paid`, adds exactly one purchased/available booking-email credit, activates the Professional entitlement, and records one settled ledger entry.
- **PASS — Phone Number Activation purchase:** authenticated Test Mode session `cs_test_a1AGXNAfvPU5nR99jxo3VPgTr9G1jptIMrcQNlryKAbLbgHPXUfvh0tsIU`; USD $3.00; Price `price_1UXoMuFgtfNMBXOVNxfRWRDp`; Product `prod_VYwFZRXzQ3dNNv`. Stripe reports `complete/paid`; event `evt_1UXrsBFgtfNMBXOVVjpQrVeM` has zero pending webhooks; DynamoDB marks the checkout `paid`, creates the separate phone entitlement as `pending_provisioning`, and records the ledger as `pending_provisioning`. No phone number is falsely claimed provisioned.
- The three sessions were created through the deployed authenticated DANZSTAK routes and independently retrieved from Stripe to verify Price, Product, amount, currency, quantity and `livemode=false`. No API secret was exposed.
- **FIXED AND DEPLOYED — phone Checkout invoke permission:** the phone route initially exposed a missing API Gateway-to-Lambda resource-policy permission and returned HTTP 500. AWS now has a path-scoped `AllowDanzStakPhoneStripeTestApi` statement for `/phone-number/*`; the deployment script and regression suite preserve that permission. The regenerated phone Checkout succeeds.
- **PASS — no duplicate or cross-product grants:** the controlled account contains one contact entitlement for the selected saved venue, one Professional entitlement, one booking-email credit balance, and one phone activation entitlement. Contact and phone payments did not add email credits; the email-credit payment did not create a contact or phone entitlement. Each success event has one processed-event record and one matching purchase ledger record.

### Controlled Test Mode refunds — 2026-11-04

- **PASS — Contact Unlock refund:** refund `re_3UXrXaFgtfNMBXOV0XFVh7c1` succeeded for USD $0.75. Stripe event `evt_3UXrXaFgtfNMBXOV09gEyHf8` has zero pending webhooks. DynamoDB marks the checkout and selected-venue entitlement `refunded` and creates one `contact_unlock_refund` ledger entry; no unrelated entitlement changed.
- **PASS — Booking Email Credit refund:** refund `re_3UXrv2FgtfNMBXOV0uCTBF6P` succeeded for USD $1.50. Stripe event `evt_3UXrv2FgtfNMBXOV0gG1p3JY` has zero pending webhooks. DynamoDB reduces purchased and available credits from 1 to 0, marks the Professional entitlement and checkout `refunded`, and creates one `purchase_refund` ledger entry with delta -1.
- **PASS — Phone Activation refund:** refund `re_3UXrsAFgtfNMBXOV0dwLo2eg` succeeded for USD $3.00. Stripe event `evt_3UXrsAFgtfNMBXOV0OX50kcE` has zero pending webhooks. DynamoDB marks the checkout and phone entitlement `refunded`, retains `provisioningActionRequired=true`, and creates one `phone_activation_refund` ledger entry. No real phone number was assigned.
- **PASS — webhook response path:** every success/refund event has zero pending Stripe deliveries and exactly one processed-event record in `DANZSTAK-Tours`. Each record is written only on the handler's verified HTTP 200 success path; the entitlement and ledger transactions are present for all six events.

### Remaining owner actions for Stripe

1. Review the completed Test Mode evidence in this report and Stripe Dashboard.
2. Decide whether to approve a later Live Mode rollout. No Live activation or `main` merge is included in this work.
3. Before any Live rollout, repeat deployment/configuration review with Live endpoint-specific secrets and explicitly approved Live catalog IDs; do not reuse Test Mode webhook secrets or Checkout sessions.

### Current DANZSTAK product status

| Product area | Factual status |
| --- | --- |
| Chat | **IN PROGRESS; DEVELOPMENT BUILD NOT DEPLOYED.** Core direct messaging, compact WhatsApp-familiar responsive UI, editing/options, notifications and implemented call controls have automated coverage. The latest header/search/icon work is verified locally. The external booking-email-to-Chat reply bridge and its production inbound-email proof are not complete, so that workflow is not claimed operational. |
| Booking Agent | **IN PROGRESS; NOT PRODUCTION-COMPLETE.** Worldwide locality resolution, route-oriented discovery, sourced venue leads, provider diagnostics, saved tours and contact workflow foundations exist. Live multi-provider benchmark coverage, current-data moderation and production-scale route discovery still require verification; results must not be treated as an exhaustive worldwide venue index. |
| EPK | **IN PROGRESS; CORE DEVELOPMENT WORK EXISTS.** The editor, S3-backed media handling, revocable public sharing link and outbound EPK-link enforcement have focused regression coverage. AI research expansion, professional PDF/export completeness and a production end-to-end outreach delivery proof are not claimed complete. |
| Tour Manager | **IN PROGRESS; TEST PAYMENT BACKEND DEPLOYED, FULL PRODUCT NOT DEPLOYED.** Saved-tour/outreach/dashboard and entitlement foundations exist, and the isolated Stripe Test webhook is active. Inbound reply correlation, automatic confirmation/calendar updates, continuous route recalculation, full delivery/bounce telemetry and the controlled 30-day/20-show/100-contact end-to-end test remain incomplete. SFS Token checkout is intentionally not active. |

### Multilingual profile sharing and invitations

- **COMPLETE IN DEVELOPMENT; NOT DEPLOYED TO THE WEBSITE:** the profile Share and Invite dialogs now cover all 15 supported account languages, including clipboard success/recovery guidance, native Share and Close controls, and invitation copy.
- Security and accessibility behavior remains intact: shared profile URLs use opaque member IDs rather than email addresses, unsafe account identifiers are not placed in the URL, clipboard failure keeps a selectable manual-copy fallback, and closing the dialog restores keyboard focus to its opener.
- Verification: the new focused localization regression passes, and the full **242-program** JavaScript regression suite passes together with release verification, the 11-page site smoke suite, infrastructure validation and `git diff --check`.
- Implementation commit: `695a89b3a27949121e1e0595f8d25633eabdff04`.

### Required light-only social interface

- **COMPLETE IN DEVELOPMENT; NOT DEPLOYED TO THE WEBSITE:** removed the Dark mode control from account Settings and retired the legacy device preference across Your Mix, Messages and Profiles. A stale local or cloud `darkMode=true` value can no longer override the official DanzStak light interface.
- Older backend clients remain compatible: current account saves explicitly send `darkMode=false`, while language, reduced motion, data saver, privacy and notification preferences remain independent and functional.
- Cache versions were advanced for the shared preference bootstrap, feed behavior and PWA shell so an installed development client cannot retain the retired theme control.
- Visual verification: the real local Settings workspace rendered without the Dark mode row, without a leftover gap, and retained compact aligned controls. Automated verification: **243 of 243** JavaScript regression programs pass, plus release verification, the 11-page site smoke suite, infrastructure validation and `git diff --check`.
- Implementation commit: `fa000ba8ffa3cf7a600cc471d7cbc8229c2f0a71`.

### Multilingual feed comments and replies

- **COMPLETE IN DEVELOPMENT; NOT DEPLOYED TO THE WEBSITE:** the complete comment interaction now follows the member's selected DanzStak language across all 15 supported locales. This includes the composer placeholder, emoji and send controls, relevant/newest sorting, Reply, named reply context, cancel-reply control, accessible labels and compact timestamps.
- Switching language while comments are already visible refreshes their interface copy and localized relative timestamps in place. Member names and user-written comments remain separate from interface translation and are never rewritten.
- Accessibility remains intact: the reply target is preserved in accessible names, each timestamp exposes its full localized date and time, keyboard behavior is unchanged, and the existing single-row Reply/trash layout is preserved.
- Verification: the new comment-localization regression and runtime language harness cover all locales and dynamic name preservation. All **244 of 244** JavaScript regression programs pass, together with release verification, the 11-page site smoke suite, infrastructure validation and `git diff --check`.
- Implementation commit: `62b8a08cfb7e6b806411b5ba9613b392af94c676`.

### Multilingual friend discovery and requests

- **COMPLETE IN DEVELOPMENT; NOT DEPLOYED TO THE WEBSITE:** the Friends workspace's full request lifecycle now follows the selected DanzStak language across all 15 supported locales. Previously untranslated progress, timeout, connection, retry, profile-opening and Tribe-message states no longer fall back to English for Italian or other supported-language members.
- The existing simple workflow remains unchanged: members can search by display name, see users who are online, add or accept a friend with one action, open a profile, and message accepted friends without knowing an account email address.
- Safety and identity behavior remain intact: opaque member IDs are preferred for friend requests and profile routes, displayed member names are never translated, accepted friends remain visible when offline, and provider failures remain visibly different from an empty online list.
- Verification: the runtime language harness now requires all friend progress and recovery copy in every supported language. All **244 of 244** JavaScript regression programs pass, together with release verification, infrastructure validation and `git diff --check`.
- Implementation commit: `cb483714f19cbc167e2316eb2b06621dbeee62fb`.

### Source and deployment record

- Branch: `danzstak-patch-1`.
- Implementation revision immediately before this report update: `cb483714f19cbc167e2316eb2b06621dbeee62fb`.
- Stripe Test integration implementation revision: `9b27dba7ee94837aafefe7a0ac0a4e8ceea2b855`.
- Deployment status: **isolated Stripe Test Lambda and webhook deployed; Live payments disabled; recent website, Chat, Booking, EPK, Tour Manager and UI branch changes not deployed to production; branch not merged into `main`.**
- This report-update commit is recorded in the GitHub history for `danzstak-patch-1`; the final pushed SHA is supplied with the report URL after publication.

## Official DanzStak platform icon

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Replaced the generic blue/purple `app-icon.svg` with a transparent standalone version of the existing official metallic silver-and-orange D. The mark retains the orange play triangle and equalizer-bar identity and is stored as `assets/danzstak-d-icon.png`; the original full wordmark remains unchanged for the landing page and other full-logo uses.
- Regenerated the 32px browser favicon, 192px and 512px PWA icons, and 180px Apple touch icon from the standalone official mark. The manifest now advertises only the verified PNG assets and no longer presents a transparent icon as maskable, avoiding unsafe platform cropping.
- The Your Mix header now uses a compact D-plus-DANZSTAK wordmark, and the active Your Mix drawer item uses the same D instead of a generic home glyph. Phone-width header layout now preserves a usable search field and all five navigation controls without overflow.
- Retired every reference to the generic SVG and advanced the service-worker shell cache to `danzstak-shell-v622`, so installed development clients refresh the brand artwork.
- Asset workflow: the built-in image editing tool extracted the official D from `assets/danzstak-logo.png` onto a transparent background; deterministic local resizing produced each platform size. The final normalized source is in the repository rather than an external generated-image directory.
- Verification: the new brand regression checks PNG dimensions and alpha support, manifest references, header/navigation markup, PWA caching and generic-icon retirement. **239 of 239** JavaScript regression programs pass, along with release verification, the 11-page site smoke suite, infrastructure template/Lambda syntax validation and `git diff --check`. Phone-width visual inspection confirmed the mark, wordmark, search and navigation remain readable at the app-panel width.
- Implementation commit: `459fc49de408be67da701907a918f7a7dcf36f0c` on `danzstak-patch-1`.
- Core-social-header follow-up: standalone Messages and Profile now use the same compact D + DANZSTAK treatment instead of the oversized landing-page wordmark. On narrow phones the word disappears while the recognizable D and every existing navigation action remain visible. The service-worker shell cache and versioned CSS references were advanced to prevent installed clients from retaining the old headers. Phone-width visual inspection confirmed the Messages and Profile headers fit without horizontal clipping; all 239 regression programs, release verification, 11-page smoke checks and infrastructure syntax checks remain green. Follow-up commit: `4c66c18cef7e1738df877804dbc4c2ff8aa76705`.
- Deployment: not published to production and not merged into `main`.

## Global icon-based interface

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Added one dependency-free shared SVG icon registry and enhancer in `assets/icon-buttons.js`, with shared responsive states in `assets/icon-buttons.css`. It handles static and dynamically rendered controls without changing their event handlers or business logic.
- Applied the shared system to Your Mix, comments, profiles, standalone and embedded Chat, The Roll, Booking Agent, Booking contact sheet, Record Store Locator, EPK editor, and the PWA shell cache.
- Chat now uses consistent back, alert, new-chat, phone, video, minimize, more, close, delete, attachment, camera, edit and send icons. The implemented phone/video controls remain available; no nonfunctional call action was introduced.
- Messages search now uses the same shared SVG search icon instead of the legacy `⌕` character. The control keeps its existing accessible input label and compact WhatsApp-familiar field; phone-width visual inspection confirmed the icon, placeholder and filters remain aligned. All 239 JavaScript regressions, release verification and the 11-page smoke suite pass. Follow-up commit: `b7b940186c175d367a18d8460710572b8ca7d250`.
- Comment Reply and Delete remain on their existing single horizontal action row, now using recognizable reply-arrow and trash icons. Destructive confirmation dialogs remain unchanged.
- Every converted control retains an `aria-label` and desktop `title`; shared styles provide visible keyboard focus, hover/active/disabled states, 38px desktop controls and 44px coarse-pointer touch targets. Pricing, purchase, legal, onboarding and ambiguous actions remain text-labeled.
- Visual verification: locally served Chat was inspected at 1440×900 and 390×844, and Your Mix at 390×844. Desktop Chat showed the compact two-panel layout and icon composer; the phone feed preserved the branded navigation, composer, Flashes and icon-based Roll control. Local screenshots were diagnostic only and were not committed because they contained transient unauthenticated loading states.
- Automated verification: **238 of 238** repository test programs pass, including the new shared-icon accessibility test plus comment reply/reaction, message editing/options/keyboard, mobile message view, Roll modal, Booking startup, EPK, record-store and PWA cache regressions. Three stale cache-version assertions were updated to the versions already referenced by `feed.html`.
- Changed components: `assets/icon-buttons.js`, `assets/icon-buttons.css`, `assets/direct-messages.js`, `assets/feed-enhancements.js`, seven core HTML pages, `service-worker.js`, and focused test files.
- Implementation commit: `42887861b9e12134bc667dd8e6945222da69870a` on `danzstak-patch-1`.
- Drawer-icon follow-up (2026-11-03): a live production audit found that the Your Mix navigation drawer still rendered legacy emoji even though action controls had been converted. The development branch now routes every drawer item through the same dependency-free SVG registry (home, profile, friends, Tribes, media, music tools, account/legal and logout), keeps the existing Android/Apple artwork, and advances the PWA shell cache so installed clients will not retain the emoji menu. This correction is **verified in development and not deployed**.
- Drawer verification: the focused icon, mobile navigation/history, layout, touch-target and PWA refresh test programs pass; the 11-page site smoke suite and `git diff --check` pass. A locally served visual inspection confirmed consistent line icons, compact alignment and no emoji in the drawer. The follow-up commit is recorded below after push.
- Settings follow-up (2026-11-03): the Settings workspace also used legacy emoji despite the global-icon status. All sixteen settings categories now use the same local SVG registry with compact circular treatment, accessible row labels, localized text, dark-mode contrast and no new dependency. The PWA cache was advanced to prevent an installed client from retaining the old artwork. Local visual verification confirmed the icon rows and unchanged functional controls; all 238 JavaScript regressions, release verification, 11-page smoke checks and infrastructure/Lambda syntax checks pass. This remains **NOT DEPLOYED**.
- Settings-icon implementation commit: `183ba5aaf30a3b8ea3d00243d03cf5521d70e2f8` on `danzstak-patch-1`.

## Multilingual Friends and presence workspace

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Corrected the Friends workspace so its existing translations are actually used for online discovery, accepted-friend lists, loading/empty/recovery states, Add Friend/Accept/Requested/Message actions, Online/Offline presence, profile-link labels and accessible action names. Previously, this live workspace bypassed the language layer and rendered English even when the account was set to Italian or another supported language.
- Live presence updates from the page heartbeat and embedded Messages frame now preserve the selected language instead of changing a translated friend card back to English.
- Member-supplied names remain unchanged and are inserted only after translation, so names are never sent through or altered by the translation dictionary. Existing opaque profile routes, privacy-respecting presence, one-tap friend requests, accepted-friend persistence, quick messaging, timeout recovery and stale-response protection are unchanged.
- Advanced the feed behavior cache key and PWA shell cache so installed clients receive the correction rather than retaining the older English-only script.
- Verification: **240 of 240** JavaScript regression programs pass, including new localization coverage plus friend discovery, live presence, loading, stale-response, failure isolation, profile routes, Italian profile language and all 15-language dictionary checks. The 11-page site smoke suite, release verification, infrastructure/Lambda syntax validation and `git diff --check` also pass.
- Implementation commit: `3cf14f455c7a6e5b8f2a1df1bd919d7221df0cb6` on `danzstak-patch-1`.
- Deployment: not published to production and not merged into `main`.

## Multilingual social activity notifications

Status as of 2026-11-04: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Corrected the notification drawer so the activity itself—not only the drawer controls—uses the selected DanzStak language. Direct-message fallbacks, Tribe `@everyone` announcements, Like/Dislike/Love/Laugh/Wow/Sad/Fire reactions, generic reactions, media tags, replies, comments, friend requests and accessible profile-link labels now cover all 15 supported locales.
- Activity rendering uses parameterized templates. Member names, Tribe names and user-written message/comment previews are inserted after translation and are never translated or rewritten.
- Preserved the existing privacy boundary: public member identity uses opaque member profile routes, account email addresses remain internal, external text is rendered with `textContent`, and notification links retain the established safe destinations.
- Advanced the feed localization/behavior cache keys and PWA shell cache so installed clients receive the corrected activity text.
- Verification: **240 of 240** JavaScript regression programs pass. Notification-specific coverage verifies every translation table, placeholder preservation, timestamp rendering, drawer behavior, focus-safe navigation, privacy, partial-source recovery and PWA refresh. Release verification, the 11-page smoke suite, infrastructure/Lambda syntax validation and `git diff --check` also pass.
- Implementation commit: `df842addf03ba337c789b9c1d15491b27f2f3a8d` on `danzstak-patch-1`.
- Deployment: not published to production and not merged into `main`.

## Multilingual privacy-safe background push notifications

Status as of 2026-11-04: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Corrected the server-generated Web Push payloads for incoming calls, direct messages and friend requests. They now use the recipient account's saved DanzStak language instead of always sending English lock-screen text.
- All 15 supported account languages are covered. Caller/sender names are inserted after translation and are never translated or replaced with an email address. Missing or unsupported language values fall back safely to English.
- Direct-message pushes remain deliberately private: the payload says that the named member sent a message but never includes the message body, attachment, conversation preview or account email. Call payloads identify voice versus video using localized terms.
- Existing account controls remain enforced independently: disabling incoming-call alerts suppresses call pushes, and disabling new-message alerts suppresses message pushes. Friend-request delivery and per-device subscription fan-out are unchanged.
- Verification: **241 of 241** JavaScript regression programs pass, including new server-payload coverage for every language, placeholder preservation, English fallback and lock-screen privacy. Release verification, the 11-page site smoke suite, CloudFormation/embedded-Lambda syntax validation and `git diff --check` also pass.
- Implementation commit: `50f2518a7a68ae1336ed1bc5a39b5a2f39246830` on `danzstak-patch-1`.
- Installed-PWA follow-up: incoming-call **Answer** and **Dismiss** actions now use the same recipient language as the call title and body. The server supplies bounded action labels, the service worker safely renders them, and malformed push data falls back to a brand-only notification rather than displaying untrusted text or inserting English-only body copy. The shell cache advanced to `danzstak-shell-v627`; all 241 regressions and the full release/site/infrastructure verification remain green. Follow-up commit: `32fb2acc511da880351a76e8d5836b9dde217783`.
- Deployment: not published to production and not merged into `main`.

## Mobile Flashes navigation

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Opening a Flash on a phone now creates a privacy-safe browser-history entry. Android/iPhone Back closes the modal and returns to the feed; Forward restores the active Flash without creating another entry.
- The close button, backdrop tap and Escape all use the same history-safe path. Focus returns to the Flash launcher after dismissal, and desktop dialog behavior remains direct.
- Existing 24-hour expiry, audience privacy, durable author links, caption cleanup, signed-media recovery, retry UI, autoplay and accessible media labels remain intact. History stores only a boolean marker and no story identifier, caption, media URL, author or account data.
- Verification: **12 of 12** focused Flash, video, navigation, CSP and PWA regression programs passed, along with whitespace checks. The locally served phone-width feed loaded with the updated strict CSP; no authenticated Flash record was available in that isolated session, so live Back/Forward playback remains to be repeated with controlled account media before deployment.
- Implementation commit: `fa30963bfddbd25a74d68c65a23c72b37cf744b4` on `danzstak-patch-1`.

## Mobile The Roll navigation

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Opening The Roll fullscreen on a phone now creates a privacy-safe browser-history entry. Android/iPhone Back closes the viewer and returns to the same Your Mix position; Forward restores fullscreen without creating a history loop.
- The close button and Escape use the same history-safe path. Desktop behavior remains direct and removes a stale phone marker if the viewport changes while fullscreen is open.
- Fullscreen now moves to a top-level modal layer, exposes a dialog named by the visible “The Roll” heading, makes the background inert, hides off-screen import controls and contains keyboard focus. Closing restores every background region's prior inert state and returns The Roll to its exact feed position.
- Existing autoplay, data-saver handling, site-wide sound preference, accessible player labels, URL validation, network recovery and media refresh behavior remain intact. History stores only a boolean marker and no video URL, title, author or account data.
- Verification: **15 of 15** focused Roll, video, navigation, CSP and PWA regression programs passed, along with JavaScript syntax and whitespace checks. A locally served phone-width browser check confirmed that only The Roll remains in the accessibility tree while fullscreen, Back restores the complete feed and launcher focus, and Forward restores the isolated viewer.
- Implementation commit: `e617d95d033133054eb5ed119f0f66e63c359f0f` on `danzstak-patch-1`.
- Modal-accessibility follow-up: `c89b130af8f70c42a8983e4fa4b78482d78a3f76`.

## Mobile navigation drawer

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- The phone navigation drawer now participates in browser history. Back, Escape, the Menu toggle and an outside tap dismiss it; Forward restores it without creating a loop.
- Selecting a menu destination still closes immediately and preserves the existing workspace route behavior. Crossing to the desktop breakpoint closes the drawer and restores the desktop rails.
- The existing body-scroll lock, dimmed backdrop, initial-link focus and opener-focus restoration remain intact. History stores only a boolean menu marker and no user, route or menu-label data.
- Verification: **9 of 9** focused mobile navigation, notification coexistence, desktop navigation and PWA cache checks passed.
- Implementation commit: `d6602a6bdb131ee8828a9a8661f86edff8416103` on `danzstak-patch-1`.
- Profile-header follow-up (2026-11-03): the existing drawer now starts with a compact account header populated from the authenticated member's profile name and resilient avatar, plus a dedicated phone-only close control. Navigation is grouped under Social, Music & Entertainment, and Account without removing or rerouting any working destination. The drawer uses an 86vw/340px maximum width, safe-area padding, independent overscroll containment, existing Back/Escape/outside-click dismissal, and the same PWA cache-refresh path.
- Verification: all **238 of 238** JavaScript regression programs pass, along with release verification, the 11-page site smoke suite, infrastructure template/Lambda syntax validation, and `git diff --check`. A locally served visual inspection confirmed the profile shortcut and grouped line-icon rail on desktop; focused mobile tests verify the off-canvas maximum width, safe area, close control, history behavior and touch targets. This remains **NOT DEPLOYED**.
- Profile-header implementation commit: `e2d5d01b58eed580bafac3e23b811912eb8cea94` on `danzstak-patch-1`.

## Mobile notification navigation

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- The phone notification drawer now participates in browser history: Back dismisses notifications and restores focus to the opener; Forward restores the drawer without creating a loop.
- Desktop notification routing is unchanged. History stores only a boolean drawer marker and never stores notification text, actor identity, email or account data.
- Existing notification count privacy, partial-source resilience, unread handling, friend-request actions, outside-click dismissal, workspace preservation and Messages mutual exclusion remain intact.
- Verification: **10 of 10** notification regression programs passed, along with JavaScript syntax and PWA shell-cache verification.
- Implementation commit: `746965b5ee7f45441032da0f442d0fb00350240f` on `danzstak-patch-1`.

## Mobile Chat navigation

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Opening a conversation in the standalone mobile Messages page now creates a privacy-safe browser-history entry. Android/iPhone Back returns to the conversation list instead of leaving Messages, and Forward restores the chat without creating a history loop.
- History state contains only a boolean view marker; it does not store the contact's email, message content or account identifier.
- Desktop Chat and embedded Chat drawers do not modify browser history. Existing per-chat drafts, optimistic sends, calls, media attachments, reactions, read receipts and conversation deletion remain unchanged.
- The standalone mobile minimize control now consumes the same history entry as Close, preventing a hidden stale conversation state from breaking the next browser Back action. Embedded minimize continues to use the parent-drawer message protocol.
- Verification: **48 of 48** focused messaging, calling, presence and notification regression programs passed; PWA shell refresh passed; the locally served Messages page loaded with its accessible list, filters, recovery state and composer structure intact.
- Implementation commit: `5f0d4b3bf4b91435ecdfe8165a2a3b0ea084fc9f` on `danzstak-patch-1`.
- History-safe minimize follow-up: `0c39e17ad3ad4ec3ff92c03852b7a96b2fcfc624`.

## Stripe integration on `danzstak-patch-1`

Status as of 2026-11-03: **TEST MODE DEPLOYED; LOCAL ENTITLEMENT TESTS PASS; HOSTED SUCCESSFUL-CARD TEST REQUIRES MANUAL COMPLETION; LIVE PAYMENTS DISABLED**.

- Test catalog and deployment-policy implementation commit: `9b27dba7ee94837aafefe7a0ac0a4e8ceea2b855` on `danzstak-patch-1`.

### Verified account and immutable Live catalog

- AWS Secrets Manager `danzstak/stripe/secret-key` authenticates in Test Mode to Stripe account `acct_1RRZmKFgtfNMBXOV`, display name **SFScoop**. Secret values were not printed, logged or committed.
- The supplied publishable Test key and the AWS-managed secret Test key were conclusively matched to the same Stripe account with a no-charge PaymentMethod create/retrieve check. No charge or PaymentIntent was created.
- The existing Live Mode objects were inspected read-only in the authenticated SFScoop dashboard: contact unlock `prod_VYruR0GLph8xsy` / `price_1UXkB5FgtfNMBXOVVeUOGJjX` at USD 0.75; Tour Manager `prod_VYr5JIwpaFSX7b` / `price_1UXjMtFgtfNMBXOVCLeEk8vI` at USD 1.50; phone activation `prod_VYrUnT8yvXS0Ek` / `price_1UXjlYFgtfNMBXOVD42xjrTc` at USD 3.00. No Live object was changed.
- `TOUR_MANAGER_LIVE_PAYMENTS` remains false. The branch has not been merged into `main`, and no production frontend or Live payment deployment was performed.

### New matching Test Mode products

All three objects were created in Test Mode only under SFScoop and re-read from Stripe as active, `livemode: false`, USD, one-time Prices:

| Purchase | Test Product | Test Price | Amount |
|---|---|---|---:|
| Booking Contact Unlock | `prod_VYwF2z3cYoe72u` | `price_1UXoMsFgtfNMBXOVSmnWDFGa` | USD 0.75 |
| Professional Tour Manager / booking-email unit | `prod_VYwFT1LQyqjsxc` | `price_1UXoMtFgtfNMBXOV1fqlkuRf` | USD 1.50 |
| DANZSTAK Phone Number activation | `prod_VYwFZRXzQ3dNNv` | `price_1UXoMuFgtfNMBXOVNxfRWRDp` | USD 3.00 |

- The Node.js billing service now selects the Test catalog for `sk_test_` and the unchanged Live catalog only for an explicitly enabled `sk_live_` environment. Checkout records, webhook validation and entitlement records must all agree on the environment-specific Price and Product.
- Contact purchases remain scoped to one authenticated user's saved venue. Tour Manager purchases activate Professional access and add the purchased booking-email units atomically. Phone purchases create `pending_provisioning` only and never claim that a telephone number was assigned.

### Deployed Test webhook

- Public HTTPS URL: `https://api.danzstak.com/tour-manager/stripe/webhook`
- Stripe Test endpoint ID: `we_1UXoPzFgtfNMBXOV05UR9jPa`
- Required/enabled events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
- AWS region: `us-west-1`
- Lambda: `DANZSTAK-TourManager-Stripe-Test`
- API Gateway HTTP API: `DANZSTAK-Auth-HTTP-API` (`0872gqal4m`)
- Webhook signing secret: stored separately in AWS Secrets Manager at `danzstak/stripe/webhook-secret`; the value is not in Git, Lambda environment variables, this report or logs.
- The Lambda execution role has a least-privilege DynamoDB policy limited to the required operations on `DANZSTAK-Tours`. Stripe signature verification is mandatory at the application layer.

### Test results

- **PASS — Stripe object verification:** all three Test Products and Prices are active, one-time, USD, `livemode: false`, use the expected amounts, and belong to the verified SFScoop Test account.
- **PASS — local successful purchases and entitlements:** signed completion grants the correct Tour Manager credits/Professional entitlement, single-venue contact entitlement, or phone `pending_provisioning` entitlement; exact amount/Product/Price/account binding is enforced.
- **PASS — local failure, tamper and duplicate handling:** invalid signatures, wrong amounts, mismatched products, failed/expired states and duplicate events do not grant access. Refund, partial-refund review and duplicate-refund tests pass.
- **PASS — deployed endpoint security:** an invalid signature returns HTTP 400. A correctly signed unpaid Test Checkout event returns HTTP 200 without granting an entitlement.
- **PASS — actual Stripe-delivered expiration path:** Test Checkout Session `cs_test_a1Y7aDZfrsV76Juxv9TeWVHY8vk04nSTqLRB3b8BDBTRmgHwL286gmADuW` was expired through Stripe. Stripe delivered `checkout.session.expired`; the DynamoDB checkout changed to `expired`; booking-email credits and Professional entitlement remained absent.
- **PASS — regression programs:** Tour Manager billing, booking-contact unlock, phone activation, refunds and secret-loading suites pass. Site smoke tests pass for 11 pages. `git diff --check` passes.
- **PASS — hosted successful-card purchases:** all three manual Stripe-hosted Test Mode payments reached the deployed signed webhook and created only the intended DynamoDB purchase and entitlement records. The phone purchase remained `pending_provisioning` until its controlled refund and never claimed an assigned number.
- **PASS — hosted refunds:** full Test Mode refunds for Contact Unlock, Booking Email Credit/Professional Tour Manager and Phone Activation were delivered through `charge.refunded`, processed once, and applied the correct scoped reversal. No Live transaction was refunded.

### Remaining review gate before Live Mode

1. Owner review of the completed Test Mode payment/refund evidence is required before any Live Mode work.
2. Keep Live Mode disabled and do not merge to `main` until explicitly approved.

## Stripe products and Tour Manager credits

Status as of 2026-11-04: Test Mode checkout, signed webhook, scoped entitlement and controlled full-refund verification complete for all three products; Live payments disabled.

## Dual payment architecture

Status as of 2026-11-04: **STRIPE TEST INFRASTRUCTURE AND CONTROLLED HOSTED PAYMENT/REFUND TESTS COMPLETE; LIVE MODE DISABLED; SFS/PHANTOM BLOCKED AND DISABLED**.

- Stripe remains under the existing SFScoop Stripe account. Three matching Test Mode Products were created with owner authorization; no Live Product, bank connection, SFScoop payment workflow, liquidity pool or token contract was changed.
- DANZSTAK entitlements and the transaction ledger are provider-neutral. Professional Tour Manager, venue contact unlocks, assigned-number activation and booking-email credits store the payment method and immutable provider reference separately from the entitlement key.
- Stripe and a future SFS verifier therefore can fulfill the same purchase-specific records without mixing their verification logic. Stripe uses signed webhooks plus a server-retrieved Checkout Session; future SFS payments require independent on-chain verification before the shared entitlement transaction is allowed.
- DANZSTAK remains functional without SFScoop, Phantom or wallet connectivity. No wallet UI, Phantom SDK, token quote, receiving wallet or SFS transaction endpoint has been added.
- SFS activation is blocked pending approval of the network, canonical token contract/mint and decimals, receiving wallet, authoritative exchange-rate source, quote expiry/rounding, wallet challenge, finality rule, RPC provider, transaction parsing, replay protection and refund policy.
- Architecture and mandatory negative tests: `docs/DUAL-PAYMENT-ARCHITECTURE.md`.
- Architecture commit: `3947f43baa5fac056ec52c929469cf2f72840d72` on `danzstak-patch-1`.
- Regression check: Tour Manager Stripe, contact unlock, assigned-number Stripe, booking-email credit lifecycle and Tour Manager dashboard tests all pass locally.

## Tour Manager production build

### Existing-system audit

- Status: **COMPLETE**.
- Frontend: static HTML, CSS and browser JavaScript; this is not React.
- Backend: Node.js Lambda behind API Gateway with Cognito authentication, DynamoDB persistence, Amazon Location route calculations, Amazon SES outbound booking email, and S3-backed EPK media.
- Existing working foundations: worldwide locality resolution and route discovery, sourced venue leads with provider diagnostics, saved tours, a private booking workspace, published and revocable EPK links, local tour-cost inputs, Stripe Checkout/webhook credit ledger, venue-contact entitlement, and idempotent SES submission with failed-send credit restoration.
- Audit conclusion: these foundations were fragmented across the route planner, booking pipeline, EPK and billing code. The production build must join them without duplicating payment or tour records.

### Integrated booking pipeline and dashboard

- Status: **IN PROGRESS; NOT DEPLOYED**.
- Implemented on `codex/tour-manager-production`: authenticated outreach history, the ten required booking statuses, legacy-status migration, confirmation-evidence and show-date enforcement, performance fee and currency fields, reply/terms notes, a responsive calendar with open-night warnings, and aggregate selected/sent/reply/confirmed/declined counts.
- Expense calculation: server-side persistent inputs and estimates for distance, fuel, tolls, parking, rental, rooms, lodging, people, meals, equipment, crew, miscellaneous costs, contingency, booking emails, confirmed revenue, potential revenue, break-even and projected result. Performance fees contribute only when their currency matches the tour currency. Values remain explicitly estimates.
- EPK enforcement: the reviewed outbound message must contain the exact saved HTTPS EPK URL. Public EPK pages remain accessible without a DanzStak account when the artist publishes them.
- Email tracking: `GET /tour-manager/outreach` returns account-isolated provider submission state. A successfully accepted SES send is displayed as sent; a draft or attempted send cannot become a confirmed show.
- Tests passing locally: workspace account isolation and optimistic revision checks; status and confirmation gating; EPK enforcement; outreach history; Stripe/contact-unlock regression tests; credit reservation/finalization/restoration; expense, calendar and narrow-phone source checks.

### Pending Tour Manager work

- Status: **IN PROGRESS**.
- Worldwide venue discovery needs live multi-provider benchmarks and current-data moderation before it can be called production complete. Provider failure must remain distinct from a true empty result.
- Inbound reply ingestion and secure correlation to the correct outbound message are **NOT STARTED**. SES receipt rules, a reply address design, spam/virus checks, and a controlled reply parser are required.
- Automatic route recalculation around fixed confirmed dates is **NOT STARTED**. Existing Amazon Location routing can calculate routes, but confirmed-stop anchoring and pending-stop optimization require a separate tested algorithm.
- SFS Token payments are **BLOCKED** pending the chain/network, token contract address, supported wallet protocol, authoritative exchange-rate source, finality rule, recipient wallet, and server-side transaction-verification method. No SFScoop account dependency will be introduced.
- Delivery/bounce/complaint events and a suppression policy are **NOT STARTED**. SES provider acceptance is not the same as recipient delivery.
- The requested 30-day/20-show/100-contact end-to-end test remains **BLOCKED** on controlled recipient addresses, SES event handling and inbound reply routing. Stripe Test secrets and the signed endpoint are now configured. No promotional email will be sent as a test.

### Estimated operating-cost inputs

- Stripe standard US domestic card pricing is currently listed as 2.9% plus USD 0.30 per successful transaction; actual account/country pricing can differ: https://stripe.com/pricing
- Amazon SES currently lists USD 0.10 per 1,000 outbound emails in its a-la-carte table, plus attachment/data and optional feature charges: https://aws.amazon.com/ses/pricing/
- Amazon Location route cost depends on request type and Core/Advanced/Premium features; route matrices are billed per origin-destination pair: https://docs.aws.amazon.com/location/latest/developerguide/routes-pricing.html
- DynamoDB, Lambda, API Gateway, S3, CloudWatch, geocoding/search providers, inbound mail processing and data transfer remain usage-based and must be measured from the deployed workload before a reliable per-tour margin is claimed.

### Unlock Booking Contact

- Status: **COMPLETE in development; NOT DEPLOYED**.
- Stripe Product: `prod_VYruR0GLph8xsy`
- Stripe Price: `price_1UXkB5FgtfNMBXOVVeUOGJjX`
- Live configuration verified read-only as active, USD 0.75 one time. Matching Test Price: `price_1UXoMsFgtfNMBXOVSmnWDFGa` on Product `prod_VYwF2z3cYoe72u`, verified active and `livemode: false`.
- Implementation: uses the existing Tour Manager Stripe Checkout and signed webhook. Checkout is limited to a saved venue with a public direct contact. Successful verified payment creates one account-and-venue-specific entitlement; webhook retries and repeat purchases do not duplicate the entitlement or charge flow.
- Interface: official website, map, and evidence stay available; direct email/phone and email outreach remain locked until the entitlement is active. Locked contacts are excluded from CSV contact exports.
- Tests: fixed Price and amount, saved-contact validation, signature verification, tampered-amount rejection, entitlement persistence, duplicate webhook protection, and repeat-purchase prevention pass locally.
- Deployment: no production deployment or live payment activation was performed.

### Tour Manager booking emails

- Stripe Product: `prod_VYr5JIwpaFSX7b`
- Stripe Price: `price_1UXjMtFgtfNMBXOVCLeEk8vI`
- Expected amount: USD 1.50 one time for each booking-email credit.
- Implementation: Checkout quantities, signed webhook verification, immediate and delayed payment handling, DynamoDB credit ledger, duplicate-event protection, booking-email reservation, provider acceptance, failed-send restoration, and balance/history UI are integrated on `danzstak-patch-1`.
- Test status: local signature, amount, delayed-payment, idempotency, ledger, reservation, final deduction, failed-send restoration, and Amazon SES mailbox-simulator tests pass.
- Matching Test Price: `price_1UXoMtFgtfNMBXOV1fqlkuRf` on Product `prod_VYwFT1LQyqjsxc`, verified active and `livemode: false`. The deployed endpoint processed an actual Stripe-delivered expiration event, a successful hosted Checkout, and a full controlled refund with the expected credit and Professional-entitlement reversal.

### DANZSTAK phone number

- Stripe Product: `prod_VYrUnT8yvXS0Ek`
- Stripe Price: `price_1UXjlYFgtfNMBXOVD42xjrTc`
- Live amount verified read-only as USD 3.00 one time. Matching Test Price: `price_1UXoMuFgtfNMBXOVNxfRWRDp` on Product `prod_VYwFZRXzQ3dNNv`, verified active and `livemode: false`.
- Implementation status: deployed to the isolated Test Lambda. A verified successful payment creates one idempotent phone-activation entitlement and does not add booking-email credits. Activation remains `pending_provisioning` until the telecommunications provider confirms provisioning.
- Cost boundary: the one-time activation fee will not be represented as covering number rental, calls, messages, carrier charges, recurring costs, or permanent number availability. Those costs and any renewal policy must be independently configurable before launch.

### Required test configuration

The isolated Lambda is `DANZSTAK-TourManager-Stripe-Test` in `us-west-1`. It is deployed for Test Mode only. Live payments remain disabled. The runtime retrieves both secrets through its least-privilege IAM role.

Required server-side configuration, without committing secret values:

- `danzstak/stripe/secret-key`: existing SFScoop Stripe Test Mode key, retrieved at runtime.
- `danzstak/stripe/webhook-secret`: endpoint-specific Test Mode signing secret, retrieved separately at runtime; configured without exposing its value.
- `TOUR_MANAGER_LIVE_PAYMENTS=false`: retain during testing.

Public test webhook URL:

`https://api.danzstak.com/tour-manager/stripe/webhook`

Required webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Controlled manual Test Checkouts and full refunds have now passed for all three purchases. Live processing remains disabled and requires explicit owner approval plus a separate Live configuration review; Test Mode keys, endpoint secrets and sessions must never be reused as Live credentials.
