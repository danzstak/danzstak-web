# 25 — EPK → Booking → Tour Manager: one flow, no repeats (owner 2026-11-18)

Owner, from phone screenshots of booking-selections.html:
> "Kinda redundant info with the booking, and it offers AI — that should be in the EPK, and in booking the paywall for add-ons and getting credits."
> "Clubs are selected from booking and sending the EPK is from booking, and tour managers should arrange the tour and set costs, not rehash the booking process."
> "Once the agent has sent out a few emails the users can start the tour planning with the tour manager. Things change as clubs reply and users get verified dates."
> "Tour planning comes after emails are sent, to try and get dates closest to each other out on the road, so users are not criss-crossing."
> "The tour planner should have the calendar and try to get the gigs one after another in a straight line. Not Seattle → Portland → Bellingham → Seattle → Sacramento → Salem → San Francisco. That is criss-crossing the route."

## Who does what
| Step | Screen | Does | Never does |
|---|---|---|---|
| 1 | **EPK** (`epk.html`) | Builds the act: name, genres, hometown, photos, bio, music links, live video, contacts, rider, stage plot. **AI-assisted EPK ($5 + fees) is offered here and only here.** Publish. | Booking or tour money |
| 2 | **Booking Agent** (`booking.html` → selected clubs) | Find and select clubs **and line them up as a road trip**: proposes the order and the date window to ask each club for, so the asks run one after another on the road; send each a pitch with the **published EPK attached automatically** (per-venue private link); follow-ups; replies come into SYNC. **The paywall lives here:** booking-email credits, packs (Starter/Club/Tour), add-ons. | Re-ask for act name, genres, hometown, EPK link or pitch text the EPK already has |
| 3 | **Tour Manager** | Opens once the first pitches are out. **Checks the agent's work:** when offered/confirmed dates criss-cross, it tells the Booking Agent the route doesn't work and what the criss-cross costs. Calendar of offered, held and confirmed dates; puts gigs in a straight-line route; travel days, drive times, lodging, per diems, costs, show pay, merch, profit/loss; advance sheets. | Selecting clubs, sending pitches, **or selling anything — no paywall, prices or credit prompts on the Tour Manager** (owner 2026-11-18: "things should have been handled before they get to the tour manager") |

## Booking Agent changes
- Remove the "Your act, ready to pitch" form (act name, genres, hometown, public EPK link, short pitch). The pitch is built from the published EPK; the artist edits the **email text** in the preview before sending (one editable message box per venue, prefilled from the EPK pitch).
- "Finish your EPK to start booking" card: keep it short (progress + "Open the EPK builder"), drop the "$5 with AI" line here — AI is sold in the EPK builder.
- Remove "Tour dates, crew and expense estimate" from booking; that is the Tour Manager.
- Credits/packs: a small credit count only; the purchase pop-up (task 12 fees) opens when credits are low (2 or fewer) or when Send needs one the artist doesn't have. Sending a pitch reserves a credit.
- Once at least one pitch is sent, show **"Plan the tour →"** (opens the Tour Manager with these clubs).

## Booking Agent: line the dates up as a tour (owner 2026-11-18)
> "It's the booking agent's job to arrange a road trip that lines up. Not a bunch of random slots being filled, but lining up for a tour."
- When the artist has selected clubs, Booking orders them along one direction of travel (start city → end city; default start = hometown; one-way or out-and-back) and gives each club a **date window to ask for**, consecutive along the route with travel days where drives are long. Example (owner): **Bellingham → Seattle → Tacoma → Olympia → Portland**, asked for Thu, Fri, Sat, Sun, Tue.
- The pitch preview shows the suggested dates for that club ("We're routing through the Pacific Northwest and could play Fri 13 or Sat 14"); the artist can change them. Each club only ever sees its own dates.
- **Suggest the clubs, not just the dates** (owner 2026-11-18: "I have driven 18 hours, did a show, then back 15 hours when the tour didn't line up. It should have been a 3-hour drive and then down to the next show. The driving is brutal."). When the artist picks a region or a couple of anchor shows, Booking proposes clubs in the towns *along the line* between them (matching genre and size), so the gaps are filled with short hops instead of random far-away slots. Default target: **3–4 h between shows, warn above 6 h, never plan above the artist's max drive hours** without a travel day. A club that would force a long backtrack is shown as "off route (+15 h)" and sorted last.
- Replies update the plan: when a club offers a different date, Booking re-fits the remaining asks around it and suggests follow-up dates that keep the line straight.

## Tour Manager: checks the route and reports back to Booking
- Input = the clubs the artist pitched (and later replies). Each club carries city, coordinates, and its date state: *asked*, *offered* (dates the venue proposed), *held*, *confirmed*, *declined*.
- **Calendar** (month view, phone-first) with confirmed shows solid, held/offered dates outlined, travel days shaded.
- **Route order:** sort stops along one direction of travel (start city → end city, default start = hometown; "out and back" or "one way" choice). Use the existing route/drive-time service; order by a nearest-neighbour pass along the chosen direction, then 2-opt to remove crossings.
- **The Booking Agent and the Tour Manager sort it out between themselves** (owner 2026-11-18: "I would not leave this up to the band. They don't know where they are on the road — first thing we'd do was check into a hotel and put the Weather Channel on to see where we were."). Booking sends its proposed clubs and dates to the Tour Manager, which maps the tour; if it doesn't line up, it sends it back to Booking to move clubs around, and they repeat until it lines up. **The band only sees a plan that lines up**, as one approval card on Music HQ. The Tour Manager's note to Booking is with the cost of the detour, phrased as a concrete swap the agent can act on (owner 2026-11-18): **"If The Crocodile (Seattle) was booked on Fri 13 and Doug Fir (Portland) on Sun 15, you'd save 10 h of driving and $260 in fuel."** One suggestion per card, biggest saving first, each with **Ask for these dates** (drafts the follow-ups in Booking for the artist to approve).
- **Report back to the Booking Agent:** when offered/held/confirmed dates make the route criss-cross (owner's example: Seattle → Portland → Bellingham → Seattle → Sacramento → Salem → San Francisco), the Tour Manager posts a note into the Booking screen and the booking thread list: **"This order backtracks 3 times: +640 mi, +11 h driving, +$410 fuel/van, +1 hotel night vs the straight route."** with **Fix the order** (reorders the asks/follow-ups in Booking) — it never sends anything itself.
- **Criss-cross check:** flag any leg that goes back past a city already played (e.g. Seattle → Portland → Bellingham → Seattle) and any day whose drive exceeds the max drive hours. Suggest the fix: "Swap Bellingham before Portland — saves 4 h 10 m and 270 mi."
- **Date asks that keep the line straight** (shown in Booking, computed with the Tour Manager's route): suggest which dates to ask each still-open club for, so the open slots fall between confirmed neighbours on the route ("Ask Salem for Thu 12 or Fri 13 — between Portland (Wed 11) and Sacramento (Sat 14)"). The artist approves; the follow-up goes from Booking.
- As replies arrive (SYNC booking thread → date state), the calendar, route and money update by themselves.
- **Costs** use the corrected tour money (emergency cash is carried, not spent — #510).

## Done when
Booking never asks for anything the EPK has; AI is only in the EPK builder; credits/packs only in Booking; Tour Manager opens from sent pitches with a calendar, a straight-line route with no backtracking, criss-cross warnings with suggested swaps, date-ask suggestions, and live updates from replies. Browser checks at 320–430px; a fixture with the owner's Seattle/Portland/Bellingham/Sacramento/Salem/San Francisco example must produce Bellingham → Seattle → Portland → Salem → Sacramento → San Francisco (or the reverse) with zero backtracking.

## On the road: "where are we?" (owner 2026-11-18)
A **Today** card on Music HQ while a tour is live: a small map with where the band is now, tonight's venue, load-in time, the drive to tomorrow's show (hours, miles, fuel stop), tonight's hotel and the weather along tomorrow's drive. No digging through screens to find out where you are.

## Where paying happens (owner 2026-11-18)
- **EPK builder:** the price appears only when the artist chooses **AI-assisted**. Building by hand never shows a price.
- **Booking Agent:** the purchase prompt appears only when credits run low (or run out at Send). No standing paywall, banner or upsell on the selected-clubs screen; a small credit count is fine.
- **Tour Manager:** never.

Everything paid is settled before the Tour Manager: AI EPK in the EPK builder; booking-email credits, packs and add-ons (including the **Tour Itinerary**, which the Tour Pack already includes) in Booking. The Tour Manager never shows prices, "Buy", "Unlock" or credit counts. If the artist reaches it without the Tour Itinerary add-on, Booking offers it at the point where the first pitches go out ("Plan the tour →" step), not inside the Tour Manager. Remove any purchase prompt that is there today and add a test that the Tour Manager pages contain no checkout calls.
