# DANZSTAK development report

## ChatGPT status bridge — 2026-11-03

Status: **CURRENT FOR `danzstak-patch-1`; TEST PAYMENTS ONLY; LIVE PAYMENTS DISABLED**.

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
- **INCOMPLETE — hosted successful-card verification:** no claim is made that a Stripe-hosted successful purchase has completed end to end for all three products. One manual Stripe Test Mode Checkout per product, followed by DynamoDB entitlement inspection, is still required.
- **INCOMPLETE — hosted refund verification:** one Test Mode refund per entitlement type must still be delivered by Stripe and checked for the expected entitlement revocation or credit restoration.

### Remaining owner actions for Stripe

1. Complete one Stripe-hosted Test Mode Checkout for each of the three products using a Stripe test card.
2. Confirm the resulting Stripe-delivered success events in the endpoint delivery log and confirm the matching DynamoDB entitlements.
3. Issue one Test Mode refund per entitlement type and confirm the corresponding revocation/restoration behavior.
4. Keep Live payments disabled and do not merge to `main` until those manual end-to-end results are reviewed and approved.

### Current DANZSTAK product status

| Product area | Factual status |
| --- | --- |
| Chat | **IN PROGRESS; DEVELOPMENT BUILD NOT DEPLOYED.** Core direct messaging, compact WhatsApp-familiar responsive UI, editing/options, notifications and implemented call controls have automated coverage. The latest header/search/icon work is verified locally. The external booking-email-to-Chat reply bridge and its production inbound-email proof are not complete, so that workflow is not claimed operational. |
| Booking Agent | **IN PROGRESS; NOT PRODUCTION-COMPLETE.** Worldwide locality resolution, route-oriented discovery, sourced venue leads, provider diagnostics, saved tours and contact workflow foundations exist. Live multi-provider benchmark coverage, current-data moderation and production-scale route discovery still require verification; results must not be treated as an exhaustive worldwide venue index. |
| EPK | **IN PROGRESS; CORE DEVELOPMENT WORK EXISTS.** The editor, S3-backed media handling, revocable public sharing link and outbound EPK-link enforcement have focused regression coverage. AI research expansion, professional PDF/export completeness and a production end-to-end outreach delivery proof are not claimed complete. |
| Tour Manager | **IN PROGRESS; TEST PAYMENT BACKEND DEPLOYED, FULL PRODUCT NOT DEPLOYED.** Saved-tour/outreach/dashboard and entitlement foundations exist, and the isolated Stripe Test webhook is active. Inbound reply correlation, automatic confirmation/calendar updates, continuous route recalculation, full delivery/bounce telemetry and the controlled 30-day/20-show/100-contact end-to-end test remain incomplete. SFS Token checkout is intentionally not active. |

### Source and deployment record

- Branch: `danzstak-patch-1`.
- Source revision immediately before this report update: `9468fb24dbf32fe882b189774f1bcfae302b8f3b`.
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
- **PENDING — hosted successful-card purchase:** Stripe Checkout deliberately blocks automated form completion. One manual Test Mode Checkout using a Stripe test card is still required to demonstrate Stripe-hosted successful payment delivery against the deployed endpoint. Local signed-success and atomic entitlement tests already pass, but they are not being misreported as a hosted payment.

### Remaining blocker before approval

1. Complete one controlled manual Test Mode Checkout for each purchase type, then verify the Stripe-delivered success event and resulting DynamoDB entitlement. Use Stripe test cards only; no real charge is required.
2. After those three manual successes, exercise one Test Mode refund per entitlement type and confirm revocation/restoration behavior through the deployed webhook.
3. Keep Live Mode disabled and do not merge to `main` until the owner reviews those results.

## Stripe products and Tour Manager credits

Status as of 2026-11-03: test infrastructure implemented; live payments disabled.

## Dual payment architecture

Status as of 2026-11-03: **STRIPE TEST INFRASTRUCTURE DEPLOYED; MANUAL HOSTED SUCCESS TEST PENDING; SFS/PHANTOM BLOCKED AND DISABLED**.

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
- Matching Test Price: `price_1UXoMtFgtfNMBXOV1fqlkuRf` on Product `prod_VYwFT1LQyqjsxc`, verified active and `livemode: false`. The deployed endpoint processed an actual Stripe-delivered expiration event; a manual successful Test Checkout remains pending.

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

Before Live processing is considered, complete controlled manual Test Checkouts for all three purchases and verify the resulting Stripe-delivered events and DynamoDB entitlements. Do not activate live processing until all products have complete test-mode checkout, webhook, duplicate-event, entitlement, provisioning-failure, refund and recovery tests.
