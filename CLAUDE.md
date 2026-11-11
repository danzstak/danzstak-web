# CLAUDE.md — DanzStak brief

Read this first, every session. Then read `docs/OWNER-DIRECTIVES.md` (priorities and task specs) and `instructions/` (the full product spec the owner wants built). Then read `README.md` (mission, independence rules, product boundary), `docs/DANZSTAK-DESIGN-SYSTEM.md`, and `docs/QUALITY-ASSURANCE-POLICY.md`. Those rules still apply.

## What DanzStak is

**Above all, DanzStak is an EPK and booking agent. An artist builds an EPK, sends it to clubs and venues, and gets booked. Everything else (Pivot, Mix, SYNC, Tribes, Record Stores) supports that or brings people to it. When priorities conflict, EPK and booking win.**

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
- **DanzStak never hosts music.** No audio-only uploads, audio storage or first-party music streaming; music is always a link or authorized embed. User video uploads are approved with DMCA and rights rules (`instructions/00e-no-music-hosting.md`).
- **Payments are Stripe or verified SFS Token through Phantom only.** DanzStak does not award, earn, hold, custody or exchange SFS, and never requires or integrates another platform account. Phantom is used only at checkout after explicit user action; access is granted only after independent server-side on-chain verification.
- Creators own their content on DanzStak. DanzStak takes only the limited permission needed to show it, ending on delete. Creators control sharing, keep attribution, and can export or delete everywhere (`instructions/00d-user-content-ownership.md`). Every deletion offers **Remove from here** (only this placement) and, for the original creator, **Delete everywhere** (the original and every in-service share disappear from feeds, profiles, Tribes, chat, search and notifications; DanzStak links/embeds stop working; media is purged from active storage and caches, with backups governed by account-erasure rules). No placeholder remains. A resharer can remove only their own share. Confirm plainly that screenshots, downloads and copies outside DanzStak cannot be recalled.
- Copy speaks like the scene, not like a corporation. Keep existing brand names
  (Digital Clubhouse, Your Mix, SYNC, Tribes, The Roll) and add more in that spirit.

## Pivot (the owner's name for leaving billionaire platforms)

Tagline: **“Pivot off those platforms.”**

Pivot is the overall move off Facebook and every other billionaire-owned platform (Instagram, X, TikTok and the rest) onto DanzStak: import your data, pick what to bring, invite your people, post an "I pivoted to DanzStak" card on your old accounts, and export or delete everything any time. **Moving Day** is the cleanup-and-selection step inside Pivot where a member previews an export and chooses exactly what to move. Facebook import exists today; other platforms are added as Pivot steps using each platform's own data export, with no platform APIs.

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

- A **Pivot** card stays on HQ until the user has imported from Facebook and invited their people.
- **Your data** (avatar menu): what DanzStak stores, export everything, delete everything — always two taps away.

### Layout rules

- One clear primary action per screen (Pitch, Publish EPK, Add show).
- No infinite scroll; Mix ends with "you're caught up".
- Phone first — bands use it from the van.
- Build this layout in steps; do not rewrite every page at once. Start with navigation + HQ, then Tour, then EPK.

## Visual direction: 80% familiar, 20% DanzStak

Familiar (about 80%). People coming from Facebook must know how to get around on day one. Keep the patterns they already know: top bar with search, notifications and messages (SYNC); left menu on desktop, bottom tabs on phones; center column for the main content; profile with cover, avatar and tabs; posts with like, comment and share; standard icons in standard places. Do not invent new navigation patterns.

DanzStak (about 20%). What makes it ours, without changing where things are:

- DanzStak colors, fonts and logo instead of stock social-network blue (it must not look like a phpFox template).
- Music tools are visible in the main menu (HQ, Tour/Gigs, EPK, Scene) next to the familiar Feed (Mix).
- Music-specific cards inside the familiar layout: shows as ticket stubs, releases as record sleeves, the EPK as a backstage laminate, tour dates as a poster list.
- Genre looks on artist-owned public pages only (EPK, artist profile, gig pages).

Genre looks. The platform frame (navigation, SYNC, settings, feed) stays one consistent DanzStak look so navigation never changes. Each artist's public EPK, profile and gig pages can wear a genre look the artist picks.

| Look | Ground / ink | Accent | Display | Detail | Body | Feel |
|---|---|---|---|---|---|---|
| Techno (default) | #0B0B0C / #EDEDEA | #FF5A1F hazard orange | Archivo 900, width 125% | JetBrains Mono | Archivo | Square edges, 1px rules, mono labels |
| Punk | #EFE8DA paper / #121110 | #E5452E screen-print red | Anton | Special Elite | Work Sans | Xerox photo frame, dashed perforations, ticket stubs |
| Metal | #0E0D0D / #E6DECB bone | #9E1B1B blood red | Pirata One (name only) | Oswald, wide tracking | Source Serif 4 | Centered, symmetrical, heavy photo |
| House / EDM | #0F2E26 deep green / #FFF4E0 | #FFC93C sun + #FF6FA8 pop | Syne 800 | DM Sans 700 | DM Sans | Rounded pills, arched photo, BPM badge |

Rules: each look is a token set, not a separate codebase. One accent per look. Contrast at least 4.5:1. Touch targets 44px. Phone first.

## How to work

- **Plan before code.** For any change bigger than one file, propose a short plan and wait for approval.
- **One feature at a time.** Small, reviewable pull requests.
- **Keep the tests green.** Run the existing regression suite; add tests for new behavior.
- **Fax the room before every PR** (`docs/OWNER-DIRECTIVES.md`). No go, no show.
- **Never** commit secrets, keys, passwords or AWS credentials. The repo is public.
- Respect the product boundary in `README.md` (no crypto/Web3 product; only the approved SFS Token checkout exception) and the independence rules
  (no core dependency on Big Tech APIs).
- Be candid about what is verified versus unverified, as `docs/OWNER-DIRECTIVES.md` requires.

## First task for a new session

Read the codebase, then reply with:
1. the 5 places DanzStak feels most like a generic social network, with file names;
2. a concrete redesign plan for Priority 1 (Music HQ home) and Priority 2 (EPK flagship);
3. what you would *remove or demote* to make room.

Do not write code until the plan is approved.

---

## Marketplace directive (owner, 2026-11-09)

- The official DanzStak Store is a main-menu platform destination. A member-named shop appears as a Shop tab/page on that member's profile, not as a permanent Mix sales block.
- DanzStak receives 5% of completed member-shop sales and event-ticket sales. Physical-goods seller proceeds release only after confirmed receipt through a provider-supported marketplace flow. No live commerce without tested seller onboarding, payouts, inventory/capacity, shipping or check-in, receipts, refunds, taxes, disputes and fraud controls. Full rules: `docs/OWNER-DIRECTIVES.md`.

## Idea bank (for discussion, not yet approved)

**Migration**
- **Pivot flow:** import from Facebook, preview, pick what to bring, invite your people, done.
- Shareable "I pivoted to DanzStak" card artists post on their old accounts with their new link.
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

## Later phase: SYNC Network (planned, paused until DanzStak has users)

SYNC becomes its own standalone chat, voice and video product with SYNC Network numbers users can get so they never share their personal number. It requires a carrier/provider, pricing, E911, A2P 10DLC, identity checks and anti-spam before launch. Until then, fix SYNC for current users and do not sell phone numbers. Full spec: `instructions/pages/04-chat` and `instructions/pages/12-phone-service`.

Current SYNC security rule (owner correction, 2026-11-11): every browser, installed PWA, tablet or computer must complete a fresh real carrier SMS OTP bound to that device's one-time server challenge before it receives a SYNC credential or can use SYNC messages or calls. Never accept a mock code, client-only flag, account-level verification from another device, replayed grant or DS internal alias as proof. The mobile number remains private, hashed/masked and unsearchable. This gate applies only to SYNC, not signup, posting, Friends or the EPK. Keep mandatory mode fail-closed and off until AWS SMS is approved and real US and Italy handset tests pass; do not lock users out behind an unavailable provider. SYNC Network numbers remain paused and must not be sold.

## StakGuard (planned)

StakGuard is DanzStak's data-broker protection product for every member under Settings -> Your data. It is separate from creator-content provenance and share-link tracking. Finding supported data-broker and people-search exposure, showing its source/date, preparing member-approved opt-outs and linking free official tools are free. Monitoring is $4 per month with no auto-renewal ever; members may prepay whole months at $4 each, up to 12 months/$48, and receive one reminder before paid time expires. Broker removal comes first; dark-web checks are later and never claim "all of the dark web." Phase A is research with synthetic data only—no vendors, Stripe products or charging without owner approval. Full spec: `instructions/pages/17-privacy-shield`.

