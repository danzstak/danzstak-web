# CLAUDE.md — DanzStak brief

Read this first, every session. Then read `README.md` (mission, independence rules, product boundary),
`docs/DANZSTAK-DESIGN-SYSTEM.md`, and `docs/QUALITY-ASSURANCE-POLICY.md`. Those rules still apply.

## What DanzStak is

DanzStak helps people leave billionaire-owned social platforms and take control of their data —
**through music**. It is the Digital Clubhouse for artists, fans, venues and record stores.

It is **not** a Facebook clone with music features attached. Today the product is roughly
80% generic social (feed, stories, reels, reactions, friends) and 20% DanzStak. The job now is to flip that.

## The core idea: music first, social second

The product is the music tools. Social features exist to support them, not the other way around.

| Core (lead with these) | Supporting (keep, but secondary) |
|---|---|
| EPK Builder (`epk.html`, `assets/epk.js`) | Feed / Your Mix (`feed.html`) |
| Booking & Tour Agent (`booking.html`, `assets/booking-*.js`) | Stories, Reels, The Roll |
| Record Stores (`record-stores.html`) | Reactions, comments |
| Facebook import + data export (leaving is easy) | Friends, presence |
| Tribes (scenes and communities around music) | SYNC messages, calls |

When a design choice is unclear, ask: *does this help an artist book a show, get press, sell a record,
grow a real scene, or bring their people over from a billionaire platform?* If not, it is not a priority.

## Not Facebook — specific rules

- The signed-in home is **not** an infinite feed. It is the user's music HQ (see Priority 1).
- No engagement-bait patterns: no infinite scroll, no streaks, no "you're missing out" nudges,
  no algorithmic ranking. Chronological or user-controlled views only (already a README rule).
- Avoid generic social UI conventions when a music-native one fits better
  (a gig poster, a record sleeve, a setlist, a tour laminate, a crate of records).
- Navigation order puts music tools before Feed.
- Copy speaks like the scene, not like a corporation. Keep existing brand names
  (Digital Clubhouse, Your Mix, SYNC, Tribes, The Roll) and add more in that spirit.

## Priorities (in order)

1. **Home = Music HQ.** For artists: next shows, tour status, EPK views/shares, booking replies, new
   activity from their Tribes. For fans: shows near them, new releases from people they follow, record
   store events. Social activity sits below, chronological.
2. **EPK Builder becomes flagship.** Give it the polish the feed received: beautiful public EPK pages,
   a shareable link and QR code, press-ready PDF export, simple stats on who opened it. An artist should
   want to join DanzStak for the EPK alone.
3. **Navigation re-order.** Music HQ, EPK, Tour, Record Stores, Tribes, then Mix (feed), SYNC.
4. **Migration front and center.** "Bring your music life over": Facebook import, invite your fans,
   export everything any time. Make leaving a billionaire platform feel easy and safe.
5. **Record Stores and Tour connect.** A tour stop can show nearby record stores; a store can host an
   in-store event that appears on the artist's tour.

## Product layout (target information architecture)

Lay DanzStak out around who is using it and what they came to do. Music first, social woven through.

### Main navigation — 5 tabs, same on phone and desktop

| Tab | What lives there |
|---|---|
| **HQ** (home) | Role-based dashboard: next show, booking replies, EPK views, Tribe activity |
| **Tour** | Route planner → booking pipeline → show-day / advance sheets |
| **EPK** | Builder, public EPK page, stage plot + input list, rider, press files |
| **Scene** | Record stores, venues, Tribes, shows near you |
| **Mix** | Chronological feed, stories, The Roll |

- **SYNC** (messages and calls) and notifications live in the top bar on every screen, not as a tab.
- Profile, Settings and **Your data** live in the avatar menu.

### HQ changes by role

- **Artist:** next 3 shows, open booking threads, EPK opens this week, tour budget vs. actual, "post from the road".
- **Fan:** shows near you, new releases from people you follow, record store events, your Tribes.
- **Venue / record store:** incoming pitches, calendar gaps to fill, upcoming in-store events.
- **Crew / production:** calls this week, advance sheets, stage plots for upcoming shows.
- Mix appears on HQ only as a small "latest from your people" strip at the bottom.

### Everything connects (the difference from Facebook)

- Tour stop → venue page → pitch with EPK attached → confirmed show → show-day sheet → post-show post in Mix.
- Record store page → artists on its shelf → in-store events that appear on those artists' tours.
- Tribe (local scene) → its calendar pulls in shows, in-stores and listening parties automatically.

A feature should hand off to the next one, not sit alone as a separate page.

### Migration and data ownership

- A **Moving Day** card stays on HQ until the user has imported from Facebook and invited their people.
- **Your data** (avatar menu): what DanzStak stores, export everything, delete everything — always two taps away.

### Layout rules

- One clear primary action per screen (Pitch, Publish EPK, Add show).
- No infinite scroll; Mix ends with "you're caught up".
- Phone first — bands use it from the van.
- Build this layout in steps; do not rewrite every page at once. Start with navigation + HQ, then Tour, then EPK.

## How to work

- **Plan before code.** For any change bigger than one file, propose a short plan and wait for approval.
- **One feature at a time.** Small, reviewable pull requests.
- **Keep the tests green.** Run the existing regression suite; add tests for new behavior.
- **Never** commit secrets, keys, passwords or AWS credentials. The repo is public.
- Respect the product boundary in `README.md` (no crypto/Web3 in DanzStak) and the independence rules
  (no core dependency on Big Tech APIs).
- Be candid about what is verified versus unverified, as `RESTART-CHECKPOINT.md` already asks.

## First task for a new session

Read the codebase, then reply with:
1. the 5 places DanzStak feels most like a generic social network, with file names;
2. a concrete redesign plan for Priority 1 (Music HQ home) and Priority 2 (EPK flagship);
3. what you would *remove or demote* to make room.

Do not write code until the plan is approved.

---

## Idea bank (for discussion, not yet approved)

**Migration**
- "Moving Day" flow: import from Facebook, preview, pick what to bring, invite your people, done.
- Shareable "I moved to DanzStak" card artists post on their old accounts with their new link.
- A visible data dashboard: what DanzStak stores about you, export and delete in one click.

**Artists**
- EPK templates by genre with a press-kit checklist ("missing: live photos, tech rider").
- Tour laminate: one page per tour with dates, venues, rider, contacts — shared with the band and crew.
- Advance sheets sent to venues straight from the booking pipeline.
- Merch and vinyl table: link physical releases to record stores that stock them.

**Fans**
- "Shows near me" and "Crate": a fan's collection of records, shows attended, and artists they back.
- Ticket stub memories: shows you went to, kept as a personal timeline you own.

**Record stores and venues**
- Store pages with in-store events, new arrivals, and local artist shelves.
- Venue profiles that list what they book, tech specs, and how to pitch them.

**Crew and production (the owner's home turf: 25+ years as an IATSE Local 16 journeyman in San Francisco)**
- Stage plot and input list builder inside the EPK, exportable for venues and crews.
- Tech rider templates that a venue's production team can actually work from.
- Load-in / show-day sheet per tour stop: call times, contacts, power, backline, curfew.
- Crew-friendly advance: venue production manager confirms specs right in the booking thread.
- Respect union crews: venue profiles can note house crew and union jurisdiction so artists plan properly.

**Scenes (Tribes)**
- Local scene Tribes by city and genre, run by members ("elders" already exists).
- Scene calendar that merges shows, in-stores and listening parties.

**Revenue (already allowed by README)**
- Pro EPK features, tour-management tools, verified venue/store tools, supporter memberships,
  clearly disclosed fees on bookings or sales DanzStak actually facilitates.

