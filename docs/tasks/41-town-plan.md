# 41 — Town plan: in-stores and radio come with every booked gig

Owner 2026-11-19 (phone, looking at Music HQ):
- "If you have buttons on the Tour Manager or HQ dashboard … in-store appearances … radio station interviews … if you have these buttons you need to have the whole thing, so when users book gigs they can also schedule radio station interviews and meet and greets at record stores. This should be part of the Booking Agent as well."
- "The Booking Agent schedules the appearances, the Tour Manager makes sure they get there."
- "When the artist books the gig, record store appearances and radio station interviews should come into play: asking to do a meet and greet at the record store and asking to do an interview on air. If they can't get an interview, how much for ads to run for the band while they're on tour."
- Credits (owner answer 2026-11-19): **free with a booked gig**: up to 2 record shops and 2 radio stations per booked gig cost nothing; more use one booking-email credit each.

Earlier directive (2026-11-15) this completes: "After a show is booked, DanzStak suggests that town's record shops (sell/consign records, in-store meet & greet) and local radio stations (on-air interview the day of the show, announce the gig and the in-store). Everything the band books that day appears on its tour and in the town's Events."

## Flow
1. **A gig turns "Confirmed"** in the Booking Agent (venue reply or manual confirm).
2. **Town plan card** appears on that gig: "Make the most of {City}": the town's record shops and radio stations from the directories (record-stores, radio stations; nearest and best genre match first, never scraped data), each with a tick box. Two of each are pre-ticked.
3. **Requests** (one-to-one mail through the booking mail system: SES us-east-1, replies to `<token>@reply.danzstak.com` into the band's SYNC booking thread, the published EPK link attached):
   - **Record shop:** "In-store meet & greet / signing on {date}, before or after our show at {venue}", plus an optional "would you stock or consign our records?" line.
   - **Radio station:** "On-air interview on {date} (show at {venue})" and announcing the gig and the in-store.
   - **Radio fallback:** if the station declines, or doesn't answer within 5 days, the Booking Agent offers a one-tap follow-up: "What would ads for {band} cost during {tour dates}?" Ads stay a quote request only; DanzStak never pays or takes money for radio ads.
   - The artist edits and previews every email before it goes (same rules as pitches: daily caps, duplicate window, suppression list, disclosures).
4. **Replies** land in SYNC; one tap marks a request **Asked → Offered → Confirmed / Declined / Ad quote received**, with time and place.
5. **Tour Manager "makes sure they get there"**: confirmed in-stores and interviews become day-sheet items with time, address, contact and travel time from the previous stop; they are routed into the day's line (load-in, interview, in-store, soundcheck, show) and flag clashes ("Interview at 16:00 overlaps load-in 15:30"). Reminders the morning of and 1 hour before.
6. **Events and Music HQ:** a confirmed in-store shows in that town's Events and on the band's tour. Music HQ gets **In-stores** and **Radio** next to Gigs (count + next one), and its buttons open the Booking Agent's town plan, never an empty page.

## Data
- `TownPlanRequest`: gigId, kind (`instore` | `radio-interview` | `radio-ad-quote`), placeId, status, proposedTime, confirmedTime, replyThreadId, creditUsed (bool), createdAt. Free allowance counted per gigId (2 + 2).
- No phone numbers or contact emails shown to other members; contacts come from the directories under existing unlock rules.

## Checks
- Confirming a gig shows the town plan card with the right town's shops and stations at 360/390px.
- 2 shop + 2 station requests use no credit; a 3rd uses one; the ad-quote follow-up appears after a decline or 5 days (clock injected).
- A confirmed interview appears on the Tour Manager day sheet in time order, and a clash is flagged.
- HQ In-stores/Radio buttons open the town plan; nothing is a dead button.

## Scene news (owner 2026-11-19)
Confirmed gigs, in-stores and radio spots become scene news cards in the Mix slot rotation and entries in Events and the tour calendar, unless the band turns off "Announce on DanzStak" for that booking. See CLAUDE.md F15i.
