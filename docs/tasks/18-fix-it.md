# 18 — Fix-it list: make DanzStak work and look finished

Owner, 2026-11-17: "the site is still ugly and doesn't function right." Before new features, every screen a member touches must work and look finished at phone size (320–430px first, then tablet and desktop).

Claude Code: take the first unticked item, fix the root cause, add a regression check, check it in a real browser at 360 and 390px, open a PR and tick the item with `PR #n`. The owner's Claude adds items from live walkthroughs, newest findings at the bottom of each screen's list.

Rules for every fix: one fluid page instead of stacked boxes, no two-line labels on buttons or tabs, icon buttons with accessible names, 44px touch targets, no horizontal overflow, nothing hidden under the header or bottom tabs, no placeholder or instructional copy where the control is obvious.

## Known from the owner (2026-11-17)
- [ ] SYNC: messages scroll over/under the header and get cut off (covered by queue item 4, 16-A)
- [ ] Buttons site-wide look bulky and "HTML" (queue item 5, 16-C)
- [ ] Share UI looks "hokie" (task 17 replaces it later; until then at least make the current sheet tidy)

## Profile page (owner, 2026-11-17)

Goal in the owner's words: a profile should feel "like looking in the mirror". The member's own cover, face, photos and videos fill the screen; DanzStak chrome, empty background and buttons get out of the way.

- [ ] Remove every big text button on the profile: "Add to the Mix", "View on Reels"/"View in The Roll" and the like. Content already in context needs no button; any remaining action is a slim icon button with an accessible name.
- [ ] The Dailies image/video strip stretches full width, edge to edge, sitting directly under the profile header and directly above the posts: no side margins, no box, no gap above or below.
- [ ] Fill the pixels: the profile reads as one continuous wall (like a familiar social profile wall), not cards floating on background. Posts edge to edge with hairline dividers, media full width, no grey gaps or padding bands (see CLAUDE.md "Mobile profile posts").
- [ ] Profile tabs/menu look janky: one tidy scrollable row (Posts · About · Friends · Photos · Videos, + Shop), single-line labels, a clear active underline, aligned with the header, no wrapping or stacked boxes. Same component for member and official DanzStak profiles.
- [ ] Profile navigation works the way Facebook members already know (familiar pattern, DanzStak look, no copied assets): a slim top bar with back arrow, the member's name and search; cover, overlapping round avatar, name and a short line; one compact row of actions (Add friend / Message / more); then the scrollable tab row; then the composer and the wall.
- [ ] Photos and videos size and play like a Facebook feed: full card width edge to edge, original aspect kept and never stretched; landscape and square shown whole; portrait shown up to 4:5 (taller is cropped to 4:5 in the feed and shown whole when tapped); multi-photo posts use a tidy grid with "+N" on the last tile. Video autoplays muted when at least 50% visible, stops when it scrolls out, one at a time, mute toggle bottom-right, tap opens full screen (see CLAUDE.md "Video and The Roll"). Same rules in Mix, The Roll and profiles.

## From the walkthrough (owner's Claude adds below)

### Walkthrough 1 — 2026-11-17, live site, 390px, signed in as Eroticon

**Whole site**
- [ ] One top bar on every page. Mix has logo + search + Pivot + bell + a big orange down-arrow; the Bazaar has its own pills and search; the EPK has only logo + search; SYNC has none. Same slim bar everywhere: logo, search, bell, SYNC. The unexplained orange down-arrow goes (install prompts belong in Menu or a one-time banner), and Pivot moves into Menu and HQ's Pivot card instead of taking header space.
- [ ] Footer links (Privacy · Terms · copyright) don't show inside the signed-in app; they move to Menu → Settings. They currently eat the bottom of every short page.
- [ ] Music HQ, Events and the menu open on `feed.html` with a hash, so the browser title stays "Your Mix". Each section gets its own title and Back behaves like a real screen change.
- [ ] Remove explanatory sub-lines under page titles ("Your saved conversations.", "Shows coming up. Promoters: post…", "Your EPK and booking work in one place…"). The controls speak for themselves.
- [ ] External links (SoundCloud, Mixcloud, YouTube) open outside DanzStak (new tab or the system app). Tapping a SoundCloud post currently replaces DanzStak in the same tab.
- [ ] Text buttons with blue outlines ("Open bookings", "Tour Manager", "Open outreach") go to the 16-C button system.

**Profile** (see the section above, plus)
- [x] (PR #427) The cover has thin side margins; it must touch both screen edges.
- [ ] The placeholder bio line "Add a short bio so people know more about you." is instructional copy: show nothing to visitors, and a small "+ bio" icon only to the owner.
- [ ] An empty profile wall shows nothing under the composer; show a friendly one-line empty state ("No posts yet") and the member's Dailies/photos if any.

**Mix**
- [ ] The Dailies tile is a single half-width tile with empty space beside it; it should be a horizontal strip filling the full width (own tile first, then friends'), and "TAKE 0" should read TAKE 1 at minimum once a member has uploaded, or hide the take until the first upload.
- [ ] Link posts first render as long raw URLs (Mixcloud with utm junk), then jump when the preview card loads. Show the preview card (or the authorized embed) straight away with a fixed-height placeholder, strip tracking parameters from displayed links, and never print the raw URL under the card.
- [ ] "N views" sits on its own line and wastes a row; put it in the reaction row or the post header.
- [ ] Official/older accounts (SFScoop, DanzStak) show gradient placeholder avatars; use the real avatar or the member's initial on brand colour.

**Music HQ**
- [ ] HQ is a long column of "0" counters with a sentence each and three different button styles. Make it a compact dashboard: next gigs, booking replies, EPK opens, email credits as small tappable tiles in a 2-column grid (each opens its screen, label on one line), one primary action ("Build EPK" or "Send a pitch"), and the Pivot card.
- [ ] Record shops and Radio stations are missing from HQ (CLAUDE.md: Music HQ = EPK, Booking Agent, Record shops, Radio stations).

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
- [ ] **Move the small camera window.** Long-press (about 300 ms) the picture-in-picture self view, then drag it anywhere; on release it snaps to the nearest corner and stays inside the safe area, never over the hang-up/mute/camera buttons. A quick tap still does what it does today (swap big/small view). Same on computers with a mouse drag. Remember the corner for the next call on that device.
- [ ] **Center the big window.** The other person's video is centered on the call screen, horizontally and vertically, at its own aspect ratio (portrait phone video fills a phone screen; landscape video is centered with even space above and below), never stretched or pushed to one side, on phones and computers. Same for the "calling…" avatar before they answer.
