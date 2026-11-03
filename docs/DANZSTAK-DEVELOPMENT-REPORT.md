# DANZSTAK development report

## Core social-network regression audit

Status as of 2026-11-03: **PASSING LOCALLY; NOT DEPLOYED BY THIS BRANCH**.

- Ran the repository's complete set of **252 Node regression programs**, including messaging, feed loading and actions, persistent posts/media, comments/replies, Friends and online discovery, notifications, calls, profiles, Flashes/The Roll, settings, navigation, PWA behavior, Booking Agent, Tour Manager, Stripe, EPK and record-store workflows.
- Result: **252 passed, 0 failed** in four bounded test groups of 63 programs.
- Five initial focused-audit failures were stale cache-key assertions that still required `feed-enhancements.css?v=482` and `feed-enhancements.js?v=503`; the page correctly loads the newer `v=483` and `v=504` builds. Two additional full-suite fixtures had not yet modeled the new online-user “Find people” control or secure booking reply-routing callbacks. The fixtures were brought up to date without weakening the production behavioral, account-isolation, email-credit or PWA assertions.
- This is strong local regression evidence, not proof of every production workflow. Physical-device, multi-account and live deployed checks remain required before the complete platform objective can be marked finished.

## Booking email-to-phone Chat bridge

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; LIVE AWS MAIL AND PUSH VALIDATION BLOCKED; NOT DEPLOYED**.

### Completed work

- Replaced the old direct-to-artist account `Reply-To` design with a unique opaque 192-bit alias for each artist/organization/category conversation. The alias contains no phone number, account email, user ID, tour ID or venue ID. Only its SHA-256 hash is used for the global inbound lookup.
- Added account-isolated, durable booking conversations and messages to the existing Tour Manager DynamoDB table. Categories exposed in the existing WhatsApp-style Chat are Personal, Club Bookings, Radio Interviews and Record Stores.
- Artist-approved outbound booking email now creates or reuses the secure conversation, uses the alias at `reply.danzstak.com`, records the provider message, and preserves the existing credit reservation/finalization/restoration workflow.
- Added authenticated APIs for listing booking conversations, reading one owned conversation, marking it read and replying. External replies are sent as ordinary SES email with the same alias plus `In-Reply-To` and `References` when the external Message-ID is available. External contacts need no DANZSTAK account or telephone number.
- Added a separate Node.js 20 inbound Lambda implementation and reviewable CloudFormation template. The SES rule requires TLS and scanning, writes raw mail to a private encrypted S3 bucket with 30-day expiry, then invokes the bridge asynchronously.
- Inbound routing requires the exact opaque alias, exact expected envelope sender, spam PASS, virus PASS and at least one SPF/DKIM/DMARC PASS. SES Message-ID conditional writes prevent duplicate processing. The owner/conversation update condition prevents cross-account delivery.
- MIME parsing is capped, text is stored rather than remote HTML, and the production dependency audit reports zero known vulnerabilities.
- Clear confirmation language plus a complete date creates a sourced appointment marker and sets `routeRecalculationRequired`. Tentative or incomplete language is `needs-clarification`; it does not become a confirmed booking.
- Created privacy-safe push jobs containing only “A booking contact replied in DanzStak Chat.” Message contents are not placed in push payloads. The bridge invokes the existing Web Push Lambda through a least-privilege IAM permission; that worker resolves the Cognito account server-side and applies the user's existing message-alert preference.

### AWS verification and blockers

- **PASS**: AWS identity and SES configuration were read successfully on 2026-11-03. `danzstak.com` is a verified SES sending identity in `us-west-1`; bounce and complaint account suppression is enabled.
- **BLOCKED**: SES `us-west-1` reports `ProductionAccessEnabled=false` and a 200-message/day, 1-message/second sandbox quota. Real booking contacts cannot be emailed until production access is approved and compliance controls are reviewed.
- **BLOCKED**: `us-west-2` has no SES receipt rule set, and Route 53 has no `reply.danzstak.com` MX record. The root-domain MX still points to `inbox.danzstak.com`; this implementation deliberately does not alter it.
- **COMPLETE IN DEVELOPMENT; LIVE TEST BLOCKED**: the existing Web Push worker now accepts only an IAM-invoked internal booking event, validates the Cognito user ID and opaque conversation ID, resolves the account server-side, respects `messageAlerts`, and sends generic copy. A real phone push has not yet been delivered because the mail bridge is not deployed.
- **NOT TESTED**: controlled external recipient round trip, real Message-ID threading across Gmail/Outlook, bounce/complaint events, cancellation/date-change extraction, automatic route recomputation, physical iPhone/Android rendering and cross-device live persistence.
- No AWS resource, DNS record, receipt rule or production code was deployed or activated.

### Tests

- **PASS**: opaque alias parsing, deterministic conversation isolation, spam/virus/authentication verdict gates, exact-sender enforcement, duplicate-event design, confirmed versus ambiguous date extraction, privacy-safe push content, least-privilege push invocation and a four-write atomic inbound transaction.
- **PASS**: auth/inbound/client syntax, Tour Manager Stripe regression, dashboard regression, booking pipeline, workspace account isolation, contact-sheet and contact-unlock regressions.
- **PASS**: CloudFormation service validation in `us-west-2`; production dependency audit has zero known vulnerabilities.
- Implementation guide: `docs/booking-email-chat-bridge.md`.
- Implementation commit: `baaf74d70256a5b0020a5f4799012537863d2f34` on `codex/tour-manager-production`.
- Client integration test commit: `8c7e8e79e664f6e4072dc01763a4ac33030bb815`.
- Privacy-safe push integration commit: `c53a7718b04a4d07e6e3e09c47680e5247f2ad09`.
- Push-to-conversation deep-link commit: `b0a01dda98b30993e91ce020c585cfec01efb197`.

### Next required work

1. Review and package the Lambda, deploy the stack in `us-west-2`, activate the receipt rule set, then add the reply-subdomain MX only for a controlled test.
2. Obtain SES production sending access; add delivery, bounce and complaint event handling before any artist outreach.
3. Prove a generic notification on subscribed Android and iPhone devices.
4. Run a two-account controlled round trip and verify account isolation, threading, retry/idempotency, calendar evidence, cancellation/date changes and route recalculation before calling the bridge operational.

## AI Music Artist Research and EPK Builder

Status as of 2026-11-03: **COMPLETE IN DEVELOPMENT; LIVE PROVIDER VALIDATION BLOCKED; NOT DEPLOYED**.

### Completed work

- Integrated AI-assisted research into the existing EPK editor rather than creating a separate application. The artist name is the only required starting field; stage name, location, genre, official site, Spotify, Discogs, Bandcamp, SoundCloud, YouTube and label links are optional identity evidence.
- Restricted this workflow to musicians, bands, DJs, producers and recording artists. No comedian or general-entertainment category was added.
- Added MusicBrainz identity search and structured release data, optional Brave Search API evidence, artist-supplied HTTPS links, source URLs, provider names and research dates. The implementation does not crawl result pages, bypass access controls, copy press photography or copy publication bodies.
- Added identity disambiguation for similar names. The artist must choose a MusicBrainz candidate or add identity evidence when the match is uncertain. A missing catalog match remains an honest sparse result rather than a fabricated career.
- Added Bedrock Converse drafting for short (75-100 word), medium (200-300 word) and full (up to 500 word) biographies plus sourced genres, releases, performances, achievements, press coverage and official links. Claims without supplied evidence are excluded by the prompt and validated source identifiers.
- Added Professional, Underground / Independent, Energetic, Press / Media and Direct and Concise writing styles.
- Added per-section Approve, Edit, Rewrite and Reject controls, Research Again, Refresh My EPK, and Save Approved EPK. Research and AI output remain private. Saving copies only approved or artist-edited sections into the existing private EPK draft; it never publishes or sends automatically.
- Added immutable EPK save-version snapshots and research history. Refresh proposes new material beside existing approved content and does not overwrite it.
- Preserved the existing public/private sharing flow, browser print-to-PDF workflow, S3 media manager and Booking Agent consumption of an artist-approved published EPK link.
- Added a seven-day duplicate-research cache, default three-research-per-user daily limit, 180-day research-record TTL, server-side credentials, adaptive Bedrock retries, explicit 2,800 output-token cap and MusicBrainz's one-request-per-second pacing.

### Providers, configuration and estimated API cost

- MusicBrainz: public official API with the required identifying User-Agent and one-request-per-second pacing. No paid API charge is expected, but availability and fair-use limits apply.
- Brave Search API: requires server-side `BRAVE_SEARCH_API_KEY`. One uncached research run makes up to three Search requests. [Brave's published Search price](https://brave.com/search/api/) is USD 5 per 1,000 requests with USD 5 monthly credits, so the search portion is approximately USD 0.015 per uncached run after credits. Cached repeats make no provider calls.
- Amazon Bedrock: defaults to `amazon.nova-lite-v1:0` in `us-west-2` through the Converse API. Configure `EPK_RESEARCH_MODEL_ID`, `EPK_RESEARCH_REGION` and `EPK_RESEARCH_DAILY_LIMIT` server-side. Bedrock is token-billed and model/region/tier prices change; measure the returned input/output token usage against the [current AWS Bedrock price table](https://aws.amazon.com/bedrock/pricing/) before setting a production budget. The explicit 2,800-token output ceiling and daily request limit bound exposure.
- The deployment script adds only `bedrock:InvokeModel` for the configured foundation-model path. A future inference-profile model requires a separately reviewed inference-profile IAM resource.

### Testing results

- **PASS**: sourced music-only research, unsafe-link rejection, similar-name disambiguation, selected MusicBrainz identity, source-ID filtering, duplicate cache, explicit Bedrock token cap, section approval persistence, private-save behavior, research history and EPK version history.
- **PASS**: existing private/published EPK, media validation, domain isolation, signed public views, permanent deletion, network recovery, Booking Agent contact sheets, Tour Manager dashboard and 13-page site smoke suite.
- **PASS**: local static visual inspection at desktop and narrow mobile widths. The new research controls stack without horizontal overflow and remain light-mode DANZSTAK branded.
- **PASS WITH LIVE DATA**: MusicBrainz identity searches for established artist, DJ/producer, band, ambiguous-name and no-match cases. This validates identity behavior, not every research source or generated biography.
- **BLOCKED**: the AWS account accepted the Bedrock Converse request but returned `ThrottlingException: Too many tokens per day`; therefore a real generated biography has not passed live validation.
- **BLOCKED**: `BRAVE_SEARCH_API_KEY` is not configured on the current Lambda, so the complete live web-research path has not been tested.
- **NOT TESTED**: physical iPhone/Android interaction and a production deployment.

### Remaining limitations and blockers

- Do not advertise AI research as operational until Brave is configured and a complete Bedrock research/draft cycle passes with controlled musician accounts.
- Direct Spotify and Discogs authenticated APIs are not integrated. Those services may appear as artist-supplied links or licensed Brave search evidence only.
- Existing PDF support is browser print/save-to-PDF. A server-rendered downloadable professional PDF file is **NOT STARTED** and must not be described as complete.
- Existing Booking Agent integration uses the approved published EPK URL. Automatic outreach, inbound email-to-Chat and reply correlation remain governed by the separate Tour Manager blockers in this report.

Implementation branch: `codex/tour-manager-production`  
Implementation commit: `be7cd86bd295098d3b444f2fb7cc62552ddd7b8b`  
Deployment status: **NOT DEPLOYED**

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
- Inbound reply ingestion and secure correlation are **COMPLETE IN DEVELOPMENT; LIVE AWS VALIDATION BLOCKED**. Opaque reply aliases, SES/S3/Lambda infrastructure, exact account/conversation routing, spam/virus/authentication checks, sender matching, MIME parsing, duplicate protection and Chat APIs are implemented. SES sandbox status, receipt-rule/MX activation, real Web Push delivery and a controlled external round trip remain blockers.
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
- Stripe Price: `price_1UXkB5FgtfNMBXOVVeUOGJjX`
- Expected amount: USD 0.75 one time. The complete Price ID was corrected from the previously truncated value; test-mode retrieval and Checkout/webhook verification remain required before activation.
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

### Three-level musician pricing page

- Status: **COMPLETE IN DEVELOPMENT; NOT DEPLOYED**.
- Implementation commit: `2478e232226dbb273be1143f7c81cc81f066dcf2` on `codex/tour-manager-production`.
- Added a dedicated, light-mode pricing page for Beginner — The Bedroom, Intermediate — The Garage, and Professional — The Rehearsal Room. Desktop uses three equal-height cards; mobile stacks the cards without horizontal overflow.
- Added three original responsive card images and optimized them as 640×480 WebP files. File sizes are 39,514 bytes, 60,624 bytes, and 51,668 bytes, each below the enforced 100 KB budget. Images lazy-load and declare intrinsic dimensions to reduce transfer time and layout shift.
- The Intermediate button returns the artist to club discovery because its existing `$0.75` checkout requires a saved venue with an available public direct contact. It reuses Stripe Price `price_1UXkB5FgtfNMBXOVVeUOGJjX` and does not create a second payment path.
- The Professional button reuses the existing Tour Manager checkout and Stripe Price `price_1UXjMtFgtfNMBXOVCLeEk8vI`. The page accurately identifies the current `$1.50` purchase as one approved booking-email credit. Replies in Chat, automatic confirmed-date calendar/routing, and Tour Book/PDF remain clearly labeled **Coming Soon**.
- Added navigation from the Booking Agent and booking pipeline, PWA shell caching, and an automated regression test for plan copy, Stripe Price mappings, existing-flow links, truthful feature labels, responsive layout, lazy loading, intrinsic dimensions, and the image-size budget.
- Tests passed: `test-booking-pricing.cjs`, `test-booking-contact-unlock.cjs`, `test-tour-manager-billing.cjs`, `test-tour-manager-dashboard.cjs`, the 13-page site smoke suite, and `git diff --check`. Desktop and narrow-screen static renders were visually inspected; no payment call was made.
- Preview references: `booking-pricing.html`, `assets/pricing-bedroom.webp`, `assets/pricing-garage.webp`, and `assets/pricing-rehearsal-room.webp`.
- Deployment: no production deployment was performed. The page is prepared for review on `codex/tour-manager-production`.

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
