# DANZSTAK development report

## Stripe products and Tour Manager credits

Status as of 2026-11-03: test infrastructure implemented; live payments disabled.

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

### Worldwide radio-station discovery and outreach workspace

- Status: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.
- Implementation commit: `389c33c07ab36387d1b645302e1d94b537328cf1` on `codex/tour-manager-production`.
- Discovery accepts an unrestricted worldwide city or region plus an optional genre. It geocodes through the existing worldwide locality resolver, then combines AWS Places, OpenStreetMap Overpass and Google Places when configured. Public provider failures remain visible rather than being reported as a definitive empty market.
- Station classification recognizes public, community, college, campus, independent, internet, FM and AM radio terms while rejecting radio-repair, equipment and amateur-radio false positives. Results retain source attribution, public address, website, telephone, email and map position when providers supply them; no contact is invented.
- The new authenticated radio workspace supports multi-station selection, artist/genre/EPK details, proposed interview date and time, follow-up date, notes, editable artist-approved outreach drafts, optimistic revision checks and account-isolated DynamoDB persistence.
- Navigation, PWA shell caching and API Gateway deployment routes include the Radio Stations module. Backend routes are `POST /radio-stations/search`, `GET /radio-station-workspace` and `POST /radio-station-workspace`.
- Tests passed: backend/client syntax, discovery/provider architecture, authenticated route and persistence assertions, safe external-link rendering, workspace selection, existing record-store and venue-discovery regressions, booking account isolation, Tour Manager dashboard, email-credit ledger and the 12-page site smoke suite. Mobile and desktop static rendering were inspected locally.
- Limitation: the station workspace currently prepares and saves outreach but does not send through Tour Manager or ingest replies. Those functions remain blocked on the shared inbound/outbound conversation work below.

### Pending Tour Manager work

- Status: **IN PROGRESS**.
- Worldwide venue discovery needs live multi-provider benchmarks and current-data moderation before it can be called production complete. Provider failure must remain distinct from a true empty result.
- Inbound reply ingestion and secure correlation to the correct outbound message are **NOT STARTED**. SES receipt rules, a reply address design, spam/virus checks, and a controlled reply parser are required.
- Unified club, radio and record-store selections in one Tour Manager calendar are **IN PROGRESS**. Club calendar summaries exist, and radio/store workspaces persist proposed dates, but cross-workspace confirmation events and automatic calendar creation from replies are not implemented.
- Professional Tour Book Day Sheets and PDF export are **NOT STARTED**. No PDF itinerary should be presented as operational until confirmed/proposed separation, pagination and mobile/print rendering tests pass.
- Automatic route recalculation around fixed confirmed dates is **NOT STARTED**. Existing Amazon Location routing can calculate routes, but confirmed-stop anchoring and pending-stop optimization require a separate tested algorithm.
- SFS Token payment implementation is **IN PROGRESS; NOT DEPLOYED**. The branch now contains a provider-independent EVM wallet checkout, timestamped SFS/USD quote, exact ERC-20 transfer verification, chain/contract/treasury/finality checks, atomic credit grant, shared credit ledger, and global transaction replay protection. It remains operationally **BLOCKED** until the chain ID, deployed token contract, decimals, treasury wallet, trusted current-rate endpoint, RPC endpoint and required confirmations are supplied and tested. No SFScoop account dependency is introduced.
- Payment checkout UI is **COMPLETE IN DEVELOPMENT** for choosing Stripe or SFS, calculating `$1.50 × selected contacts`, displaying the full USD total, displaying an expiring verified SFS amount, and handing the exact ERC-20 transfer to a compatible injected wallet. The SFS panel was visually checked at a narrow mobile viewport. Static local testing correctly shows API fetch failures because the production API was not redirected to a mock server.
- Optional SFS earning path is **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**. Checkout links to `https://app.sfscoop.com` in a separate tab, preserves the saved DANZSTAK tour, explains that only eligible Engage promotions may award SFS through SFScoop's existing Proof of Engagement rules, and states that rewards and waiting periods vary and earnings are not guaranteed. DANZSTAK does not recreate Proof of Engagement or require a SFScoop account.
- Automated SFS tests are **PASSING** for a fresh timestamped rate, a 100-email `$150.00` quote, exact token base-unit calculation, chain ID, token contract, treasury recipient, successful receipt, confirmation depth, atomic credit grant, payment ledger entry, and repeated-transaction protection. These are controlled provider mocks, not a live-chain transaction.
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
- Stripe Price: `price_1UXkB5FgtfNMBXOVVeUOG`
- Dashboard verification: active, USD 0.75 one time.
- Implementation: uses the existing Tour Manager Stripe Checkout and signed webhook. Checkout is limited to a saved venue with a public direct contact. Successful verified payment creates one account-and-venue-specific entitlement; webhook retries and repeat purchases do not duplicate the entitlement or charge flow.
- Interface: official website, map, and evidence stay available; direct email/phone and email outreach remain locked until the entitlement is active. Locked contacts are excluded from CSV contact exports.
- Tests: fixed Price and amount, saved-contact validation, signature verification, tampered-amount rejection, entitlement persistence, duplicate webhook protection, and repeat-purchase prevention pass locally.
- Deployment: no production deployment or live payment activation was performed.

### Tour Manager booking emails

- Stripe Product: `prod_VYr5JIwpaFSX7b`
- Stripe Price: `price_1UXjMtFgtfNMBXOVCLeEk8vI`
- Expected amount: USD 1.50 one time for each booking-email credit.
- Implementation: Checkout quantities, signed webhook verification, immediate and delayed payment handling, DynamoDB credit ledger, duplicate-event protection, booking-email reservation, provider acceptance, failed-send restoration, and balance/history UI are implemented on `codex/tour-manager-stripe-webhook`.
- Test status: local signature, amount, delayed-payment, idempotency, ledger, reservation, final deduction, failed-send restoration, and Amazon SES mailbox-simulator tests pass.
- Blocker: no Stripe test secret or endpoint signing secret is configured, so the Price object and a Stripe-hosted checkout/webhook cycle have not been verified.

### DANZSTAK phone number

- Stripe Product: `prod_VYrUnT8yvXS0Ek`
- Stripe Price: `price_1UXjlYFgtfNMBXOVD42xjrTc`
- Expected amount: USD 3.00 one time. The dashboard product and amount were verified on 2026-11-03.
- Implementation status: intentionally not implemented yet and outside this booking-contact task. The product and displayed amount were verified in the dashboard, but the local environment and isolated AWS test Lambda still do not have a Stripe test secret for an end-to-end phone-entitlement test.
- Planned entitlement: a verified successful payment will create one idempotent phone-activation entitlement. It will not add booking-email credits. Activation will remain pending until the telecommunications provider confirms provisioning.
- Cost boundary: the one-time activation fee will not be represented as covering number rental, calls, messages, carrier charges, recurring costs, or permanent number availability. Those costs and any renewal policy must be independently configurable before launch.

### Required test configuration

The isolated Lambda is `DANZSTAK-TourManager-Stripe-Test`. It currently has live payments disabled and no Stripe secrets.

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

Before phone-product implementation, retrieve both Price objects from Stripe and verify their active status, currency, unit amount, one-time type, livemode value, Product IDs, and shared Stripe account. Do not activate live processing until both products have complete test-mode checkout, webhook, duplicate-event, entitlement, provisioning-failure, and recovery tests.
