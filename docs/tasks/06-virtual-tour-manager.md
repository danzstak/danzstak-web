# Task 06 — Virtual Tour Manager: cost, schedule, itinerary book + maps

## Owner direction (2026-11-16, from a working stagehand / road veteran)
- "The tour manager calculates the cost of the tour with rooms to stay, or free parking to sleep in the van, campgrounds and such on the road."
- "The tour manager sets the times the band does the meet & greet at record stores and the time on air for interviews at radio, and gets them to the club on time for soundcheck."
- "When I was on tour I had a full itinerary book of where I was going to be and at what time. The tour manager's job is to get the full itinerary in the hands of the band members."
- "A virtual tour manager should have a full itinerary for the band in the form of a PDF and mapped out on Google Maps. Back in the day we had paper maps; now Google Maps handles this."

## Read first
booking.html (route, Driver Card, comfort styles couch/budget/holiday/custom, Tour Finish Line, close-out), assets/booking-agent.js, booking-map.js, and docs/tasks/02–05 (pipeline, town plan, radio, advance/day sheet). Routing/places already use **AWS Location** (`@aws-sdk/client-geo-routes`, `client-geo-places`) — keep using it.

## Independence rule (README/CLAUDE.md)
No core dependency on Big Tech APIs. So: compute routes/times/places with AWS Location (already in use); **hand off to Google Maps with plain links** (`https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=…&travelmode=driving`) — no Google API key, no SDK. Also offer Apple Maps / OSM links. The PDF works offline without any map service.

## Build
1. **Nightly stay per tour day** (after each show): the band picks one —
   - Room (hotel/motel): AWS Places search near the venue; the band enters the price they found (DanzStak doesn't book or take a cut).
   - Campground: AWS Places category search near the route; enter the fee.
   - Sleep in the van: "free overnight parking" is **member-reported only** (name, address, notes like "ask the manager", date confirmed) with a clear note "Rules change — check signs and local law." Never claim a place is legal or safe.
   - Host / couch (friend or fan): free, address entered by the band, private to the band.
2. **Tour cost** (builds on the existing comfort styles): fuel = route miles ÷ van MPG × fuel price (both editable, default per country), lodging per night from step 1, per diems × band size × days, tolls/ferries (manual), van rental, other. Show **total, per show, per member**, vs. expected income from confirmed deals (guarantees / estimated door) → "tour budget vs. actual" on Music HQ. Close-out updates actuals.
3. **Day scheduler**: for each show day, order the stops — leave lodging → radio (on-air time) → record shop (meet & greet time) → venue (load-in / soundcheck from the advance) → show → stay. Use AWS Routes for drive times with a buffer (default 20%, editable; extra for load-in). **Warn** when a stop makes them late for load-in/soundcheck, and suggest the latest safe time for the in-store/radio. Times always in the local time zone of each stop.
4. **Itinerary book (the "tour book")**:
   - Phone view: day by day, each stop with time, address, contact (tap to call/email), notes; "Navigate" buttons opening Google Maps (or Apple/OSM) for that leg; "Whole day in Google Maps" link with waypoints.
   - **PDF**: cover (tour name, dates, band), contacts page, then one page per day: schedule, venue advance details, stay, drive legs with miles/time, map-link QR codes per leg; printable, works offline. Generate server-side or client-side; no secrets or private member data beyond what the band entered.
   - **Share with band members and crew**: invite by DanzStak member or a private revocable link; updates push to everyone; SYNC message "Tour book updated".
5. Changes flow: a confirmed show (task 02), a booked in-store/radio (task 03) or an advance correction (task 05) updates the book automatically.

## Tests
Cost math (fuel, per diem, per member); stops ordered and late-for-soundcheck warning; times in each stop's zone; Google Maps link built correctly (no API key); PDF has one page per day; share link revocable; van-parking entries always show the "check local rules" note.

## Done when
On a phone, a 3-city sandbox tour shows a full cost, a day schedule that gets the band to soundcheck on time, a shareable tour book, a downloadable PDF, and working Google Maps links per leg.

## Pricing (owner, 2026-11-16)
The printed tour book is the **Tour Itinerary**, a one-off $5 product per tour ($6.30 with fees; free for 20+ confirmed shows). Everything else in the Tour Manager is free. See task 12.
