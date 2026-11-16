# DanzStak — session handoff (read after CLAUDE.md)

Keep this file current at the end of every working session so a new Claude session (claude.ai or Claude Code) never makes Shawn re-explain. No secrets, keys, phone numbers or personal data here — the repo is public.

## How Shawn works
- Plain text, short numbered questions, no multiple-choice cards. Don't paste links unless he asks.
- Standing permission to build anything DanzStak. He must approve: going live with real money, charges/refunds (named amount), anything irreversible.
- He pastes secret keys into AWS himself; Claude never handles key values.

## Shipped 2026-11-15/16 (PRs #302–#322)
- Mix/profile: full-width media, tight continuous surface, icon buttons, 2 comments + "+N", FB-style profile tabs (Posts · About · Friends · Photos · Videos (+Shop)), Add friend (incl. locked profiles), black/orange palette (no stock blue), no Official store.
- Signup: members choose name + @username, then SYNC device prompt ("Later — text only").
- Video: muted autoplay at 50% visible; The Roll = uniform 9:16 tiles, tap → full-screen vertical swipe; composer offers The Roll for pasted video links.
- Link previews: source image + title + clean link (tracking stripped), backend GET /link-preview.
- Share to Facebook/X/Bluesky/Threads/Reddit/WhatsApp/Telegram/Mastodon/Email/More.
- Tribes: Facebook-Groups-style list, initial-letter covers.
- **Marketplace (Stripe Connect, sandbox only):** #321 "Get paid" seller onboarding (payouts.mjs), #322 ticket checkout (ticket-orders.mjs): named tickets, capacity reservation, held funds (release = event end + 3 days), signed webhook, emailed QR + plain code, door list with check-in.

## Stripe setup (approved plan; details in claude.ai Project doc `claude/stripe-connect-plan.md`)
- Build/test in the Stripe **sandbox "DanzStak Test"**; its test key is the AWS secret `danzstak/stripe/secret-key`. Live key separate and untouched.
- Accounts v2 with header `Stripe-Version: 2026-10-28.endive`; seller accounts: dashboard full, fees/losses collector stripe, recipient stripe_transfers + merchant card_payments.
- Ticket webhook: sandbox endpoint → `/marketplace/stripe/webhook`, secret in `danzstak/stripe/marketplace-webhook-secret`.
- Payouts/ticket code refuses live keys until env `MARKETPLACE_PAYOUTS_LIVE=approved` (owner sign-off).
- Who can sell: anyone lists; only Stripe-verified sellers/promoters can actually sell/get paid.

## Deploy notes
- Frontend: merge to main → Amplify (~3–5 min). Bump `danzstak-shell-vNNN` + asset `?v=`; tests pin versions (also test-site.ps1 and browser-checks/*.cjs).
- CI browser-call-media runs browser-checks that pin design — read its log; don't call it flaky.
- Backend: zip infrastructure/auth-api and update BOTH Lambdas `DANZSTAK-Auth-API` and `DANZSTAK-TourManager-Stripe-Test` (us-west-1). New routes: API Gateway `0872gqal4m`, target `integrations/5pipi5a`, plus a Lambda AddPermission per path.
- Social backend (friends, stories, profiles, Tribes) is the `DANZSTAK-Call-Signaling` CloudFormation stack (inline code in infrastructure/call-signaling/template.yaml) — don't redeploy casually.

## Next (specs in docs/tasks/ — claude.ai thinks, Claude Code codes)
- Run `docs/tasks/01-ticket-release-job.md` next.
- Booking Agent / Tour Manager (owner 2026-11-16: find clubs → send EPK → replies → set dates → suggest record shops for meet & greets and radio for interviews or short ads): tasks 02 pipeline, 03 town plan, 04 radio directory, 05 advance + day sheet, 06 virtual tour manager (cost incl. rooms/campgrounds/van parking, day scheduler to soundcheck, itinerary book PDF + Google Maps links), 07 live venue data (no pitches to dead clubs/bounced emails — benchmark Indie on the Move: 250 sent → 32 booked, many dead) + lock dates on the shortest route.
- Master plan: docs/tasks/00-BOOKING-AGENT-PLAN.md (Local gigs within 100 mi + Tour modes). Build order 02 → 07 → 03 → 04 → 05 → 06.
- Roles: Booking Agent = gigs, EPK sends, locking dates, record-store meet & greets, radio on-air + radio ad suggestions (stays home). Tour Manager = the road (cost, lodging, day schedule, tour book).
- **Task 02 is split into 4 PRs (agreed with Shawn 2026-11-16).** Data stays in the single `booking-workspace-v1` document until PR C; `RUN#` records come with Local/Tour runs.
  - **PR A (branch `booking-pipeline-stages`): pipeline rules. NEEDS BACKEND DEPLOY.** `infrastructure/auth-api/booking-pipeline.mjs` (+ browser copy `assets/booking-pipeline.js`, parity test) maps the 10 old statuses + new `Played` onto found → pitched → replied → offer → confirmed → played (+ passed / no reply). GET/POST `/booking-pipeline` derive pitched/replied/thread from EMAIL_SEND records (both reply paths already set `repliedAt`, so the inbound-email Lambda is untouched), block backward moves, and set follow-up ≥ 5 days after the pitch; preflight/send refuse an earlier follow-up. Board: stage chips + filters, one-step status select, thread link, editable follow-up draft.
  - **PR A2 (branch `booking-epk-gate`, stacked on PR A): EPK gate. NEEDS BACKEND DEPLOY with PR A.** `epkGate()` in booking-pipeline.mjs: published EPK + name, photo, bio, music link, live video or photo (or a second photo), booking email or phone. Preflight and send refuse with "Finish your EPK to start booking (N of 6 done)…" before any credit is reserved; GET /booking-pipeline returns `epk`; the board shows the gate card above the filters and disables pitch/follow-up buttons. Browsing and saving venues stay open. Not yet done from "Tell artists up front": Music HQ card, signup step, EPK finish screen.
  - PR B: offer form (doors/set, deal type, guarantee, door %, ticket price, capacity) + "Confirm show" → one show on the run, pre-filled Events post, town-plan hook.
  - PR C: Local gigs (25/50/100/150 mi, km outside US) vs Tour runs, radius-clause warning, `RUN#` records.
  - PR D: Music HQ next 3 confirmed shows.
- **Task 07 is split into 5 PRs (Claude Code, 2026-11-16):** 07-A contact check → 07-B venue freshness → 07-C artist stats → 07-D date options + route optimizer → 07-E accept dates.
  - **07-A (branch `booking-contact-check`): NEEDS BACKEND DEPLOY.** `infrastructure/auth-api/booking-contact-check.mjs`: strict syntax, MX lookup (null MX / NXDOMAIN = dead; DNS timeout fails closed with 503, no credit), shared hard-bounce block for 12 months ("This address bounced — find a newer contact."), opt-outs/complaints never expire and a bounce never downgrades them. Preflight + send run it before any credit is reserved; the atomic suppression ConditionCheck matches the 12-month rule. SES hard bounce reported after the send now **restores the credit once** (ledger `email_bounced_restored`). `aws-deploy-auth-api.ps1` now packages every `*.mjs` (fixes the payouts/ticket-orders/link-preview omission). Unverified: Lambda DNS egress for MX lookups (it reaches Stripe, so expected).
  - **07-B (branch `booking-venue-freshness`, stacked on 07-A): NEEDS BACKEND DEPLOY of DANZSTAK-Auth-API, DANZSTAK-TourManager-Stripe-Test AND the booking-inbound Lambda.** `booking-venue-signals.mjs` (+ browser copy `assets/booking-freshness.js`, parity-tested): one shared record per venue (`BOOKING#VENUE_SIGNAL`, dates only: delivered, reply, booked, bounce, closed reports; no member identity). Freshness on discovery, route leads, map and selected venues: Active (<6 mo) / Last activity (<12 mo) / Unverified / Bounced / Reported closed; 2 member reports or owner-confirmed = hidden behind "Show N closed clubs". "Club closed or new booker?" on each selected venue posts `{action:"venue_report"}` to the existing POST /booking-pipeline (no new API route), one report per member; owner reviews with `review-venue-reports.ps1` (List / ConfirmClosed / Reopen / Dismiss). New booker contacts are never auto-applied. Shell bumped to v845.
  - **07-C (branch `booking-artist-stats`): NEEDS BACKEND DEPLOY of DANZSTAK-Auth-API and DANZSTAK-TourManager-Stripe-Test.** `pitchStats()` in booking-pipeline.mjs; GET /booking-pipeline returns `stats` {sent, delivered, bounced, opened, replied, booked, replyRate, bookedRate}. First pitches only (follow-ups excluded); "opened" = private EPK link opened (EPK#OUTREACH# openCount), email opens are not tracked; booked = pitched venues now confirmed/played. Board shows "Your pitch numbers" after the first pitch. Shell v846, booking-selections.js v30 / .css v22.
  - **07-D (branch `booking-route-dates`, stacked on 07-C): NEEDS BACKEND DEPLOY of DANZSTAK-Auth-API and DANZSTAK-TourManager-Stripe-Test.** `booking-route-dates.mjs` (pure): `booking.dateOptions` (max 30, saved and cleaned on workspace save; a venue's offer_date reply joins them via use-date), cheapest-insertion + relocate/swap optimizer with max drive per day (default 6 h) and a day off after N nights in a row (default 5), never double-books, confirmed shows fixed, never worse than first-come (reply order). Ordering uses straight-line miles x1.2 at 50 mph (owner chose no IAM change 2026-11-16: the role allows `geo-routes:CalculateRoutes` but not `CalculateRouteMatrix`); the chosen order is then checked with one CalculateRoutes call (LegAdditionalFeatures Summary) and long legs become conflicts. POST /booking-pipeline `{action:"route_dates", home, settings}` suggests only, never writes. Board: "Dates they offered" chips (single date or "Any Thursday from/to") on replied/offer cards, "Lock dates on the shortest route" panel. Shell v847, booking-selections.js v31 / .css v23. Unverified until deployed: the per-leg Summary shape from CalculateRoutes (falls back to estimates if missing).
  - **07-E (branch `booking-accept-dates`, stacked on 07-D): NEEDS BACKEND DEPLOY of DANZSTAK-Auth-API and DANZSTAK-TourManager-Stripe-Test.** "Accept these dates" under the picker: one editable confirmation per club, sent only after a tick + click as a reply in the existing booking thread (POST /tour-manager/outreach/reply, no credit); clubs without a DanzStak thread get "Save date only". POST /booking-pipeline `{action:"accept_date", venueKey, date, sentReplyId?}` sets **Date proposed** + showDate + acceptedDate (only a date the club offered; revision-checked). **Owner decision 2026-11-16: a show is Confirmed only when the club confirms** (existing confirm_date reply or written evidence), never on the artist's acceptance. **Owner 2026-11-16: no written OK after 3 days** → the card offers one follow-up email (artist approves; `confirmFollowUpAt` saved so it's sent once) and a tap-to-call; "They confirmed by phone" records who + when as the confirmation evidence and moves it to Confirmed. Shell v849, booking-selections.js v32 / .css v24. Pre-existing bug: the workspace-save `timestamp()` regex dropped `discoveredAt` on every save; fixed separately in PR #359.
- `aws-deploy-auth-api.ps1` copies a fixed file list that omits `payouts.mjs`, `ticket-orders.mjs` and `link-preview.mjs` (index.mjs imports them). Deploy by zipping the whole folder as noted above, or fix the list first.
- Local-only browser-check failures seen on clean main (not caused by PR A): `booking-contact-unlock-return`, `booking-credit-resume`, `booking-pitch-review` (hidden Buy-credit button measured as a 0px target; not in CI).
1. Release job (scheduled): pay promoters/sellers from held funds when rules are met; refunds/problems.
2. Shop orders: shipping/tracking, buyer "I got it", 3-day / 21-day release rules.
3. Full sandbox run-through with Shawn, lawyer review of seller/promoter terms, then live only on his OK.

## Waiting on Shawn
- YouTube: regular player (his login works, YouTube can track viewers) vs privacy player.
- A fresh test account for a full signup run-through.
- Booking email end-to-end test (who sends the pitch).
- Recommended: remove the SOL wallet from live Stripe payouts (no crypto payouts per product boundary).
- Still pending at AWS: SMS approval case for SYNC calls.
