# CLAUDE.md — DanzStak brief

Read this first, every session. **Claude Code: your work list is `docs/tasks/QUEUE.md`. Take the first `TODO` item, open a PR, mark it, and move on (see the instructions at the top of that file).** Then read `docs/SESSION-HANDOFF.md` (latest progress and open items), then `docs/OWNER-DIRECTIVES.md` (priorities and task specs) and `instructions/` (the full product spec the owner wants built). Then read `README.md` (mission, independence rules, product boundary), `docs/DANZSTAK-DESIGN-SYSTEM.md`, and `docs/QUALITY-ASSURANCE-POLICY.md`. Those rules still apply.

## ★ THE DIRECTIVE (owner 2026-11-19, supersedes every other order in this file and in QUEUE.md until it is done)

Owner: "Lots of mistakes I'm finding that we have gone through. Fix all these things — the UX is not good and users will not use the site. Main keeps moving. Make one big directive for Code, then test it all, and test it again. When two agents are coding, things get messed up."

### Rules
**Motto: test, test, test, deploy.** The owner is seeing too many mistakes in the PWA.

1. **Roles.**
   - **Claude Code** (the builder) is the only one who writes code. It builds each fix and **tests it once**: `node scripts/run-all-tests.cjs` plus every browser check the change touches, at 320/360/390/430px, **tapping the centre of icons**, not the button box. Then it opens the PR (or the release train) and stops.
   - **Claude** (the owner's review/deploy session) **tests it twice more**. First the PR branch: full suite plus browser checks plus a walk through the changed screens at phone width. Then, after merge and the Amplify publish, the live site: the same checks against `https://danzstak.com` and the T2 walk, confirming the published service worker version.
   - Only then does it **deploy** the backend pieces (Auth API, call-signaling) and test those live.
   - Planning goes into this file, which is the only channel between sessions. Nobody pushes to a branch another session is working on.
2. **One release train at a time.** Bring the listed PRs and fixes into one branch `train/<date>`, in the order below. Fix conflicts once, bump versions once (`scripts/bump-versions.cjs`, one shell number), open one PR to main. Nothing else merges while a train is open.
3. **A failed live test stops everything** until it's fixed, and the fix gets the check that would have caught it.
4. **No new features** until the fix list below is done. Each fix gets a check that would have caught it.
5. **Message the owner only** for something he must do (a deploy he must run, a decision), with numbered steps and the shell named (**CloudShell** or **PowerShell**) on every command.

### Fix list (in this order)
- **F0. CI green on main first.** Since #625 every check counts. `browser-checks/call-audio-output.cjs` and `browser-checks/original-feed-art-direction.cjs` time out in CI (seen on #632, a docs-only PR). Fix the root cause or the stale check; never skip one.
- **F1. Tap a photo or video → full screen.** The owner says it still doesn't work, because the viewer never merged. **#594 is green and ready.** Bring it up to date with main and merge it first, then check on the live app: Mix, Tribes, profile Posts, and the Photos/Videos tabs.
- **F2. The Roll keeps the sound choice.** Owner: "each video I have to turn the audio on." Once sound is on, the next Roll video stays audible, whether reached by scroll or auto-advance; mute carries over the same way; never two audible players. Browser check with real playback. Root cause is likely `media-visibility.js` session sound (`sessionSound`) reset or not applied on the next card.
- **F3. Dailies scrolling doesn't work** (owner's phone). Reproduce with touch at 360/390px, fix the root cause, and add a check that swipes both the strip and the full-screen Dailies. Land #605 (tile never opens the picker), #609 and #587 in the same train.
- **F4. The photo/shop box beside the avatar fills the free space.** #629 stopped it covering the name. Now:
  - It grows to fill all unused space: down to the avatar's bottom or the action row when the name text doesn't reach under it.
  - It shrinks again when the name gets longer or the screen narrower.
  - The image scales to fill the box (`object-fit: cover`).
  - Recompute on resize and on name change.
  - Extend `browser-checks/profile-showcase-fit.cjs`: a short name gives a tall box; a long name puts the box above the name.
- **F5. Every profile picture opens that member's profile** (#598).
- **F6. The rest of the audit**, `docs/tasks/36-site-audit-2026-11-19.md`, in its order: A4–A10, E8–E10, B1–B10 (one app bar, one tab bar, one font set, one post component, one button system), C1–C5, D.
- **F7. Finish the open feature PRs**, one per train after F1–F6:
  - #575 albums;
  - #572 friends row (needs the call-signaling `/friends/of` deploy);
  - #593 share a phone photo;
  - #591 SYNC as its own app;
  - #580 ringer part 2.
- **F8. Modern look, every page.** Owner 2026-11-19: "This is janky… kids these days know what a dope site looks like… if it looks like something an 8th grader could build they won't use it."
  - **Example, Notifications.** Today: a big black "View post" button under every row, full dates, heavy cards (`docs/screenshots/owner-reference/notifications-danzstak-2026-11-19.png`). Target, the familiar pattern (`notifications-familiar-reference-2026-11-19.png`, layout only, DanzStak colours and brand):
    - big title with search in the header;
    - **New** / **Earlier** sections;
    - unread rows on a soft tinted background;
    - a 56px avatar with a small round **type badge** (like, comment, friend, Tribe, shop, ticket) in DanzStak colours;
    - **bold names** in one running sentence, then a relative time ("12h", "3d");
    - a ⋯ menu per row (mark read, turn off, delete);
    - the **whole row is tappable** (no "View post" buttons);
    - no boxes, hairlines only, phone-width spacing.
  - **Then the same pass on every screen a tester touches**, in T2-walk order (Mix, profile, Tribes, Bazaar, Events, Music HQ/EPK, SYNC, Menu, Settings):
    - no default browser controls, no big black text buttons where an icon or a tappable row is the norm;
    - one type scale, relative times, consistent 44px targets;
    - subtle motion (≤150 ms press/fade), skeletons instead of "Loading…" text.
  - Screenshot before and after at 360/390px for each screen. Spec to write first: `docs/tasks/39-modern-look.md` (tokens, components, the per-screen list).
- **F9. Profile and Friends pages look like a finished app.** Owner 2026-11-19: "See the difference. Each profile page and each friends page… still Friends is a button on DanzStak."
  - Reference screenshots, layout only, DanzStak colours and brand, in `docs/screenshots/owner-reference/`: `profile-familiar-reference`, `friends-things-in-common-reference`, `profile-danzstak`, `friends-danzstak`.
  - **Profile:**
    - big avatar centred over the cover, with a small camera badge (owner only);
    - name with an optional check, then one line "N friends · N following";
    - bio line, then an icon line: work · city · shop;
    - the **friends facepile** "Friends with things in common" (#572);
    - one primary action plus secondary actions (owner: Dashboard / + Create / edit; visitor: Add friend / Message / ⋯);
    - pill tabs (All · Photos · Videos · Events · Shop);
    - "Personal details" as icon rows.
    - No floating edit/delete circles over the showcase photo; that becomes one ⋯ on the photo.
  - **Friends:**
    - remove the "Invite a friend" text button (invite goes in the ⋯ / header icon);
    - pills **Friends · Following · Things in common** (spec 5a3);
    - rows of 56px avatar + name + one grey sub-line ("12 mutual friends", "Online now", a city), whole row tappable;
    - no big round message buttons on every row (message sits behind ⋯);
    - "Things in common" grouped by birthday month, hometown, location and genres, each with a small facepile and "X, Y and N others also added this".
- **F10. Event creation like a modern app.** Owner 2026-11-19: "See the difference. Nobody is going to put in an event on DanzStak."
  - References in `docs/screenshots/owner-reference/`: `event-create-familiar-reference` and `event-create-danzstak`.
  - **Today:** a raw "Choose File / No file chosen" picker, an empty grey select for the start time, and a long form under the event list.
  - **Target, a full-screen "Create event" screen** (from + in the Events header):
    - big cover/flyer area at the top with **Upload / Gallery** buttons over it (flyer or ≤15 s video);
    - host row (your avatar + "Event host");
    - floating-label fields: Event name, **Start date and time** prefilled to the next hour (native date/time picker, locale format), chips "+ End time" · "Repeat" · time zone;
    - "In person or online?" and "Who can see it?" as tap-to-pick sheets;
    - venue picker;
    - tickets (DanzStak sales or outside link) as a sheet with the fee note;
    - a sticky **Create event** button, disabled until the name, time and flyer are set.
  - Events home shows the poster wall (spec 26), not the form.
- **F11. Music HQ = a real creator dashboard.** Owner 2026-11-19: "See the difference."
  - References in `docs/screenshots/owner-reference/`: `creator-dashboard-familiar-reference`, `creator-dashboard-welcome-familiar-reference` and `music-hq-danzstak`.
  - **Today:** a huge orange "Publish EPK" bar, four grey boxes all showing "0", and pills that cut off.
  - **Target:**
    - header "Music HQ" with search and your avatar;
    - scrollable pill tabs **Overview · Gigs · EPK · Booking · Sales · Fans** (no cut-off text: scroll with a fade);
    - a dismissible **welcome card** the first time ("Your HQ shows how your band is doing… Learn more");
    - an artist row (avatar with a check, name, "Set up your EPK" progress ring);
    - **three progress rings**: EPK (sections done / total), Pitches (sent / planned), Shows (booked / asked);
    - **"Analytics ›"** with 30 / 14 / 7-day pills and a 2-column stat grid (EPK opens, booking replies, ticket sales, merch sales, new followers, Mix views), each showing a ▲/▼ % change versus the previous period, or "--" when there's no data;
    - **"Next gigs ›"** as ticket-stub rows;
    - **"Content ›"** with the latest post;
    - one primary action in context (Publish EPK only while the EPK is unpublished, as a slim button inside the EPK ring row).
  - Zeroes never look broken: empty states say what to do next ("Send your first pitch →").
  - Numbers come from the existing APIs (EPK views, booking pipeline, marketplace, follows). Never fake data.
- **The owner could do this on every page:** F8–F11 are examples of one standard. Apply it everywhere in the F8 pass, and write `docs/tasks/39-modern-look.md` with every screen listed before building.
- Then the **T2 sweep**, T3 and T4 (test-ready plan below).

### CDN plan (task 38)
- **Done (2026-11-19):**
  - CloudFront `dk7kawr758jtd.cloudfront.net` (distribution `E1IHQF8SMWIYPH`, private bucket via Origin Access Control, trusted key group).
  - Signing key in Secrets Manager `danzstak/cloudfront/media-signing-key`.
  - Pages allow the CDN host.
  - The app keeps CDN photos and clears them on log out.
  - **Call-signaling serves CDN URLs** (`MediaCdnServe=true`): Dailies, avatars, SYNC media.
  - Verified: signed links return 200, a second load is faster (edge cache), and an unsigned link returns 403.
- **Owner: "keep making the CDN so it's fast"**: C1–C4 run alongside F1–F8 in the same trains.
- **C1. Mix posts and The Roll through the CDN.**
  - Land #631: the Auth API deploy script runs in CloudShell, attaches the `DanzStakMediaCdn` policy and sets `MEDIA_CDN_DOMAIN`.
  - Then the owner runs, in **CloudShell**: `cd ~/danzstak-web && git pull -q && pwsh ./aws-deploy-auth-api.ps1`. This also ships the server half of the Bazaar scramble (#618).
  - Verify: Mix image URLs are on the CDN host and identical across two loads; deleting a post invalidates its media.
- **C2. Faster API.**
  - `GET /stories` without a full-table Scan (GSI or per-member query).
  - Author names from `DanzStak-ProfileNames` instead of Cognito per author.
  - Lambdas at 1024 MB (call-signaling template plus `aws-deploy-auth-api.ps1`).
- **C3. Videos at 720p** (task 37 part 2). This needs the owner's go-ahead for the MediaConvert cost.
- **C4. Measure.** After the first visit, Mix's first screen should load in under 2 s on 4G, from Italy and San Francisco. Record the numbers in the PR.
- Full spec: `docs/tasks/38-media-cdn.md`.

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

### Pivot and creator control

- Pivot is the guided exit from billionaire-owned platforms. The member downloads their own export—no platform login or API—previews it, chooses exactly what moves, sets privacy in batches, invites people and can share an “I pivoted” card. Imported timelines retain original dates and default private; audio files are never imported.
- DanzStak can track in-service content identity and outbound share-link engagement, not people across the internet. Do not promise to detect screenshots, copied downloads, reposts without the link or deletion from third-party systems DanzStak does not control. Make casual downloading harder where lawful, while keeping accessibility and authorized downloads functional.
- **Delete everywhere** removes the original, every DanzStak reshare/reference, active media and caches, and makes DanzStak-served links stop working. It cannot recall a screenshot, prior download or independent third-party copy; the confirmation must say that plainly.

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

## Media CDN (owner 2026-11-19: "build the CDN" — "takes 10 sec with one user", "needs a proper cdn")

**Claude Code: build `docs/tasks/38-media-cdn.md` next (queue row CDN), one PR per step.** Today every photo/video loads straight from the S3 bucket in us-west-1 with a brand-new signed URL each time, so nothing is ever cached and Italy waits ~10 s. Fix: CloudFront in front of the media bucket (private, Origin Access Control, signed URLs from a trusted key group), signed URLs with a fixed expiry window so the same URL repeats and caches, CDN host in CSP and the service-worker cache, `/stories` without full-table scans or per-author Cognito calls, Lambdas at 1024 MB. Videos at 720p follow (task 37). Stays serverless (Lambda/DynamoDB/S3): no containers, Kubernetes, pm2 or Redis. The owner session creates the signing key pair (private key only in Secrets Manager `danzstak/cloudfront/media-signing-key`) and deploys.

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

## Manager's plan (owner 2026-11-19: "why do I have to micro-manage Claude — you should be the manager of the project")

**Claude Code runs this project. The owner sets direction and tests on his phone; he should never have to say "do it", "plan it" or "merge it".** Every Claude Code run follows this section, then `docs/tasks/QUEUE.md`.

**Goal right now: test-ready.**
- Every screen a tester touches works and looks finished in the installed PWA at 360 and 390px.
- Then friends sign up and test (T4).
- No new features until the T0 rows are done.

**Each run, in this order:**
1. **Land what's ready.** For every open PR from Claude Code:
   - If it's behind main, merge main into it (bump versions with `scripts/bump-versions.cjs`; take the higher number).
   - If CI is green and its browser check passes, **merge it**. The owner gave permission on 2026-11-19.
   - Never merge anything marked "needs owner".
   - Close a PR that another merged PR supersedes, with one line saying which.
2. **Build the first `TODO` row in QUEUE.md.**
   - Reproduce the bug in a real browser at phone width first, and fix the root cause.
   - Add the check that would have caught it. **Tap the centre of icons**, not the button box: the dead Comment icon slipped past every test that clicked by locator.
   - Screenshot before and after at 360 and 390px, then open the PR.
3. **If something can only be done on the owner's computer** (Auth API or call-signaling deploys, IAM, Stripe keys), add it to the **Owner-session box** below with the exact command. Don't stop the queue for it.
4. **Write one Builder log line** (below) and message the owner **only** for something he must do or see.

**Order of work** (QUEUE.md has the rows; the audit with root causes is `docs/tasks/36-site-audit-2026-11-19.md`):
1. **Ready PRs:**
   - #602 (posted photos/videos go to Dailies and The Roll automatically; supersedes #601, so close #601);
   - #604 (Comment icon);
   - #599 (shop beside the profile picture);
   - #603 (this plan).
2. **T0 bugs**, in queue order:
   - A2 (Dailies tile opens the photo picker; avatars open profiles);
   - A4 (Saved page crash);
   - A5 (Record Stores crash);
   - A6 together with E2 and E4 (raw errors shown to members; forms that fail silently);
   - A7 (Booking: dead buttons; serve Leaflet locally);
   - A8 (Tribes: an Elder sees "Join");
   - A9 (Mix composer avatar does nothing);
   - E8 (the only way into Edit profile is the Edit button);
   - E9 (one Photo/video button);
   - E10 (Friends ▾ on visitor profiles);
   - A10 (Menu → Photos/Videos show only your media);
   - B1–B10 (one app bar, one tab bar, one font set, one post component, one button system);
   - C1–C5, then D.
3. **T1: finish the open feature PRs**, one at a time, each brought up to date with main and checked at phone widths:
   - #594 / #577 (full-screen media viewer; keep one, close the other);
   - #575 (albums);
   - #572 (friends facepile; needs the call-signaling `/friends/of` deploy);
   - #593 (share a phone photo to DanzStak);
   - #591 (SYNC as its own app);
   - #598 (avatars open profiles).
4. **T2 sweep**, then T3 (SYNC own-app pop-up after device registration) and T4 (invite testers, `docs/TESTING.md`).

**Done means:** a fresh account can sign up, post a photo and a video (it lands in Dailies and The Roll), comment, open a profile, use the Bazaar, start a SYNC chat and log out, at 360/390px, with **no raw errors, no dead buttons and no duplicate buttons**.

### Owner-session box (things only the owner's computer can do)
- **2026-11-19, owner travelling — do these from AWS CloudShell (us-west-1), nothing saved locally.** The CDN signing key already exists (`danzstak/cloudfront/media-signing-key`, CloudFront public key `danzstak-media-signing`).
  0. **Done 2026-11-19 12:03 UTC:** call-signaling deployed with the CDN (`dk7kawr758jtd.cloudfront.net`, distribution `E1IHQF8SMWIYPH`, `MediaCdnServe=false`), TAKE fix live; backfill ran (18 Dailies, 14 Roll videos, 1 TAKE raised). Steps 1–2 below are done.
  1. **(done) Deploy call-signaling with the CDN** (also ships #619's TAKE-count fix and #555): CloudShell → `git clone --depth 1 https://github.com/danzstak/danzstak-web.git && cd danzstak-web`, then
     `ID=$(aws cloudfront list-public-keys --query "PublicKeyList.Items[?Name=='danzstak-media-signing'].Id | [0]" --output text); BUCKET=$(aws cloudformation describe-stack-resource --region us-west-1 --stack-name DANZSTAK-Call-Signaling --logical-resource-id MediaBucket --query StackResourceDetail.PhysicalResourceId --output text); aws cloudformation deploy --region us-west-1 --stack-name DANZSTAK-Call-Signaling --template-file infrastructure/call-signaling/template.yaml --s3-bucket "$BUCKET" --s3-prefix deploy-artifacts --capabilities CAPABILITY_NAMED_IAM --parameter-overrides MediaSigningPublicKeyId=$ID MediaCdnServe=false --no-execute-changeset`
     → review the change set (adds MediaKeyGroup, MediaOriginAccessControl, MediaCachePolicy, MediaResponseHeadersPolicy, MediaDistribution; modifies MediaBucketPolicy, SignalingRole, SignalingFunction) → `aws cloudformation execute-change-set` with the printed ARN. CloudFront takes ~5–15 min. Then give Claude Code the `MediaCdnDomain` output for task 38 step 3 (CSP + service worker); only after step 3 is live, redeploy with `MediaCdnServe=true` and set the Auth API `MEDIA_CDN_DOMAIN` / `MEDIA_CDN_DISTRIBUTION_ID`.
  2. **Fill Dailies / The Roll / TAKE for testing (#619):** in the same clone, `cd infrastructure/auth-api && npm ci --ignore-scripts && cd ../.. && node infrastructure/auth-api/backfill-dailies-from-posts.mjs` (dry run, counts only) then `... --apply`. Dailies made this way last 24 h.
  3. **Deploy the Auth API** (`./aws-deploy-auth-api.ps1`, owner computer) for the server half of #618 (Bazaar scrambled) and the CDN code; until then the Bazaar is mixed in the browser only.
- **Deploy the Auth API after #602 merges:** `./aws-deploy-auth-api.ps1`. It also creates and attaches the IAM policy `DanzStakPostDailies`; the cloud session isn't allowed to change IAM. Until then, new posts still reach The Roll, and Mix adds the Daily from the browser.
- **Done 2026-11-19 by Claude Code:** Eroticon's video post (the only video missing `reel`) is now in The Roll, and it has a Daily until 21:06 UTC today. The `backfill-video-reels.mjs` run isn't needed for existing posts.
- **Deploy call-signaling** for #572 (`/friends/of`) and #555 (everyone list) once they merge.
- **Deploy the Auth API for the AI EPK (#567)**, then merge it.

## Hand-off: Claude Code builds, Claude plans (owner 2026-11-18)

**Owner, 2026-11-19 00:10 (final): one coder only. Claude Code codes; Claude (the planning chat) only plans and writes the plan here. "It takes four times longer to fix mistakes than to do it right the first time" — read the spec, build it right, test it in a real browser at phone widths before opening the PR.**

- **Claude Code (the hourly cloud builder)**: at the end of every run, after opening its pull request, add one line at the **top** of the "Builder log" below on the same branch: date/time UTC · queue item · PR number · what's left or blocked · **"Next: <the next TODO in QUEUE.md>"**.
- **Claude (the owner's planning chat) or Copilot**: reads the Builder log, decides the next task, and pastes it into `docs/tasks/QUEUE.md` as the first TODO (with a spec in `docs/tasks/` when it's bigger than one screen). Claude Code always builds the first TODO in the queue.
- Keep the log to the latest 20 lines; older lines can go.

### Plan (Claude, 2026-11-18 night): what the owner is looking for

Goal for the next builds: **DanzStak should feel like a finished, familiar phone app** (Facebook/WhatsApp-level polish, DanzStak look), with **media you can tap and swipe**, **shops that look like real record shops**, and **the Bazaar woven into Mix**. Build in this order; one queue row = one PR; frontend first; every PR checked at 320/360/390/430px with screenshots.

1. **5a1 Full-screen media viewer** (`assets/media-viewer.js` + `.css`, one shared component). Tap any photo/video (Mix, profile Posts/Photos/Videos, Dailies, The Roll, Tribes, SYNC, shop items) → black full-screen layer, media only (no post text, no reaction rows); **swipe up/down (vertical, owner correction 2026-11-19)** moves through the **same member's** photos (from a photo) or videos (from a video), each full screen; videos autoplay muted with the lower-right sound toggle (sound choice carries over, one player at a time); pinch-zoom on photos; swipe down, ✕ or system Back closes and restores the exact scroll spot (history state, no reload). Done when: a browser check taps a Mix photo, swipes twice, presses Back and lands on the same scroll Y.
2. **5a2 Photos / Videos tabs + albums** (owner 2026-11-18, all three sentences are requirements). Tabs show only media in a 3-column grid (square photos, portrait video tiles with duration and poster frame); tap → the 5a1 viewer. **Every photo/video a member posts lands in an album automatically**: posts from the composer go to a default album **"Uploads"**, photos shared from the phone's Share menu (5a01) go to **"Phone photos"**; the member can **rename** either (e.g. "Cell photos"). Members **create their own named albums** ("Concert pictures", "Mike & Ana's wedding", a date/place), **upload many photos at once** straight into an album, and **tick which ones also get posted** to Mix. Albums row at the top of Photos/Videos ("All" + albums with cover + count + "+ New album"); album owner can rename, reorder, set cover, change visibility (Public / Friends / Only me), move photos between albums, delete (Delete everywhere rules). Frontend + `infrastructure/auth-api` album routes (owner session deploys). Never audio files.
3. **5a3 Friends row + Things in common.** Under the profile name: 3–6 small overlapping friend photos + "N friends" (own) / "N mutual friends" or "Friends with things in common" (others); one tap target → Friends · Following · Things in common screen (things in common = same hometown, location, birthday month, genres, Tribes, with the matching friends' small photos). Tapping a friend's photo opens their profile. Replaces the old Friends list everywhere (profile tab, Menu → Friends).
4. **5a5 Bazaar item every 4th post in Mix (after The Roll)** — task 23b. Server cursor in DynamoDB + Mix slot card ("For sale"), different seller/kind each slot, 2-week no-repeat, never paid; tap → seller's Shop tab with the product open; Back restores the spot.
5. **5a6 Shop skin part 2** — task 23 items 2–7 and the product page: kicker "LABEL · SHIPS FROM REGION", seller-editable shop title, "Every order comes with…" box, category chips with counts, featured bundle card, item badges, shipping table; product page with big photo carousel (5a1 viewer), title, mono detail line, price + shipping, Buy, seller row. New seller fields in `marketplace.mjs` (owner session deploys).
6. **5a7 Dailies horizontal swipe + The Roll carousel** (owner 2026-11-19): Dailies open full screen and swipe **left/right** card to card (next card peeks while swiping, photos 6 s with a progress bar, videos muted with the sound toggle, "You're caught up" at the end); The Roll strip in Mix is a **carousel** (snap scrolling, next card peeking, one muted autoplay at a time) and a tapped Roll video opens full screen with **up/down** swipe like Reels.
7. **5a8 Share sheet rebuild** (fix-it 18 "Share post box looks broken") as one bottom sheet with the 16-C buttons; then server-rendered share previews (task 17).
8. **5a9 Tribes like Facebook Groups** (owner 2026-11-18; full spec `docs/tasks/29-tribes-like-groups.md`, built from the owner's Groups brief on DanzStak's own AWS stack, no Express/Socket.io). Directory: cards with the Tribe's picture, name, member count + small member photos, Join. Tribe page: full-width cover (Elders change it), name, Public/Private · N members, row of member photos, Join / Invite / ⋮; tabs **Discussion · Featured · Members · Events · Media · About**; composer "Write something…"; chronological posts with the same post component and the 5a1 viewer; Members tab with Elders (admins) and moderators first, Elders can approve requests, remove posts, mute or remove members; Events tab pulls the Tribe's shows/in-stores; About with rules. Join requests for private Tribes. Phone first, no ranking. **Tribes home looks like Facebook Groups** (owner screenshot 2026-11-18): Tribes title + / search / ⋮; pills For you · Your Tribes · Your activity · Discover; "Your Tribes" rows with picture, role · members or "25+ new posts ●", pin; then a chronological "Latest from your Tribes" feed (spec 29 "Tribes home"). **Members create Tribes** (owner correction): no built-in category Tribes; "+ Create Tribe" asks name → category → city → Public/Private → cover; categories are only a Discover filter and a label. **Create flow like Facebook** (owner 2026-11-18): name with live preview → category/city → Public/Private (+ Visible/Hidden; Private→Public locked) → invite friends → Create → creator is Elder → "Finish setting up your Tribe" checklist (invite, cover, description, welcome post) → Elder tools (rule templates, up to 3 join questions, optional Elder assist rules). Spec 29; **full design with flowchart, DynamoDB schema and API: `docs/tasks/29a-tribe-creation-design.md`** (owner: current stack, UI + backend, no extra constraints).

Owner-session only (not Claude Code): deploy the Auth API for AI EPK (#567) and new routes; fix the Stripe test keys. (SYNC chat-list cache: owner said yes 2026-11-19.)

9. **5a00 Incoming calls ring** (spec 31, PR #578). **5a0 Text button in calls** (spec 30): 5th call button, note over the other person's video until they close it. **5a01 Share a phone photo to DanzStak** (spec 32): DanzStak in the Android Share menu → composer with the photo attached → it posts and lands in the "Phone photos" album.

10. **Translation** (owner 2026-11-18): **5a02 SYNC auto-translate messages** (spec 33) and **real-time call captions** (task 21, queue 9b, after the call fixes).

Build order for Claude Code right now: **5a0 → 5a04 Tribe creation (design 29a) → 5a01 → 5a02 → 5a03 → 5a2 albums (finish #575) → 5a3 friends row (#572) → 5a1 viewer (#577) review fixes → 5a5 Bazaar in Mix → 5a6 shop skin → 5a7 Dailies carousel → 5a8 share sheet → 5a9 Tribes.**

### Plan: test-ready for the owner and friends (Claude, 2026-11-19) — Claude Code builds this BEFORE any new feature

Owner: "Make all the little things we've done so far work and look good so I can test them, in the PWA. When everything works, open accounts so friends can sign up and test. When users register devices, a pop-up says save SYNC as its own app." Order:

**T0. Audit fixes first (owner 2026-11-19: "go through all pages and all buttons… so it flows as one webapp").** Full bug list, one line each with root cause where known: `docs/tasks/36-site-audit-2026-11-19.md` (32 screens and every button clicked at 390px, plus the owner's phone reports). Order, one PR per group:
1. **A1–A3 (owner's phone bugs):**
   - a posted video lands in Dailies and The Roll automatically, from **any** composer (server sets it; remove the opt-in checkboxes; backfill existing videos);
   - Dailies tile never opens the photo picker;
   - **only your own big profile picture on your profile opens the picker (to edit it); every other profile picture opens that member's profile**;
   - The Roll keeps sound on when it opens full screen, and fills the screen;
   - **A11** "+ bio" opens the long-bio editor, owner-only;
   - **A12** remove the @username line under the profile name and put the friends row there (tap a friend's photo → that friend's posts);
   - **A13** a shop storefront (shop name + rotating item preview + price) in the white space beside the profile picture, replacing the small shop button.
2. **A4–A10 (broken in the audit):** Saved page crash, Record Stores crash, raw JS errors shown on the shop manager (add one friendly-error helper), Booking Example/Find clubs dead and Leaflet served locally, Elder sees "Join", composer avatar dead, Menu → Photos shows other people's photos.
3. **B1–B3 one shell:** one app bar, one bottom tab bar with the right tab lit on every signed-in page, one font set.
4. **B4–B6:** one post component everywhere, your own photo instead of "N", one button system.
5. **C1–C2:** the Tour Manager has no paywall and never re-asks for EPK info.
6. **B7–B10:** styled form controls, fluid pages instead of boxes, a DanzStak landing page, Bazaar images.
7. **C3–C5 and D:** small fixes.

Overlaps: A2 = T2a/T2b, A10 is part of 5a2, B10 includes T2g, C4 = T2h/T2i, D1 = T2f. Build each once and tick both.

**T1. Finish what's open (one at a time, each tested in the installed PWA at 360/390px, then merged by the owner's review session):**
- #577 full-screen media viewer (5a1), #575 Photos/Videos albums (5a2), #572 friends row (5a3): bring each up to date with main, fix conflicts, finish, browser-check, screenshots.
- `build/share-target` (5a01): finish as described in the Builder log.

**T2. "Works and looks good" sweep (the owner tests from the installed app):** walk every screen a tester touches, in the installed PWA at 360 and 390px, signed in as a new member: sign up → name/@username → Mix (Dailies, composer with own photo, post photo/video, The Roll) → profile (Posts/About/Friends/Photos/Videos/Shop, + bio, edit profile) → Tribes (create, open, post) → Bazaar (Eroticon items, open product) → Events → Music HQ / EPK builder → SYNC (chat list, thread, send text, call + ring + Text note, Call alerts, Test ringer) → Menu → Log out. For every broken or "'97-looking" thing: add a line to `docs/tasks/18-fix-it.md`, fix the root cause, add a check. No new features in this pass. Done when a fresh account can do the whole walk without help and every screen looks finished.

**T2 checklist (Claude, 2026-11-19) — the open fix-it items in `docs/tasks/18-fix-it.md`, in this order, one small PR each, inside the T2 sweep:**
1. **Tap any profile picture → that member's profile** (post authors, comments, friends rows, search, SYNC list/thread, Tribes members).
2. **No separate Dailies upload:** the Dailies tile opens the viewer (own Dailies) or the composer, never the photo picker; every posted photo/video goes to Dailies automatically.
3. **TAKE N counts every Dailies item** (photos and videos), lifetime, never decreasing.
4. **Videos tab:** poster frame instead of a black box, full avatar, dates like "Nov 18" (no US-only `mm/dd/yyyy`).
5. **Media fills the column edge to edge** in Mix, profiles, Tribes, Roll previews and SYNC; never stretched.
6. **Events: "Post an event" is its own screen** (+ in the Events header), styled file picker, locale date picker (reuse PR #486 if it still applies).
7. **Bazaar: one search** (the shared top bar), Bazaar / My Shop as tabs, empty state = one line + "+ Sell something".
8. **Menu = familiar full-screen grid:** profile row on top, 2-column shortcut tiles (Friends, Tribes, Photos, Events, Bazaar, Music HQ, Record shops, **Radio stations**, Your data, Settings), Log out at the bottom.
9. **Radio stations:** a simple directory page (name, city, genre, website, booking contact) in Music HQ and the Menu; start with an empty state + "Suggest a station"; no scraped data.
10. **Share sheet tidy** until 5a8: one bottom sheet, no wall of text, styled buttons.
11. **Site-wide buttons** outside SYNC use the 16-C button system (no browser-default buttons anywhere a tester can see).
12. **About tab** = one fluid page (no three grey boxes), hide empty fields for visitors.
13. **SYNC (DS) number at the top of the SYNC device window**, owner-only.
14. **SYNC chat list opens instantly** from a copy kept on the phone (**owner approved 2026-11-19**): names, photos, last-message preview, time and unread count only, stored per account; show it at once and refresh in the background. Cleared on Log out, on account switch and on Delete everything; never stores codes, phone numbers or call data. No more "Loading saved chats…".
15. **Plan only, no code yet:** bundle step (one JS + one CSS per page, versioned) — write `docs/tasks/35-bundle-step.md` with the approach, risks and test plan for owner approval.
16. **Plan only:** server-rendered share previews (Open Graph) for profiles/posts/EPKs/events — part of task 17, needs an Auth API/Lambda@Edge route the owner session deploys.

**T3. SYNC as its own app (5a03 + owner 2026-11-19):** spec 34, plus: **right after a device registers** (the SMS code succeeds), show a one-time pop-up: "Make SYNC its own app — get a SYNC icon on your home screen, straight to your chats" with **Add SYNC to home screen** (uses the install prompt from SYNC's own `/sync/` scope; iPhone shows the Share → Add to Home Screen steps) and **Not now**. Never shown again once installed or dismissed twice.

**T4. Friends can sign up and test (needs the owner — Claude Code prepares, never changes live services):**
- Owner tasks before inviting friends: ~~upgrade Twilio from Trial~~ **done — the owner paid the Twilio upgrade (2026-11-19)**; the owner's session only needs to confirm a text reaches an unverified number (a friend's phone) through the "DanzStak" Verify service in `danzstak/twilio/verify`; confirm sign-up is open on the live site; payments stay in **Stripe Test Mode** (friends must not be charged; checkout stays blocked until the test keys are fixed).
- Claude Code builds a simple **"Invite testers"** path: Menu → Invite friends shares the sign-up link (`https://danzstak.com/?invite=<member>`); new members land in Mix with the inviter as a friend request; a small "Beta — tell us what's broken" link in Menu opens support with the device and app version filled in.
- Claude Code writes `docs/TESTING.md`: what testers should try (the T2 walk), how to report a problem, known limits (no real payments, AI EPK pending deploy).

**T5. Then continue the feature plan above:** 5a04 steps 2–5 (Tribe creation design 29a), 5a02 auto-translate, 5a5 Bazaar in Mix, 5a6 shop skin, 5a7 Dailies carousel, 5a8 share sheet, 5a9 Tribes feed.

Owner-session only: deploy the Auth API (AI EPK #567, Tribes privacy, albums, translate), Twilio upgrade, Stripe test keys, live testing on two real phones.

### Builder log (newest first)
- 2026-11-19 13:35 UTC · Claude Code · T0-A10 · PR #634 · merged #633 (T0-A3). Photos/Videos (Menu, feed.html#photos/#videos) now open your own profile tabs (3-column grids; albums with 5a2) instead of copying everyone's Mix media into text cards; new check `menu-own-media` (CI account-security). Found: own Photos/Videos tabs show the Location/Work/Website block above the grid → queue T0-A10b · Next: T0-A10b, then the next TODO
- 2026-11-19 13:10 UTC · Claude Code · T0-A3 · PR #633 · The Roll full screen keeps the member's sound (one shared in-memory choice; moving The Roll to <body> no longer re-mutes it) and fills the screen (no strip padding/white card, caption edge to edge). Merged #625 (CI enforces every check). New checks `roll-fullscreen-sound` (CI call-media) + `test-roll-sound-session`. Not in CI and failing on main too: `video-playback-coordinator`, `core-social-mobile`, `feed-mobile-density`, `pivot` · Next: T0-A10 (Menu → Photos/Videos show only your media, with 5a2)
- 2026-11-19 13:05 UTC · Claude Code (owner live) · owner: "stop coding, plan" → **★ THE DIRECTIVE** at the top of this file (one coder, one release train, test twice; fix list F1–F7; CDN C1–C4). Call-signaling now serves the CDN; #594 viewer green but blocked by main moving · Next: F1 (#594)
- 2026-11-19 12:20 UTC · Claude Code · CI enforcement · merged #617, #623 (6 stale checks + 3 flakes), #624 (alerts banner on phones, Mix media bleed above 700px); PR #625: review.yml and the regression suite run every check through `scripts/run-checks.ps1` (keeps going, then fails and names each failed check; covered by `test-run-checks.ps1` and `test-review-workflow.cjs`). **Rule for everyone: add new checks to a `run-checks.ps1 -Checks @(...)` list, never as bare `node` lines.** Owner decisions open: purchase pop-up totals leave out the buyer fee ($0.75 unlock, $1.50 email vs the 2026-11-16 all-in prices); `call-devices.js` startup can overwrite a credential another tab just saved · Next: T0-A3 (The Roll full screen: sound + fill; #617 found the full-screen Roll shifted 10px with its bottom cut off)
- 2026-11-19 12:20 UTC · Claude Code (owner live, CloudShell) · CDN deployed (dk7kawr758jtd.cloudfront.net) + backfill run; #627 backfill arg fix; CDN step 3 PR (CSP + app photo cache + log-out clear) · Next: switch the CDN on (CloudShell: verify a signed URL, MediaCdnServe=true, Auth API env + policy)
- 2026-11-19 11:55 UTC · Claude Code (owner live session, owner said "handle everything" before a flight) · merged #622 (CDN steps 1–2); release train #626 = #616 + #620 + #618 + #619; CDN signing key created by the owner in CloudShell; call-signaling CDN deploy + backfill left in the Owner-session box (the cloud session can't upload the template to S3 or read member data) · Next: CDN step 3 once the MediaCdnDomain exists
- 2026-11-19 11:20 UTC · Claude Code (owner live session) · owner: "build the CDN" → spec `docs/tasks/38-media-cdn.md`, queue row CDN first; also opened #616 About one line, #618 Bazaar scrambled, #619 TAKE count + Dailies/Roll backfill script, #620 photos 720p · Next: CDN step 1
- 2026-11-19 10:55 UTC · Claude Code · browser-check triage (test files only) · PR #617 · 8 stale checks updated to the owner's current designs; found 3 product bugs: full-screen Roll shifted 10px/bottom clipped (T0-A3), Mix media 2px past its card above 700px, venue selection dead without unpkg Leaflet (T0-A7). **CI hides failures:** pwsh only fails a step on the last `node` line, 9 checks fail under Edge while CI is green · Next: fix those 3 bugs, then make review.yml enforce every check
- 2026-11-19 09:20 UTC · Claude Code (manager) · #600 merged; Eroticon video put in The Roll + today's Dailies directly in DynamoDB; IAM policy + Auth API deploy left for the owner session (cloud session may not change IAM); "Manager's plan" written above · Next: land #602, #604, #599, #603, then T0-A2
- 2026-11-19 01:45 UTC · Claude Code · T0-A1 · PR #602 posted photos/videos go to Dailies (24 h) and videos to The Roll automatically from every composer (server-side), checkboxes removed; owner: deploy Auth API (managed policy DanzStakPostDailies) then `node infrastructure/auth-api/backfill-video-reels.mjs --apply` · Next: T0-A2
- 2026-11-19 · Claude Code (owner live session) · re-tapped every control on 30 screens on main → `docs/tasks/36` section E; new T0-E1 (Mix Comment icon dead), E8–E10; A11/A12/A13/A1 now PRs #600/#600+#572/#599/#601 · Next: T0-E1
- 2026-11-19 02:00 UTC · Claude (planning chat) · full site audit (every page + button at 390px) + owner phone bugs → `docs/tasks/36-site-audit-2026-11-19.md`, plan T0 above, queue rows A1–D · Next: T0-A1
- 2026-11-19 · Claude (planning chat) · owner: yes, the SYNC chat list may be kept on the phone → T2 checklist item 14 / queue T2n unblocked · Next: T1
- 2026-11-19 · Claude (planning chat) · owner asked what's next → "T2 checklist" (16 fix-it items) added under the test-ready plan; queue rows T2a–T2p · Next: T1
- 2026-11-19 00:45 UTC · Claude (planning chat) · owner: tap photo/video → full screen **vertical** swipe through that member's photos/videos (was horizontal); Dailies = horizontal swipe; The Roll = carousel swipe → plan steps 1 and 6 updated, queue 5a1/5a7 · Next: T1
- 2026-11-19 00:40 UTC · Claude (planning chat) · owner: Twilio is upgraded (paid), not Trial; plan T4 updated · Next: T1
- 2026-11-19 00:20 UTC · Claude (planning chat) · owner: make everything work and look good in the PWA, then friends test; SYNC "make it its own app" pop-up after device registration → plan "test-ready" T1–T5 above · Next: T1 (#577, #575, #572, build/share-target), then T2 sweep
- 2026-11-19 00:12 UTC · Claude (planning chat) · **handing all coding to Claude Code.** #588 merged (service worker installs again). Unfinished from tonight for Claude Code: **5a01 share-to-DanzStak** — WIP on branch `build/share-target` (manifest `share_target`, service-worker `/share-target` handler, `assets/share-receive.js` composer hand-off, `browser-checks/share-target.cjs`); finish it: run the browser check against a server that tolerates parallel requests, add `test-share-target.cjs`, bump versions, open the PR. Then 5a04 steps 2–5 (design 29a), 5a02, 5a03, 5a2/5a3/5a1 reviews · Next: 5a01
- 2026-11-18 23:58 UTC · Claude (planning chat) · **found and fixed a root cause**: `service-worker.js` listed 28 URLs twice, so `Cache.addAll()` failed and the service worker never installed on new phones (no offline, no push → "Call alerts does nothing", no ring when SYNC is closed). Fixed + `test-service-worker-shell.cjs` guards it. **Rule for everyone: never add a URL to SHELL that's already there; run `node test-service-worker-shell.cjs`.** #586 Tribe create screen merged. Next: 5a01 share-to-DanzStak (branch build/share-target, in progress), 5a02, 5a03
- 2026-11-19 01:30 UTC · Claude (working through the night on the owner's word; hourly builder paused) · shipped tonight: #578 calls ring + louder rings + Call alerts fixed, #582 no built-in category Tribes, #584 Tribes home like Facebook Groups (art covers, pins, ⋯), #585 Text button in calls (5a0). Open from other sessions: #577 media viewer (5a1), #575 albums (5a2), #572 friends row (5a3), #567 AI EPK (needs Auth API deploy) · Next: 5a04 Tribe creation (design 29a), then 5a01 share-to-DanzStak, 5a02 auto-translate, 5a03 SYNC own app
- 2026-11-19 00:45 UTC · Claude (planning chat) · owner asked for the full Facebook-style Tribe creation design → `docs/tasks/29a-tribe-creation-design.md` (flow, flowchart, schema, API); queued as 5a04, right after 5a0 · Next: 5a0
- 2026-11-19 00:25 UTC · Claude (planning chat) · PR #582 merged (no built-in category Tribes); owner sent Facebook group-creation workflow → spec 29 "Creating a Tribe" · Next: 5a0
- 2026-11-19 00:10 UTC · Claude (planning chat) · PR #578 merged (ringer, louder rings, Call alerts); owner screenshot: Tribes home like Facebook Groups → spec 29 "Tribes home" · Next: 5a0
- 2026-11-18 23:55 UTC · Claude (planning chat) · PR #578: ringer + louder rings + Call alerts fixed; owner: "Get SYNC as its own app" doesn't install → spec 34 queued as 5a03 · Next: 5a0
- 2026-11-18 23:35 UTC · Claude (planning chat) · owner: real-time translation + SYNC auto-translate; spec 33 queued as 5a02, call captions stay task 21 / 9b · Next: 5a0
- 2026-11-18 23:15 UTC · Claude (planning chat) · 5a00 ringer PR #578; owner: shared/posted photos go into albums ("Uploads", "Phone photos", renameable) + named albums with bulk upload; spec 32 share-to-DanzStak queued as 5a01 · Next: 5a0
- 2026-11-18 22:30 UTC · Claude (planning chat) · owner phone test: video call works (picture-in-picture drag works) but incoming calls don't ring; spec `docs/tasks/31-call-ringer.md`, queued first as 5a00, then 5a0 Text button · Next: 5a00
- 2026-11-18 22:20 UTC · Claude (planning chat) · owner asked for a Text button in SYNC calls (note over the other person's video until closed); spec `docs/tasks/30-call-text-overlay.md`, queued first as 5a0 · Next: 5a0
- 2026-11-18 22:05 UTC · Claude (planning chat) · plan written above; queue rows 5a1–5a8 · Next: 5a1
- 2026-11-18 21:45 UTC · Claude (planning chat) · queued 5a1 full-screen media viewer, 5a2 Photos/Videos albums, 5a3 friends row · Next: 5a1

## Owner directives 2026-11-18 (evening, from the owner's phone)

Claude Code builds these in this order (queue items in `docs/tasks/QUEUE.md`; details in `docs/tasks/18-fix-it.md`):

1. **Tap a video or photo → full screen, media only.** On profiles, Mix and everywhere: tapping a video opens it full screen and plays; **swipe vertically (up/down)** through **that member's** videos — or, from a photo, that member's photos — full screen, **without the post text** (not post by post). Back returns to the exact spot in Mix or the profile. (Owner correction 2026-11-19: vertical, not horizontal.)
   - **Swipe directions (owner 2026-11-19):** **Dailies = horizontal swipe** (left/right, card to card, like stories); **The Roll = a carousel swipe** (the strip in Mix scrolls sideways as a carousel with the next card peeking; tapping a Roll video opens it full screen and swipes up/down through Roll videos, like Reels); **tapping any photo or video = full screen with vertical swipe** through that member's photos or videos.
2. **Photos and Videos tabs are media, with albums.** Grids of the member's photos / videos only. Members create **named albums** ("Hellfest 2026", "Mike & Ana's wedding", a concert date…), upload many at once and choose which also get posted.
3. **Friends like Facebook.** Under the profile name: a row of small overlapping friend photos with "N friends" / "Friends with things in common"; tapping it opens Friends · Following · Things in common (things in common = shared hometown, location, birthday month, genres… with the friends' small photos). Tapping a friend's photo opens what that friend has going on (their profile).
4. **Bazaar item every 4th post in Mix, after The Roll**, a different item each time (queue 6e / task 23b). Never paid, never an ad.
5. **Shops need a real skin, not "straight HTML".** The profile Shop tab is the shop itself (done, PR #569); next: task 23 extras (chips, featured bundle, shipping table, all-in prices) and the product page.
6. **Your own photo everywhere you post from.** Composer avatars (Mix and profile) show the member's profile photo, never the DanzStak "D" or an empty circle.
7. **Done today:** Log out goes straight to the landing page; Tribe initials centred and Tribes can show their own picture; "+ bio" is the 5th profile icon; profile Shop tab; Bazaar has the Eroticon shop live; AI EPK builder ready as PR #567 (needs the Auth API deploy, then merge).

