# Task 03 — Town plan: record shops + radio for each confirmed show

## Owner direction (2026-11-15/16)
After a show is booked, suggest that town's record shops (sell/consign records, in-store meet & greet) and local radio stations (on-air interview on show day, or a short spot announcing the gig and the in-store). Everything booked that day appears on the tour and in the town's Events. Radio stations belong in Music HQ.

## Build
1. **Suggestions on each confirmed show** (from task 02): "Record shops near <venue>" and "Radio in <city>", nearest/most relevant first, punk/metal/electronic-friendly first when the shop/station lists genres.
   - Record shops: reuse record-stores.js data/search.
   - Radio: new `radio stations` directory (task 04). Until it has entries for a city, show "Add a station you know" + nothing invented.
2. **One-tap pitches** with editable drafts (artist reviews every word; nothing sent unseen):
   - Shop: "In-store meet & greet / signing on <date>", "Consign or sell our records".
   - Radio: "On-air interview on <show date>", "Can you mention / announce our show", and "We'd like to run a short spot for our show — what are your rates?" (DanzStak only sends the question; the artist pays the station directly; DanzStak doesn't sell or take a cut of radio ads).
   - Sent through the same booking mail + reply-token → SYNC bridge, with the same caps, suppression and disclosures.
3. **When they say yes**: "Add to the day" creates an item on that show's day (time, place, contact). In-stores can also be posted to Events (pre-filled, editable).
4. Show day view (task 05) lists these items.

## Tests
Drafts never auto-send; one pitch per shop/station per show; replies thread into SYNC; an accepted in-store appears on the show day and (if posted) in Events.
