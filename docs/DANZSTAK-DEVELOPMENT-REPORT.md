# DANZSTAK development report

## Mobile The Roll navigation

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- Opening The Roll fullscreen on a phone now creates a privacy-safe browser-history entry. Android/iPhone Back closes the viewer and returns to the same Your Mix position; Forward restores fullscreen without creating a history loop.
- The close button and Escape use the same history-safe path. Desktop behavior remains direct and removes a stale phone marker if the viewport changes while fullscreen is open.
- Existing autoplay, data-saver handling, site-wide sound preference, accessible player labels, URL validation, network recovery and media refresh behavior remain intact. History stores only a boolean marker and no video URL, title, author or account data.
- Verification: **11 of 11** focused Roll, video, navigation and PWA regression programs passed, along with JavaScript syntax and whitespace checks. A locally served phone-width browser check confirmed Open fullscreen, Back-to-feed with launcher focus restored, and Forward-to-fullscreen.
- Implementation commit: `e617d95d033133054eb5ed119f0f66e63c359f0f` on `danzstak-patch-1`.

## Mobile navigation drawer

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.

- The phone navigation drawer now participates in browser history. Back, Escape, the Menu toggle and an outside tap dismiss it; Forward restores it without creating a loop.
- Selecting a menu destination still closes immediately and preserves the existing workspace route behavior. Crossing to the desktop breakpoint closes the drawer and restores the desktop rails.
- The existing body-scroll lock, dimmed backdrop, initial-link focus and opener-focus restoration remain intact. History stores only a boolean menu marker and no user, route or menu-label data.
- Verification: **9 of 9** focused mobile navigation, notification coexistence, desktop navigation and PWA cache checks passed.
- Implementation commit: `d6602a6bdb131ee8828a9a8661f86edff8416103` on `danzstak-patch-1`.

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

Status as of 2026-11-03: **COMPLETE IN LOCAL DEVELOPMENT; STRIPE-HOSTED TEST BLOCKED; NOT DEPLOYED; LIVE PAYMENTS DISABLED**.

- Branch: `danzstak-patch-1`
- Stripe implementation commit: `e61208e73792f8bac7c5bf1ff3752f0e3d73c7db`

### Implemented

- Integrated one signed Stripe webhook and Checkout service for all three existing SFScoop-account products. No Stripe account or Product was created and no SFScoop payment workflow was modified.
- Booking contact unlock: Product `prod_VYruR0GLph8xsy`, Price `price_1UXkB5FgtfNMBXOVVeUOGJjX`, expected USD 0.75 one time. Fulfillment is permanently scoped to the authenticated account and selected saved venue.
- Professional Tour Manager / booking-email unit: Product `prod_VYr5JIwpaFSX7b`, Price `price_1UXjMtFgtfNMBXOVCLeEk8vI`, expected USD 1.50 one time. Verified fulfillment activates the Professional entitlement and grants the purchased email units through the existing atomic credit ledger.
- Assigned-number activation: Product `prod_VYrUnT8yvXS0Ek`, Price `price_1UXjlYFgtfNMBXOVD42xjrTc`, expected USD 3.00 one time. Verified payment creates a `pending_provisioning` entitlement only; it does not assign a number until a telecommunications provider confirms provisioning.
- The webhook re-fetches the Checkout Session from Stripe and validates exact Product, Price, currency, amount, quantity, account/user binding, environment and stored pending checkout before granting access. Stripe event IDs and DynamoDB conditional transactions prevent duplicate fulfillment.
- Test keys and signing secrets remain server-side. Live keys fail closed unless `TOUR_MANAGER_LIVE_PAYMENTS=true`; that flag remains disabled.
- The provider-neutral ledger retains `paymentMethod`, allowing a future independently verified Phantom/SFS Token payment processor to grant the same entitlement types. Token payments are **NOT STARTED** and are not active.

### Endpoint and required Stripe events

- Public HTTPS webhook URL: `https://api.danzstak.com/tour-manager/stripe/webhook`.
- API Gateway verification: `api.danzstak.com` maps to the default stage of `DANZSTAK-Auth-HTTP-API`, and the webhook route currently exists.
- Required events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.
- Current AWS test configuration: `DANZSTAK-TourManager-Stripe-Test` is active, but its environment contains neither `STRIPE_SECRET_KEY` nor `STRIPE_TOUR_MANAGER_WEBHOOK_SECRET`. The public route therefore cannot process a real test webhook yet.

### Tests

- **PASS locally**: webhook HMAC verification and timestamp tolerance; test/live gate; delayed payment; exact Tour Manager Product/Price/amount; atomic Professional entitlement and credit grant; Stripe retry idempotency.
- **PASS locally**: exact booking-contact Product/Price/amount; saved-contact validation; tampered payment rejection; venue-scoped entitlement persistence; duplicate purchase prevention.
- **PASS locally**: exact phone Product/Price/amount; signed fulfillment; duplicate prevention; `pending_provisioning` state; no false claim that provider provisioning succeeded.
- **PASS locally**: booking-email credit reservation, provider acceptance, final deduction, duplicate-send prevention and failed-send restoration; dashboard regressions.
- **PASS locally**: complete repository regression sweep, **229 passed and 0 failed**, including unrelated feed, Friends, PWA, profile, messaging, media, Booking Agent and EPK checks.
- **PASS locally**: production dependency audit, 0 known vulnerabilities across 37 production dependencies.
- **UPDATED LIVE TEST EVIDENCE (reverified 2026-11-03)**: AWS Secrets Manager contains `danzstak/stripe/secret-key`, and it was safely identified as a Stripe Test Mode key without printing its value. Stripe authenticated it as account `acct_1UXmCxDahXMLrQax` with dashboard display name and business name **DANZSTAK sandbox**, not SFScoop. The account has incomplete details, card charges disabled and zero active one-time Test Mode Prices. Each supplied Price ID returned Stripe `404`. AWS Secrets Manager in AWS account `635288116224` has no other Stripe or SFScoop secret. The recheck made no deployment and created no Checkout Session or charge.
- Stripe Test Mode verification evidence commit: `bd2178b1af8b0048d92771241128556941798853` on `danzstak-patch-1`.
- **BLOCKED**: `DANZSTAK-TourManager-Stripe-Test` is not wired to the Secrets Manager value and still has no webhook-signing secret. No Stripe-hosted Checkout or signed webhook was attempted, no Product was created, and no live charge was made.

### Remaining configuration

1. Owner action required: replace `danzstak/stripe/secret-key` with a restricted **test** key from the existing SFScoop Stripe account, or identify the approved secret name and AWS account/region where that key is stored. Then store the endpoint-specific **test** webhook signing secret alongside it; never commit either value.
2. Ensure Test Mode counterparts for the three approved products exist in that same account, then record their test Price IDs separately from live IDs. Do not recreate or alter live SFScoop products as a workaround.
3. Register the four events above for the public webhook URL, then run controlled test-card purchases for all three products, including webhook retry and delayed/failure cases.
4. Add the two new phone routes and contact-unlock routes to the test API only when approved for a controlled test. No production deployment was performed from this branch.
5. Do not merge to `main`, configure live keys or enable `TOUR_MANAGER_LIVE_PAYMENTS` until owner review.

## Stripe products and Tour Manager credits

Status as of 2026-11-03: test infrastructure implemented; live payments disabled.

## Dual payment architecture

Status as of 2026-11-03: **STRIPE LOCAL IMPLEMENTATION COMPLETE; STRIPE-HOSTED TEST BLOCKED; SFS/PHANTOM BLOCKED AND DISABLED**.

- Stripe remains under the existing SFScoop Stripe account. No Product, bank connection, SFScoop payment workflow, liquidity pool or token contract was changed.
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
- The requested 30-day/20-show/100-contact end-to-end test remains **BLOCKED** until Stripe test secrets, controlled recipient addresses, SES event handling and inbound reply routing are configured. No promotional email will be sent as a test.

### Estimated operating-cost inputs

- Stripe standard US domestic card pricing is currently listed as 2.9% plus USD 0.30 per successful transaction; actual account/country pricing can differ: https://stripe.com/pricing
- Amazon SES currently lists USD 0.10 per 1,000 outbound emails in its a-la-carte table, plus attachment/data and optional feature charges: https://aws.amazon.com/ses/pricing/
- Amazon Location route cost depends on request type and Core/Advanced/Premium features; route matrices are billed per origin-destination pair: https://docs.aws.amazon.com/location/latest/developerguide/routes-pricing.html
- DynamoDB, Lambda, API Gateway, S3, CloudWatch, geocoding/search providers, inbound mail processing and data transfer remain usage-based and must be measured from the deployed workload before a reliable per-tour margin is claimed.

### Unlock Booking Contact

- Status: **COMPLETE in development; NOT DEPLOYED**.
- Stripe Product: `prod_VYruR0GLph8xsy`
- Stripe Price: `price_1UXkB5FgtfNMBXOVVeUOGJjX`
- Expected configuration: active, USD 0.75 one time; Stripe API verification remains blocked on a test key.
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
- Blocker: the available Stripe Test Mode key addresses an account with no matching test Prices, and no endpoint signing secret is configured. A Stripe-hosted checkout/webhook cycle has not been verified.

### DANZSTAK phone number

- Stripe Product: `prod_VYrUnT8yvXS0Ek`
- Stripe Price: `price_1UXjlYFgtfNMBXOVD42xjrTc`
- Expected amount: USD 3.00 one time; Stripe API verification remains blocked on a test key.
- Implementation status: complete locally and not deployed. A verified successful payment creates one idempotent phone-activation entitlement and does not add booking-email credits. Activation remains `pending_provisioning` until the telecommunications provider confirms provisioning.
- Cost boundary: the one-time activation fee will not be represented as covering number rental, calls, messages, carrier charges, recurring costs, or permanent number availability. Those costs and any renewal policy must be independently configurable before launch.

### Required test configuration

The isolated Lambda is `DANZSTAK-TourManager-Stripe-Test`. It currently has live payments disabled and is not wired to the available Secrets Manager test key. No endpoint-specific webhook signing secret is configured.

Required server-side configuration, without committing secret values:

- `STRIPE_SECRET_KEY`: Stripe test restricted or secret key for the account containing both Prices.
- `STRIPE_TOUR_MANAGER_WEBHOOK_SECRET`: endpoint-specific test webhook signing secret.
- `TOUR_MANAGER_LIVE_PAYMENTS=false`: retain during testing.

Public test webhook URL:

`https://api.danzstak.com/tour-manager/stripe/webhook`

Required webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Before a controlled deployment, retrieve all three Price objects from Stripe and verify their active status, currency, unit amount, one-time type, livemode value, Product IDs, and shared Stripe account. Do not activate live processing until all products have complete test-mode checkout, webhook, duplicate-event, entitlement, provisioning-failure, and recovery tests.
