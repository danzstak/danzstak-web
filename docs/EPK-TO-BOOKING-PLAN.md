# EPK to Booking plan

Status: **PLAN ONLY — owner approval required before implementation**

Priority: **DanzStak's #1 product path**—an artist builds an EPK, sends it to clubs and venues, and gets booked

Boundary: no deployment, AWS/Stripe changes, unsolicited email, music upload, or automatic sending is authorized by this plan.

## Outcome and success measure

An artist can sign up, publish a useful EPK in under five minutes, choose real saved venue leads, review a personalized pitch, send it through the paid Tour Manager workflow, and see what needs attention next. Every message is one-to-one and artist-approved. Music and video remain HTTPS links to the artist's existing hosts; DanzStak never uploads or hosts the music.

The first release is successful when a controlled artist can complete:

`Join → build EPK → choose venue → review pitch → send → venue opens EPK → venue replies → artist records outcome`

without repeated data entry, an account for the venue, a duplicate send, or an unearned credit charge.

## Verified baseline and release blockers

### Reuse

- Booking already saves venue leads and source/contact evidence in the authenticated workspace.
- `POST /tour-manager/emails/send` validates the saved venue/contact, active contact unlock, reviewed subject/body, exact saved EPK URL, and idempotency key. It atomically reserves one credit, settles it after SES accepts the message, and restores it when SES rejects submission.
- SES currently sends from `booking@danzstak.com`, uses the artist's name in the message, and sends replies directly to the account email.
- EPKs already support public pages and revocable private links backed by hashed tokens.
- Checkout, ledger, contact-unlock, credit-balance, and outreach foundations exist.

### Do not represent as operational yet

- `docs/tour-manager-stripe.md` records that on 2026-11-03 the configured Test Mode account could not access the supplied Prices and the webhook secret was missing. Payment-dependent sending stays unavailable or clearly **Coming soon** until a separately authorized Stripe task proves a complete Test Mode checkout, signed webhook, entitlement, duplicate event, and refund cycle. This plan does not change Stripe.
- SES provider acceptance is not delivery. Bounce, complaint, delivery events, and a platform-wide suppression policy are not implemented.
- Inbound SES reply ingestion and secure conversation correlation are not implemented.
- Private EPK links are not currently per-outreach, expiring, or instrumented for venue-specific opens.
- The present send route does not enforce the proposed daily cap, 30-day duplicate-contact window, global opt-out, or required postal/opt-out footer.
- Discovery remains a sourced lead, not proof that a venue is active, accepts the genre, has the proposed date, or wants unsolicited pitches.

## Foundation — multiple EPK projects without data loss (4–6 days)

The current implementation is singular: every account reads and writes the fixed DynamoDB key `epk-workspace-v1`, and the browser calls only `/epk`. That contradicts the owner-approved product model in this plan, where one member may keep a band EPK, a DJ EPK, and a side-project EPK. Multi-project storage must land before per-EPK AI purchases or booking outreach can be represented as correctly scoped.

### Project identity and migration

- Add an opaque, server-generated `epkId` to every artist-owned EPK. Never derive it from the act name, email address, or public slug.
- Add owner-scoped list/create/read/update/delete routes. Every mutation verifies the authenticated owner and uses conditional revisions so one tab cannot overwrite another project's newer save.
- Treat the existing `epk-workspace-v1` record as a legacy source. On the first authenticated list/read after release, copy it transactionally into one project, preserve its public ID, media, publish state, share state, selected look, production details, and timestamps, then record a migration marker. Retries must return the same project instead of making duplicates.
- Keep a read-compatible rollback window: the legacy item is not deleted until the migrated project has been read, saved, published/private links checked, and the release rollback period has elapsed. No background bulk migration and no destructive rewrite.
- New accounts start with no project and see **Create EPK**. Existing accounts land on their migrated EPK. Project names are artist-controlled labels; duplicate labels are allowed because identity comes from `epkId`.

### Isolation of connected records

- Bind media ownership, immutable versions, public/private/outreach shares, open aggregates, reviews, booking drafts, venue threads, future AI entitlements/allowances, and audit history to both owner and `epkId`.
- Keep each project's stable public ID independent. Deleting one project revokes only its links and removes only its media after the existing cleanup rules; it must not affect another project or its outreach.
- A booking draft stores the exact `epkId` and approved version. Changing the selected project or version invalidates the prior send approval. The artist always sees the act name and EPK preview before approving outreach.
- The future `$5 per EPK` AI purchase and `$5 AI redesign` are entitlements for one `epkId`, never an account-wide flag. Manual creation, editing, publishing, sharing, sending, and look switching remain free.

### Phone-first project switcher

- Add a compact **Your EPKs** screen with act name, act type, publish state, selected look, last edited time, and the primary actions **Edit**, **View**, and **Pitch venues**. Do not expose private share tokens.
- The editor URL carries an opaque project ID and retains the guided five-minute flow. Creating, switching, duplicating, archiving, and deleting projects require explicit actions; navigation never silently replaces the current draft.
- Sparse and full projects use the same editor and public templates. Empty public sections remain hidden. A band can use stage-plot/input-list fields while a DJ/electronic project uses booth-plot/tech-rider fields.

### Required regression and migration evidence

- Legacy account migrates once with byte-equivalent approved content, the same public URL, working private/review links, and no media loss.
- Empty account creates two projects; edits, publish state, looks, media, reviews, shares, and delete operations remain isolated.
- Two tabs editing the same project produce a revision conflict instead of last-write data loss; two tabs editing different projects do not conflict.
- Another account cannot list, read, mutate, share, delete, buy AI for, or attach the project to outreach.
- Booking preflight rejects a missing, deleted, unpublished, wrong-owner, or stale EPK version and never consumes a credit.
- Migration retry, partial transaction failure, rollback compatibility, project deletion cleanup, link revocation, account export, and account deletion are covered.
- Browser checks cover the project list, create flow, editor switch, delete confirmation, and booking selector at 320, 360, 375, 390, 414, 430, 768, 1024, and 1366 pixels.

Likely files: `epk.html`, a new project-list page or state in the existing editor, `assets/epk.js`, EPK styles, `assets/booking-selections.js`, `infrastructure/auth-api/index.mjs`, focused API/browser tests, export/deletion handlers, and this report. This foundation changes no Stripe object, AI provider, AWS resource, or production deployment by itself.

## Phase 0 — growth path and safe feature gates (2–3 days)

### Five-minute first EPK

- After sign-up, offer **Build your EPK in 5 minutes**: act name, act type, hometown, one-line pitch, one photo, genre, and at least one HTTPS music/video link. Only the act name is required to start; unfinished work saves as a private draft.
- Show a live preview and a clear checklist. Hide empty public sections rather than publishing placeholders.
- Keep band and DJ/electronic paths distinct: bands see stage plot/input-list prompts; DJs and electronic live acts see booth-plot/tech-rider prompts.
- Preserve content independently from the selected visual look so artists can change looks without losing work.

### Free builder and optional $5 AI assistance

- Building, publishing, sharing, sending, manually editing and manually switching looks for any EPK is free. The complete workflow must work without AI.
- **AI-assisted EPK is $5 per EPK.** The purchase is bound server-side to one artist-owned `epkId`; it is not an account-wide upgrade. A band EPK and a separate DJ/side-project EPK are two purchases.
- One paid EPK includes one guided generation package—short/medium/full bio, one-line pitch, booking-pitch starting copy, press-kit gap checklist, and a stage-plot/input-list or booth-plot/tech-rider text draft—plus **12 artist-requested AI rewrites and 5 booking-pitch drafts** for that EPK within 90 days. Unused AI actions expire, but the EPK and all manual editing remain free forever. The owner may adjust these limits before implementation.
- An **AI redesign** is a separately confirmed $5 action that asks AI to rewrite the bio/pitch package and propose a new section order/look treatment for an existing EPK. It grants a fresh generation package and the same rewrite allowance while preserving version history. Merely typing edits, rearranging fields with manual controls, uploading an approved photo, changing a link, or switching Techno/Punk/Metal/House-EDM looks manually is never an AI redesign and never charged.
- Show `AI redesign — $5` and the exact included allowance before Checkout. Never infer consent from clicking a look, opening AI help, or exhausting an allowance. Nothing AI-written is published or sent until the artist reviews and explicitly approves it.
- Only the artist-selected EPK text/structured answers go to the provider after a plain-language notice. Do not send private messages, contacts, analytics, unpublished files or unrelated account data. Contractually/API-configure no provider training on creator content and document retention; redact secrets and minimize logs.
- Put the model behind a provider-neutral `EpkWritingProvider` interface with per-request token limits, timeout/retry controls, spend caps and auditable usage. Free EPK and booking remain operational when the provider is unavailable.
- This plan proposes a new $5 Stripe product/Price; the owner creates it. No Stripe object or live payment is created or enabled by implementation without separate approval.

#### Conservative cost envelope (verified 2026-11-07)

Use a hard per-paid-EPK budget of 150,000 input and 50,000 output tokens across the included package. As a conservative reference, Amazon Nova Pro has been listed at $0.0008/1K input tokens and $0.0032/1K output tokens: about **$0.28 maximum model usage** for that envelope. Stripe's published US standard domestic-card price is 2.9% + $0.30, about **$0.45 on a $5 charge**. Reference total: **about $0.73**, leaving about **$4.27** before taxes, international/currency fees, storage, support, retries and refunds. Sources: [AWS Bedrock cost guidance](https://aws.amazon.com/blogs/machine-learning/effective-cost-optimization-strategies-for-amazon-bedrock/), [Stripe pricing](https://stripe.com/pricing).

These are planning inputs, not guaranteed account rates. Before launch, verify the chosen model/region and the connected Stripe account's actual pricing, run measured EPK fixtures, and fail closed at the server-side spend cap. A provider/model whose measured quality or total cost breaks the envelope requires owner approval; do not silently shorten paid output.

### Bring people in

- Put the existing **Pivot** Facebook-import path on onboarding/HQ, with preview, audience choice, duplicate prevention, and no automatic Facebook-account closure.
- Let artists invite bandmates and fans using scoped invitation links. Joining must be optional; accepting a bandmate role requires authentication and explicit artist approval.
- Every pitch and share creates a fast public landing opportunity: useful title/description/image metadata, canonical URL, compact mobile HTML, deferred noncritical assets, and no account wall around the artist-approved EPK.

### Gates

- Artists can build, preview, save venues, and prepare drafts before payment is operational.
- The Send control remains disabled with a factual reason until EPK publication, verified contact entitlement, credit, compliance fields, and payment/email infrastructure gates pass.

Likely files: `epk.html`, `assets/epk.js`, EPK styles, onboarding/HQ assets, `booking.html`, `assets/booking-*.js`, API EPK/profile handlers, Open Graph/static metadata support.

## Phase 1 — one connected booking workspace (3–5 days)

Create one resumable workflow:

1. **EPK:** select the saved, approved EPK version.
2. **Venues:** choose leads from Booking discovery, saved venues, or a saved tour route; retain source, actual town, contact evidence, unlock state, and proposed date.
3. **Pitch:** choose a template and edit every field.
4. **Preview:** show exactly what the venue receives, the per-venue cost, suppression/cap results, and EPK permissions.
5. **Approve and send:** require a final per-recipient checkbox and explicit total confirmation; never send from selection, AI generation, payment, or a background timer alone.
6. **Track:** show each venue in a consistent pipeline.
7. **Follow up:** prepare one reminder only after the artist's chosen interval; the artist must review and approve it.

Drafts persist per artist, tour, venue, proposed date, EPK version, and contact. A venue removed or changed after preview invalidates approval.

Likely files: Booking workspace UI/assets, `infrastructure/auth-api/tour-manager-billing.mjs`, `infrastructure/auth-api/index.mjs`, Tours-table item conventions, focused route tests.

## Phase 2 — private per-venue EPK shares (3–4 days)

- Issue a random, high-entropy share token for each approved outreach record; store only its hash and bind it to artist, EPK version, venue, outreach, expiry, and permissions.
- The URL contains no artist email, venue email, user ID, or predictable database key. Revoking the outreach or EPK revokes its link.
- Record EPK page opens—not an invisible email pixel—as aggregate count plus first/last-open timestamps for that venue/outreach. Disclose on the page that the artist can see that this venue link was opened. Do not retain viewer IP, fingerprint, or user-agent history.
- PDF download appears only when the artist enabled it for that link. Press-photo and document permissions remain explicit. Music/video display as clean external link cards only.
- Return fast share metadata and a useful no-JavaScript shell. Set strict cache rules for private responses and never place the token in logs, analytics, referrers, or preview metadata.

Tests: token hashing and entropy, artist isolation, venue binding, expiry, revoke, stale EPK version, opening counts/idempotency policy, no PII in URL/log response, download permission, metadata and mobile performance budget.

## Phase 3 — artist-reviewed pitches and sending controls (4–6 days)

### Templates

- **Band tour pitch:** date/range, city, routing context, artist-entered expected draw, fee/door-deal request, EPK link.
- **DJ gig pitch:** date/range, city, format/set length, artist-entered expected draw, fee/door-deal request, EPK link.
- **Festival pitch:** festival/date range, format, artist-entered draw, fee/terms, EPK link.

Generated copy is a draft. Label artist-entered claims such as draw and fee; do not infer or embellish them. The immutable send snapshot contains recipient, contact source, subject, body, footer, EPK link/version, proposed dates, approval time, and approver.

### Sender identity and reputation

- Send through DanzStak's verified SES domain with DKIM/DMARC alignment verified in a separately authorized infrastructure check. Use the artist/act as display name while retaining a DanzStak-controlled envelope sender.
- Initially keep the artist's verified account email as Reply-To. Add optional SYNC booking-thread routing only after secure inbound email is tested; it is not required for the first safe send.
- One recipient per message; no BCC or bulk-blast endpoint.
- Initial configurable cap: **20 new pitches per account per rolling 24 hours**, lower for new/risky accounts. Server enforcement only.
- Block another initial pitch to the same normalized contact from any one artist for 30 days. A reply or artist-approved follow-up belongs to the existing thread, not a new pitch.
- Require DanzStak LLC's verified postal address and a plain opt-out line in every message. Do not expose an artist's private home address.
- A venue opt-out suppresses that normalized contact platform-wide. SES bounce/complaint events suppress automatically; hard bounces and complaints block immediately. Unsubscribes are honored before any credit reservation.
- Use a send state machine (`draft → approved → reserved → provider_accepted → delivered|bounced|complained`, plus `restored`/`reconciliation_required`). Never label SES acceptance as delivered.

Credits are reserved only after every preflight check. Existing idempotency and atomic reserve/restore behavior remains; provider-accepted reconciliation cannot resend blindly.

Tests: daily cap, account age/risk cap, 30-day duplicate rule, global opt-out, bounce/complaint suppression, mandatory footer, approval invalidation, exact EPK snapshot, account isolation, concurrent duplicate requests, SES failure restoration, provider-accepted reconciliation, and no hidden BCC.

## Phase 4 — replies and accountless venue actions (5–8 days)

### Email replies

- Give each outreach a DanzStak-controlled, unguessable reply alias mapped to the artist/outreach. Store the mapping server-side; never route by artist phone number or message subject alone.
- SES inbound receipt processing must validate the recipient token, size/type limits, malware/spam verdicts, deduplicate provider IDs, sanitize MIME/HTML, retain the safe minimum, and enforce artist isolation.
- A verified reply updates the venue thread to **Replied** and appears in the optional SYNC **Club Bookings** category. Replying from SYNC creates an artist-reviewed outbound email in the same thread.
- Email transport to venues remains sufficient; venues need no DanzStak account.

### Secure venue page

The per-venue EPK page offers **Reply**, **Interested**, and **Offer dates**. Actions use scoped, expiring, revocable tokens, confirmation screens, CSRF/replay protection, rate limits, and a visible explanation of what is sent to the artist. They cannot expose other venues, artist-private notes, credit balance, or tour data.

Tests: valid/expired/revoked action tokens, forged recipient, duplicate inbound message, malicious MIME/links, oversize attachment, cross-account routing, reply-from-SYNC threading, opt-out, and accountless date offer.

## Phase 5 — pipeline, HQ, and approved follow-up (3–5 days)

Per venue, display evidence-backed states:

- Draft
- Approved
- Sent (provider accepted)
- Delivered (provider event)
- EPK opened (count, first/last time)
- Replied
- Booked
- Passed
- Bounced / Complained / Opted out

Only the artist can mark **Booked**, unless a later confirmed-date workflow supplies explicit evidence and asks the artist to approve it. Never infer a booking from an open or an interested response.

- HQ **Needs you** shows replies, date offers, failed/reconciliation sends, and follow-ups awaiting approval.
- Tour/Gigs shows the same authoritative venue state rather than a second copy.
- The artist chooses a follow-up interval; one draft may be prepared after it. No automatic send. Do not follow up after a reply, opt-out, bounce, complaint, passed, or booked state.

Tests: state transitions, stale event ordering, one follow-up maximum, cancellation when response arrives, HQ/Tour consistency, notification privacy, and logout/relogin persistence.

## Data and API shape

Use owner-scoped records with conditional writes and audit timestamps:

- `EpkVersion` and `EpkShare`: immutable approved version, token hash, venue/outreach binding, expiry, permissions.
- `OutreachDraft` / `OutreachMessage`: normalized recipient hash, template, proposed dates, approval snapshot, idempotency key, provider IDs and status.
- `VenueThread`: artist/venue/contact relationship and current pipeline status.
- `Suppression`: normalized destination hash, scope/reason/source/timestamp; global for venue opt-outs and provider abuse signals.
- `InboundMessage`: provider ID, safe parsed content, thread, verdicts, deduplication record.
- `EpkOpenAggregate`: outreach ID, count, first/last open only.

Never store tokens in plaintext after issuance, return another artist's records, or make payment state a browser-only permission. Define bounded text/media sizes and TTLs before adding new records.

## Quality gates

### Functional and security

- Controlled artist and venue inboxes only; never real promotional recipients in tests.
- Full success and failure journey, payment gate, contact entitlement, approval, idempotency, credit restore, suppression, reply routing, EPK revoke/expiry, and account isolation.
- Authorization and conditional-write tests on every new route; rate-limit, token-replay, injection, MIME, and log-redaction tests.
- AI tests cover free/manual paths without a provider, entitlement bound to one EPK, $5 confirmation, allowance accounting under concurrency, AI-redesign confirmation, free manual edits/look changes, provider timeout/cost cap, no publish/send before approval, no cross-EPK/account access, and exact provider payload/log redaction.

### Visual and accessibility

- Guided EPK and booking flow at 320, 360, 375, 390, 414, 430, 768, 1024, and desktop widths.
- Keyboard and screen-reader journey, 44px targets, clear errors, no overlapping primary screens, and no hidden cost/recipient changes.
- Public EPK performance and share-preview fixtures for sparse and full artist content.

### Integration

- Keep the full regression suite and review checks green.
- In an authorized isolated environment: Stripe Test Mode proof, SES mailbox simulator/controlled inboxes, signed provider events, inbound reply, and DynamoDB persistence across sessions.
- No deployment until `docs/RELEASE-CHECKLIST.md` identifies exact evidence, rollback, and explicit owner approval.

## Rollout and rough effort

| Release | Scope | Rough effort |
| --- | --- | --- |
| A | Five-minute free EPK, optional paid AI boundary, Pivot/invites, workflow drafts and honest gates | 1–2 weeks |
| A2 | AI provider adapter, per-EPK entitlement/allowance, measured cost gate and artist approval workflow | 1 week |
| B | Per-venue EPK shares, permissions, opens and fast public previews | 1 week |
| C | Templates, final approval, caps, suppression and provider event state | 1–2 weeks |
| D | Inbound replies, accountless venue actions and optional SYNC thread | 1–2 weeks |
| E | HQ/Tour pipeline, approved follow-up and end-to-end hardening | 1 week |

Ship each release as a separate reviewed PR. Estimates exclude owner/legal review, SES production-access/reputation work, Stripe remediation, DNS/domain configuration, or provider delays.

## Decisions required before code

1. Approve the initial 20-new-pitches-per-24-hours cap and the risk limits for new accounts.
2. Approve use of DanzStak LLC's published mailing address in the compliance footer.
3. Choose the default private-link expiry (proposed: 45 days after send, extended while a thread is active).
4. Decide whether v1 replies go directly to artist email only, or wait for the separately tested SES-inbound/SYNC bridge.
5. Obtain legal review of outreach, opt-out, retention, and international requirements before production sending.
6. Approve the proposed per-paid-EPK allowance (initial package, 12 rewrites, 5 pitch drafts, 90-day AI window) and the definition of a separately charged AI redesign.
7. Approve a provider only after quality, no-training/data-retention terms, region, measured token use and actual cost pass review; then create the $5 Stripe product/Price separately.
