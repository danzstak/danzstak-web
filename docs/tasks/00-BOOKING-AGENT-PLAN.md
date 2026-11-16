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
1. **Start**: pick Local gigs or Tour, then dates, genre and draw. **The band must have a published EPK to use the agent** (owner, 2026-11-16: it's up to the band to get their EPK together). Minimum: name, photo, bio, at least one music link, at least one live video or photo, and a contact. Without it, the agent shows one card: "Finish your EPK to start booking", with what's missing and a link to the EPK builder (free by hand, or $5 with AI). Searching venues is allowed; sending pitches is not.
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

## Promote every show: timeline, town plan and costs (owner, 2026-11-16)
Example: a show in Sacramento. The agent suggests Sacramento record stores for an in-store appearance and Sacramento radio stations for an on-air interview or short ads. Promoters love a band that does this, and they often come to the in-store to see the band's real draw. Invite the show's promoter to the in-store (draft, artist approves).

**Timeline (defaults, editable)**
- Book the gig **2 months or more ahead**. The pipeline warns when a pitched date is under 8 weeks away ("tight — promo may suffer") and does not block it.
- **2 weeks before the show**: flyers go to the club and ads/announcements start on radio. Reminders appear in Music HQ with drafts ready to approve.
- In-store and on-air are set for the show week, ideally show day or the day before, timed around soundcheck (Tour Manager).

**Radio**
- Rank **college and community stations first**: they're the cheapest, often almost free. Most US college stations are non-commercial, so the request is worded as an **underwriting spot, community-calendar listing or PSA/gig announcement**, not a commercial ad. Commercial stations get an ad-rate request. The draft picks the right wording per station type (task 04 stores `type: college | community | commercial`).

**Flyers**
- Generate a print-ready flyer and a digital square/story flyer from the show + EPK look (genre look tokens). Send to the club 2 weeks out (digital via the booking thread; print = artist prints/ships, cost logged).

**Costs: the Tour Manager budgets everything for each gig** (task 06)
- Travel (fuel, tolls), lodging (room, campground or free van parking), food.
- Promo: radio ad/underwriting spend, flyer printing and shipping, in-store costs (if any).
- Per gig: expected income (guarantee / door split / merch estimate) vs. total cost → **profit/loss per show and per tour**, budget vs. actual after the show.

## Radio rotation: promo package to the program/music director (owner, 2026-11-16)
- For each station in a show's town, the agent drafts a **promo package to the program director / music director**: a short note, the EPK link, the show date and venue, and the songs for rotation.
- Songs are **links only** (the artist's own Bandcamp/streaming/private link or the EPK's authorized embeds). DanzStak never hosts or attaches audio files (`instructions/00e-no-music-hosting.md`).
- Timing: rotation package **3–4 weeks before** the show, so the song is playing when the 2-week ads/announcements start. One follow-up only, which the artist approves.
- The booking agent's checklist per show doesn't count the show as "promo ready" until: flyer sent, radio package sent, in-store asked, ads/announcements asked.

## Tour Manager's real goal: everyone home in one piece (owner, 2026-11-16)
"A successful tour is going out on the road and making it home in one piece, with the band not killing each other." Tour managing is herding cats. The easier the road is, the less stress, and the more the band stays focused. So the Tour Manager (task 06) designs for low stress:
- **Sane days**: default max 6 h driving, no drive after a show longer than 2 h unless the artist accepts it, a day off every 5–6 shows, and sleep windows protected in the schedule. Warn on any day that breaks these.
- **One source of truth**: every band member sees the same itinerary book, day sheet and live updates in SYNC. No "nobody told me".
- **Clear jobs**: assign driver shifts, merch, settlement and advancing to named members; rotate drivers automatically.
- **Money out in the open**: the per-show settlement, the float and the per-diems are visible to the whole band, and splits are calculated, not argued.
- **Morning brief** each day: where, when, who drives, load-in, soundcheck, appearances, and where you sleep tonight.

## Press: zines and reviews (owner, 2026-11-16)
- For each release and tour, the agent suggests **zine writers, blogs and local music press** for the genre and towns on the route (example: Spinning Platters, spinningplatters.com, a Sacramento music site, for a Sacramento show), and drafts a promo package for each: note, EPK link, release/stream links (links only, no audio files), show dates, and an offer of guest-list spots for the show.
- Reviews come into DanzStak in two ways:
  1. The writer posts the review on DanzStak themselves. Invite them with a no-account-needed link; if they join, the review is their post, owned by them, shown on the artist's EPK "Press" section and in Mix's review slot.
  2. The artist adds an outside review to the EPK as a **link + a short pull-quote (≤ 1–2 sentences) + outlet + date**, with a checkbox confirming the writer is OK with it. Never copy the full review.
- Track press in the same pipeline: sent → replied → reviewed, with one approved follow-up.

## EPK pricing (confirmed, owner 2026-11-16)
Building an EPK by hand is **free**. An **AI-built EPK costs $5**, and the band can edit every word for free afterwards (manual edits and look changes free forever; an AI redesign is another $5). This matches `docs/OWNER-DIRECTIVES.md`.

## The reason to open DanzStak first thing (owner, 2026-11-16)
- **Bands, in the morning**: Music HQ answers "how's my EPK doing?" at a glance: EPK opens since yesterday (which venues and press opened it), new replies, offers waiting, follow-ups due, today's promo to-dos (flyers, radio, in-stores), and next show.
- **Fans, after work**: a **Tonight / this week** card: shows near you tonight, friends going, artists you follow in town, in-stores and listening parties. Tickets are one tap away.
- Earn the open with real usefulness, not engagement-bait: no streaks, no "you're missing out", no fake urgency, chronological only (CLAUDE.md). One optional daily digest notification, off by default, that the member turns on.
- Everyone still lands in Mix (nav directive 2026-11-15). The band's Music HQ summary and the fan's Tonight card show as one compact card at the top of Mix, tapping through to Music HQ / Events.

## Tell artists up front (owner, 2026-11-16)
Artists learn before they reach the agent that a ready EPK comes first: in the Music HQ booking card, during artist signup ("Step 1: your EPK. Step 2: the agent books you."), and on the EPK builder's finish screen ("Your EPK is ready — start booking"). Tagline: **"Get it together to keep it together."** Show a short EPK checklist with progress (e.g. 4 of 6 done).
