# 18 — Fix-it list: make DanzStak work and look finished

Owner, 2026-11-17: "the site is still ugly and doesn't function right." Before new features, every screen a member touches must work and look finished at phone size (320–430px first, then tablet and desktop).

Claude Code: take the first unticked item, fix the root cause, add a regression check, check it in a real browser at 360 and 390px, open a PR and tick the item with `PR #n`. The owner's Claude adds items from live walkthroughs, newest findings at the bottom of each screen's list.

Rules for every fix: one fluid page instead of stacked boxes, no two-line labels on buttons or tabs, icon buttons with accessible names, 44px touch targets, no horizontal overflow, nothing hidden under the header or bottom tabs, no placeholder or instructional copy where the control is obvious.

## Known from the owner (2026-11-17)
- [x] SYNC: messages scroll over/under the header and get cut off (covered by queue item 4, 16-A) — PR #411 + #413
- [ ] Buttons site-wide look bulky and "HTML" (queue item 5, 16-C) — SYNC: PR #423; other areas to follow
- [ ] Share UI looks "hokie" (task 17 replaces it later; until then at least make the current sheet tidy)

## Profile page (owner, 2026-11-17)

Goal in the owner's words: a profile should feel "like looking in the mirror". The member's own cover, face, photos and videos fill the screen; DanzStak chrome, empty background and buttons get out of the way.

- [x] (PR #425) Remove every big text button on the profile: "Add to the Mix", "View on Reels"/"View in The Roll" and the like. Content already in context needs no button; any remaining action is a slim icon button with an accessible name.
- [x] (PR #427) The Dailies image/video strip stretches full width, edge to edge, sitting directly under the profile header and directly above the posts: no side margins, no box, no gap above or below.
- [x] (PR #427) Fill the pixels: the profile reads as one continuous wall (like a familiar social profile wall), not cards floating on background. Posts edge to edge with hairline dividers, media full width, no grey gaps or padding bands (see CLAUDE.md "Mobile profile posts").
- [x] (PR #429) Profile tabs/menu look janky: one tidy scrollable row (Posts · About · Friends · Photos · Videos, + Shop), single-line labels, a clear active underline, aligned with the header, no wrapping or stacked boxes. Same component for member and official DanzStak profiles.
- [x] (PR #429) Profile navigation works the way Facebook members already know (familiar pattern, DanzStak look, no copied assets): a slim top bar with back arrow, the member's name and search; cover, overlapping round avatar, name and a short line; one compact row of actions (Add friend / Message / more); then the scrollable tab row; then the composer and the wall.
- [x] (PR #432) Photos and videos size and play like a Facebook feed: full card width edge to edge, original aspect kept and never stretched; landscape and square shown whole; portrait shown up to 4:5 (taller is cropped to 4:5 in the feed and shown whole when tapped); multi-photo posts use a tidy grid with "+N" on the last tile. Video autoplays muted when at least 50% visible, stops when it scrolls out, one at a time, mute toggle bottom-right, tap opens full screen (see CLAUDE.md "Video and The Roll"). Same rules in Mix, The Roll and profiles.

## From the walkthrough (owner's Claude adds below)

### Walkthrough 1 — 2026-11-17, live site, 390px, signed in as Eroticon

**Whole site**
- [x] (PR #471; SYNC's screen with the SYNC session) One top bar on every page. Mix has logo + search + Pivot + bell + a big orange down-arrow; the Bazaar has its own pills and search; the EPK has only logo + search; SYNC has none. Same slim bar everywhere: logo, search, bell, SYNC. The unexplained orange down-arrow goes (install prompts belong in Menu or a one-time banner), and Pivot moves into Menu and HQ's Pivot card instead of taking header space.
- [x] (PR #473) Footer links (Privacy · Terms · copyright) don't show inside the signed-in app; they move to Menu → Settings. They currently eat the bottom of every short page.
- [x] (PR #476) Music HQ, Events and the menu open on `feed.html` with a hash, so the browser title stays "Your Mix". Each section gets its own title and Back behaves like a real screen change.
- [x] (PR #473) Remove explanatory sub-lines under page titles ("Your saved conversations.", "Shows coming up. Promoters: post…", "Your EPK and booking work in one place…"). The controls speak for themselves.
- [x] (PR #473) External links (SoundCloud, Mixcloud, YouTube) open outside DanzStak (new tab or the system app). Tapping a SoundCloud post currently replaces DanzStak in the same tab.
- [x] (PR #455) Text buttons with blue outlines ("Open bookings", "Tour Manager", "Open outreach") go to the 16-C button system.

**Profile** (see the section above, plus)
- [x] (PR #427) The cover has thin side margins; it must touch both screen edges.
- [x] (PR #478) The placeholder bio line "Add a short bio so people know more about you." is instructional copy: show nothing to visitors, and a small "+ bio" icon only to the owner.
- [x] (PR #478) An empty profile wall shows nothing under the composer; show a friendly one-line empty state ("No posts yet") and the member's Dailies/photos if any.

**Mix**
- [x] (PR #481) The Dailies tile is a single half-width tile with empty space beside it; it should be a horizontal strip filling the full width (own tile first, then friends'), and "TAKE 0" should read TAKE 1 at minimum once a member has uploaded, or hide the take until the first upload.
- [x] (PR #483) Link posts first render as long raw URLs (Mixcloud with utm junk), then jump when the preview card loads. Show the preview card (or the authorized embed) straight away with a fixed-height placeholder, strip tracking parameters from displayed links, and never print the raw URL under the card.
- [x] (PR #483) "N views" sits on its own line and wastes a row; put it in the reaction row or the post header.
- [x] (PR #483) Official/older accounts (SFScoop, DanzStak) show gradient placeholder avatars; use the real avatar or the member's initial on brand colour.

**Music HQ**
- [x] (PR #484) HQ is a long column of "0" counters with a sentence each and three different button styles. Make it a compact dashboard: next gigs, booking replies, EPK opens, email credits as small tappable tiles in a 2-column grid (each opens its screen, label on one line), one primary action ("Build EPK" or "Send a pitch"), and the Pivot card.
- [ ] (Record shops: PR #484; Radio stations need a directory first, no page or data exists yet) Record shops and Radio stations are missing from HQ (CLAUDE.md: Music HQ = EPK, Booking Agent, Record shops, Radio stations).

**Events**
- [ ] The full "Post an event" form is printed on the Events page with a browser-default "Choose File" button and a US-only `mm/dd/yyyy` date field. Events shows the list of shows; a + button opens the composer as its own screen with a styled flyer/video picker and the date in the member's locale.

**Bazaar**
- [ ] Two search boxes (top bar and body). Keep one. Use the shared top bar; "Bazaar / My Shop" become tabs under it.
- [ ] Empty state is three lines of text on a grey page. One line plus a "+ Sell something" action.

**SYNC list**
- [ ] Five large round buttons in the header (share, video, call, bell, compose). WhatsApp pattern: title, search, a single ⋮ menu; new chat is a floating button bottom-right; calls live in the Calls tab.
- [ ] Empty state sits in a framed box of music staves; drop the box, centre a short line and a "Start a chat" action.

**Menu**
- [ ] The menu is a long side drawer list. Use the familiar full-screen menu: profile row on top, a 2-column grid of shortcut tiles (Friends, Tribes, Photos, Videos, EPK, Booking Agent, Tour Manager, Record shops, Radio, Events, Bazaar, Saved), then Settings, Your data, Help, Log out.
- [ ] Radio stations is missing from Music HQ in the menu.

**EPK builder**
- [ ] Two stacked titles ("EPK Builder" then "Build your EPK in 5 minutes") and "stays private until you publish" said twice. One title, one line.
- [ ] The All-Access laminate graphic is clipped by the right screen edge at 390px.

### SYNC call test — 2026-11-17, phone (SFScoop) ↔ computer (Eroticon), both registered

Fix these before item 5 (16-C) is called done; they block a real call between two members.
- [x] (PR #438) **A registered device is sent back to registration.** On the registered computer, tapping video call opened "Verify this device by SMS" (which itself said "This device is registered"). The call request came back 403/429; the client treats *any* failure as "register this device". Find the real cause (rate limits from polling? stale device headers?) and only open registration on `CALL_DEVICE_REGISTRATION_REQUIRED` when `/calls/devices` also says the device is not registered; otherwise show the real error.
- [x] (PR #438) **Incoming call didn't show until a reload.** SFScoop's call offer was in `/calls/inbox`, but the open chat showed the registration window instead of the ringing screen; after reloading the page the "Incoming call: SFScoop" screen appeared. The incoming poller must recover after a failed poll and never swap a ringing call for the registration window on a registered device.
- [x] (PR #438) **Chat banner says "Register this device…" on a registered device.** Hide it when `/calls/devices` says registered.
- [x] (PR #438 (16-B3 hand-off waits for 16-B3)) **Registration window stays open after success** and its ✕ didn't respond to a tap. Close it on success and go to the "set up this phone" flow (16-B3); make ✕ a 44px target that always closes.
- [x] (PR #438) **Friend button stuck on "Requested"** after the other account accepted. Refresh the relationship state after accept (or on focus).
- [x] (PR #438) **Rename uses `prompt()`**, which is blocked in installed/embedded contexts. Inline rename field instead.
- [ ] **Show your SYNC (DS) number at the top (owner, 2026-11-17; first test purchase gave DS-454-5239).** The SYNC device window (and the top of SYNC under the member's name) opens with, in this order: (1) the member's DS number in large type with copy and share (invite link/QR); (2) the **Send a test notification** button right under it; (3) one clear status line with a green check: "This phone is registered — calls, video and voice messages are on" (or a red "Not registered yet — register to make calls"). Owner: "users would never guess" it's registered today; the status must be obvious at a glance, not buried in a paragraph. Members without a DS number skip (1); no upsell banner. The private mobile number is never shown. Note: a DS number is an in-SYNC address only; it does not replace this device's SMS registration until the DS-number registration path in CLAUDE.md is built and approved.
- [x] (PR #438) **Registration panel is wordy:** SMS rules explained three times and the DS-number upsell in the middle. One line ("Calls and voice messages need this device's own SMS code."), the device row, and move DS numbers out until they launch.
- [x] (PR #438 (needs a real-phone test)) **Speaker is silent or very quiet during a call on the owner's phone.** Check the remote audio element: `volume = 1`, not muted after the user taps unmute, playing (`play()` after the user gesture), only one element carrying the remote track. Add a speaker button: on Android Chrome route with `setSinkId`/`selectAudioOutput` where supported; on iPhone the web can't pick earpiece vs loudspeaker, so say so in the call screen help and make sure the call doesn't start in "voice-processing" mode that plays through the earpiece only. Test on the owner's phone and one other phone.
- [ ] Note for testing: the Claude desktop browser pane blocks camera and microphone, so answering a call there can't prove audio/video. Answer on a second phone or in real Chrome.

### Call audio setup (owner, 2026-11-17: "it should open the box in the middle of the page that users can set the audio")
- [x] (PR #445) **Computers only (owner: "on a computer, and on a phone they should use the phone controls"):** an **Audio & video check box**, centered on screen (a proper modal, not a side panel), opened automatically before the first call on a computer and from a gear icon on the call screen and in SYNC settings. **On phones there is no box:** calls use the phone's own volume buttons and speaker/earpiece/Bluetooth controls, and SYNC just asks for microphone/camera permission once. The box has:
  - Microphone picker with a live level meter ("say something").
  - Speaker picker with **Play test sound**, using `setSinkId`/`selectAudioOutput`.
  - Camera picker with a small live preview.
  - Ring volume slider with a preview ring (feeds the ringtone gain, default the new louder level).
  - Choices saved on that device only (not synced, not sent to the server). One ✕ that always closes, 44px targets, works at 320px.
- [x] (PR #445) If the browser blocks the microphone or camera, the box says exactly how to allow it in that browser instead of failing silently (today "Accept" just does nothing).

### Call screen (owner, 2026-11-17)
- [x] (PR #480) **Move the small camera window.** Long-press (about 300 ms) the picture-in-picture self view, then drag it anywhere; on release it snaps to the nearest corner and stays inside the safe area, never over the hang-up/mute/camera buttons. A quick tap still does what it does today (swap big/small view). Same on computers with a mouse drag. Remember the corner for the next call on that device.
- [x] (PR #480) **The other person's video fills the whole screen (owner, 2026-11-17, supersedes "center the big window").** During a video call the received video is full screen, edge to edge, like the phone's own video calls, **except a band at the bottom kept for the subtitles when they are on** (task 21: the video area ends above that band so subtitles never cover the picture; when subtitles are off the video uses the full screen): on phones it covers the screen (`object-fit: cover`, centered so faces stay in frame; no letterbox bars, no header, no bottom tabs, safe areas respected for the controls). If the other side's camera is landscape on a portrait phone, still fill and center; a double-tap toggles to "fit" to see the whole frame. On computers the call fills the window, with a full-screen button. The "calling…" avatar is centered too.
- [x] (PR #480) **Your own camera window is movable** (see the long-press drag item above): it floats over the full-screen video and the caller can put it in any corner.

## Voice typing on computers (owner 2026-11-18)
- Phones already have voice typing in their keyboard and it works in SYNC — leave phones alone (no extra mic button on touch devices).
- Computers have none. Add a mic button to the SYNC message box (and the post composer) **on computers only**: press to talk, the words appear in the box as you speak, press again to stop; the member edits and sends as usual. Nothing is sent automatically.
- Use the same Amazon Transcribe streaming path planned for live call subtitles (task 21), not the browser's built-in speech recognition (Chrome sends that audio to Google — independence rule). Nothing is stored; the audio stream ends when the button is released or after 60 s of silence.
- Free (no pack needed); rate-limit per account. Languages: the member's DanzStak language, then English, Italian, French, German, Spanish.
- No mic permission → one plain line explaining how to allow it; never a dead button.

## Walkthrough 2 (owner's Claude, live v911 at 390px, 2026-11-18)
Release #494 shipped the call screen, button system, SYNC list polish, profile wall, one top bar, Mix fixes and Music HQ. Mix now looks right (one slim bar, full-width Dailies, no TAKE 0, link cards show the domain, views inline). Found live:
- [x] (hotfix #495) The new top bar hid `.topnav` on phones — that is the phone bottom tab bar, so Mix had no Mix · Music HQ · Events · Bazaar · SYNC · Menu. Fixed; `test-phone-bottom-tabs.cjs` guards it. **Lesson: a browser check at phone width must assert the bottom tabs are visible on every main page.** Add that to the browser checks.
- [ ] Profile still shows the Privacy Policy · Terms of Service footer above the bottom tabs (the no-footer rule from #473 didn't reach profile.html).
- [ ] Profile top bar still has the unexplained white down-arrow (install prompt) next to search. Remove it everywhere; install lives in Menu.
- [ ] SYNC chat list: the music-staff wallpaper is drawn as a box in the middle of the screen under the last chat. Either fill the whole list background edge to edge or show none on the list (wallpaper belongs in threads).
- [ ] SYNC chat list shows "Loading saved chats…" for ~8 s on a warm load. Show the cached list instantly and refresh in the background.
- [ ] Every page loads ~70 separate scripts and stylesheets. Plan a bundle step (one JS + one CSS per page, versioned) so phones on mobile data open faster. Plan first, no big-bang rewrite.

## Mix Dailies (owner 2026-11-18, phone screenshots)
- [x] (PRs #498 #499 #500 #501) In Mix the strip is horizontal, three tiles across, each a third of the screen and the full height of the strip. The member's own tile (photo + clapper showing **TAKE N** = how many Dailies they have uploaded) is pinned on the left; friends' Dailies (photos or videos, cover-fit) scroll left to right behind it, two at a time, like Facebook. With fewer than two friends' Dailies, dark film-frame placeholders keep it at three.
- [ ] **Full-screen Dailies viewer = card carousel.** Tapping a friend's Daily opens it full screen; swipe left/right (or tap the right/left third) moves to the next/previous Daily as a card carousel — the next card peeks in from the side while swiping — through every friend's Dailies in strip order, then on to the following ones, ending with "You're caught up". Videos play muted by default with the lower-right sound toggle (sound choice carries to the next card, one player at a time); photos show for 6 s with a progress bar on top. Swipe down or Back closes and returns to the same scroll spot in the strip. Own tile opens the member's own profile (see below), not an upload. Phone first, 44px targets, works at 320–430px.
- [ ] Count check: TAKE N currently counts uploaded **videos** only (server `dailyTakeCount`). Owner says "how many Dailies that user has uploaded" — count photos too, lifetime, never decreasing on expiry/deletion.
- [ ] The composer avatar for a member with no photo is an empty black circle on some accounts (seen on the owner's phone). It must show the member's initial (orange on dark), like the Dailies tile.
- [ ] **Tap any photo or video anywhere → full screen (owner 2026-11-18).** One shared full-screen media viewer for every photo and video on DanzStak: Mix posts, profiles (Posts/Photos/Videos tabs), Dailies, The Roll, Tribes, SYNC chats, shop items, events, EPK galleries. Tap opens it full screen (fit to the screen, never stretched); swipe left/right moves through the other media in the same place (the post's gallery, the profile's Photos tab, the chat's media, the Dailies strip — the Dailies card carousel above uses the same viewer); videos follow the existing sound rules (muted default, lower-right toggle, one player at a time); pinch-zoom on photos; swipe down or Back closes to the exact scroll spot. Linked YouTube/SoundCloud embeds open their own full-screen player where the provider allows. Captions/alt text stay readable; keyboard Esc and arrows on computers.

## Sharing (owner 2026-11-18, phone screenshots)
- [ ] **Shared profile links show a blank grey card on Facebook (and every other app).** The profile page is built in the browser, so link-preview robots get no title or picture. Give every public profile a share URL (e.g. `https://danzstak.com/@username`, rewritten in `infrastructure/amplify-custom-rules.json` to a small server-rendered page from the Auth API) that returns real Open Graph / Twitter-card tags: `og:title` = the member's name, `og:description` = their bio or "@username on DanzStak", `og:url`, and `og:image` = a 1200×630 card made on the server from **their cover (background) with their profile photo** overlapping on the left plus name and @username, DanzStak mark small in a corner. Cache the card, rebuild it when the cover/photo/name changes; private or deleted profiles return a generic DanzStak card and never leak photos. People who open the link see the normal profile. Do the same for posts, EPKs, events and shop items (task 17), each with its own image. Test with the Facebook Sharing Debugger and a WhatsApp/Telegram paste.
- [ ] **The "Share post" box looks broken (unstyled browser controls).** Seen from a Roll video on the owner's phone: a wall of explanatory text, a tiny textarea, two raw drop-downs and a sentence wrapping round them, a raw URL field. Rebuild it as a phone bottom sheet with the 16-C button system, same on every page (Mix, The Roll, profiles, Tribes, SYNC), and make sure its stylesheet loads everywhere it can open:
  - a small preview of what is being shared (thumbnail + first line), no paragraph about credits (one short line under the preview at most: "Credit stays with <author>");
  - **Share to Mix** as the main button with a small audience chip (Friends ▾) and a "Tribe" chip; an optional comment field that grows when tapped;
  - **Send in SYNC** row of recent chats (round avatars, horizontal scroll);
  - **Share outside DanzStak**: one horizontal row of round app icons (WhatsApp, Telegram, Facebook, X, Bluesky, Threads, Reddit, Mastodon, Email) plus **Copy link** and **More** (the phone's own share sheet); no raw URL text box;
  - a close button in the top corner only; Back closes it. 44px targets, no horizontal overflow at 320px.

## Dailies come from posts; profile pictures open profiles; Home leaves sub-screens (owner 2026-11-18, phone screenshots)
- [ ] **No separate Dailies upload.** Tapping the Dailies tile opened the phone's photo picker. Remove that. Every photo or video a member posts (Mix composer, profile composer, Tribe post) automatically goes into their Dailies for 24 hours; every **video** also goes into The Roll (permanent, until the member deletes it). The post itself stays in Mix/profile as normal. Owner 2026-11-18: **all** photos and videos go to Dailies for 24 h and **all** videos go to The Roll and stay — automatic, no extra choice on the composer (the member removes a Roll video by deleting it). TAKE N counts these lifetime (photos and videos), never decreasing. Server: one post write creates the Daily (24 h expiry) and, for video, the Roll entry; deleting the post with **Delete everywhere** removes both.
- [ ] **Tapping any profile picture anywhere opens that member's profile**: post authors, comments, friends lists, search results, SYNC chat list and thread header, notifications, Tribe members, shop seller rows, event hosts, and the Dailies tiles (own tile → own profile; on a friend's tile the round avatar/name opens their profile, the media itself opens the full-screen Dailies carousel). One shared handler, real links (`<a href="profile.html?u=…">`), 44px targets, keyboard-accessible.
- [ ] **Home (Mix tab) always returns to Mix.** On Friends (opened from the menu, `feed.html` with a hash) tapping the Mix/home tab did nothing. Any bottom tab must leave the current sub-screen and open its own screen; tapping the active tab again scrolls Mix to the top. Back still unwinds one step.
- [ ] **Dailies strip showed at the bottom of the Friends screen.** Only one primary screen may be active (CLAUDE.md shell rule): the Dailies strip, composer and posts belong to Mix only and must be hidden on Friends, Notifications, Menu, Music HQ and Events views.

## Media fills the canvas, no visible inner containers (owner 2026-11-18, Facebook screenshot as a counter-example)
- [ ] Every photo and video in Mix, profiles, Tribes, The Roll previews and SYNC fills the full width of the column, edge to edge, never wider and never narrower. **Shared/quoted posts** ("X shared Y's post", memories, reshares) must not draw a bordered inner card on phones with the media spilling past its border (Facebook itself gets this wrong): on phones the quoted author line and text sit on a subtle tinted band, and the media below runs full width with no side border. On desktop the quoted card may keep a border, and its media is clipped to the card with matching radius. Add a browser check at 320–430px that every `img`/`video` in a post is exactly the column width and no media rect extends outside its card's rect.

## Music HQ: one clear start, then what the clubs did (owner 2026-11-18, phone screenshot)
- [ ] Remove the three pills under the tiles (EPK · Booking Agent · Record shops) — nobody knows what they're for.
- [ ] **Before the EPK is published**, the top is one clear start: **"Build your EPK to get started"** (primary) and right under it a small secondary **"Want it AI-assisted?"** (opens the AI EPK flow; price shows only there, per the paywall rule). Once published, the primary becomes "Send a pitch".
- [ ] **Under the tiles, the interaction list from the boxes** — a chronological list of what clubs did with the EPK, newest first, each row: club name + city, what happened and when, tap → that booking thread:
  - **Confirmed** (green) — "The Crocodile, Seattle confirmed Fri 13"
  - **Offered dates / replied** — "Doug Fir, Portland replied · offered Sun 15"
  - **Opened** — "Opened your EPK · 2h ago" (from the per-venue EPK link)
  - **Not opened yet** — sent pitches still unopened, with days since sent
- [ ] **The tiles are exactly (owner 2026-11-18): EPKs sent · Opened · Replied · Confirmed · Credits** — in that order, as one compact row/grid on phones (Credits is the small last tile showing the remaining booking-email credits; it never shows a price). Replace today's Next gigs / Booking replies / EPK opens / Email credits tiles.
- [ ] Tapping a tile filters the list (EPKs sent → every pitch with its status; Opened → opens; Replied → replies/offered dates; Confirmed → confirmed shows; Credits → credits used and returned, e.g. unopened-pitch refunds). Empty states are one short line, e.g. "No clubs have opened your EPK yet."
- [ ] Tiles that show 0 before anything exists collapse into the start card (no wall of zeros for a new artist).
