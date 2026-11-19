# CLAUDE.md — DanzStak brief

Read this first, every session. **Claude Code: your work list is `docs/tasks/QUEUE.md`. Take the first `TODO` item, open a PR, mark it, and move on (see the instructions at the top of that file).** Then read `docs/SESSION-HANDOFF.md` (latest progress and open items), then `docs/OWNER-DIRECTIVES.md` (priorities and task specs) and `instructions/` (the full product spec the owner wants built). Then read `README.md` (mission, independence rules, product boundary), `docs/DANZSTAK-DESIGN-SYSTEM.md`, and `docs/QUALITY-ASSURANCE-POLICY.md`. Those rules still apply.

## ★ THE DIRECTIVE (owner 2026-11-19, supersedes every other order in this file and in QUEUE.md until it is done)

Owner: "Lots of mistakes I'm finding that we have gone through. Fix all these things — the UX is not good and users will not use the site. Main keeps moving. Make one big directive for Code, then test it all, and test it again. When two agents are coding, things get messed up."

### Rules
**Motto: test, test, test, deploy.** The owner is seeing too many mistakes in the PWA. Owner's saying: **"What is wrong with perfect?"**

**The quality bar, in the owner's words:** "This is perfect if the link works, but this is the quality of work DanzStak needs for success. Everything needs to look this good to a user."
- The reference is the invite share card in a phone's messages: `docs/screenshots/owner-reference/invite-share-card-quality-bar-2026-11-19.png`. It has a clean preview image, a clear title and the domain.
- Every screen, share preview and email must reach that level.
- Also verify that the invite link itself lands correctly: sign-up, then a friend request to the inviter.

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
- **L1. LIVE FAILURE, first before everything (rule 3): a tester in Washington state can't open profiles or register a device** (owner 2026-11-19 ~19:00 UTC: "Profile page not loading in Washington state. The Mix loaded but profiles did not load… and can not register their device").
  - **What Claude found in AWS (us-west-1, last 3 h, metrics only, no member data):** no 5xx and no Lambda errors. Every signed-in route is answered with **4xx while `/auth/refresh` succeeds**: `GET /profiles` 19 of 64, `GET /phone-verification` 13 of 16, `GET /calls/devices` 12 of 43, plus `/calls/inbox`, `/calls/presence`, `/settings/sync-prefs` and `/sync-network-number/entitlement` at 10 each. `GET /phone-verification` only fails with **401 "Authentication required"**, so that phone **is not sending a valid session**. There were **zero** `POST /phone-verification` calls, so the member never reached "Text me a code": the screen failed before it. A new sign-up went through in the same window (`/auth/signup`, legal acceptance and `POST /profiles` once each).
  - **Likely causes to confirm (in this order):** the session cookie isn't stored or sent on that phone (an in-app browser opened from a text/WhatsApp/Instagram link, iOS private browsing or blocked cookies, a stale installed PWA or service worker holding an old session); the refresh succeeds but the new cookie isn't kept (cookie attributes, `SameSite`/`Domain` between `danzstak.com`, `www` and `api.danzstak.com`); or the page doesn't retry after refresh.
  - **Fix and checks:**
    - Add **API access logs** to `DANZSTAK-Auth-HTTP-API` (status, route, latency, a hashed request id; no IP beyond /24, no emails, no tokens) so the next failure shows its status codes. Template change; the owner deploys in CloudShell.
    - Reproduce in Playwright with WebKit (iPhone) and Chromium (Android), signed in through an invite link, including a third-party-cookie-blocked profile and an in-app webview user agent. Fix the root cause.
    - **Never fail silently:** when any signed-in call returns 401 after one refresh-and-retry, show one clear sheet "Sign in again to keep going" (keeps drafts), never a blank profile or a dead registration screen. The SYNC registration screen shows the real reason (signed out, texts unavailable, number refused) instead of nothing.
    - Check: profiles and "Text me a code" work in both engines after an invite-link sign-up; a forced 401 shows the sign-in sheet, not a blank page.
  - **More from the owner (2026-11-19):** the tester is on a **MacBook Air** (a computer, not a phone). They couldn't load **the owner's profile**, couldn't register the computer, and **the computer didn't ring** when called. So reproduce first in **Safari on macOS** (WebKit desktop, "Prevent cross-site tracking" on, which is Safari's default) and Chrome on macOS, at desktop width, through an invite-link sign-up, then open the owner's profile and SYNC registration.
    - Not ringing is expected for a device that isn't registered (calls need a registered device), but it must never be silent: an unregistered computer shows the incoming call with **"Register this device to answer"** (the existing SYNC rule) and a desktop notification once permission is given. The check calls an unregistered desktop session and asserts that banner appears.
    - Desktop registration uses the same text-a-code flow to the member's phone; the check runs it at 1280px in WebKit and Chromium.
  - **ROOT CAUSE FOUND for device registration (2026-11-19 19:51, owner's own phone in Italy):** the registration screen showed the raw AWS error `…DANZSTAK-Auth-API-role… is not authorized to perform: dynamodb:ConditionCheckItem on …table/DANZSTAK-PhoneVerifications`. `personal-phone-dynamodb.mjs` uses a `ConditionCheck` inside `TransactWriteItems` (the 10-accounts-per-number claim), but the role's policies (`DanzStakPhoneVerification`, `DanzStakPostAuthorization`) only grant Get/Put/Delete/Update/TransactWriteItems. So **every** "Text me a code" fails, for everyone, and calls stay locked (the owner: "calling does not work with an Italian number"). `tour-manager-billing.mjs` has the same gap on `DANZSTAK-Tours` (booking-email sends).
    - **Owner fix (CloudShell, sent 2026-11-19):** managed policy `DanzStakConditionChecks` allowing only `dynamodb:ConditionCheckItem` on `DANZSTAK-PhoneVerifications` and `DANZSTAK-Tours`, attached to the Auth API role.
    - **Code:** add `DanzStakConditionChecks` to `aws-deploy-auth-api.ps1` (create if missing, attach), and a test that scans every `ConditionCheck` table in `infrastructure/auth-api/*.mjs` and fails unless the deploy script grants `ConditionCheckItem` on it. A transaction must never ship without its IAM.
    - **Never show raw AWS errors to members** (this one leaked the account number and role name). Every API error goes through one server-side mapper: members see a short translated message ("Couldn't send the code right now. Try again in a minute."), and the details stay in the logs. Check: no response body from any route contains `arn:`, `is not authorized`, an account number or a stack trace.
  - **Also reported by the owner the same evening:** "Photo or attach does not work" (SYNC chat attach: reproduce and fix with a check) and "Need translation to work as well" (SYNC auto-translate, spec 33 / queue 5a02: move it up to week 2).
  - Ask the tester (through the owner): which browser on the Mac (Safari or Chrome), opened from a link inside another app or not, and whether "Sign out → sign in" fixes it.
- **F0. CI green on main first.** Since #625 every check counts. `browser-checks/call-audio-output.cjs`, `browser-checks/original-feed-art-direction.cjs`, `browser-checks/roll-fullscreen-sound.cjs` and `browser-checks/profile-onboarding-identity.cjs` time out in CI now and then (seen on docs-only PRs #632, #639, #644, #650). Fix the root cause or the stale check; never skip one.
- **F1. Tap a photo or video → full screen.** The owner says it still doesn't work, because the viewer never merged. **#594 is green and ready.** Bring it up to date with main and merge it first, then check on the live app: Mix, Tribes, profile Posts, and the Photos/Videos tabs.
  - **Owner 2026-11-19 (phone, after the viewer went live):** "When I click on a video it goes full screen. It should be able to vertically swipe to see the rest of the videos in that profile." The same for photos. Opening full screen alone is **not** done: from a video, swiping up/down moves through **every video of that member**, and from a photo through **every photo of that member** (not only the ones already loaded on the page; fetch the member's media list). The check swipes up twice and down once on a real touch emulation at 360/390px, from Mix, the profile Posts tab and the Photos/Videos tabs, and asserts a different media item each time.
- **F1a. Full-screen video: actions on the right, comments in a sheet below the video** (owner 2026-11-19, screenshot of a familiar app's full-screen video with comments open: "the comments, likes and things should be on the right hand side in full screen… when users click on that the video changes to something like the screenshot… a swipe down brings it back up full screen… DanzStak video should open similar, with the text box below"). The reference screenshot shows a real person, so it is described here and not committed.
  - **Full screen (F1 viewer, The Roll, Dailies videos):** a slim vertical action rail on the **right** edge, above the sound toggle: Like (with count), Comment (with count), Share, Save and ⋯; author avatar + name and the caption sit bottom-left over a soft gradient. Lucide icons (UI kit), 44px targets, centre-tap checked.
  - **Like the familiar short-video apps** (owner, second screenshot: "just like TikTok, just like Facebook, just like the other ones, DanzStak should be the same"): the video fills the whole screen edge to edge (portrait video `object-fit: cover`, landscape centred with its own ratio); the rail runs top to bottom as: **author's round avatar with a small orange + (Follow, F18)**, Like, Comment, Save, Share, each a white icon with a soft shadow and its **count underneath**; author name and caption bottom-left; nothing else on the video (no boxed buttons). DanzStak orange replaces the other apps' colours.
  - **Tap Comment:** the video **shrinks into the top part of the screen** (about 40% of the height, its own aspect, still playing with the same sound choice) and a **comments sheet** slides up below it (rounded top, drag handle, 220 ms):
    - a sort control **Newest ▾ / Oldest** (chronological only, never "most relevant" ranking);
    - rows: 40px avatar, **name** · relative time, text, then Reply · like/dislike with counts, and "View N replies" folded under each comment;
    - a fixed **"Comment as {your name}"** box at the bottom with your own photo, above the keyboard (keyboard-safe).
  - **Swipe the sheet down** (or tap the video, or system Back): the sheet closes and the video **grows back to full screen** without restarting or losing its sound choice. Swiping up/down on the video itself still moves to the next/previous video (F1) only while the sheet is closed.
  - The same comment sheet component is used for posts in Mix (one comment system, no copy).
  - Check (touch at 360/390px): open a Roll video, tap the centre of Comment → video rect ends in the top half and the sheet is below it with the input box visible; post a comment; swipe the sheet down → the video fills the screen again and `currentTime` kept going (no restart).
- **F2. The Roll keeps the sound choice.** Owner: "each video I have to turn the audio on." Once sound is on, the next Roll video stays audible, whether reached by scroll or auto-advance; mute carries over the same way; never two audible players. Browser check with real playback. Root cause is likely `media-visibility.js` session sound (`sessionSound`) reset or not applied on the next card.
  - Owner again, 2026-11-19 6:32 pm: "In The Roll when sound is on the next video should have sound on; when the sound is off the next video should have sound off." This is the whole rule; the check plays three Roll videos in a row, toggling sound on the first, and asserts the second and third follow it.
- **F3. Dailies scrolling doesn't work** (owner's phone). Reproduce with touch at 360/390px, fix the root cause, and add a check that swipes both the strip and the full-screen Dailies. Land #605 (tile never opens the picker), #609 and #587 in the same train.
- **F4. Profile header: name beside the avatar, picture box below it.** Owner 2026-11-19, replacing the earlier "box beside the avatar" layout: "put the name to the right of the profile image and move the image box below the name… make the font size smaller to fit the space if needed… this also gives room for a bigger image. Think like a Marvell chip designer."
  - Pack every pixel deliberately. Everything is measured and placed with no overlaps and no dead space.
  - **Name** sits in the white space **to the right of the avatar**, under the cover. Its font scales down (`clamp` plus a fit-to-width step, minimum about 18px, then two lines) so the whole name always shows. Handle, friends count and the facepile go under it in that same column when they fit.
  - **The showcase/shop picture box moves below the name row**: full content width, a bigger image (about 16:7, tall enough to read logos), `object-fit: cover` with the owner's saved focal point (F12). Shop preview thumbnails sit in the same band.
  - Action buttons stay in one row under the band.
  - This **replaces** the centred-avatar idea in F9 for the header. F9's tabs, Friends page and details rows still apply.
  - Rewrite `browser-checks/profile-showcase-fit.cjs` so it checks:
    - the name sits right of the avatar, never clipped or overlapped, across short and very long names;
    - the box is below the name at full width;
    - there is no gap of more than 12px anywhere in the header, at 320/360/390/430px.
- **F4a. First, in the next train: stack the picture box's pencil and bin, and give the space to the photo** (owner 2026-11-19, phone screenshot: "put the pencil and the garbage can on top of each other, the pencil on top and the garbage underneath, and make that space bigger for an image").
  - Today the owner's ✎ and 🗑 sit side by side left of the showcase photo (`.profile-showcase .profile-showcase-tools{flex-direction:row}` in `assets/profile-shop.css`), so they eat about 90px of the row.
  - Fix: one column, pencil on top and bin underneath, 44px targets with a 6px gap, sitting against the photo's left edge. `placeProfileShopPreview` (`assets/profile-editor.js`) re-measures, and the photo grows into the freed width (it scales with the space, per the owner's earlier "the image box should fill the unused space").
  - Visitors never see the tools.
  - Update `browser-checks/profile-showcase-fit.cjs`: the tools are stacked (pencil above bin), nothing overlaps the name, avatar or photo, and the photo is wider than before at 320/360/390/430px.
  - When F4 moves the box below the name, the stacked pair moves into the band's top-right corner over the photo (later one ⋯, per F9), so the photo keeps the full width.
- **F4b. Your own photo in the composer, and real dates on profile posts** (owner 2026-11-19, phone screenshot of the profile Posts tab: "The black S should be a profile picture"). The profile composer shows a black circle with "S" instead of the member's photo; posts below show "11/16/2026, 2:36:01 AM". Fix: every composer avatar (profile, Mix, Tribe) is the member's own profile photo (initial only when no photo exists, in DanzStak colours), and post times are relative ("5h", "3d", then "Nov 16"), the same component as Mix. Check: a member with a photo never sees a letter avatar in any composer; no `mm/dd/yyyy, hh:mm:ss` text on any page.
- **F4c. Tapping the big profile picture** (owner 2026-11-19): "when a user clicks on the profile picture that is not the account owner they should be able to do a horizontal swipe to see previous profile pictures; if it's the account owner it should open to edit the profile picture."
  - **Visitor:** the full-screen viewer (F1) opens on the current profile picture; **horizontal swipe** (left/right) goes through that member's earlier profile pictures, newest first, with a small "1 / N" count. ✕, swipe down or Back closes it.
  - **Owner:** the tap opens the profile-picture editor (new photo, reposition and zoom per F12, remove).
  - The server keeps each member's past profile pictures (key + date) when they change it; the member can delete any of them (Delete everywhere rules), and only pictures the visitor is allowed to see are listed.
  - Every other small profile picture (post authors, comments, friends rows, Dailies avatars) still opens that member's profile (F5).
  - Check: as a visitor, tap the avatar, swipe left twice and see older pictures; as the owner, the tap opens the editor; a deleted old picture never appears.
- **F5. Every profile picture opens that member's profile** (#598).
- **F6. The rest of the audit**, `docs/tasks/36-site-audit-2026-11-19.md`, in its order: A4–A10, E8–E10, B1–B10 (one app bar, one tab bar, one font set, one post component, one button system), C1–C5, D.
- **F7. Finish the open feature PRs**, one per train after F1–F6:
  - #575 albums;
  - #572 friends row (needs the call-signaling `/friends/of` deploy);
  - #593 share a phone photo;
  - #591 SYNC as its own app;
  - #580 ringer part 2.
- **F8. Modern look, every page.** Owner 2026-11-19: "This is janky… kids these days know what a dope site looks like… if it looks like something an 8th grader could build they won't use it." **Built on the UI kit below** (Tailwind + Flowbite + Lucide + Fluent Emoji, the "Backstage" look, every form matching).
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
  - Reference screenshots, layout only, DanzStak colours and brand, in `docs/screenshots/owner-reference/`: `profile-familiar-reference`, `profile-familiar-reference-2` (Events tab, "Share a note…" bubble on the avatar), `friends-things-in-common-reference`, `profile-danzstak`, `friends-danzstak`.
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
- **F12. Every picture can be moved to fit its box.** Owner 2026-11-19: "on all pictures I should be able to move them around to fit them in the box."
  - Applies to the profile cover, avatar, showcase photo, Tribe cover and Tribe picture, shop cover and event flyer. When the owner sets or edits one: **drag to reposition** (and pinch or slider to zoom) inside a preview of the exact box, then Save.
  - Store the focal point and zoom (`objectPosition` x/y %, scale) with the image, and render everywhere with `object-fit: cover` plus that position.
  - Example: the "DACHSHUND" showcase logo is cut off today (`docs/screenshots/owner-reference/profile-duplicate-name-danzstak-2026-11-19.png`).
  - Reuse one shared component. The cover already has a position (`test-cover-position.cjs`); extend that, don't add a second system.
- **F13. Tribe page.** Reference: `docs/screenshots/owner-reference/tribe-page-danzstak-2026-11-19.png`.
  - **Changing the cover also changes the Tribe's picture** in the top-left header and in the Tribes list, unless a separate Tribe picture was set.
  - **Only Elders see Tribe controls:** Change cover, edit, members tools, pin. Everyone else sees none of them. Enforce on the server too, and add a check as a non-Elder member and a visitor.
  - Modern look per F8:
    - no "← Back to Tribes" text button (the app bar back arrow does it);
    - no huge "✓ Joined" bar (a small "Joined ▾" chip with Leave/Notifications);
    - pill tabs instead of boxed tabs;
    - no box inside a box.
- **F14. The name shows twice on a profile.** "Dachshund Records" appears as the name and again as the bio line under it. Hide a bio or handle line that repeats the name, ignoring case and spacing. Check: a profile whose bio equals its name shows the name once.
- **F15. Dailies rotate on every return and "bounce and settle".** Owner 2026-11-19: "Dailies should rotate each time the user comes back to the site. They should just bounce and settle."
  - Each new visit (app open, sign-in, return after more than 30 min) shows friends' Dailies in a new fair order, never the same first tile twice in a row. The member's own tile stays pinned left.
  - On load the tiles slide in with a short spring: overshoot about 6px, settle within 400ms, staggered 40ms. No motion with `prefers-reduced-motion`.
  - Check: two visits give different orders and the own tile stays first.
- **F15a. Dailies strip: no icons on the tiles, and tiles slide behind your own tile** (owner 2026-11-19, phone screenshot: "When I horizontally swipe on the Dailies the icons go above my profile picture and the video goes behind my profile picture. The icons really shouldn't be there and they should swipe behind my profile picture").
  - Today each tile in the strip carries a bin, a mute circle and a play circle, and the "Dailies" label and SCENE/TAKE strip overlap the bin and the name. While the strip scrolls, those icons draw **over** the pinned own tile because they sit in a higher stacking layer than the tile itself.
  - Fix: strip tiles show **only** the picture or poster, the SCENE/TAKE clapper (own tile) or the small time label, and the name. No bin, mute or play icons in the strip (delete, sound and play live in the full-screen Dailies, F3). Each scrolling tile is its own stacking context (`isolation: isolate`), and the pinned own tile sits above the whole scroller, so everything slides cleanly **behind** it. The clapper and the name never overlap (the name sits under the clapper or is dropped on your own tile).
  - **More from the owner's screenshots (2026-11-19, 6:30 pm):** "Two images don't have the icons and the rest of them do… take those icons away and just click on the video and it plays, you don't need the play button there." Every tile looks the same: **tap the tile and it plays** (opens the full-screen Dailies on that card). Also seen: photo Dailies sit in the tile with **black bars above and below** (they must fill the tile, `object-fit: cover`, F17's fill = box rule), and a scrolled tile's name ("Dachshund Records") is drawn **over** the own tile's clapper.
  - Check (touch swipe at 360/390px): while the strip is scrolled, no element from another tile is painted over the own tile's rect (`elementFromPoint` at a grid of points over the own tile always hits the own tile); no button with a bin, mute or play icon inside the strip; the clapper and name rects don't intersect.
- **F15b. Pin the DanzStak welcome post to the top of Mix, say "Tribes", tighten it** (owner 2026-11-19, screenshot of the "Welcome to DanzStak!" post: "Lock this post to the top of the Mix until a few weeks after opening, also take out the part about groups and make it say Tribes, and take away the spacing to make it tighter").
  - **Pinned:** a server-side `pinnedUntil` on official DanzStak posts only (set by the `danzstak-owner` group, checked on the server). Mix shows a pinned post first, once, with a small pin label, until **20 January 2027** (about four weeks after doors open on 23 Dec). After that it falls back into its chronological place. Members can't pin.
  - **Text:** "Welcome to DanzStak! Connect with people, share your original photos, music videos and ideas, and build your scene. Start by finishing your profile, finding friends and joining a Tribe. What are you creating today?" Translated through i18n. No "group" anywhere in member-facing copy (grep check).
  - **Tight:** no empty lines between sentences (one short paragraph plus the question), the same post padding as every post. The text change goes through an owner-run script (Owner-session box) or the owner's edit on the post, never a hand edit in DynamoDB.
  - Check: Mix's first post is the pinned welcome until the date, and not after (clock injected); the post text contains "Tribe" and no "group"; no blank-line gaps in it.
- **F15c. Mix flows: no down arrow at the end** (owner 2026-11-19: "take away that downward arrow when the user gets to the end of the page and just make the Mix flow. It scrolls as things are loaded"). Owner's correction to the old "load more" button (`.load-more-posts` in `feed.html`).
  - When the member nears the end of what's loaded (about one screen before), the next chronological page loads by itself, with a skeleton post, no button. Order stays chronological and never ranked.
  - When there's nothing older, Mix ends with one quiet line "You're caught up" (the finite feed stays finite: no recycled or suggested posts to keep people scrolling).
  - Check: scroll to the bottom at 360/390px → more posts appear with no tap; no "load more"/arrow button exists; at the true end the "caught up" line shows and no further requests fire.
- **F15d. After The Roll, one Mix post in every five is a slot (4 member posts, then the slot: 20%) that alternates Bazaar item → review → Bazaar item → **scene news** → Bazaar item → event flyer → …** (owner 2026-11-19: "In the Mix every fourth post after The Roll should be a product from the Bazaar"; then "Alternate" for sharing with reviews; then "so 20% will be Bazaar items or reviews, so one every five").  Reviews rotate between different writers (task 42). The Bazaar part is queue 5a5 / task 23b, now on the fix list: in the Bazaar turns of that slot, the card is one member's Bazaar item (a clearly labelled "For sale" card, never paid), a different item and seller each slot, the same item not again for 2 weeks, rotating each new session; tap → the seller's shop at that item; Back returns to the same spot. Built in week 3 with the Bazaar server half (C1 deploy).
- **F15f. Bazaar: a real mix, never the same shop twice in a row** (owner again, 2026-11-19 6:38 pm, screenshot with three Eroticon items in a row: "these products should be jumbled up and switched around every time you come in, different items for sale in different places and not the same shop in a row so it's a variety").
  - **Root cause (found in `assets/bazaar.js`):** the real items are scrambled among themselves, but the labelled examples are **appended after** them (`examplesFor` … `list.append(exampleCard…)` after the real cards). Today the only real shop is Eroticon, so every Eroticon item lands together at the top. The server half of the scramble (#618) also isn't deployed yet (C1).
  - Fix: build **one list** of real items and examples, then the same seeded shuffle + round-robin by shop (`scrambleBySeller`, one shared function for the browser and the server), so **no two neighbouring cards in the grid share a shop** whenever another shop is available (left/right and above/below in the 2-column grid). New seed every visit, so places change each time; "Show more" keeps the same visit's order.
  - Check: with 1 real shop of 5 items plus examples from 4 shops, no two adjacent cards (row or column) share a shop at 360/390px; two visits give different orders; searching still returns plain results.
- **F15e. SYNC ringer at least 10 dB louder** (owner 2026-11-19: "The ringer on SYNC should be 10 dB louder minimum").
  - Measure first: record the integrated loudness (LUFS) and peak of today's ringtones (`assets/call-ringer.js`, `call-setup.js` `ringVolume`, the ringtone files).
  - Then: remaster each ringtone to at least +10 dB integrated loudness (target about −8 LUFS, true peak ≤ −0.5 dBTP so it doesn't clip), play it at full gain through Web Audio with a `DynamicsCompressorNode` limiter, default `ringVolume` to the maximum, and keep the vibration pattern. The incoming-call push notification (phone locked or app closed) uses the same louder file. The phone's own ringer volume still caps it; say so in "Test ringer" ("Turn up your phone's volume for the loudest ring").
  - Check: `test-ringer-loudness.cjs` measures each ringtone file (offline decode) and fails if it's not at least 10 dB louder than the old baseline recorded in the test, or if it clips.
  - Also seen in the same screenshot (call screen): the call buttons are text ("Mute", "Camera off", a "Hang Up" label that wraps over two lines). They become icons with labels under them, as in F15k.
- **F15k. The SYNC call screen looks like the phone's own messenger** (owner 2026-11-19, screenshot of a familiar messenger's voice call: "SYNC phone should open like this"; the screenshot shows a private person, so it is described here and not committed). Same layout, DanzStak colours:
  - **Background:** the member's SYNC chat wallpaper (F17), dimmed, behind everything; full screen with no page header or tab bar.
  - **Top:** left a round **minimise** button (shrinks the call to a floating bubble so the member can use DanzStak, tap to return); centre the other person's **name** and under it a small lock line **"Encrypted"** (say "End-to-end encrypted" only if a check proves the media path is end-to-end for that call; never claim more than is true); right a round **add person** button only once group calls exist (hidden until then).
  - **"SYNC Mobile"** (owner 2026-11-19: "comes up SYNC Mobile, then goes away when the user answers"): while the call is ringing or calling, the line under the name reads **SYNC Mobile** (like a messenger's "voice call" label); once the call is answered it is replaced by the running call time.
  - **Middle:** the other person's **big round profile photo** (about 55% of the width) while ringing and on voice calls, with "Ringing…", "Calling…" or the running call time under it; on video calls their video fills the screen and your camera sits in the draggable picture-in-picture.
  - **Bottom:** one rounded dark panel with **two rows of three equal round buttons (about 64px) with labels under them**: **Speaker · Video · Mute** / **More · Share · End** (End in red). Lucide icons; a pressed button shows a lighter fill. **More** opens a sheet with Text note (5a0), Keypad later, and Call alerts; **Share** shares something into the call (a photo, the band's EPK or a show card, never the phone number); **Video** turns the camera on or off.
  - Incoming calls use the same screen with **Decline** (red) and **Accept** (green) as the bottom row, and the ring from F15e.
  - Check at 320/360/390/430px: the six buttons are equal size in two rows with no wrapped labels, the photo is round and centred, nothing overlaps, every button is 44px or larger and works on a centre tap; the "End-to-end encrypted" text never appears unless the check proves it.

- **F15g. Town plan: in-stores and radio come with every booked gig** (owner 2026-11-19: "if you have these buttons you need to have the whole thing… the Booking Agent schedules the appearances, the Tour Manager makes sure they get there… if they can't get an interview, how much for ads"). Spec: `docs/tasks/41-town-plan.md`. When a gig is confirmed, the Booking Agent offers that town's record shops (in-store meet & greet) and radio stations (on-air interview; ad-rate quote as the fallback), sends artist-approved one-to-one requests (2 shops + 2 stations free per booked gig, more use a booking-email credit; owner 2026-11-19), tracks replies from SYNC, and the Tour Manager puts confirmed appearances on the day sheet with travel time, clash warnings and reminders. Music HQ gets In-stores and Radio next to Gigs; no HQ button may open an empty page.
- **F15h. News is back, with writers, photographers and member reviews** (owner 2026-11-19: "In the main Menu there is no News anymore… reviews from writers, show reviews and album reviews… writers from magazines and photographers… their reviews posted in the Mix on a rotating schedule… Add your review, for an album two pictures, for a concert a short video"). Spec: `docs/tasks/42-news-and-reviews.md`. Menu → News on phones (same page as the desktop RSS column) with tabs All · Show reviews · Album reviews · Photos · Headlines and a big **Add your review** (album: up to 2 photos; concert: one video ≤ 15 s or 2 photos; never audio); owner-approved Writer/Photographer badges; reviews rotate through the one-in-five Mix slots (F15d).
- **F15i. Scene news in Mix: booked gigs, in-stores and radio spots** (owner 2026-11-19: "when a band books a gig we should also post that in the Mix, one out of every five: congratulations to so-and-so, they booked a gig at … with the band's profile picture, where they booked it and the date, and that goes on the calendar… so users can see that the system actually works"; "when they booked a meet and greet or a radio show as well… such and such band will be at this record store at this time, on the radio at this time, with the locations: on 107.7 FM, or at Joe Blow's record store on Main Street").
  - **Cards** (one shared "scene news" card in the UI kit, ticket-stub style), generated by the server when a booking reaches **Confirmed**:
    - Gig: band avatar + "🎉 **{Band}** booked **{Venue}**, {City} · {Day, date}" → taps through to the gig/event page.
    - In-store (F15g): "**{Band}** at **{Record shop}**, {street}, {City} · {date} {time}" → the shop page and a map link.
    - Radio (F15g): "**{Band}** live on **{Station} {frequency}** · {date} {time}" (+ stream link if the station has one).
  - They take the **scene news** turn in the one-in-five Mix slot (F15d), newest first, people and scene you follow first, never the same band twice in a row; each card shows once per member.
  - **Calendar:** each confirmed gig, in-store and radio spot also appears in Events (that town) and the band's tour calendar (Tour Manager), with "Add to my calendar" (.ics).
  - **Band's say:** a per-booking toggle "Announce on DanzStak" (on by default, shown at confirmation) so a band can hold an announcement until the venue goes public; it never posts before Confirmed. Ad-rate quotes are never announced.
  - Check: confirming a gig with announce on → a scene news card in the slot rotation and an Events entry; announce off → neither; in-store and radio cards carry place, address/frequency, date and time.
- **F15j. Pivot button back in the top header** (owner 2026-11-19, screenshot of the Mix header: "the Pivot button has gone from the top header"). It was moved into the Menu on purpose in commit 7b7ba547 ("Pivot and Install move to the Menu"); the owner now wants it in the header again.
  - Put a compact Pivot icon button (Lucide `refresh-cw`/arrows in DanzStak orange, accessible name "Pivot your data") in the shared app bar (`assets/app-bar.js`) between Search and the bell, on every signed-in page; it opens the Pivot flow. The Search field shrinks to fit; all header targets stay 44px with no overflow at 320px. Keep the Menu entry too.
  - Check: the Pivot button is visible and tappable (centre tap) on Mix, HQ, Events, Bazaar and profile at 320/360/390/430px, opens Pivot, and the header doesn't overflow.
- **F16. SYNC installs as its own app, offered right after verification.** Owner 2026-11-19 (phone):
  - **Problem:** "When I save SYNC as standalone it does not save to my desktop." The app drawer shows no SYNC icon (`docs/screenshots/owner-reference/sync-not-installed-app-drawer-2026-11-19.png`).
  - **Wanted:** "When users verify their device it should also give the option there, right under the verification text: Save app to desktop."
  - **Root cause to confirm first:** SYNC shares the main app's scope and manifest, so Android treats it as the same installed PWA. #591 (`/sync/` scope + its own manifest/start_url/icons) is not merged yet. Land #591 in a train and verify on a real Android phone that a separate **SYNC** icon appears.
  - **Then:** the moment verification succeeds, a **pop-up** appears: "Save the SYNC app to your home screen", with **Save app** (the install prompt) and **Not now**. The owner says either works; do both. After "Not now", the same **"Add SYNC to home screen"** button stays directly under the "This device is verified" text. It uses SYNC's own `beforeinstallprompt`; iPhone shows the Share → Add to Home Screen steps. It is hidden once installed. Opening the icon goes straight to the chat list.
  - **Check:** the manifest scope and id differ from the main app; the button appears right after verification; the install prompt fires.
- **F17. SYNC wallpaper picker: the boxes are bigger than what's in them.** Owner 2026-11-19: "The box is bigger than the fill. See the mistakes." Screenshot: `docs/screenshots/owner-reference/sync-wallpaper-picker-danzstak-2026-11-19.png`.
  - Today: the wallpaper thumbnails don't fill their grid cells, and the selected tile shows two outlines (an orange ring on the thumbnail plus a grey box around a larger grey cell). The cells aren't even either.
  - Target:
    - a 3-column grid of identical 9:16 tiles that fill their cell edge to edge, with the label under each;
    - **one** selection ring that hugs the tile, plus a small check;
    - the "Your photo / Camera / Default" buttons as equal tiles of the same height;
    - colour swatches in one even row.
  - Check: every tile's image rect equals its cell rect, there is one selection ring, and there is no horizontal overflow at 320–430px.
  - Apply the same "fill = box" rule to every picker and grid (Tribe art, shop images, album covers).
- **F18. Tag people, tag a location, and Follow, visible everywhere.** Owner 2026-11-19: "I didn't see any tag or follows throughout the site: tag location & users."
  - Code exists in part (`assets/media-tags.js`, post `location`, the visitor menu Unfollow in #612), but none of it is visible or easy to reach.
  - **Composer** (Mix, profile, Tribe), the familiar row of icons under the text: **Photo/video · Tag people · Location · Feeling**.
    - **Tag people:** a search sheet of friends and members by name/@username, with chips you can remove.
    - **Location:** search a place or venue (the existing venue directory plus a free text city), never the member's GPS without asking.
  - **On the post:** "**Ana** is at **Bimbo's 365** with **Bo** and **2 others**" in the header line. Names and the place are links (profile / venue / city page). Tagged people get a notification and can remove their tag.
  - **Follow** (queue item 15: a friend is two-way, a follow is one-way). Artist, venue, shop and Tribe pages lead with **Follow**. Profiles show "N followers · N following" (F9). Following adds their posts to Mix chronologically, never ranked.
  - Privacy: the member chooses who can tag them (everyone / friends / nobody) in Settings, and a tag only shows after review if they pick "review tags".
  - Checks: tag a friend and a place in the composer, see both on the post, the tagged friend gets a notification, Follow/Unfollow works and the counts update.
- **F19. The picture box on a profile does something when tapped** (the band from F4). Owner 2026-11-19:
  - **Shop cover:** "When users put a store cover photo in the second image box on their profile it should open that user's store. That should be the store front." The picture links to the member's storefront: their Shop tab with the products, or the shop page.
  - **Any other photo**, e.g. their dog: "it should pop up to nothing more to see or something, but they can add a link to the photo if they wish, say to Bandcamp or somewhere."
    - When editing the box, the owner can add an optional **link** (https only; Bandcamp, SoundCloud, their site…). Tapping then opens that link in a new tab with a small "leaving DanzStak" note.
    - With no link (owner 2026-11-19: "F19 not full screen. Full box", then "it opens the image full screen and then users can close it… yes that works"): **in the profile the photo fills its whole box**, edge to edge with the saved focal point (F12), never letterboxed. **A tap opens it full screen** in the shared viewer (F1), and ✕, swipe down or system Back closes it and returns to the profile at the same spot.
  - Checks: shop cover → storefront; photo with link → the link; plain photo → fills its whole box in the profile, a tap opens it full screen, closing returns to the same spot; visitor and owner both.
- **F20. Tapping your own picture on the Dailies tile goes to your profile.** Owner 2026-11-19: "When I click the profile image on Dailies it goes to this page for some reason. It should go to my profile page."
  - Today it opens an old full-screen Daily (`docs/screenshots/owner-reference/dailies-own-tile-opened-wrong-2026-11-19.png`).
  - **Own tile:** tapping your picture → `profile.html`. Only the small "watch" area or the tile's media opens your own Dailies.
  - **Friend's tile:** the avatar/name → their profile; the media → their Dailies (F3/F15).
  - Check: tapping the centre of your own avatar on the tile lands on your profile.
- **F21. Shop storefront image: upload it in the shop, put it on the profile.** Owner 2026-11-19: "Need to add your store front image here somewhere where users can upload their image for their shop… confirm save to profile and put the image in the shop store front on their profile page… warn the user this will replace the second photo… and the link if they have one."
  - **Where:** the shop manager (`store.html`; reference `docs/screenshots/owner-reference/shop-manager-no-storefront-image-2026-11-19.png`). At the top, a **storefront image** area, the same box as the profile band (F4) with drag to fit (F12): upload from the phone, then preview.
  - **On save**, a confirm sheet: "Use this as your shop front on your profile? It will replace the photo on your profile (and its link)." with **Replace** / **Keep shop only**.
  - **Replace** sets the profile picture box to the storefront image, linked to the storefront (F19). **Keep shop only** saves it to the shop alone.
  - Restyle the rest of the shop manager to F8: no raw select, no paragraph-heavy "Get paid" box.
- **F22. Post photos: the frame is bigger than the image (black bars).** Owner 2026-11-19: "The box is bigger than the image. The box should scale to the smaller images." References: `docs/screenshots/owner-reference/post-photo-black-bars-2026-11-19.png` and `post-photo-black-bars-2-2026-11-19.png` (a landscape photo with more black than picture; the owner calls it "wasting pixels").
  - The media frame takes the **image's own aspect ratio** (from `naturalWidth/Height`, or stored dimensions so nothing jumps): full column width, height = width ÷ ratio, with no black bars above or below.
  - Very tall images are capped at about 1.25× the column width in height and cropped centred, or at the saved focal point (F12). Tap opens the full image (F1).
  - Same rule for videos (the poster ratio), the profile Photos grid previews and Tribe posts.
  - Check: for a landscape, a square and a portrait image, the frame rect equals the image rect at 320–430px.
- **F23. "Then / Now" before-and-after posts with a slider** (owner 2026-11-19: "an effect like this that does before and after with the slider going left and right… would be kind of cool"). Reference: `docs/screenshots/owner-reference/then-now-slider-reference-2026-11-19.png`. This is a new feature, so build it **after F1–F22**.
  - In the composer, pick **two photos** and add **Then / Now**, with an optional date for "Then" (prefilled from the photo's date).
  - **The slider is automated; users don't touch it** (owner: "a mix between 2 photos… the slider is automated, users don't touch the slider"). On the post, both photos sit in one frame and a divider with a round ⇄ badge **sweeps left and right on its own**: an easing loop of about 4 s, pausing a moment on each side, so viewers see the mix between the two. Labels "Then: Nov 19, 2018" and "Now" sit in the corners.
  - The loop plays only while the post is at least 50% visible, and stops (showing the split) with `prefers-reduced-motion` or data saver. A tap opens full screen (F1), with both photos side by side.
  - Same aspect rules as F22.
- **F24. Gift codes the owner hands out** (owner 2026-11-19: "I will need a couple AI Shop Manager, a few translations for SYNC and a few AI for EPK that I can distribute"). Needed before doors open.
  - The owner creates **single-use gift codes** for: **AI EPK** (one EPK), **AI Shop Manager** (the AI shop: setup + up to 10 listings), **SYNC Translation** (30 minutes), **AI profile** (owner 2026-11-19: "and 10 AI profile"). Each code grants exactly what the paid product grants, through the **same entitlement code path** the Stripe webhook uses (no second system), with `source: "gift"` and no charge.
  - **Owner-only creation:** an owner page (`ops.html` → Gift codes) for members in the Cognito group `danzstak-owner`, checked on the server. Pick product + how many (max 25 per batch) + expiry (default 60 days) → a list of codes and share links (`https://danzstak.com/?gift=CODE`) to copy or share.
  - **Redeem:** the link or Menu → **Redeem a code**, signed in. One code, one account, once. Codes are long and random (≥ 80 bits, readable alphabet), stored only as a keyed hash, rate-limited (10 tries/hour per account and per IP), and never logged in full.
  - **First batch (owner 2026-11-19: "10 of all 3"):** 10 AI EPK, 10 AI Shop Manager, 10 SYNC Translation and 10 AI profile codes (40 in all), ready for doors open (23 Dec).
  - The owner sees each code's status (unused / redeemed by @username on date / expired) and can cancel unused codes.
  - This is the owner's approved exception to "entitlements only from the Stripe webhook": gift entitlements only from an owner-created, hashed, single-use code. Update `test-payment-boundary.cjs` to allow exactly that and nothing else.
  - Checks: create 3 codes as owner; a non-owner gets 403; redeem one → the product unlocks; a second redeem of the same code fails; an expired or cancelled code fails; the code never appears in logs.
- **F25. Owner dashboards to monitor the site** (owner 2026-11-19: "I will also need dashboards so I can monitor the site"). Needed before doors open.
  - **Ops page** (`ops.html`, owner-only, server-checked, phone first, UI kit): today and 7 days for: new sign-ups against the 25-account cap and the waitlist; members active today; posts, photos, videos; Dailies and Roll counts; SYNC devices registered, texts sent (Twilio), calls; Tribes, events, shop listings; test-mode purchases by product; gift codes issued/redeemed; error reports from the app ("tell us what's broken" plus friendly-error counts); CDN cache hit rate. Counts only: no messages, phone numbers or private data. One Auth API route `GET /ops/summary` reads counters, never full-table scans on each load.
  - **CloudWatch dashboard `DanzStak-Live`** (in the templates, deployed by the owner in CloudShell): Lambda errors, duration p95, throttles and cold starts for the Auth API and call-signaling; API Gateway 4xx/5xx; DynamoDB throttles; CloudFront requests, cache hit rate, 4xx/5xx; SES bounces/complaints.
  - **Alarms → push and email to the owner** (SNS): 5xx above 1% for 5 minutes, any Lambda error spike, SES complaint rate, Twilio send failures, a sign-up surge.
  - Checks: the ops page renders at 360/390px with sample data; a non-owner gets 403; the template validates and names every alarm.
- **F26. Live checks Claude can run.** This cloud session can't reach `danzstak.com` (its network blocks the host), so the live tests run in GitHub Actions: a `live-check.yml` workflow (on a schedule every 30 minutes, after each push to main, and on demand) runs `scripts/verify-live-pwa.cjs` and the public browser checks against `https://danzstak.com` at 360/390px. It confirms the published service-worker version matches main, and uploads screenshots as artifacts. A failure opens or updates one GitHub issue "Live check failing" (the owner gets a push through F25's alarms).
- **The owner could do this on every page:** F8–F22 are examples of one standard. Apply it everywhere in the F8 pass, and write `docs/tasks/39-modern-look.md` with every screen listed before building.
- Then the **T2 sweep**, T3 and T4 (test-ready plan below).

### UI kit: Tailwind + Flowbite + Lucide + Fluent Emoji (owner 2026-11-19: "do it so it's not so HTML", "pick a dope look", "match all the web forms", "get an icon and emoji kit")
Every screen in the F8 pass and the G3 clean-up is rebuilt on this kit. **Rebuild one screen at a time and delete that screen's old CSS in the same PR**, so no screen has two styles fighting.
- **The kit** (all free and open source; pin exact versions; the files and licences are kept in `assets/vendor/`; nothing loads from a CDN, so CSP stays `'self'`):
  - **Tailwind CSS v4** (MIT) builds **one CSS file**, `assets/ds.css`. Add a root `package.json` with `@tailwindcss/cli` (dev only) and `npm run css`. **Commit the built `ds.css`** so Amplify publishes it as it is today (no Amplify build change). Add `test-ds-css-build.cjs`: rebuilding gives the same file as the one committed.
  - **Flowbite 3** (MIT, free version only, not Pro) for the pieces: bottom sheets/drawers, modals, tabs, dropdowns/⋯ menus, toasts, toggles, the datepicker and the file dropzone. Take its markup and classes; its JS goes in `assets/vendor/flowbite.min.js` only where a page uses it.
  - **Lucide** (ISC) icons: one SVG sprite, `assets/icons.svg`, with only the icons we use (`<svg><use href="assets/icons.svg#heart">`). Outline 1.75 stroke, 24px (20px in rows). It replaces every text-only button and mixed icon set. Each icon keeps an accessible name.
  - **Fluent Emoji** (MIT): self-hosted SVGs of only the emoji we use, in `assets/emoji/`. 3D style for the reaction bar, the Feeling picker and empty states; Flat style at 20px or smaller. Every device then sees the same emoji. Typed emoji in text stay the phone's own.
- **The look: "Backstage"** (dope, familiar, DanzStak). Tailwind's theme reads the existing `--ds-*` tokens (`assets/mobile-design-system.css`), so there is one source of colour:
  - **Day** (default): white content, `#F4F4F2` canvas, ink `#0B0B0C`, hazard orange `#FF5A1F` as the **only** accent (primary buttons, active tab, unread dot, focus ring); silver `#C9CCD1` hairlines. No stock social-network blue.
  - **Night** (follows the phone's dark mode, plus a switch in Settings): `#0B0B0C` ground, `#151517` surfaces, the same orange with a soft glow on the primary button.
  - **Type:** Archivo (body 15/22, titles 22–28 at 800 weight, width 110%); JetBrains Mono for small labels, times and counts (11–12px, uppercase, tracked). One type scale only.
  - **Shape:** primary buttons are pills (44px high); cards and sheets have 16px corners; avatars are round; media are square-cornered edge to edge. Hairlines, not boxes. Shadows only on things that float (sheets, menus, toasts).
  - **App bars:** frosted glass (`backdrop-blur`, 85% surface) and sticky. The bottom tab bar has Lucide icons, labels and an orange dot under the active tab.
  - **Motion:** 150 ms press scale (0.97) and fade; sheets slide up in 220 ms; skeleton shimmer instead of "Loading…". All motion is off with `prefers-reduced-motion`.
  - **Music-native touches** (the 20%): ticket-stub cards for shows, sleeve cards for releases, a laminate for the EPK, a mono "SCENE / TAKE" label style, and a subtle grain on covers.
- **Every web form matches** (owner: "match all the web forms"). One form component set, used everywhere (sign-up, profile edit, composer, Create event, shop manager, Booking, EPK, SYNC registration, Settings, checkout pop-ups):
  - floating-label text fields; a select replaced by a tap-to-pick sheet; a toggle switch instead of a checkbox for settings; radio rows as tappable list rows; the Flowbite datepicker plus native `type=date/time` on phones; a dropzone instead of "Choose File"; char counters; inline error text under the field (through `friendly-error.js` and i18n); one disabled style; 44px targets; a visible orange focus ring.
  - Check `browser-checks/forms-match.cjs`: it opens every page with a form at 320/360/390/430px in Day and Night and fails on any native-looking control (default `appearance`, browser-default border or button), any form field outside the shared classes, or a label overlapping its value.
- Write the full token table, the component list (app bar, tab bar, post, button, list row, sheet, form fields, cards) and the order the screens are rebuilt in `docs/tasks/39-modern-look.md` **before building**. Start with Notifications, then Create event, then the shop manager (they are the owner's worst examples), then the T2-walk order. Update `docs/DANZSTAK-DESIGN-SYSTEM.md` to point at the kit.

### Quality bar for Code (owner 2026-11-19: "tight code… make sure Code is doing quality work… effort is set to extra, so get Code to do extra… make it more Facebook-ish")
- **More familiar.** On every screen, compare against the owner's reference screenshots in `docs/screenshots/owner-reference/`: same places, same patterns, same density. Only the DanzStak colours, fonts, logo and music details differ. When in doubt, do it the way the familiar app does.
- **Tight code.**
  - One shared component per job, no copy-paste variants.
  - No `!important` stacking to win fights; fix the cause.
  - No dead code, no unused assets, no magic pixel offsets that aren't measured.
  - Every string goes through the translation layer: every word must be in the visitor's own language (owner 2026-11-16).
- **Extra effort on every PR.**
  - Read the spec and the owner's words twice.
  - Before opening the PR, review your own diff line by line.
  - Run the full suite and the touched browser checks at all four widths, and look at your own screenshots.
  - List what you did not verify.
  - A fix without a check that would have caught the bug is unfinished.
- **Security stays tight** (owner: data breaches are the main risk): least-privilege IAM, nothing secret in the repo, server-side permission checks for every Elder/owner control.

### Launch gates — "doors open" for 25 testers (owner 2026-11-19)
Owner: "When you make all the fixes I want you to open it for 25 accounts so we can test… I need all products working and tested."

Work through these in order. Each gate must pass before the next one starts.
- **G1. Code finishes the fix list** F0–F22 plus F24–F26 (gift codes, dashboards, live checks) and the CDN steps C1–C2. It tests each fix once (suite plus browser checks at 320/360/390/430px, tapping icon centres).
- **G2. Claude does two full sweeps from start to finish**, separately, on the live installed PWA at 360 and 390px:
  - **The route:** sign up as a new member → name/@username → SYNC device registration → Mix (Dailies, composer, post a photo and a video, The Roll, the full-screen viewer) → profile (every tab, edit, pictures repositioned) → Friends → Tribes (create, post, Elder tools) → Events (create one) → Bazaar (browse, product, checkout in test mode) → Music HQ (EPK build/publish, Booking pitch in test mode, Tour Manager) → SYNC (chat, call, ring, Text note) → Notifications → Menu → Settings / Your data (export) → Log out.
  - **On every screen:** every button is tapped and must work and land on the right screen, with no raw errors, no dead or duplicate buttons, and nothing that looks unfinished.
  - **Findings:** each problem goes into a new fix list (F16+) here. Code fixes them, then the sweep repeats.
- **G3. Code clean-up pass: new, working code, no old code.** Owner: "Have Code update the code so there is no old code; it should all be new and working code. If the old code is creating problems, overwrite it." Where an old layer causes bugs (stacked override CSS, duplicate handlers, legacy fallbacks, old screens behind flags), **replace it with one clean implementation** instead of patching on top. Keep behaviour that is covered by checks, and keep the checks passing. Remove broken or untranslated strings, half-finished screens, dead code and duplicate CSS and JS. Make one component per job: app bar, tab bar, post, button, sheet, list row, all on the UI kit (Tailwind + Flowbite + Lucide). Delete the old CSS files as each screen moves over. Delete unused assets. Code gets tight, not clunky. No behaviour changes without a check.
- **G4. Claude tests again before doors open.** One more full sweep (G2 route) plus the full suite and every browser check against the live site.
- **G5. Every page modern, every button works and goes to the right place** (the F8–F15 standard), confirmed screen by screen with before/after screenshots in `docs/screenshots/launch/`.
- **G6. Every product works and is tested end to end in Stripe Test Mode:**
  - single email, Starter/Club/Tour packs, AI EPK, AI redesign, AI profile, AI shop;
  - Tour Itinerary, contact unlock, translation packs, shop items, event tickets;
  - buyer pop-up with the all-in price, webhook entitlement, refunds under Terms 8A, unopened-pitch credit return.
  - Record each result in `docs/tasks/40-launch-check.md`. Live keys stay off until the owner approves.
- **G7. Doors open for 25 test accounts.**
  - Invite-only sign-up capped at **25 new accounts**: a server-side counter plus invite links from Menu → Invite friends.
  - Account 26 sees a friendly "Testing is full — join the waitlist" with an email field.
  - A "Beta — tell us what's broken" link in Menu.
  - `docs/TESTING.md` for testers.
  - The owner gets a push when doors open, and again at 10 and 25 accounts.

### Road to doors open: Christmas 2026 (owner 2026-11-19: "test this and test some more, I would like to open doors by Christmas. I will get a few users going.")
Target: **doors open (G7) on Wednesday 23 December 2026**, with two days of margin before Christmas. Each week ends with a release train, and Claude's two test passes run on it before the next week starts.
- **Week 1, 19–26 Nov:** **L1 live failure first**, then F1a, F4a–F4c, F15a–F15c, F15e, F15f, F15j and F15k (first, the owner's phone findings), F0 (CI green, flaky checks fixed at the root), F1–F7, C1–C2, F26 live checks.
- **Week 2, 27 Nov–3 Dec:** UI kit set up (Tailwind build, icons, emoji, forms), then F8 Notifications, F10 Create event, F21 shop manager, F9 profile and Friends.
- **Week 3, 4–10 Dec:** F15d Mix slots, F15g town plan, F15h News and reviews, F15i scene news, F11–F20, F22, F24 gift codes, F25 dashboards.
- **Week 4, 11–17 Dec:** G2 two full sweeps with grades; G3 clean-up; G6 every product in Stripe test mode (including redeeming each gift code).
- **Week 5, 18–22 Dec:** fixes from the sweeps; G4 final sweep; every screen and product graded A; G5 screenshots.
- **23 Dec:** G7 doors open for 25 accounts; the owner sends invites and the 40 gift codes.
- **F23 Then/Now** comes after doors open unless every other item is done early.
- **Owner jobs before doors open:** the Auth API and call-signaling deploys (CloudShell, numbered steps), fixing the Stripe test keys. Gift codes: 10 of each of the four kinds (decided 2026-11-19).
- If a week slips, Claude says so in the Builder log and to the owner the same day, with what moves. Doors never open on a grade below A.

### Grading: outstanding, not just passing (owner 2026-11-19)
Owner: "Everything we texted about is in there to do… make sure it's all checked and graded, not just passing but outstanding student material."

In every sweep (G2, G4), Claude grades **every screen and every product** in `docs/tasks/40-launch-check.md`, scoring 1–10 on each:
1. **Works:** every button does the right thing and lands on the right screen; no errors, no dead ends.
2. **Looks:** modern, matches the owner's reference standard (F8–F15); no default browser controls, no boxes in boxes, no clipped or overlapping text.
3. **Feels:** fast (CDN, first screen in under 2 s after the first visit); smooth motion; nothing jumps.
4. **Words:** scene-voice copy, no broken or untranslated strings, no instructions where an icon is enough.
5. **Reach:** 44px targets, readable contrast, keyboard and screen-reader labels; works at 320–430px and on desktop.

**Only an A passes: 9 or 10 in every category.** Anything below goes back to Code as a new F-item, with the grade, a screenshot and the reason. A test that passes on a screen graded below A is not done.

**Owner checklist (everything from the 2026-11-19 texts).** Each item must be graded A before doors open:
- About on one line; no + bio; name shown once (F14).
- Profile header with the name beside the avatar and the picture band below (F4).
- Pictures repositionable (F12).
- Full-screen photo/video viewer (F1).
- Roll sound carries over (F2).
- Dailies scrolling, rotating and bouncing (F3, F15).
- TAKE count and Dailies/Roll filled (done; verify).
- Bazaar mixed across shops, never the same shop in a row (F15f; the server half ships in C1).
- 720p photos (done); videos at 720p (C3).
- CDN speed (C1–C4).
- Notifications (F8), Profile and Friends (F9), Create event (F10), Music HQ dashboard (F11), Tribe page and Elder-only controls (F13).
- Every page modern (G5), every product tested (G6), 25 testers (G7).

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
- No infinite scroll of recycled or suggested posts; Mix loads older chronological posts by itself as you scroll (owner 2026-11-19, F15c) and ends with "you're caught up".
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
- **Shops and the Bazaar (owner, 2026-11-15).** There is no official DanzStak Store; the **DanzStak Bazaar** is the only commerce destination and it is its own main-menu category, not part of Music HQ. When a member lists an item in their profile shop, it appears in the Bazaar and once in Mix as a normal chronological post from that member (no boosting, no repeats, no paid placement). **Superseded 2026-11-17 (owner), then 2026-11-19 by F15d (one post in five, alternating with reviews):** at most every 4th post in Mix (fewer when there is not enough fresh, relevant stock; owner: "Facebook has way too many other posts") is a members' item, merch or ticket slot, clearly labelled, never paid, rotated fairly (nearby and followed first, then newer); the same item does not show again for 2 weeks; no slot when nothing relevant exists. Every slot is a different item, and each new session (sign-in, reopening the app, or reaching the end of Mix) rotates to the next items; tapping one opens the seller's shop at that item and Back returns to the same spot (owner 2026-11-18). Until there are enough members for categories, the Bazaar is every item on DanzStak in one fairly shuffled grid that reshuffles to unseen items each visit; tapping opens the seller's shop the same way. Musicians sell their merch and releases; fans sell their crafts; promoters create events and sell tickets. DanzStak keeps 6% of the item or ticket price ($1 minimum on orders under $30, Stripe fees included), never shipping.
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
4. **5a5 Bazaar item in the one-in-five Mix slot (after The Roll; F15d supersedes)** — task 23b. Server cursor in DynamoDB + Mix slot card ("For sale"), different seller/kind each slot, 2-week no-repeat, never paid; tap → seller's Shop tab with the product open; Back restores the spot.
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
4. **Bazaar item in the one-in-five Mix slot, after The Roll (F15d supersedes)**, a different item each time (queue 6e / task 23b). Never paid, never an ad.
5. **Shops need a real skin, not "straight HTML".** The profile Shop tab is the shop itself (done, PR #569); next: task 23 extras (chips, featured bundle, shipping table, all-in prices) and the product page.
6. **Your own photo everywhere you post from.** Composer avatars (Mix and profile) show the member's profile photo, never the DanzStak "D" or an empty circle.
7. **Done today:** Log out goes straight to the landing page; Tribe initials centred and Tribes can show their own picture; "+ bio" is the 5th profile icon; profile Shop tab; Bazaar has the Eroticon shop live; AI EPK builder ready as PR #567 (needs the Auth API deploy, then merge).

