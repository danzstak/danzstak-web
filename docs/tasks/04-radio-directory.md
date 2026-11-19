# Task 04 — Radio stations in Music HQ

## Build
1. A **Radio** section in Music HQ next to Record shops: search by city/genre; each station: name, city, website, genres/shows, how to contact (public submission email or form URL only), and notes like "college / community / specialist show".
2. **Members can add stations** (public info only: name, city, website, public contact). New entries are marked "member-added" until another member confirms or the owner reviews. Report a wrong/closed station.
3. **Starter list**: an owner-approved JSON seed in the repo (`data/radio-stations.json`) — empty to start; the claude.ai session researches and proposes entries for review. Never scrape private contact data; only publicly published submission addresses.
4. Pitching uses task 03's drafts and the booking mail bridge.

## Tests
Only https websites; contact must be a public email or https form URL; member-added flag shown; no duplicate station per city+name.
