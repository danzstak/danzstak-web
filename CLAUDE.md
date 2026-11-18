# CLAUDE.md — DanzStak brief

Read this first, every session. **Claude Code: your work list is `docs/tasks/QUEUE.md`. Take the first `TODO` item, open a PR, mark it, and move on (see the instructions at the top of that file).** Then read `docs/SESSION-HANDOFF.md` (latest progress and open items), then `docs/OWNER-DIRECTIVES.md` (priorities and task specs) and `instructions/` (the full product spec the owner wants built). Then read `README.md` (mission, independence rules, product boundary), `docs/DANZSTAK-DESIGN-SYSTEM.md`, and `docs/QUALITY-ASSURANCE-POLICY.md`. Those rules still apply.

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

- ~~A **Pivot** card stays on HQ~~ Owner 2026-11-18: no Pivot card on Music HQ; Pivot lives in Menu.
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

## Sanitized owner directive ledger from the project thread

This section preserves the durable product decisions from the owner's long-form development thread so a new coding session does not lose context. It intentionally does **not** reproduce raw chat text, temporary login URLs/codes, passwords, API keys, webhook secrets, account identifiers, private phone numbers or other credentials. Those must never be placed in this public repository. When two directives conflict, use the owner's latest dated correction, then `docs/OWNER-DIRECTIVES.md` and `instructions/` for the detailed acceptance criteria. Never turn an unverified claim from the conversation into a product or legal claim.

### Delivery and quality

- Finish one scoped task completely: inspect, implement, test functionally, test visually in a real browser, test integrations/regressions, deploy only when authorized, then test the actual deployed PWA. A compile or commit is not completion.
- The owner must not be the routine software tester. Reproduce defects, fix the root cause, add a regression check, fax every changed screen, and show evidence. If the owner catches a defect, add the check that should have caught it.
- Verify the exact deployed commit, service-worker/cache version, asset versions and CDN delivery. Test the installed PWA, not only source or a browser preview. Do not claim a phone result that was only simulated.
- The PWA is the product until it is solid. Do not restart native-app work or ship native folders merely to bypass a PWA defect.
- Preserve drafts, messages, authentication, payments and user data across cache changes. Do not deploy unrelated unfinished work.

### Mobile application shell and visual standard

- Phone first. Test at 320, 360, 375, 390, 414 and 430px, plus tablet and desktop. Respect safe areas, prevent horizontal overflow, and keep touch targets at least 44px.
- The shell is about 80% familiar social-network navigation and 20% DanzStak identity: standard locations and interactions, DanzStak silver/orange/black branding and music-native details. Familiar does not mean copying trademarks, code or proprietary assets.
- Only one primary mobile screen may be active. Home/HQ, Friends, SYNC, Notifications, Menu, Profile, Booking, EPK and Tour must never stack or show through one another. Android/system Back must unwind screen history naturally without destroying drafts.
- Keep the header compact and the phone bottom navigation consistent. Do not duplicate top and bottom navigation. Remove the global bottom navigation/footer inside a full-screen registered SYNC conversation where it steals usable space.
- Prefer a fluid page over panels inside panels: transparent or page-level sections, deliberate dividers, compact vertical rhythm and no dead space. Every pixel needs a purpose. Do not erase boundaries needed for comprehension or accessibility merely to make everything transparent.
- Reactions are compact horizontal groups with the count immediately to the icon's right. Post media is full-width within the feed grid, aligned consistently and never stretched.

### Profiles and Mix

- Profiles use the familiar mobile pattern: full-width cover, large circular overlapping avatar, name/about directly below, compact actions, scrollable Posts/About/Photos/Videos/More tabs, create-post composer and chronological posts. The official DanzStak profile follows the same component rules as member profiles.
- Profile photos and video occupy the same media width. Remove redundant **View in Your Mix** and **Feature on profile** buttons where content is already in context. Do not show instructional copy such as “tap your name to change it” when the control is self-evident.
- Mobile profile posts (owner correction 2026-11-16) flow as one continuous white wall: edge-to-edge posts separated by a hairline (no grey gaps or boxes), 10px/16px text padding, 36px author avatars, full-bleed media and familiar reaction/comment rows. Keep DanzStak branding and functionality rather than cloning another site's code.
- Mix stays chronological and finite. Its ordered insertion pattern, Dailies placement, The Roll and review/event slots are defined in `docs/OWNER-DIRECTIVES.md`; do not improvise a ranking algorithm.
- The first Dailies tile uses the member's real profile image filling the complete tile. A small clapper overlays the lower-left without hiding the subject and shows today's date plus `SCENE 1 · TAKE N`, where N is that member's lifetime count of videos uploaded to DanzStak (expiry or deletion from Dailies does not reduce the historical take count). No plus badge substitutes for the clapper.

### Video and The Roll

- **Autoplay (owner correction 2026-11-16):** feed and Roll videos autoplay **muted** when at least 50% visible; once more than 50% scrolls out of frame the video stops and the next visible one starts. Data saver (or the member preference `danzstak_muted_autoplay=off`) turns it off. Never background audio. A player is eligible only when sufficiently visible; visibility never enables unmuted audio. At most one player may play or produce sound. Leaving the viewport, opening another primary screen, hiding the tab or starting another player pauses the previous one.
- Every supported player has a real, synchronized, visible mute/unmute control in the lower-right. Default muted. If a provider cannot be controlled reliably through its supported API, keep its native controls and click-to-play rather than drawing a fake control.
- The Roll opens a full-screen vertical snap player. The active video fits the device without requiring the member to scroll just to see it. Device Back exits full screen to the exact prior page. The next video inherits the user's current muted/unmuted preference, but never creates overlapping sound.
- Use source-aware aspect ratios and `object-fit` deliberately. Portrait, square and landscape media must not stretch. Eliminate black bars or blank space introduced by DanzStak; document unavoidable bars rendered inside a third-party player.
- Music remains externally hosted. Do not download, mirror or re-host provider videos or audio.

### SYNC

- SYNC should feel like a polished WhatsApp-class messaging product while retaining DanzStak identity: full-screen phone conversation list/thread, 48px list avatars, readable previews/times/unread state, fixed composer, responsive keyboard behavior and no desktop popup on mobile.
- Ordinary authenticated text messaging works on an unregistered device. Phone calls, video calls, incoming-call acceptance and voice-message playback require the **current device** to complete a real carrier SMS OTP. Calls must not initialize signaling, ICE, camera or microphone before that verification.
- Enrollment is one flow only: enter private mobile number -> **Text me a code** -> reveal the six-digit field only after the server accepts the send -> confirm the correct code -> atomically register the current device. There is no separate **Register this device** button and no client-only or account-wide shortcut.
- The signed-in account name is the default device label; rename/revoke/calls-off controls come after registration. Phone numbers are private, hashed/masked, unsearchable and never visible to another member. No OTP, full number or one-time grant belongs in browser storage or logs.
- A failed SMS send or unconfirmed/expired/wrong/replayed code leaves the device unregistered. When AWS or another approved provider is unavailable, remain fail-closed and say so plainly; never supply a fake success path.
- Calls must show the other participant on the main stage and the local camera in picture-in-picture, carry two-way audio, ring the recipient, clean up immediately on reject/no-answer/hangup, and never keep a stale “Calling” state. Verify with two independent physical devices before claiming handset acceptance.
- DS Network numbers are a later in-network identity product, not carrier numbers. They cannot satisfy carrier OTP, SMS, emergency calling or ordinary phone-network requirements. Do not sell or activate them until the carrier, compliance, pricing and owner approvals in the full spec are complete.

### EPK, booking and email

- Every artist can build a complete EPK manually for free. The guided builder supports minimal and veteran catalogs, hides empty public sections, separates content from look, and supports band stage plots/input lists plus DJ/electronic booth plots/tech riders.
- AI assistance is optional: $5 per EPK and another $5 for a clearly defined AI redesign. Manual edits and manual look switching remain free forever. The artist reviews every generated word; nothing is published or sent unseen. Keep the AI provider swappable and never train on creator content.
- The primary growth loop is EPK -> venue discovery/saved route -> editable pitch -> preview -> send -> track opens/replies -> artist-approved follow-up -> booking. Every venue receives a per-venue private EPK link. Venues can reply or offer dates without creating an account.
- Booking mail uses the approved DanzStak sending infrastructure and verified domain. The artist is the display identity and replies return to that artist's booking thread in SYNC. Do not reroute or reconfigure the established support mailbox while implementing booking mail.
- One-to-one outreach only: daily caps, duplicate-contact window, suppression list, bounce/complaint handling, required disclosures and no BCC blasts. Credits must reserve and restore correctly on delivery failure.

### Commerce, Stripe and SFS checkout

- One commerce destination: the **DanzStak Bazaar** (owner correction 2026-11-15: there is **no official DanzStak Store**). The Bazaar aggregates active fixed-price listings from member-named shops; each seller's shop also lives on that member's profile. Products use an eBay-familiar grid without auctions.
- DanzStak's marketplace fee is 6% of the item price and event-ticket price ($1 minimum on orders under $30; includes Stripe's processing fee, which DanzStak pays; owner 2026-11-16), never the seller-entered shipping amount. Flag or block shipping manipulation, such as a token item price paired with disproportionate postage. Sellers set legitimate shipping costs.
- For physical goods, do not describe Stripe as indefinite escrow. Use an approved Stripe Connect marketplace design with a transaction ledger, delivery/dispute/refund states and provider-supported delayed/separate transfer mechanics. Do not enable seller payouts until identity, tax, fee, fraud, refund and delivery rules are approved and tested end to end.
- Stripe belongs to the DanzStak account only. Keep every other platform's Stripe account, webhooks, products and customers unchanged. Secrets live in AWS Secrets Manager, never frontend code or GitHub. Test Mode stays separate from Live Mode; no live charges or marketplace payouts without explicit owner approval.
- Approved paid products and exact owner-set prices live in `docs/OWNER-DIRECTIVES.md`. Audit and reuse valid DanzStak products before creating anything. Access/entitlements come only from signature-verified, idempotent webhook processing.
- SFS Token through Phantom is an optional checkout method only. Verify the mint, recipient, amount, price source and transaction on the server. DanzStak does not custody SFS, award it or bypass marketplace safety, taxes, delivery, refunds or records merely because the buyer chose token payment.

### Pivot, creator control and StakGuard

- Pivot is the guided exit from billionaire-owned platforms. The member downloads their own export—no platform login or API—previews it, chooses exactly what moves, sets privacy in batches, invites people and can share an “I pivoted” card. Imported timelines retain original dates and default private; audio files are never imported.
- DanzStak can track in-service content identity and outbound share-link engagement, not people across the internet. Do not promise to detect screenshots, copied downloads, reposts without the link or deletion from third-party systems DanzStak does not control. Make casual downloading harder where lawful, while keeping accessibility and authorized downloads functional.
- **Delete everywhere** removes the original, every DanzStak reshare/reference, active media and caches, and makes DanzStak-served links stop working. It cannot recall a screenshot, prior download or independent third-party copy; the confirmation must say that plainly.
- StakGuard provides a broker directory, verified source/date information, member-reviewed request templates and a progress ledger. The member—not DanzStak—reviews and transmits requests using official broker/state tools. Never claim zero legal risk, guaranteed removal, a real scan when none occurred or “all of the dark web.” Legal, vendor, security and feasibility review precede launch.
- StakGuard removal help is free. Monitoring is $4 per month as a one-time charge: no automatic renewal, no subscriptions and no prepaid bundles (owner, 2026-11-16: strictly one-off charges across DanzStak). One reminder before the month ends. No product or charge is created before owner approval.

### Infrastructure boundaries

- Treat AWS, Stripe, email, DNS and production data as separate high-risk systems. Inspect the live configuration, change the smallest authorized surface, preserve unrelated services and report the exact region/service/commit without printing secrets.
- Incoming support mail and application-sending infrastructure have distinct owners and purposes. Do not replace a working mailbox with SES, an ad-hoc mail server or forwarding shortcut. SES is a sending service, not an IMAP inbox.
- Never paste temporary AWS login blobs, OAuth callbacks, OTPs, passwords, API secrets, webhook secrets, private keys or sensitive customer/account data into issues, commits, reports, screenshots or this file. If such material appears in chat, treat it as ephemeral and potentially compromised—not as documentation.

## First task for a new session

Read the codebase, then reply with:
1. the 5 places DanzStak feels most like a generic social network, with file names;
2. a concrete redesign plan for Priority 1 (Music HQ home) and Priority 2 (EPK flagship);
3. what you would *remove or demote* to make room.

Do not write code until the plan is approved.

---

## Marketplace directive (owner, 2026-11-09)

- ~~The official DanzStak Store is a main-menu platform destination.~~ Superseded 2026-11-15: no official DanzStak Store. A member-named shop appears as a Shop tab/page on that member's profile, not as a permanent Mix sales block (a single chronological new-item post in Mix is allowed, see 2026-11-15 directives).
- DanzStak receives 6% of completed member-shop sales and event-ticket sales ($1 minimum on orders under $30, Stripe fees included). Physical-goods seller proceeds release only after confirmed receipt through a provider-supported marketplace flow. No live commerce without tested seller onboarding, payouts, inventory/capacity, shipping or check-in, receipts, refunds, taxes, disputes and fraud controls. Full rules: `docs/OWNER-DIRECTIVES.md`.

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

Current SYNC security rule (owner correction, 2026-11-11): ordinary authenticated text messaging remains available on unregistered devices. Every browser, installed PWA, tablet or computer must complete a fresh real carrier SMS OTP bound to that device's one-time server challenge before it can make or answer phone/video calls or play voice messages. An incoming call on an unregistered device must say: “Register this device to accept the call or to listen to the voice message.” Never accept a mock code, client-only flag, account-level verification from another device, replayed grant or DS internal alias as proof. The mobile number remains private, hashed/masked and unsearchable. Never expose it, including masked digits, on profiles, SYNC contact details, directories, search, notifications or call screens; only its owner may see the masked last four in private registration/settings. This gate applies only to calling and voice-message playback, not signup, text chat, posting, Friends or the EPK. Keep mandatory call-registration mode fail-closed until AWS SMS is approved and real US and Italy handset tests pass; never block text chat behind an unavailable SMS provider. SYNC Network numbers remain paused and must not be sold.

Owner correction (2026-11-15, final): **no email codes for device registration.** A device registers for SYNC calls only by a real **SMS OTP to the member's personal mobile number**, or (once built and approved) by a **DanzStak Network number** the member gets inside DanzStak. The email-code path was removed entirely (2026-11-15). SMS must work worldwide: AWS case 179476783100086 requests every Notify-supported country and all 27 EU countries.

**SYNC SMS provider decision (owner, 2026-11-17): Twilio Verify.** AWS SMS stayed blocked by sandbox/origination approval, so device-verification codes now go through Twilio Verify (service "DanzStak": SMS channel only, 6 digits, Fraud Guard on, worldwide). Twilio generates, texts and checks the code; DanzStak keeps its own challenge record (rate limits, 10-minute expiry, 5 attempts, device and purpose binding checked **before** Twilio is called, one-time device grant) and stores only Twilio's verification SID (`VE…`), never the code or the number. Only Twilio status `approved` counts as verified.
- **Switch:** `OTP_PROVIDER=twilio` (default) or `aws` (the old AWS Notify sender, kept, not deleted).
- **Credentials from AWS Secrets Manager** `danzstak/twilio/verify` (us-west-1; JSON `accountSid`, `serviceSid`, `authToken`, or `apiKeySid` + `apiKeySecret`), name overridable with `TWILIO_VERIFY_SECRET_NAME`; the Auth API role may read only that secret. Environment variables (`TWILIO_ACCOUNT_SID`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_API_KEY_SID`/`TWILIO_API_KEY_SECRET` or `TWILIO_AUTH_TOKEN`) are a fallback only. Never in the repo or logs; anything missing → texts stay off (fail-closed) and only setting names are logged. `PHONE_DEVICE_OTP_REQUIRED` still controls whether calls require a registered device.
- **Language:** the PWA sends `navigator.languages`; the server reduces each tag to a Twilio Verify SMS locale from a fixed allowlist (`personal-phone-twilio.mjs`, source https://www.twilio.com/docs/verify/supported-languages): keeps `pt-BR`, `zh-CN`, `zh-HK`; otherwise the base code (`it-IT` → `it`); falls back to `en`. `en-GB` is voice-only and `zh-TW`/`pt-PT` are WhatsApp-only, so they fall back.
- **Numbers:** E.164 validated server-side, stored only as a keyed hash plus the owner-only masked last four; logs keep at most the last 2 digits.
- **One-reply rules (server-side):** one Twilio call per tap (a second tap in the cooldown fails atomically); SMS only, never voice; one resend, only after 60 s, then a 10-minute wait from the first text (tracked per number and per device); one wrong code cancels the verification (Twilio status `canceled`) and the member requests a new code; an approved code verifies the device once and is never accepted again.
- **Other limits:** sends 3/hour and 6/day per account, 3/hour per number and per device registration, 12/hour per IP; checks 10/hour per account and 30/hour per IP.
- **Twilio errors → member message (translated in `assets/i18n-sync.js`):** 60200 invalid number, 60203 too many codes sent, 60202 too many wrong codes, 60410 fraud-blocked, 60605 country blocked, 20404 expired, 20429 rate limited.

**One phone, several accounts (owner, 2026-11-17).** One verified mobile number may be linked to up to **10** DanzStak accounts (one person, several artist accounts). Each link is its own per-account record; the number stays a keyed hash and only each account's owner sees its masked last four. When another account signs in on a device that already holds an SMS-verified SYNC registration, SYNC asks once: "This phone is already registered (number ending NN). Use it for this account too?" Yes registers that same device for the new account without a new text; No leaves the normal text flow. The proof is that device's own registration token on the same physical device record, checked on the server; a different device, a client-only flag or an account-level claim never qualifies, and a different device still needs its own code. At most 10 accounts per number and per device. Removing a shared device offers **Remove from this account** or **Remove from all my accounts on this device**. Logs carry hashed ids only.

**SYNC contacts and invites (owner, 2026-11-18).** Like WhatsApp: on Android the member picks people from the phone's own contacts; DanzStak matches members with "People who have my number can find me on SYNC" on (on by default like WhatsApp, shown on the registration screen, can be turned off any time), compares keyed hashes, stores nothing and never shows a number. Anyone not found gets an invite from the member's own SMS/WhatsApp/share sheet: "<Name> is inviting you to SYNC up on DanzStak"; after sign-up they land in a chat with the inviter. Group chats get invite links. iPhone and computers use invite links and @username search. The standalone SYNC app has its own short sign-up (mobile number → SMS code → name + @username) that registers the device and creates the DanzStak account in one go, so chat-only people join without visiting the main site. Spec: `docs/tasks/24-sync-contacts-and-invites.md`.

## Owner directives added 2026-11-15

- **SYNC = 80% WhatsApp, 20% DanzStak.** Familiar WhatsApp layout and behavior (chat list, thread, sent/delivered/read ticks, typing, reply/forward/edit/delete, voice notes, calls, groups) in the places people expect; DanzStak brand colors and music-native cards in chat (EPK, show/ticket stub, release sleeve, venue pitch), booking replies in SYNC, Tribe group chats. Plan order: SMS OTP worldwide + DanzStak Network number registration → ticks + typing → reply/forward/edit/delete → push notifications → music cards → end-to-end encryption → in-network DanzStak numbers.
- **SYNC works worldwide**, not only the US and Italy, via carrier SMS OTP (request covers every Notify-supported country and all 27 EU countries) or a DanzStak Network number. No email codes.
- **Notifications when offline:** members of the installed PWA must receive SYNC message and incoming-call notifications when the app is closed or the phone is locked.
- **No music files, ever.** Never accept WAV, MP3, AIFF, FLAC or any other audio-file upload anywhere in DanzStak; music is links or authorized embeds only (copyright). SYNC voice messages recorded in the app are not music uploads.
- **Shops like eBay:** every member's shop lives on their profile; all their active items also appear in the DanzStak Bazaar. DanzStak keeps 6% of each item sold (item price only, never shipping; $1 minimum on orders under $30; Stripe fees included).
- **Information architecture (owner, 2026-11-15) — supersedes the 5-tab HQ/Tour/EPK/Scene/Mix layout where they conflict.** Top-level categories are separate: **Music HQ** = EPK, Tours, Local gigs, Record shops and Radio stations; **Events** is its own category (promoters create events and sell tickets); **DanzStak Bazaar** is its own category (shops and Bazaar-only ads); **Mix** is the chronological social feed with The Roll. SYNC and notifications stay in the top bar. Final phone tab order to be confirmed by the owner.
- **Who each category is for (owner, 2026-11-15).** **Music HQ is for musicians**: EPK, the **Booking Agent for both local gigs and touring**, record shops and radio stations. **Events is for promoters**: create events and sell tickets. **Shops/Bazaar is for everybody**: musicians sell merch and releases, fans sell crafts. **Mix** is for everyone's social life.
- **Get people out to shows (owner, 2026-11-15).** DanzStak should actively encourage members to go to shows and buy tickets (shows near you, friends going, artists you follow playing nearby) without engagement-bait. The **promoter chooses** how tickets are delivered (owner, 2026-11-15): QR code, emailed ticket or physical ticket. DanzStak must support an emailed ticket with **both** a QR code **and** a plain-text ticket (event, date, venue, buyer name, short human-readable ticket code) plus a printable/phone door list, because many clubs cannot scan QR codes. Tracking applies to tickets only when they are physically mailed.
- **Events and tickets (owner, 2026-11-15).** Ticket sales live under **Events**, not the Bazaar. A member posts an event with a **flyer or a short video of 15 seconds or less** and a link to the tickets. The **promoter sets the ticket price**; DanzStak takes 6% of the ticket price ($1 minimum on orders under $30, Stripe fees included). Ticket money is held until after the event. Promoters may instead link to an **outside ticket service such as Eventbrite or Resident Advisor** (https link only); those sales, fees and refunds belong to that service, and DanzStak takes no cut. **Buyers pay the flat listed price, no added fees; the promoter pays DanzStak's 6% ($1 minimum on orders under $30, Stripe fees included) out of the payout and sets the price to cover it** (owner, 2026-11-16). The event composer tells promoters this when they turn on DanzStak ticket sales; Terms of Service section 8B. **Named tickets are the default (scalping protection, owner 2026-11-16):** every DanzStak ticket carries the attendee's legal name and says **non-transferable**; a multi-ticket order needs every attendee's legal name before any ticket is issued; names print on each ticket and the door list because many venues check photo ID. The **promoter may turn this off** per event (e.g. punk venues that don't check names); then tickets are transferable. The event composer explains this when DanzStak ticket sales are on. **Seating (owner, 2026-11-16):** general admission is the simple default. A promoter who wants assigned seating sets it up in DanzStak: uploads the venue's seating plan and sets a price per seating section (tier). DanzStak has no access to venue ticketing systems and is **not Ticketmaster**: keep it simple, no dynamic pricing, no buyer fees.
- **Booking mail and replies (owner, 2026-11-16).** EPK sends and gig requests to venues, and emails to **record shops and radio stations**, go out through DanzStak's sending service (SES **us-east-1**, production access; us-west-1 SES is still sandboxed and must not be used for sending). Every reply comes back to the artist's chat (SYNC) through `<token>@reply.danzstak.com` (SES receipt rule `BookingReplies` → `DANZSTAK-Booking-Inbound`). The root danzstak.com MX stays on **Zoho** for the team mailboxes; never change it. **Radio stations belong in Music HQ** alongside record shops.
- **Look and feel (owner, 2026-11-16).** Mobile first (most traffic is phones); no wasted pixels, tight like a chip layout. Treat members as people who already know how a social network works: **icons instead of words** on buttons (a plus to add, a down arrow for more posts, standard icons for like/comment/share/menu), with accessible names kept. Under a post show **2 comments**, fold the rest behind a small "+N" toggle. Media in Mix, The Roll and profiles fills the full card width. **Profiles (owner, 2026-11-16):** no "tap your name to change it" text; icon buttons; Featured, Memories and Media are removed; tabs are Posts · About · Friends · Photos · Videos (+ Shop when the member has one); the Friends tab lists the member's friends first, then members online now. Members must never have to learn a new way to use a social network. **Signup (owner, 2026-11-16):** no "DanzStak member" placeholders; every new member chooses their name and @username before using DanzStak, then is offered SYNC device registration ("Later — text only" allowed; calls, video and voice messages stay locked until the device is registered). The site must look finished and a little artsy, never thrown together.
- **Dailies come from posts (owner, 2026-11-18).** There is no separate Dailies upload: every photo or video a member posts automatically goes into their Dailies for 24 hours, and every video also goes into The Roll and stays there (automatic; removed only by deleting it). In Mix the Dailies strip is three tiles across, a third of the screen each: the member's own tile pinned left (their photo + clapper with TAKE N = lifetime Dailies), friends' Dailies scrolling beside it, film-strip placeholders with set calls ending in ACTION! when empty. Tapping any profile picture anywhere opens that member's profile; tapping any photo or video opens it full screen.
- **Video, Dailies, The Roll and social basics (owner, 2026-11-16, queued).** **Dailies** videos expire after 24 hours. **The Roll** videos never expire and The Roll is a **horizontal scroll** in Mix. The Roll must feel like **Facebook Reels**: tap any video (uploaded or linked) to open full screen, then swipe/scroll vertically through videos full screen. Linked videos (YouTube etc.) sit **centered** in their container. Members need an obvious way to **add friends** (Add friend on profiles, people search and suggestions). **Tribes** must work like **Facebook Groups** (cover, about, join/leave, members, group feed, admins/moderators, events). Overall the site must have its own **vibe** — not generic, not phpFox out of the box — so people stay.
- **Genres (owner, 2026-11-15).** DanzStak must cater to **punk, metal and electronic** artists and scenes first (genre looks, copy, venue/radio/record-shop discovery and booking defaults).
- **Navigation (owner, 2026-11-15).** Everyone lands in **Mix**, like Facebook, so nobody is confused. Phone tabs, same on every page: **Mix · Music HQ · Events · Bazaar · SYNC · Menu**; notifications bell in the header. The Roll lives inside Mix.
- **EPK → Booking → Tour Manager (owner, 2026-11-18).** The EPK builds the act (AI-assisted EPK is sold only there). Booking selects clubs, lines them up as a road trip (one direction, consecutive date windows to ask each club for, e.g. Bellingham → Seattle → Tacoma → Olympia → Portland) and sends pitches with the published EPK attached (credits, packs and add-ons are sold only there) and never re-asks for EPK info. The Tour Manager opens once pitches are out and never shows a paywall (everything paid is settled in the EPK builder and Booking before it): a calendar of offered/held/confirmed dates, gigs routed one after another in a straight line and tells the Booking Agent when the dates criss-cross and what that costs in miles, hours, fuel and hotel nights, with a one-tap fix of the ask order, costs and profit/loss, updating as clubs reply. Spec: `docs/tasks/25-booking-then-tour.md`.
- **Music HQ is the first app an artist opens** to see how their band or art is doing (next gigs, booking replies, EPK views, ticket and merch sales, new followers).
- **Tour stop → town plan (owner, 2026-11-15).** After a show is booked, DanzStak suggests that town's **record shops** (sell/consign records, set up an in-store meet & greet) and **local radio stations** (book an on-air interview the day of the show, announce the gig and the in-store). Everything the band books that day appears on its tour and in the town's Events.
- **Tone:** underground and anti-establishment; punk, metal and electronic first.
- **Fees (owner, 2026-11-16, final; supersedes the 5%/6% seller-paid and "no added fees for buyers" lines below):** every purchase (shop items, tickets, and DanzStak's own products) carries a **6% fee paid by the buyer**, plus **$1 on orders under $30**. A $5 AI EPK costs $6.30. Sellers and promoters get the full item or ticket price; DanzStak pays Stripe from the fees. Show the all-in price up front. Multiple items per checkout are OK; no prepaid credits or subscriptions. Packs (final, owner 2026-11-16): **Starter Pack** AI EPK + 11 emails $22.20 · **Club Pack** AI EPK + 21 emails $34.98 · **Tour Pack** AI EPK + 31 emails + Tour Itinerary $45.05 · single email $3.65 · Tour Itinerary alone $6.30 · AI profile $6.30 · SYNC Translation packs: 30 minutes $6.30 or 180 minutes $31.80 of real-time call subtitles, used across calls (owner 2026-11-17, $30 + fees; calls stay free; the only approved prepaid exception; minutes never expire; spec docs/tasks/21-call-translation.md) · AI shop $6.30 (setup + up to 10 listings; owner 2026-11-17, $5 + fees; bulk "Shop Manager AI": at most 250 listings per purchase; more only for shops that file for and get an upgraded shop account approved by DanzStak (owner 2026-11-18); $20 for up to 250 listings = $21.20 with fees, owner confirmed 2026-11-18) (all prices include fees). Spec: `docs/tasks/12-buyer-paid-fees.md`.
- **Shops and the Bazaar (owner, 2026-11-15).** There is no official DanzStak Store; the **DanzStak Bazaar** is the only commerce destination and it is its own main-menu category, not part of Music HQ. When a member lists an item in their profile shop, it appears in the Bazaar and once in Mix as a normal chronological post from that member (no boosting, no repeats, no paid placement). **Superseded 2026-11-17 (owner):** at most every 4th post in Mix (fewer when there is not enough fresh, relevant stock; owner: "Facebook has way too many other posts") is a members' item, merch or ticket slot, clearly labelled, never paid, rotated fairly (nearby and followed first, then newer); the same item does not show again for 2 weeks; no slot when nothing relevant exists. Every slot is a different item, and each new session (sign-in, reopening the app, or reaching the end of Mix) rotates to the next items; tapping one opens the seller's shop at that item and Back returns to the same spot (owner 2026-11-18). Until there are enough members for categories, the Bazaar is every item on DanzStak in one fairly shuffled grid that reshuffles to unseen items each visit; tapping opens the seller's shop the same way. Musicians sell their merch and releases; fans sell their crafts; promoters create events and sell tickets. DanzStak keeps 6% of the item or ticket price ($1 minimum on orders under $30, Stripe fees included), never shipping.
- **Refunds (owner, 2026-11-15):** once a member uses what they bought (sends a booking email, sees an unlocked contact, uses a DanzStak number), no refund. Unused purchases refund at the price minus Stripe's processing fee; the buyer pays the fee. A pop-up before every purchase must be accepted, and a refund is sent only after the member accepts the exact amount shown. Terms of Service section 8A; details in `docs/OWNER-DIRECTIVES.md` → Refunds.
- **Shop payments (owner, 2026-11-15):** sellers set their own refund terms; money is held until the item arrives, released 3 days after tracked delivery or earlier when the buyer confirms; payout = item price − 6% (item only, $1 minimum under $30, Stripe fees included) + shipping; tracking required on orders over $19 (untracked orders release when the buyer confirms or 21 days after shipping with no problem opened); ticket money is held until after the event; buyer problem window refunded from held funds. Fair to buyer and seller, no avoidable risk for DanzStak. Details: `docs/OWNER-DIRECTIVES.md` → Shops and event tickets.
- **Advertising lives only in the Bazaar (owner, 2026-11-15).** No advertising anywhere in Mix, ever. Any ad space DanzStak sells (to a brand like Chevy or anyone else) is shown only inside the DanzStak Bazaar, so members see ads only while they are browsing the Bazaar. Mix may show DanzStak members' own products (their shop items), never paid third-party ads. Ads are never targeted from members' private data and never ranked into feeds.
- **Unopened pitches (owner, 2026-11-17).** Opens are logged from the venue's private EPK link (no email-open pixels). A first pitch whose EPK link is still unopened 30 days after sending gives the band its booking-email credit back inside DanzStak (not a Stripe refund): 10 sent, 7 opened, 3 unopened = 3 credits back, once each. An unopened pitch drops that club to "quiet" in the rankings; 3 unopened pitches in a row (no open, reply or booking since) take it out of the venue lists until a newer open, reply or booking. Spam folders can cause unopened pitches, so keep sending deliverability-clean (SPF/DKIM/DMARC, plain one-to-one mail).
- **Hometown skins (owner, 2026-11-17).** The EPK and the Tour Manager wear the band's hometown vibe on top of its genre look: city palette, original motif and laminate detail, never logos, team marks or photos. The navigation frame stays DanzStak. DanzStak must not feel like a ton of HTML boxes: one fluid page, not stacked panels. Spec: `docs/tasks/15-hometown-skins.md`.
- **SYNC feels like the phone (owner, 2026-11-17).** SYNC is the dopest part of DanzStak and good enough to be its own app: members should not be able to tell SYNC from their phone's own messenger. Native shell (no web-page tells), chat wallpaper with the member's own photo (private, per chat or global), slim icon buttons, ticks/typing, reply/forward/edit/delete, lock-screen push, standalone launch. All buttons site-wide get one non-HTML-looking button system. Spec: `docs/tasks/16-sync-feels-like-the-phone.md`.
- **Setup after registration and share everywhere (owner, 2026-11-17).** After SYNC device registration, a skippable "set up this phone" flow: wallpaper, ringtone, notifications, then sharing a personal SYNC invite link/QR with Join DanzStak (phone numbers are never shared). Every post, EPK, event and item gets a Share sheet to all the member's other socials (native share, copy, QR, public share URLs, no platform APIs) with short links tracked back to the sharer: opens, joins, purchases, counts only. Specs: `docs/tasks/16-sync-feels-like-the-phone.md` (16-B3), `docs/tasks/17-share-everywhere.md`.
- **SYNC signup = DanzStak membership (owner, 2026-11-18).** Signing up for SYNC makes the person a DanzStak member: one account, one identity, no separate SYNC account. A member who joins through SYNC lands in SYNC after signup (the conversation they were invited to, or the chat list), with Mix one tap away. Someone invited to a call just wants to answer it: the invite link shows who is calling and **Answer**; answering creates the account, asks for name/@username and the SMS code, then connects the call. The caller sees "Waiting for … to join" instead of a ring timeout; if the call is gone, the new member lands on a missed call with **Call back**. Spec: `docs/tasks/24-answer-to-join.md`.
- **No ChatGPT/Codex references.** Remove ChatGPT, OpenAI and Codex references and dependencies from the repository, scripts and branch/deploy names; DanzStak is built with Claude.

## Hand-off: Claude Code builds, Claude plans (owner 2026-11-18)

- **Claude Code (the hourly cloud builder)**: at the end of every run, after opening its pull request, add one line at the **top** of the "Builder log" below on the same branch: date/time UTC · queue item · PR number · what's left or blocked · **"Next: <the next TODO in QUEUE.md>"**.
- **Claude (the owner's planning chat) or Copilot**: reads the Builder log, decides the next task, and pastes it into `docs/tasks/QUEUE.md` as the first TODO (with a spec in `docs/tasks/` when it's bigger than one screen). Claude Code always builds the first TODO in the queue.
- Keep the log to the latest 20 lines; older lines can go.

### Plan (Claude, 2026-11-18 night): what the owner is looking for

Goal for the next builds: **DanzStak should feel like a finished, familiar phone app** (Facebook/WhatsApp-level polish, DanzStak look), with **media you can tap and swipe**, **shops that look like real record shops**, and **the Bazaar woven into Mix**. Build in this order; one queue row = one PR; frontend first; every PR checked at 320/360/390/430px with screenshots.

1. **5a1 Full-screen media viewer** (`assets/media-viewer.js` + `.css`, one shared component). Tap any photo/video (Mix, profile Posts/Photos/Videos, Dailies, The Roll, Tribes, SYNC, shop items) → black full-screen layer, media only (no post text, no reaction rows); swipe left/right moves through the **same member's** photos (from a photo) or videos (from a video); videos autoplay muted with the lower-right sound toggle (sound choice carries over, one player at a time); pinch-zoom on photos; swipe down, ✕ or system Back closes and restores the exact scroll spot (history state, no reload). Done when: a browser check taps a Mix photo, swipes twice, presses Back and lands on the same scroll Y.
2. **5a2 Photos / Videos tabs + albums** (owner 2026-11-18, all three sentences are requirements). Tabs show only media in a 3-column grid (square photos, portrait video tiles with duration and poster frame); tap → the 5a1 viewer. **Every photo/video a member posts lands in an album automatically**: posts from the composer go to a default album **"Uploads"**, photos shared from the phone's Share menu (5a01) go to **"Phone photos"**; the member can **rename** either (e.g. "Cell photos"). Members **create their own named albums** ("Concert pictures", "Mike & Ana's wedding", a date/place), **upload many photos at once** straight into an album, and **tick which ones also get posted** to Mix. Albums row at the top of Photos/Videos ("All" + albums with cover + count + "+ New album"); album owner can rename, reorder, set cover, change visibility (Public / Friends / Only me), move photos between albums, delete (Delete everywhere rules). Frontend + `infrastructure/auth-api` album routes (owner session deploys). Never audio files.
3. **5a3 Friends row + Things in common.** Under the profile name: 3–6 small overlapping friend photos + "N friends" (own) / "N mutual friends" or "Friends with things in common" (others); one tap target → Friends · Following · Things in common screen (things in common = same hometown, location, birthday month, genres, Tribes, with the matching friends' small photos). Tapping a friend's photo opens their profile. Replaces the old Friends list everywhere (profile tab, Menu → Friends).
4. **5a5 Bazaar item every 4th post in Mix (after The Roll)** — task 23b. Server cursor in DynamoDB + Mix slot card ("For sale"), different seller/kind each slot, 2-week no-repeat, never paid; tap → seller's Shop tab with the product open; Back restores the spot.
5. **5a6 Shop skin part 2** — task 23 items 2–7 and the product page: kicker "LABEL · SHIPS FROM REGION", seller-editable shop title, "Every order comes with…" box, category chips with counts, featured bundle card, item badges, shipping table; product page with big photo carousel (5a1 viewer), title, mono detail line, price + shipping, Buy, seller row. New seller fields in `marketplace.mjs` (owner session deploys).
6. **5a7 Dailies card carousel** (fix-it 18 "Full-screen Dailies viewer"), using the 5a1 viewer.
7. **5a8 Share sheet rebuild** (fix-it 18 "Share post box looks broken") as one bottom sheet with the 16-C buttons; then server-rendered share previews (task 17).
8. **5a9 Tribes like Facebook Groups** (owner 2026-11-18; full spec `docs/tasks/29-tribes-like-groups.md`, built from the owner's Groups brief on DanzStak's own AWS stack, no Express/Socket.io). Directory: cards with the Tribe's picture, name, member count + small member photos, Join. Tribe page: full-width cover (Elders change it), name, Public/Private · N members, row of member photos, Join / Invite / ⋮; tabs **Discussion · Featured · Members · Events · Media · About**; composer "Write something…"; chronological posts with the same post component and the 5a1 viewer; Members tab with Elders (admins) and moderators first, Elders can approve requests, remove posts, mute or remove members; Events tab pulls the Tribe's shows/in-stores; About with rules. Join requests for private Tribes. Phone first, no ranking.

Owner-session only (not Claude Code): deploy the Auth API for AI EPK (#567) and new routes; fix the Stripe test keys; SYNC chat-list cache decision.

9. **5a00 Incoming calls ring** (spec 31, PR #578). **5a0 Text button in calls** (spec 30): 5th call button, note over the other person's video until they close it. **5a01 Share a phone photo to DanzStak** (spec 32): DanzStak in the Android Share menu → composer with the photo attached → it posts and lands in the "Phone photos" album.

Build order for Claude Code right now: **5a0 → 5a01 → 5a2 albums (finish #575) → 5a3 friends row (#572) → 5a1 viewer (#577) review fixes → 5a5 Bazaar in Mix → 5a6 shop skin → 5a7 Dailies carousel → 5a8 share sheet → 5a9 Tribes.**

### Builder log (newest first)
- 2026-11-18 23:15 UTC · Claude (planning chat) · 5a00 ringer PR #578; owner: shared/posted photos go into albums ("Uploads", "Phone photos", renameable) + named albums with bulk upload; spec 32 share-to-DanzStak queued as 5a01 · Next: 5a0
- 2026-11-18 22:30 UTC · Claude (planning chat) · owner phone test: video call works (picture-in-picture drag works) but incoming calls don't ring; spec `docs/tasks/31-call-ringer.md`, queued first as 5a00, then 5a0 Text button · Next: 5a00
- 2026-11-18 22:20 UTC · Claude (planning chat) · owner asked for a Text button in SYNC calls (note over the other person's video until closed); spec `docs/tasks/30-call-text-overlay.md`, queued first as 5a0 · Next: 5a0
- 2026-11-18 22:05 UTC · Claude (planning chat) · plan written above; queue rows 5a1–5a8 · Next: 5a1
- 2026-11-18 21:45 UTC · Claude (planning chat) · queued 5a1 full-screen media viewer, 5a2 Photos/Videos albums, 5a3 friends row · Next: 5a1

## Owner directives 2026-11-18 (evening, from the owner's phone)

Claude Code builds these in this order (queue items in `docs/tasks/QUEUE.md`; details in `docs/tasks/18-fix-it.md`):

1. **Tap a video or photo → full screen, media only.** On profiles, Mix and everywhere: tapping a video opens it full screen and plays; swipe **horizontally** through **that member's** videos (or photos) full screen, **without the post text** (not post by post). Back returns to the exact spot in Mix or the profile.
2. **Photos and Videos tabs are media, with albums.** Grids of the member's photos / videos only. Members create **named albums** ("Hellfest 2026", "Mike & Ana's wedding", a concert date…), upload many at once and choose which also get posted.
3. **Friends like Facebook.** Under the profile name: a row of small overlapping friend photos with "N friends" / "Friends with things in common"; tapping it opens Friends · Following · Things in common (things in common = shared hometown, location, birthday month, genres… with the friends' small photos). Tapping a friend's photo opens what that friend has going on (their profile).
4. **Bazaar item every 4th post in Mix, after The Roll**, a different item each time (queue 6e / task 23b). Never paid, never an ad.
5. **Shops need a real skin, not "straight HTML".** The profile Shop tab is the shop itself (done, PR #569); next: task 23 extras (chips, featured bundle, shipping table, all-in prices) and the product page.
6. **Your own photo everywhere you post from.** Composer avatars (Mix and profile) show the member's profile photo, never the DanzStak "D" or an empty circle.
7. **Done today:** Log out goes straight to the landing page; Tribe initials centred and Tribes can show their own picture; "+ bio" is the 5th profile icon; profile Shop tab; Bazaar has the Eroticon shop live; AI EPK builder ready as PR #567 (needs the Auth API deploy, then merge).

## StakGuard (ON HOLD — owner 2026-11-18)

**On hold until the owner has worked out the legal side.** Do not build, ship, advertise, price or create Stripe products for StakGuard; leave existing StakGuard PRs unmerged and any StakGuard screens hidden. **DanzStak gives no advice at all on data brokers, people-search sites or removing personal data (owner 2026-11-18: "DanzStak can't even give advice to users until I dig deeper")** — no help pages, tips, templates, broker lists or links, and the AI helpers and support replies must not offer it either. DanzStak's own privacy policy statement ("DanzStak is not a data broker") stays.


StakGuard is DanzStak's data-broker protection product for every member under Settings -> Your data. It is separate from creator-content provenance and share-link tracking. Finding supported data-broker and people-search exposure, showing its source/date, preparing member-approved opt-outs and linking free official tools are free. Monitoring is $4 per month as a one-time charge with no auto-renewal ever and no prepaid bundles (owner, 2026-11-16); one reminder before the paid month expires. Broker removal comes first; dark-web checks are later and never claim "all of the dark web." Phase A is research with synthetic data only—no vendors, Stripe products or charging without owner approval. Full spec: `instructions/pages/17-privacy-shield`.

