# Booking Agent: master plan (owner, 2026-11-16)

Owner: "Currently in DanzStak the booking agent does not really function as a booking agent." This plan makes it one. Read this first, then build tasks 02 → 07 → 03 → 04 → 05 → 06 in that order, one small PR each.

## What a booking agent does (and doesn't)
- Gets the band gigs: finds real, live clubs, sends the EPK, follows up, and locks dates from the replies.
- Sets up public appearances in each town: record-store meet & greets and radio on-air interviews, and suggests short radio ads for the show.
- Stays home. The **Tour Manager** (task 06) handles the road: costs, lodging, day schedule, soundcheck timing, and the itinerary book PDF with Google Maps links.

## Two modes
1. **Local gigs**: one-off nights within 100 miles of home (editable). No route, no Tour Manager.
2. **Tour**: a date window and a region. Dates are locked on the shortest route, then the tour goes to the Tour Manager.

## The flow the artist sees (phone first, Music HQ → Booking)
1. **Start**: pick Local gigs or Tour, then dates, genre and draw. The EPK is attached automatically (prompt to finish it if it's missing basics).
2. **Find clubs**: only live venues (task 07 freshness, no dead or bounced contacts), filtered to the genre (punk, metal and electronic first).
3. **Pitch**: an editable pitch per venue with a private EPK link, previewed, then sent. Caps, suppression list and no BCC.
4. **Replies**: they land in SYNC, and the venue card moves to `replied`. A follow-up nudge after 5 days is never auto-sent.
5. **Dates**: "They offered a date" → `offer` → "Confirm show". On a tour, the route optimizer proposes the best set of dates.
6. **Town plan**: for each confirmed show, nearby record shops (in-store) and radio stations (on-air or ad) are suggested, and the pitches are sent the same way (tasks 03 and 04).
7. **Hand-off**: Local gigs get an advance/day sheet (task 05). A Tour goes to the Tour Manager (task 06).
8. **Music HQ**: next shows, replies waiting, follow-ups due, and reply rate vs. pitches sent.

## Definition of done (whole plan)
- A test band can run Local gigs and a Tour end to end in the Stripe/SES test setup: pitch → reply via `reply.danzstak.com` → confirmed show → Events post offered → town plan → day sheet or tour book.
- No pitch goes to a known-dead or bounced contact, and no credit is spent on bounces.
- Each PR passes the test suite and the browser checks, with the changed screens tested at 360 and 430 px.
- Nothing is sent from the owner's real account during testing.

## The mindset it teaches (owner, 2026-11-16)
"Any band can become a Nirvana, but they have to put in the work and do a lot of driving." The agent coaches the grind honestly:
- Start with Local gigs, then go regional: return to towns that worked, and build a circuit.
- Show progress: shows played, new towns, repeat bookings, miles driven, and reply rate over time (in Music HQ).
- Never promise fame, bookings or income. Copy encourages the work and does not guarantee results. Don't use a real band's name or likeness in product copy; the Nirvana line is the owner's motivation, not UI text.

## AI does the busywork, the artist approves (owner, 2026-11-16)
AI automates most of the agent's work. It never sends anything unseen (CLAUDE.md rule: the artist reviews every generated word). What AI does:
- Finds and ranks venues, record shops and radio stations for the genre, draw and route.
- Drafts each pitch, follow-up, in-store request and on-air/ad request, personalized per venue.
- Reads replies: detects offered dates, deal terms, "no" and "ask again in spring", and pre-fills the offer form and next action.
- Proposes the date set on the shortest route, and suggests appointment times around soundcheck for the Tour Manager.
- Queues everything as a **review list**. The artist opens each item, edits it, and taps Send or Approve. "Approve all" is allowed only after each draft has been opened (a scroll-through preview counts) and must still respect caps and the suppression list.
- Provider is swappable. Never train on creator content. Pricing follows `docs/OWNER-DIRECTIVES.md` (manual remains free).
