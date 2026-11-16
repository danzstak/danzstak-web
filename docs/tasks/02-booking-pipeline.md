# Task 02 — Booking pipeline: find clubs → send EPK → replies → dates

## Owner direction (2026-11-16)
"The booking agent should handle finding the clubs and sending the EPK; when replies come in, set dates to perform; suggest record shops for meet & greets and radio stations for interviews or short ads for the upcoming gigs."

## Read first
booking.html, assets/booking-agent.js, booking-discovery.js, booking-selections.js, booking-conversation.js, booking-sync.js, booking-reply.js, infrastructure/auth-api/tour-manager-billing.mjs (pitch sends, credits, reply tokens → SYNC). Reuse what exists; don't rebuild discovery or sending.

## Build
1. **One pipeline per run** (a run = one local show or a whole tour). Each venue card moves through: `found → pitched → replied → offer → confirmed → played` (plus `passed` / `no reply`).
   - Status changes come from real events: a pitch send marks `pitched`; an inbound reply (the existing reply-token bridge) marks `replied` and links the SYNC thread.
   - Phone-first board: one column list with status chips and filters (not a wide kanban); tap a card to open the thread.
2. **Local show mode**: the brief accepts "one show in my city" (no route). Discovery searches the home city; the same pipeline is used.
3. **Follow-up nudge**: a venue in `pitched` for 5 days with no reply shows "Follow up?" with an editable draft. Never auto-send. Respect the existing daily caps, duplicate window and suppression list. Max one follow-up per venue.
4. **"Set a date" from a reply**: in the thread, a "They offered a date" action opens a short form: date, doors/set time, deal type (guarantee / door split % / ticket price), guarantee amount, capacity, notes. Saving moves the venue to `offer`. "Confirm show" moves it to `confirmed` and:
   - creates the show on the run (tour date list),
   - offers "Post this show on Events", pre-filled (artist can edit; default ticketing = outside link or none; DanzStak ticket sales only if they turn it on),
   - triggers the Town plan (task 03).
5. **Music HQ summary**: next 3 confirmed shows, replies waiting, follow-ups due.

## Data
Store per member under the existing tour tables: `RUN#<id>` and `RUN#<id>/VENUE#<venueId>` with status, timestamps, deal fields, threadId. No venue contact details beyond what discovery already stores.

## Tests
Status transitions only from allowed states; follow-up appears only after 5 days and never auto-sends; confirm creates exactly one show; local mode needs no route.

## Done when
CI green; on a phone width (375px) a member can pitch 3 venues, see a reply move a card to `replied`, enter an offer, confirm it, and see it on the run and Music HQ.
