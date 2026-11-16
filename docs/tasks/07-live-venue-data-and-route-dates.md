# Task 07 — Only real, live clubs + lock dates on the shortest route

## Owner direction (2026-11-16)
- Roles: **the Booking Agent** gets the band the gigs — finds clubs, sends the EPK, locks dates, sets up record-store meet & greets and radio on-air appointments, and suggests radio ad placement in the towns they're going to. Booking agents don't go on tour. **The Tour Manager** handles the road (task 06).
- "Once the response comes back from the club, the agent needs to lock down dates in the shortest route between clubs."
- Benchmark: Indie on the Move is the best DIY booking tool today. Shawn sent 250 requests and booked 32 shows (≈13%), but **many requests went to defunct clubs or bounced emails**. DanzStak must beat that by never wasting a pitch on a dead club or a dead address.

## Part A — Live venue data (beat the dead-club problem)
1. **Before a pitch is sent**, check the contact: valid email syntax, the domain has MX records (DNS lookup server-side), not on the suppression list, no hard bounce in the last 12 months **from any DanzStak member** (shared, privacy-safe: store only a hash of the address + bounce date + reason class, never who sent it). If it fails: block the send, don't spend a credit, show "This address bounced — find a newer contact".
2. **Venue freshness score** shown on every result: last confirmed activity (a member booked/played there, a reply received, an upcoming show listed, website reachable with a recent update), "member reported closed", bounce history. Sort and filter: hide venues marked closed; show "Unverified" honestly when there's no recent signal.
3. **Members keep it fresh**: after any reply or bounce, update the venue record automatically; one tap "This club closed / changed booker" with the new public contact; owner-reviewable.
4. **Credits are never spent on bounces** (existing rule: reserve then restore on delivery failure) — verify it covers hard bounces reported later by SES events.
5. **Stats for the artist**: sent, delivered, opened (if tracked today), replied, booked — so they can see "X% reply rate" vs. the old way.

## Part B — Lock dates on the shortest route
1. When a club replies with possible dates (or "any Thursday in March"), the agent records the **date options** per venue (not just one date).
2. **Route-aware date picker**: given home base, tour window, confirmed shows and every venue's date options, suggest the order and dates that **minimize total driving** (and max drive per day — default 6 h, editable; at least one day off per N shows, editable). Use AWS Location for drive times. Small N (≤ 40 stops): a good heuristic (nearest-neighbour + 2-opt with date-window constraints) is fine; show the total miles saved vs. the order replies came in.
3. Show conflicts: two clubs wanting the same night, a 9-hour drive between back-to-back shows, a gap with no show (suggest nearby venues to pitch for the gap → feeds back into discovery).
4. "Accept these dates" sends the confirmations (editable drafts, artist approves each) and moves venues to `confirmed` (task 02).
5. Then hand off: the record-shop/radio appointments (task 03) are scheduled by the Booking Agent; the Tour Manager (task 06) builds the road plan and tour book from the locked route.

## Tests
- A hard-bounced address (any member) blocks sending and spends no credit; MX-less domain blocked.
- Closed venues are hidden by default; freshness shown.
- Date optimizer: respects each venue's date options, max drive per day, days off; never double-books a night; total miles ≤ order-of-replies baseline.
