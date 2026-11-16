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
