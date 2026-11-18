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
| 2 | **Booking Agent** (`booking.html` → selected clubs) | Find and select clubs; send each a pitch with the **published EPK attached automatically** (per-venue private link); follow-ups; replies come into SYNC. **The paywall lives here:** booking-email credits, packs (Starter/Club/Tour), add-ons. | Re-ask for act name, genres, hometown, EPK link or pitch text the EPK already has |
| 3 | **Tour Manager** | Opens once the first pitches are out. Calendar of offered, held and confirmed dates; puts gigs in a straight-line route; travel days, drive times, lodging, per diems, costs, show pay, merch, profit/loss; advance sheets. | Selecting clubs or sending pitches |

## Booking Agent changes
- Remove the "Your act, ready to pitch" form (act name, genres, hometown, public EPK link, short pitch). The pitch is built from the published EPK; the artist edits the **email text** in the preview before sending (one editable message box per venue, prefilled from the EPK pitch).
- "Finish your EPK to start booking" card: keep it short (progress + "Open the EPK builder"), drop the "$5 with AI" line here — AI is sold in the EPK builder.
- Remove "Tour dates, crew and expense estimate" from booking; that is the Tour Manager.
- Credits/packs: one clear "Credits: 7 · Get more" bar at the top of the selected-clubs screen; buying opens the purchase pop-up (task 12 fees). Sending a pitch reserves a credit.
- Once at least one pitch is sent, show **"Plan the tour →"** (opens the Tour Manager with these clubs).

## Tour Manager: straight-line routing
- Input = the clubs the artist pitched (and later replies). Each club carries city, coordinates, and its date state: *asked*, *offered* (dates the venue proposed), *held*, *confirmed*, *declined*.
- **Calendar** (month view, phone-first) with confirmed shows solid, held/offered dates outlined, travel days shaded.
- **Route order:** sort stops along one direction of travel (start city → end city, default start = hometown; "out and back" or "one way" choice). Use the existing route/drive-time service; order by a nearest-neighbour pass along the chosen direction, then 2-opt to remove crossings.
- **Criss-cross check:** flag any leg that goes back past a city already played (e.g. Seattle → Portland → Bellingham → Seattle) and any day whose drive exceeds the max drive hours. Suggest the fix: "Swap Bellingham before Portland — saves 4 h 10 m and 270 mi."
- **Date asks that keep the line straight:** before follow-ups, suggest which dates to ask each still-open club for, so the open slots fall between confirmed neighbours on the route ("Ask Salem for Thu 12 or Fri 13 — between Portland (Wed 11) and Sacramento (Sat 14)"). The artist approves; the follow-up goes from Booking.
- As replies arrive (SYNC booking thread → date state), the calendar, route and money update by themselves.
- **Costs** use the corrected tour money (emergency cash is carried, not spent — #510).

## Done when
Booking never asks for anything the EPK has; AI is only in the EPK builder; credits/packs only in Booking; Tour Manager opens from sent pitches with a calendar, a straight-line route with no backtracking, criss-cross warnings with suggested swaps, date-ask suggestions, and live updates from replies. Browser checks at 320–430px; a fixture with the owner's Seattle/Portland/Bellingham/Sacramento/Salem/San Francisco example must produce Bellingham → Seattle → Portland → Salem → Sacramento → San Francisco (or the reverse) with zero backtracking.
