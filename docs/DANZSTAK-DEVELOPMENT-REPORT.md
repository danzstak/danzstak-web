# DANZSTAK Development Report

Last updated: 2026-11-03  
Repository: `Danzstak/Danzstak-web`  
Report branch: `codex/brand-icon`

This document records verified repository and deployment status. It intentionally excludes passwords, secret keys, webhook signing secrets, private tokens, and customer data.

## Status legend

- **COMPLETE** — implemented and verified for the stated scope.
- **IN PROGRESS** — implementation exists but required work or verification remains.
- **BLOCKED** — cannot proceed without a decision, credential, external service, or configuration.
- **NOT STARTED** — no implementation was found for the stated scope.

## 1. Completed work

### Official DANZSTAK brand icon — COMPLETE (development branch)

- Reused the original standalone metallic silver-and-orange DANZSTAK D artwork, including its play triangle and equalizer details.
- Added the transparent D to the compact social-feed header and Home navigation.
- Updated favicons, Android/PWA icons, the Apple touch icon, manifest references, loading/cache assets, and the principal site pages.
- Kept the full DANZSTAK logo on the landing page without adding another full-logo display.
- Kept the social interface light-mode and responsive.
- Commit: `67a3050` (`Use official DanzStak D across app branding`).
- Deployment status: **NOT STARTED**. The branch has been pushed for review but has not been deployed to production.

### Existing product areas confirmed in the repository — IN PROGRESS

- Social feed, profiles, friends, Tribes, messages, stories/Flashes, posts, comments, reactions, notifications, and PWA support have working source and regression coverage.
- Booking Agent, tour workspace, EPK, record-store discovery, routing, booking pipeline, and contact-sheet source are present.
- These areas are not declared fully complete here because live worldwide coverage and complete end-to-end production behavior were not revalidated as part of the brand-icon task.

## 2. Current development

### Brand-icon review — COMPLETE

- Development branch is available for review at `codex/brand-icon`.
- Production deployment remains intentionally pending review.

### Stripe payment foundation — NOT STARTED

- No Stripe SDK dependency, Checkout Session creation, webhook signature verification, payment ledger, email-credit ledger, phone-number entitlement handler, or Stripe webhook route was found on the reviewed branch.
- No public Stripe webhook URL exists in the reviewed implementation.

## 3. Pending tasks

1. Review and merge the official D brand-icon branch.
2. Decide whether the existing stale cache-version assertions should be repaired separately on the main development line.
3. Implement one shared Stripe Checkout and verified webhook system for all DANZSTAK products.
4. Implement persistent, idempotent purchase records and the booking-email credit ledger.
5. Implement phone-number purchase entitlement and telecommunications provisioning separately from email credits.
6. Identify and document the third Stripe product's product ID, price ID, amount, currency, billing type, and intended entitlement.
7. Revalidate Booking Agent, worldwide venue discovery, EPK delivery, record-store discovery, routing, and cost calculations against live services before assigning COMPLETE status.

## 4. Stripe integration

Overall status: **NOT STARTED in repository code**

### Product 1 — Tour Manager booking emails

- Stripe Product ID: `prod_VYr5JIwpaFSX7b`
- Stripe Price ID: `price_1UXjMtFgtfNMBXOVCLeEk8vI`
- Expected price: $1.50 USD per booking email, one-time.
- Dashboard verification during this report update: **NOT COMPLETED**.
- Checkout implementation: **NOT STARTED**.
- Webhook processing: **NOT STARTED**.
- Persistent email-credit allocation and deduction: **NOT STARTED**.
- Failed-send credit restoration: **NOT STARTED**.

### Product 2 — DANZSTAK phone number

- Stripe Product ID: `prod_VYrUnT8yvXS0Ek`
- Stripe Price ID: `price_1UXjlYFgtfNMBXOVD42xjrTc`
- Dashboard verification: **COMPLETE** — active product, $3.00 USD.
- Billing model shown by the supplied configuration: one-time price.
- Checkout implementation: **NOT STARTED**.
- Phone-number activation entitlement: **NOT STARTED**.
- Telecommunications provider provisioning: **NOT STARTED**.
- Recurring number rental, calling, messaging, and usage costs remain undefined and must not be represented as covered by the one-time activation fee.

### Product 3

- Stripe dashboard product count reported by the project owner: three products.
- Product ID: **BLOCKED — not yet identified in the repository or supplied to this report**.
- Price ID, amount, currency, billing type, and entitlement: **BLOCKED — information required**.

### Stripe webhook and payment status

- Public HTTPS webhook URL: **NOT STARTED / not available**.
- Required signature secret storage: **NOT STARTED**; when implemented, it must be stored server-side in an approved AWS secret/configuration service and never committed.
- Required events are not yet configured in code. Expected implementation must at minimum safely process successful Checkout payments, asynchronous success/failure where enabled, expiration/failure, and duplicate event delivery.
- Test-mode end-to-end payment verification: **NOT STARTED**.
- Live payments: **NOT STARTED and not approved for deployment**.

## 5. AWS infrastructure

Overall status: **IN PROGRESS**

### Repository infrastructure

- `infrastructure/auth-api` — authentication and primary API Lambda source.
- `infrastructure/call-signaling` — calls, presence, friends, profiles, messages, stories, notifications, news, push subscriptions, and related DynamoDB/API resources.
- `infrastructure/engagement` — reactions, comments, reports, groups, legal acceptance, profile video, and engagement tables/routes.
- `infrastructure/mail-server` — DANZSTAK mail-server infrastructure.
- `infrastructure/support-email-forwarder` — support-email processing.
- `infrastructure/campaign` — campaign assets and launch configuration.

### Public endpoints referenced by the web client

- Website: `https://danzstak.com`
- API origin: `https://api.danzstak.com`
- Auth callback in source: `https://api.danzstak.com/auth/callback`

### Deployment status

- Existing production website/API references are present in source and current pages use them.
- Brand-icon branch deployment: **NOT STARTED**.
- Stripe infrastructure deployment: **NOT STARTED**.
- Live AWS stack state was not changed or comprehensively audited during this report update.

## 6. Booking and Tour Manager

Overall status: **IN PROGRESS**

- Venue discovery source and regression tests exist, including conversational planning, map drawing, route markets, reviewed-directory fallback, venue quality, manual venues, contact sheets, booking pipeline, and workspace APIs.
- Route planning includes intermediate-market test coverage rather than only origin and destination.
- EPK source and media-management routes exist.
- Record-store discovery UI and API integration source exist.
- Booking-email payment credits: **NOT STARTED**.
- Credit reservation before email submission, final deduction after provider acceptance, duplicate-send protection, and failed-send restoration: **NOT STARTED**.
- Verified EPK delivery through paid booking-email outreach: **NOT STARTED**.
- Tour cost calculations: **NOT VERIFIED in this report update**.
- Worldwide live venue and record-store accuracy: **IN PROGRESS**; repository architecture and tests do not prove exhaustive live coverage.

## 7. Errors and blockers

1. **BLOCKED — third Stripe product metadata:** product ID, price ID, price, currency, billing type, and intended entitlement are required.
2. **BLOCKED — Stripe server configuration:** webhook signing secret and API key must eventually be configured server-side, but no secret values belong in this report or repository.
3. **BLOCKED — telecommunications model:** provider, provisioning API, recurring number rental, calling, messaging, and usage pricing must be selected before phone-number activation can be completed.
4. **IN PROGRESS — regression baseline:** the broad suite encounters pre-existing cache-version assertions that expect `feed-enhancements.css?v=482`, while `origin/main` already loads `v=483`. This is unrelated to the brand-icon changes and should be corrected in a separate change.

## 8. Testing results

### Brand-icon task

- **PASS** — `node test-brand-icon.cjs`
- **PASS** — `node test-navigation-layout.cjs`
- **PASS** — `pwsh -NoProfile -File test-site.ps1` (11 pages)
- **PASS** — `git diff --check`
- **PASS** — Microsoft Edge visual rendering checks at 390 × 844 mobile and 1440 × 900 desktop sizes.
- **PASS** — manifest icon dimensions and alpha-capable PNG formats verified by automated tests.

### Broader regression suite

- **PARTIAL PASS** — numerous account, authentication, booking, call, navigation, engagement, EPK, record-store, messaging, and safety tests passed before the suite reached a stale cache-version assertion.
- **FAIL (pre-existing baseline assertion)** — `test-feed-action-feedback.cjs` expects stylesheet cache key `v=482`; `origin/main` already references `v=483`.
- **FAIL (pre-existing baseline assertion)** — `test-pwa-shell-refresh.cjs` has the same stale `v=482` expectation.
- Stripe Checkout/webhook/credit tests: **NOT STARTED** because no implementation exists on this branch.

## 9. Information needed from ChatGPT

1. Research and recommend the safest AWS design for Stripe webhook signature verification and an atomic, idempotent shared entitlement ledger without introducing a second payment system.
2. Confirm which Stripe events are required for immediate and delayed payment methods in the intended countries.
3. Recommend reasonable minimum/maximum booking-email quantities and abuse controls.
4. Define the third Stripe product's intended customer entitlement once its IDs and billing details are supplied.
5. Recommend a sustainable phone-number model covering recurring rental and usage fees without implying permanent availability from a one-time fee.
6. Review whether stale cache-version tests should be fixed on the main branch before the brand-icon branch is merged.

## Update record

- 2026-11-03 — Initial central report created on `codex/brand-icon`; recorded the completed brand-icon development task, current repository/AWS status, verified phone-number Stripe price, unimplemented payment work, test results, and blockers.
