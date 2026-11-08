# DanzStak owner directives

Every standing instruction from the owner (Shawn), in one place. This file is the directive set for Codex (and any AI or person working on this repo). Read in this order:

1. CLAUDE.md: the short brief.
2. This file: priorities, rules and task specs from 2026-11-07.
3. instructions/: the full product spec the owner wrote with ChatGPT on 2026-11-04 (page-by-page contracts for Home/Mix, Dailies, The Roll, SYNC, Facebook import, Events, StakGuard, phone service and more). This is what the owner wants to build. Nothing in it is cancelled; this file only sets the order.

When two directives conflict, the newer dated one wins; if unclear, stop and ask the owner. Last updated: 2026-11-07.

## Global rules (apply to every task)

- Read CLAUDE.md first.
- Plan first: draft PR, then stop for owner approval before code.
- No deploys. No AWS, Stripe or credential changes.
- Never commit secrets, keys, passwords, account IDs or login notes. The repo is public.
- DanzStak never hosts music. No audio-only uploads (MP3, WAV, FLAC, AIFF, AAC, OGG...), no audio storage, no first-party music streaming. Music is always a link or authorized embed (Bandcamp, SoundCloud, YouTube, etc.).
- User video uploads are approved (phone video from shows, clubs, daily life), with rights affirmation, DMCA process and server-side checks that a file is real video, not disguised audio. Full rules: instructions/00e-no-music-hosting.md. No hosting goes live without owner approval of costs.
- If DMCA problems grow, the owner may restrict video uploads; repeat infringers lose upload rights.
- Downloading from DanzStak is very hard by default. Do not show download controls or grant reusable public media URLs unless the creator explicitly allows downloads. Where DanzStak controls media, use access-checked short-lived delivery, restrictive response headers and cache rules, and revoke access on privacy/deletion changes. Be honest that browser playback cannot prevent screenshots, screen recording or determined capture; this is strong deterrence and creator control, not an impossible guarantee.
- Creators own their content on DanzStak. DanzStak takes no ownership. Users only grant DanzStak the limited permission needed to show their content where they choose, and that ends when they delete it. Creators control who sees and shares it (Do Not Share, download limits), keep attribution on every share, and can export or delete it everywhere at any time. Every deletion offers **Remove from here**, which removes only that placement, and—only to the original creator—**Delete everywhere**. Delete everywhere removes the original and every share from every DanzStak feed, profile, Tribe, chat, search and notification; no placeholder remains. Shared DanzStak links and embeds stop working, and media is removed from active storage and caches under the account-erasure backup rules. A resharer can remove only their own reshare. The confirmation must say plainly that screenshots, downloads and copies outside DanzStak cannot be recalled. No selling, training AI on, or advertising with user content. Full rules: instructions/00d-user-content-ownership.md.
- Tests stay green (test-regressions.ps1 and the review checks). Add tests for new behavior.
- Never hard-code any artist's name, bio, releases or links into pages, CSS or templates. Example content is example only.

## Faxing the room — owner's quality gate for every PR

Nothing reaches the owner until the room has been faxed: the builder walks every screen they touched like a technical director walks the room before doors.

- **Text:** spelling, names and labels match the specification, including Take, Pivot, Mix, SYNC and StakGuard.
- **Layout:** nothing is cut off, overlapping, misaligned or badly spaced at 320, 360, 390, 414 and 430px or on desktop.
- **Proof:** the PR contains screenshots of every changed screen, and the builder has personally inspected them before requesting review.
- **No leftovers:** no placeholders, retired names, TODOs or fake "done" claims remain.
- **Tests:** existing tests and new tests for changed behavior are green.
- **PR description:** every PR description ends with a **Room faxed** checklist recording each item above. For a documentation-only PR, state honestly that no product screen changed; do not invent screenshot evidence.

The owner then performs the walkthrough and decides go or no-go. No go, no show.

**Test, test, test, deploy.** (1) Automated tests green. (2) The builder faxes the room. (3) The owner tests the preview on their phone. Only then deploy, and only with the owner's go. The owner should never be the one who finds a mistake: if the owner finds one, the builder missed it, so add a check or test that would have caught it.

## Mix layout and placements (owner, 2026-11-07)

Phone and the desktop center column use this exact finite order:

1. Header with search, notifications and SYNC.
2. Dailies row. The first tile is the signed-in member's own photo with today's date and **SCENE 1 · TAKE N**; N is the server-authoritative lifetime count of that member's successfully uploaded Dailies videos. Each successful Dailies video counts once, photos do not increase the Take, and expiry never lowers N.
3. Four chronological Mix posts.
4. **The Roll** launcher row, opening the existing fullscreen swipe video player.
5. Three chronological posts, then the newest unseen show review from the member's people and scene.
6. Three chronological posts, then the newest unseen album review from the member's people and scene.
7. Three chronological posts, then the newest unseen event flyer from the member's people and scene.
8. Repeat the three-post/show-review, three-post/album-review, three-post/event-flyer pattern until **You're caught up**. No infinite scroll.

Posts remain chronological. If an eligible unseen supplemental item does not exist, skip that slot without leaving a gap. Never substitute an advertisement, promotion or algorithm-selected item. Desktop keeps **HQ, Tour, EPK, Scene, Mix** in the left menu and **News (with Reviews)** plus **Shows near you** in the right column. Implementation plan and 390px reference: `docs/DESIGN-DIRECTION-PLAN.md` on `codex/design-direction-plan`.

## Priority order (2026-11-07): get users first

0. Merge instructions/, this file and the CLAUDE.md updates into main.
1. Task 1, repo cleanup. Done (b5b5213).
2. Task 4, EPK -> send to clubs -> get booked. #1 priority.
3. Task 2 EPK part: EPK builder for every artist, look picker, share links, stage plot / booth plot, press PDF.
4. SYNC P0 fixes for current users only: reliable messages (#39), two-way call audio and incoming ring (#27), optional private phone SMS verification (#21). Fix what's broken; no rebuild. Booking replies routed into SYNC depend on this.
5. Task 3, 80/20 look: navigation shell, HQ (artist HQ led by bookings and EPK opens), EPK public page first.
6. Growth basics: sign-up to first EPK in under 5 minutes; invite bandmates and fans by link; venues reply without an account; public EPK pages load fast and preview well.
7. Pivot (with the guides and timeline imports from the Pivot addendum), after the EPK and booking work. For artists, Pivot ends with a published EPK.
   One guided flow on top of the Facebook import already on main and instructions/pages/15-facebook-import:
   - Start from a Pivot card on HQ (stays until done) and from the menu.
   - Step 1, bring your data: Facebook export help, upload, preview, pick what to bring, privacy in batches.
   - Step 2, bring your people: invite by link, native SMS or email share (no address-book upload).
   - Step 3, tell your old followers: a shareable "I pivoted to DanzStak" card with the user's link (and EPK link for artists).
   - Step 4, you're free: show export and delete-everywhere, so leaving DanzStak is just as easy.
   - Progress shows on HQ; the user can skip or come back any time. No nagging, streaks or countdowns.
   - **Pivot** is the overall move. **Moving Day** is the cleanup-and-selection step where the member previews an export and chooses exactly what to move.
   - Pivot guides: show users how to get off each platform. One plain, phone-first guide per platform: how to request and download your data, which format to pick (JSON, all time, high media quality), how long it takes, then "upload it here". Order: Facebook, Instagram, X, TikTok, YouTube (Google Takeout). Guides live in one data file, show a "last checked" date, and are re-checked against the real platform before each release, because menus change. No platform APIs, no logins to their sites: the user downloads their own file.
   - Bring your timeline: import the user's own posts, photos and videos into their DanzStak timeline with original dates, private by default, in date order. Reuse the Facebook importer pattern (preview, pick, batch privacy, missing-media decisions). Add importers one platform at a time, Instagram first, then X. Each importer is built and tested against a real export file from that platform. Music audio files in an export are never imported (no audio hosting); videos are fine under the video rules.
7b. StakGuard, DanzStak's data-broker protection product for every member in Settings -> Your data (separate from creator-content provenance/share tracking):
   - Free: show which supported data brokers and people-search sites have the member's data, with source and date; prepare opt-out requests for the member to review and approve; link free official tools such as California DROP.
   - Paid monitoring: always $4 per month, with no automatic renewal ever. A member may prepay whole months at $4 each, with no discount or annual plan, up to 12 months ($48) under the no-single-charge-of-$50-or-more rule. Send one reminder before paid time expires; renewal happens only when the member chooses.
   - Broker removal comes first. Dark-web checks are a later phase and must never claim coverage of "all of the dark web."
   - Plan later, not now: Phase A is a legal, vendor, cost and feasibility report with synthetic example data only. No vendor sign-ups, Stripe products or charging until the owner approves.
8. Then the rest of instructions/ in its own order, one page per PR.

Later phase (after users): SYNC standalone, device registration, SYNC Network numbers, federated network, SYNC transport rebuild.

## Prices (owner-set, 2026-11-07)

| Product | Price | Status |
| --- | --- | --- |
| EPK builder (build, publish, share, send) | Free | Every artist, always |
| AI-assisted EPK | $5 per EPK; an AI redesign of an existing EPK is another $5 (or build and edit your own for free) | New. Plan only |
| Booking email credit | $1.50 each | Stripe test mode |
| Venue contact unlock | $0.75 | Stripe test mode |
| DanzStak number activation | $3 one-time | Checkout hidden until the owner approves |
| SYNC calling Plus / Pro | $3 / $5 a month (proposed) | Later phase |
| StakGuard: see which brokers have your data + remove it | Free | Spec only |
| StakGuard monitoring | $4 a month, no auto-renewal; prepay any months at $4 each (e.g. $20 = 5 months) | Spec only |

AI-assisted EPK rules:

- Helps the artist write: bio, one-line pitch, booking pitch emails, press-kit checklist ("missing: live photos, tech rider"), and a stage plot / input list draft from what they type. The artist reviews and edits everything; nothing AI-written is published or sent unseen.
- Each EPK the artist has AI build costs $5 (for example: a band EPK and a separate DJ/side-project EPK = $10). An AI redesign of an existing EPK is another $5 each time. After paying for an EPK or redesign, the artist owns it and edits it free forever. Building and editing by hand, including manually switching looks (Techno, Punk, Metal, House/EDM), stays free always. The plan must define included AI rewrites per paid EPK, define AI redesign versus free manual edits, show the price before confirmation, and show AI usage plus Stripe fees so $5 covers the cost. Small fixes the artist makes by hand are never charged.
- The free EPK builder must work fully without AI. AI is an optional add-on (README independence rule: no core feature may depend on a Big Tech API). Keep the AI provider behind one swappable interface.
- Only send the artist's own EPK text to the AI provider, with a clear notice. Never use creator content to train AI.
- No Stripe changes: propose the new $5 product in the plan; the owner creates it. Live payments only after owner approval.

## SYNC phone verification (2026-11-07)

Many users don't want to put their phone number on the web. So:
- Optional. Never required to sign up, post, chat, or build or send an EPK.
- Private: stored hashed/masked, never on profiles, never searchable, never shared with other users.
- Unlocks trust features only: verified badge in SYNC, account recovery, higher call/message limits.
- Rate limits, resend cooldown and attempt caps (as built on codex/personal-phone-verification).
- Switched off until the owner approves an SMS provider. No texts are sent before then.
- Later, users who won't share a number can use a SYNC Network number instead.

## Task 1: Repo cleanup (done)

Deleted RESTART-CHECKPOINT.md and stripe_intergration. Keep working notes outside the repo.

## Task 2: SYNC and EPK rock solid (plan: docs/SYNC-EPK-HARDENING-PLAN.md)

Part A, SYNC (later phase except bug fixes). Findings: polling everywhere (messages 3 s, call inbox 2 s, presence 3 s, conversations 15 s, directory 30 s); Google STUN only, no TURN; direct-messages.js about 1,200 lines. Plan: push delivery (WebSocket or SSE) with 30-60 s polling fallback, paused when hidden; DanzStak-controlled TURN/STUN with short-lived credentials; no lost/duplicate messages, sending/sent/delivered/read, offline queue; isBlockedPair on every SYNC route, rate and size limits, report/mute; state E2EE now or later and why; split direct-messages.js with no behavior change; keep tests green and add reconnect/queue/duplicate/block/rate-limit tests; cost per active user per hour before vs after.

Part B, EPK Builder (active). Keep the careful backend (length caps, https-only links, hashed share tokens). Plan: fast phone-first public EPK a booker reads in 30 seconds with clean link previews; press PDF one-page and full; stage plot + input list builder and tech rider exportable as PDF to a professional production standard (owner: 25+ years IATSE Local 16, 18 years Dreamforce TD); open counts and times only; public link, private link with expiry, revoke, choose downloadable files; attach to a venue pitch in one tap; tests for publish, private links, expiry, revoke, PDF and downloads.

## The EPK is for every artist

1. Any artist builds an EPK from scratch: name, genre, home town, pitch, bio, releases, music/video links, photos, press, shows, tech rider, stage plot / booth plot, contact.
2. The artist picks a look (Techno, Punk, Metal, House/EDM) and can switch any time without losing content.
3. Every look works with any amount of content. Empty sections hide cleanly; no placeholders on the public page.
4. Act types: band (stage plot + input list) and DJ / electronic live act (booth plot + tech rider).
5. Guided first-time flow, "Build your EPK in 5 minutes", with a live preview in the chosen look.
6. More looks later (hip hop, indie, country, jazz) by adding a token set only.

## Task 3: Visual direction, 80% familiar / 20% DanzStak (plan: docs/DESIGN-DIRECTION-PLAN.md)

Familiar (about 80%): top bar with search, notifications and messages (SYNC); left menu on desktop, bottom tabs on phones; center column; profile with cover, avatar and tabs; posts with like, comment and share; standard icons in standard places. Do not invent new navigation patterns.

DanzStak (about 20%): DanzStak colors, fonts and logo instead of stock social-network blue (not a phpFox template); music tools in the main menu (HQ, Tour/Gigs, EPK, Scene) next to Feed (Mix); music cards inside the familiar layout (shows as ticket stubs, releases as record sleeves, EPK as a backstage laminate, tour dates as a poster list); genre looks on artist-owned public pages only, never the app frame.

Genre looks:
| Look | Ground / ink | Accent | Display | Detail | Body | Feel |
|---|---|---|---|---|---|---|
| Techno (default) | #0B0B0C / #EDEDEA | #FF5A1F hazard orange | Archivo 900, width 125% | JetBrains Mono | Archivo | Square edges, 1px rules, mono labels |
| Punk | #EFE8DA paper / #121110 | #E5452E screen-print red | Anton | Special Elite | Work Sans | Xerox photo frame, dashed perforations, ticket stubs |
| Metal | #0E0D0D / #E6DECB bone | #9E1B1B blood red | Pirata One (name only) | Oswald, wide tracking | Source Serif 4 | Centered, symmetrical, heavy photo |
| House / EDM | #0F2E26 deep green / #FFF4E0 | #FFC93C sun + #FF6FA8 pop | Syne 800 | DM Sans 700 | DM Sans | Rounded pills, arched photo, BPM badge |
Rules: each look is a token set, not a separate codebase. One accent per look. Contrast at least 4.5:1. Touch targets 44px. Phone first.

Plan: Techno base tokens plus one theme block per look in assets/mobile-design-system.css via data-look on artist public pages; self-host fonts in assets/fonts (woff2, subset); keep layout and nav positions, restyle with tokens, Tour tab labeled "Gigs" for DJs with set times; restyle order nav shell, HQ, EPK public page, Gigs/Tour, then Mix; Look picker in EPK settings; update docs/DANZSTAK-DESIGN-SYSTEM.md; visual checks at 390px and 1366px with contrast and touch-target checks; one screen per PR with screenshots of every look.

## Task 4: EPK -> send to clubs -> get booked (top priority; plan: docs/EPK-TO-BOOKING-PLAN.md)

Connect what exists: Tour Manager outreach (POST /tour-manager/emails/send, SES, paid credits), venue discovery, saved venues, contact unlocks, hashed EPK share links. Flag (do not change) the Stripe test-price and webhook-secret problems in docs/tour-manager-stripe.md.
1. One flow: EPK -> pick venues -> write pitch -> preview -> send -> track -> follow up.
2. Every booking email includes a per-venue private EPK link. No attachments.
3. Pitch templates: band tour, DJ gig, festival. Fields: dates, city, artist-entered draw, fee or door deal, links. The artist edits every email; nothing is sent unseen.
4. Sent from DanzStak's verified domain (SES, DKIM) with the artist's display name and reply-to; option to route replies into SYNC.
5. Tracking per venue: sent, EPK opened, replied, booked, passed. Shown on HQ and the Tour/Gigs list.
6. One artist-approved follow-up after X days without a reply.
7. Anti-spam: one-to-one only, daily cap per account, same venue contact at most once per 30 days, venue opt-outs honored platform-wide, physical address and opt-out line, bounces and complaints auto-suppress.
8. Venues can reply, mark interested or offer dates without an account.
9. Tests: per-venue tracking, suppression, daily cap, duplicates, reply routing, credit reserve/restore on SES failure.

## Task 5: SYNC standalone + SYNC Network numbers (later phase; reference)

SYNC-only sign-up on the same account system; its own entry (https://www.google.com/url?q=http://sync.danzstak.com&source=gmail&ust=1794099440213000&sa=E or /sync), PWA, native later; contact discovery without uploading address books; free DanzStak-to-DanzStak chat and calls, paid numbers and calls/texts to regular phones; provider comparison (AWS, Telnyx, Twilio, Bandwidth) behind one swappable interface; monthly plan instead of $3 one-time, owner sets prices; compliance before launch (A2P 10DLC, E911, KYC, STIR/SHAKEN, recording consent with default no recording, EU/Italy local rules, telecom taxes); number recycling cool-down, spam reporting, new-account limits. See also instructions/pages/04-chat and 12-phone-service.

## Other open finding

Venue discovery calls the Google Places API (infrastructure/auth-api/index.mjs). The README forbids core features depending on dominant platform APIs. Plan a replacement (AWS Location Places plus the existing OpenStreetMap/Overpass failover).
