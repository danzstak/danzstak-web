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
