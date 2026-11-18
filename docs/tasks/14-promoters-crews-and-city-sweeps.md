# Task 14: AI promoter reader, free tekno crews, big-city sweeps

Owner directives 2026-11-16/17. First job next session.

## Context (what is live)
- Club database (DANZSTAK-VenueDirectory, `club-directory.mjs`): every club a search finds is saved; tiers verified (booked) > replied > found; bounced/opted-out = removed and hidden. Pay-to-play reports (tickets/fee). Owner CSV: `scripts/export-club-directory.mjs`. IAM policy DanzStakClubDirectory is in place.
- Promoter search (`promoter-research.mjs`, `promoter-contact.mjs`): Brave web search in English + local language, filtered to promoter-looking pages, then each page and its contact page are read for email/phone/socials. Brave key is on both Lambdas (BRAVE_SEARCH_API_KEY). Brave costs $5 per 1,000 searches with $5/month credit.
- Live test 2026-11-17: Bologna punk gave only 2 weak promoters. A plain search is not enough; Google AI mode reads the pages.

## 14-A AI promoter reader
- Per city: wider search (8–12 queries: English + local, genre scene words), collect results.
- An AI step (Bedrock, same provider as the AI EPK, task 08) reads titles/snippets and the fetched pages and keeps only real promoters, party crews, collectives, booking agencies and sound systems with a public booking email, phone or social page. Output: name, type, city, genres, email, phone, socials, source URL.
- Needs: Bedrock model access + `bedrock:InvokeModel` on the Auth-API role (owner pastes the command), and the bedrock-runtime client (or SigV4 call).
- Save to the club database (kind promoter / crew); same tier rules.
- Test: Bologna punk, Mannheim techno, a US city. Show the owner the lists.

## 14-B Free tekno crews (Europe and the US)
- Own search type: "free tekno sound system {city}", "teknival", "free party crew", "sound system collettivo", "Soundsystem Kollektiv", "son tekno free party", US: "underground rave crew", "free party collective".
- They post mostly on Instagram, Facebook and Telegram: keep public social pages as the contact. The band decides whether a free party fits.

## 14-C Big-city sweeps
- One search tops out around one centre point. Sweep big cities area by area and scene by scene, saving every club and crew.
- New York: Brooklyn (Bushwick, Williamsburg, Greenpoint, Gowanus), Queens (Ridgewood, Astoria, LIC), Manhattan (LES, East Village), the Bronx, Jersey City. Scenes: punk/DIY, metal, techno/house/warehouse, free tekno, promoters.
- Then all of them (owner: "yes all them"): LA, Chicago, SF/Oakland, Seattle, Portland, Detroit, Austin, Philadelphia, Berlin, London, Paris, Milan, Bologna, Barcelona, Madrid, Amsterdam, Lyon, Hamburg, Mannheim and more.
- Budget (owner 2026-11-17): 50,000 Brave searches to work with. Keep a running count; report searches used per sweep. Give him a spreadsheet per city sorted by area and scene.

## Also queued
- Notification when a club or promoter replies to a pitch ("[club] answered your pitch") — booking replies land in SYNC but no push fires today.
- Owner: delete the root access key in AWS before doors (wiping the PC does not revoke it).

## 14-D Events page: not another HTML form (owner 2026-11-17)
- Same treatment the EPK builder got (assets/epk-skin.css): DanzStak black/silver/hazard orange, Archivo wide display, mono labels.
- Creating an event should feel like making a gig poster: a live poster/flyer preview (flyer or 15 s video, headline, date, venue, price) that fills in as the promoter types; ticket options as ticket stubs; one orange primary action (Publish event).
- Public event page: the poster up top, ticket stub to buy, lineup, venue map link. Phone first, 44 px targets, IT/FR/ES strings.
- Inviting to promoters, not a form to fill out (owner 2026-11-17):
  - Open with what the promoter gets: "Sell tickets to your night. You keep the full ticket price; buyers pay the 6% fee." Plus door list, QR + plain-text tickets, named tickets against scalpers, your crowd sees it in Mix and Events.
  - Start with one big drop zone: "Drop your flyer" (or a 15 s video). The poster preview appears right away; then a few quick questions one at a time (name of the night, date and doors, venue, ticket price), not a long page of fields.
  - Optional extras (seating sections, ticket delivery, named tickets on/off, outside ticket link) folded under "More options".
  - Show past/upcoming events from local promoters as inspiration on the empty state.
- What Events is for (owner 2026-11-17): fans discover nights in Mix (the event post goes in Mix). Fans open Events already knowing which night they want, so Events is not a feed to scroll:
  - Top: search ("night, artist, venue or city") and "My tickets" (show the ticket / door code fast, works offline).
  - Then: tonight and this weekend near me as a short list, not an endless scroll.
  - For promoters: "Sell tickets to your night" (the flyer-first creator above) and their own events with sales so far.
  - The public event page (from Mix or a shared link) is the ticket stub: poster, date, venue, price, Buy, done.
- "DanzStak ads" (owner 2026-11-17) means members' own items, merch and tickets shown as house promotion (e.g. "tonight near you" in Events, a member's new item once in Mix). Free and fair: ordered by time and distance, no payment, no boosting. Third-party paid ads stay Bazaar-only.
- Mix item slot (owner 2026-11-17, supersedes "once in Mix"): at most every 4th post in Mix, adaptive (skip the slot unless the member has a fresh, relevant item they have not seen in 2 weeks; early on that may be 1 in 10-20 posts; gigs and merch rotate with other items; the 4 is an owner setting). Friends' posts stay the bulk of Mix, unlike Facebook. Every slot shows something different: a different seller and a different kind (gig ticket, band merch, record, craft) than the slot before. is a members' item, merch or ticket; labelled "For sale" / "Tickets"; never paid; fair rotation (nearby and followed first, then newer); the same item does not repeat within 2 weeks; skip the slot when nothing relevant exists. Rotation (owner 2026-11-18): every 4th post shows a different Bazaar item (a different item, seller and kind than any other slot on the same Mix load), and each new session (sign-in, reopening the app after it was closed, or reaching the end of Mix — "You're caught up" — and refreshing) rotates to the next items in the fair order, so returning members see fresh items instead of the same ones; keep a per-member server-side cursor of items already shown (no client-only state), still honouring the 2-week no-repeat. Tapping a slot opens the seller's shop (their profile Shop tab) with that item's product page open; Back returns to the same spot in Mix. Mix stays chronological and finite otherwise.
