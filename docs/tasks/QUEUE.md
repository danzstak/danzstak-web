# DanzStak build queue

**Claude Code:** read this file at the start of every session and after every PR you open.
1. Take the **first** item whose status is `TODO`, set it to `IN PROGRESS (Claude Code)`, and commit that change on your branch.
2. Build it as described in its spec, open the PR against main, and set the status to `PR #<n>`. **Don't merge or deploy.**
3. Add one line to the top of the **Builder log** in CLAUDE.md (time · item · PR · blocked · "Next: …"), then go on to the next `TODO`.
4. If a PR of yours shows conflicts with main, rebase it first. Use `node scripts/bump-versions.cjs` for version clashes and take the higher number.

**Owner's Claude (review/deploy):** reviews each PR, merges it, deploys it (Auth API Lambdas; CloudFormation change sets for call-signaling), tests it live, then sets the status to `DONE (date)`. It adds new owner requests to this queue, in priority order.

The owner should never have to paste prompts: everything Claude Code needs is in this file and the specs it links.


> **StakGuard is ON HOLD (owner 2026-11-18)** until the owner works out the legal side. Skip any StakGuard work; don't merge StakGuard PRs; keep StakGuard screens hidden.

| # | Item | Spec | Status |
|---|------|------|--------|
| 1 | SYNC texts via Twilio Verify | CLAUDE.md "SYNC SMS provider decision" | DONE (2026-11-17, #402 + ttl fix) |
| 2 | People search: name + @username, placeholder accounts named first, search on every page | CLAUDE.md signup rule | DONE (2026-11-17, #409, call-signaling deployed) |
| 3 | One phone verification across the same person's accounts (up to 10) | owner 2026-11-17 | PR #405 (merged) |
| 4 | (Owner 2026-11-17: a two-device **video call worked well** — Chrome/computer ↔ phone. Keep it working.) SYNC 16-A: native shell + layout (messages scroll under the header, nothing cut off, keyboard) | 16 | PR #411 + #413 |
| 5 | SYNC 16-C: button system, SYNC first, then site-wide (no "HTML-looking" buttons) | 16 | PR #423 (SYNC), site sweep #455 → #464 |
| CDN | **Owner 2026-11-19 (do first): "build the CDN" — media takes ~10 s with one user.** CloudFront in front of the media bucket (OAC, trusted key group), cacheable signed URLs (fixed expiry window, same URL → browser/edge cache), CSP + service-worker cache, faster `/stories` (no full Scan, no Cognito per author), Lambdas 1024 MB. One PR per step 1–4; owner session makes the key pair and deploys. | 38 | Steps 1–2 DONE (#622, deployed 2026-11-19: dk7kawr758jtd.cloudfront.net); step 3 PR (build/cdn-step3); step 4 TODO |
| T | **TEST-READY FIRST (owner 2026-11-19):** CLAUDE.md "Plan: test-ready for the owner and friends" T1 finish open PRs → T2 works-and-looks-good sweep in the installed PWA → T3 SYNC own-app pop-up after device registration → T4 invite testers + docs/TESTING.md. No new features until T1–T3 are done. | CLAUDE.md test-ready plan | TODO |
| T0-E1 | **Mix Comment icon does nothing when tapped** (`feed.html` ~1705 uses `event.target.classList.contains`; use `closest`) + grep for the same pattern site-wide | 36 E1 | MERGED #604 |
| T0-SHOP | **Owner 2026-11-19:** shop cover photo uploaded from the phone (not only an http link), a shop album every shop gets, product photos from the phone | owner | PR (build/shop-photos); needs the Auth API deploy |
| T0-A1 | **Owner bug:** posted video not in Dailies/The Roll → automatic from every composer (server-side), remove opt-in checkboxes, backfill | 36 | MERGED #602 (owner: deploy Auth API) |
| T0-A2 | **Owner bug:** Dailies tile opens the photo picker; only your own big profile picture edits; every other avatar opens that profile | 36 | Dailies tile: PR #606; avatars: PR #598 |
| T0-A3 | **Owner bug:** The Roll full screen loses sound (carry the sound choice over) + fill the screen | 36 | TODO |
| T0-A11 | ~~+ bio opens the long-bio editor~~ Owner (later 2026-11-19): no + bio button at all; Edit profile owner-only; Edit · Shop · Share row | 36 | MERGED #600 |
| T0-A12 | **Owner:** remove @username under the profile name; friends row there; tap a friend's photo → their posts | 36, 5a3 | PR #600 (@username hidden) + PR #572 (facepile, needs `/friends/of` deploy) |
| T0-A13 | **Owner:** shop storefront beside the profile picture (shop name + item preview + price → Shop tab), replaces the shop icon button | 36 | MERGED #599 |
| T0-A4 | Saved page crash (`volatilePostPreferences` used before declared) | 36 | PR #607 |
| T0-A5 | Record Stores crash + endless loading | 36 | PR #607 |
| T0-A6 | Shop manager shows a raw JS error; shared friendly-error helper; Save shop feedback (+ E2 Trusted contacts raw error, E4 Events/Support/Shop silent forms) | 36 | PR #608 |
| T0-E8 | Remove "Tap your name to change it" and the tap-name-to-edit path; Edit button is the only way in (C3) | 36 E8 | PR (build/edit-profile-one-way) |
| T0-E9 | One Photo/video button in the profile and Mix composers (no duplicate media buttons) | 36 E9 | Profile composer: PR (build/edit-profile-one-way). Mix keeps Photo + Video (different file filters and size limits, not duplicates) |
| T0-E10 | Visitor profile: Friends ▾ (Unfriend/Unfollow) instead of a dead disabled button; Add friend → Cancel request | 36 E10 | PR #612; Cancel request needs a server route (later) |
| T0-A7 | Booking Example / Find clubs dead; Leaflet served locally | 36 | Re-checked 2026-11-19: Example works (crawler could not see the textarea value), empty Find clubs uses the native required bubble, the map shows a message if Leaflet cannot load. Left: ship Leaflet in assets/vendor/ (this cloud session cannot download packages) |
| T0-A8 | Tribes: Elder sees Join; open on Your Tribes | 36 | PR (build/tribes-elder-join) |
| T0-A9 | Mix composer avatar opens your profile | 36 | PR (build/tribes-elder-join) |
| T0-A10 | Menu → Photos/Videos show only your media (with 5a2) | 36 | TODO |
| T0-B1 | One app bar on every page | 36 | TODO |
| T0-B2 | One bottom tab bar, correct lit tab, on every signed-in page | 36 | TODO |
| T0-B3 | One font set | 36 | TODO |
| T0-B4 | One post component (Mix's) on Profile/Tribes/Saved | 36 | TODO |
| T0-B5 | Your photo instead of "N" on your posts and composer | 36 | TODO |
| T0-B6 | One button system (orange primary) | 36 | TODO |
| T0-C1 | Tour Manager: no paywall | 36 | TODO |
| T0-C2 | Tour Manager: never re-ask EPK info | 36 | TODO |
| T0-B7 | Styled switches/selects/date/file pickers | 36 | TODO |
| T0-B8 | Fluid pages: Tour Manager, Support, Settings, HQ | 36 | TODO |
| T0-B9 | Landing page in DanzStak style | 36 | TODO |
| T0-B10 | Bazaar images fill tiles; one search | 36 | TODO |
| T0-CD | Small fixes C3–C5, D1–D7 | 36 | TODO |
| T2a | Tap any profile picture → that member's profile | CLAUDE.md "T2 checklist", 18 | TODO |
| T2b | No separate Dailies upload (Dailies tile never opens the photo picker) | CLAUDE.md "T2 checklist", 18 | TODO |
| T2c | TAKE N counts photos and videos | CLAUDE.md "T2 checklist", 18 | TODO |
| T2d | Videos tab: poster frame, full avatar, readable dates | CLAUDE.md "T2 checklist", 18 | TODO |
| T2e | Media fills the column edge to edge everywhere | CLAUDE.md "T2 checklist", 18 | TODO |
| T2f | Events: "Post an event" as its own screen (reuse #486) | CLAUDE.md "T2 checklist", 18 | TODO |
| T2g | Bazaar: one search, Bazaar / My Shop tabs, one-line empty state | CLAUDE.md "T2 checklist", 18 | TODO |
| T2h | Menu = full-screen grid with Radio stations | CLAUDE.md "T2 checklist", 18 | TODO |
| T2i | Radio stations directory page (empty state + Suggest a station) | CLAUDE.md "T2 checklist", 18 | TODO |
| T2j | Share sheet tidy (until 5a8) | CLAUDE.md "T2 checklist", 18 | TODO |
| T2k | Site-wide 16-C buttons outside SYNC | CLAUDE.md "T2 checklist", 18 | TODO |
| T2l | About tab = one fluid page | CLAUDE.md "T2 checklist", 18 | TODO |
| T2m | SYNC (DS) number at the top of the device window | CLAUDE.md "T2 checklist", 18 | TODO |
| T2n | SYNC chat list instant from a copy kept on the phone (owner approved 2026-11-19; cleared on Log out / account switch) | CLAUDE.md "T2 checklist", 18 | TODO |
| T2o | Plan only: bundle step → write docs/tasks/35-bundle-step.md | CLAUDE.md "T2 checklist", 18 | TODO |
| T2p | Plan only: Open Graph share previews (task 17) | CLAUDE.md "T2 checklist", 18 | TODO |
| 5a00 | **Incoming SYNC calls must ring** (owner 2026-11-18 phone test: calls connect, no ringer). Foreground ringtone via `<audio>` + vibration with audio unlock, background push that rings/vibrates and re-notifies while ringing, "Test ringer" row, call-alerts prompt | 31 | PR #578 (foreground ring + vibration + tap prompt + Test ringer; server re-notify while ringing still TODO) |
| 5a0 | **Text button in SYNC calls (owner 2026-11-18, do first):** 5th button in the call controls opens a text box; Send shows the note over the other person's video until they close it (existing WebRTC data channel, no server) | 30 | PR #585 |
| 5a03 | **"Get SYNC as its own app" installs a SYNC icon on the home screen** (own `/sync/` scope so Android installs it next to DanzStak) | 34 | TODO |
| 5a04 | **Tribe creation + Elder setup like Facebook Groups** (setup screen with live preview, Public/Private + Visible/Hidden, invite friends, Create → Elder, setup checklist, rules/questions/moderation; 5 PRs per the design's build order) | 29a (+29) | Step 1 PR #586 (create screen); steps 2–5 TODO |
| 5a01 | **Share a phone photo to DanzStak** (Android Share menu → DanzStak → composer with the photo attached; Web Share Target) | 32 | TODO — WIP branch `build/share-target` to finish |
| 5a02 | **SYNC auto-translate messages** (setting off by default; incoming messages shown in your language with "Show original"; Amazon Translate via Auth API, fail-closed) | 33 | TODO |
| 5a1 | **Owner 2026-11-18 evening (top priority):** tap a video or photo anywhere → full screen, media only (no post text), swipe **vertically (up/down)** through **that member's** videos or photos (owner correction 2026-11-19); Back returns to the same spot in Mix/profile. Same viewer for Mix, profiles, Dailies, The Roll. | 18 ("Tap any photo or video anywhere"), CLAUDE.md "Owner directives 2026-11-18 (evening)" | TODO |
| 5a2 | **Owner 2026-11-18 evening:** profile **Photos** and **Videos** tabs are media-only grids with **named albums** (concert, date, someone's wedding…): create/rename/visibility, upload many at once, choose which also get posted. Frontend first, then the album API. | 18 ("Profile Photos tab", "Profile Videos tab") | PR #575 (albums: create/edit/visibility, upload many, cover, remove; stacked on #552; needs Auth API deploy. Part 2 TODO: choose which uploads also post to Mix) |
| 5a3 | **Owner 2026-11-18 evening:** Facebook-style **friends row** under the profile name (small overlapping friend photos + "N friends" / "Friends with things in common"); tap → Friends · Following · Things in common; tapping a friend's photo opens that friend's profile. | 18 ("Friends row under the profile header") | TODO |
| 5a5 | **Bazaar item every 4th post in Mix, after The Roll** (server cursor + Mix slot card; see CLAUDE.md "Plan (Claude, 2026-11-18 night)" step 4) | 23b | TODO |
| 5a6 | **Shop skin part 2 + product page** (task 23 items 2–7, product page with the 5a1 viewer; seller fields in `marketplace.mjs`) | 23, CLAUDE.md plan step 5 | TODO |
| 5a7 | **Dailies horizontal swipe (left/right, like stories) + The Roll carousel in Mix (Roll video full screen swipes up/down like Reels)** (owner 2026-11-19) | 18 ("Full-screen Dailies viewer") | TODO |
| 5a8 | **Share sheet rebuild** (one bottom sheet, 16-C buttons, every page) | 18 ("Share post box"), 17 | TODO |
| 5a9 | **Tribes like Facebook Groups** (directory cards, Tribe page with cover, members row, Join/Invite, tabs Discussion · Featured · Members · Events · Media · About, Elder tools, private join requests; see CLAUDE.md plan step 8) | 29 | TODO |
| 5a4 | Profile composer shows the member's own photo, never "D" | owner 2026-11-18 | PR #570 (merged) |
| 5b | **NEXT (owner 2026-11-18: "still no AI-assisted EPK") — AI EPK builder** via the Anthropic API (AWS Bedrock is on hold for this account, with every model throttled). Build `ai-epk.mjs` with the `llm` provider = Anthropic Messages API (plain fetch, model `claude-haiku-4-5` for extraction and Sonnet for writing), key read from Secrets Manager `danzstak/ai/anthropic-key` (JSON `{"apiKey": "..."}`, us-west-1; the auth API role may read only that secret). Fail-closed: with no key, the "Let AI build it" choice says "AI builder coming soon" and nothing is charged. Keep the provider swappable (Bedrock later). Everything else as in the spec: Stripe Test Mode only. | 08 | PR #522 + #525 + #527, combined as **PR #567** (needs Auth API deploy, then merge) |
| 5b2 | (owner 2026-11-18: "Edit profile should have AI-assisted profile $5" — build right after the AI EPK, same provider) **AI profile** and **AI shop** ($5 + fees = $6.30 each; shop covers setup + up to 10 listings), then the other AI helpers behind flags (pitch, event post, town plan). Shop Manager AI for big catalogs waits for a price. | 19 | AI profile PR #542, AI shop PR #549 (other helpers TODO) |
| 5c | **EPK → Booking → Tour Manager, no repeats** (booking stops re-asking for EPK info; AI only in the EPK; credits/packs only in Booking; Tour Manager opens after pitches go out with a calendar and straight-line routing, criss-cross warnings and date-ask suggestions) | 25 | PR #550, #553, #554 (rest TODO) |
| 6 | **Fix-it pass:** work through `docs/tasks/18-fix-it.md` top to bottom (broken or unfinished-looking screens found by the owner's Claude in phone-size walkthroughs). One PR per screen or small group; tick each item with its PR number. The owner's Claude keeps adding to that file. | 18 | TODO |
| 6b | **Verify the artist before the EPK goes public or pitches** (anti-impersonation; owner 2026-11-17) | 20 | PR #559 |
| 6c | **Example shops** (fan, band, record shop) that show members how theirs should look, with the Discogs import walkthrough; Moving Day also accepts the Discogs collection export (set prices before moving) | 22 | PR #560 (WIP) |
| 6d | **Shop tab + product page polish** (model: Eroticon shop): the template every band, fan and record shop gets — shop header, free-extra box, category chips, featured bundle, 2-column grid with all-in prices and seller badges, shipping table; frontend first, then `marketplace.mjs` fields. **Brief incomplete: waiting for the rest of item 7 and the product page section.** | 23 | TODO |
| 6e | **Mix item slot + Bazaar rotation** (after 23): server-side per-member cursor of shown items (DynamoDB), fair order, 2-week no-repeat, rotate on new session / app reopen / end-of-feed refresh; every 4th Mix post (owner setting) one "For sale"/"Tickets" card, different seller and kind, skipped when nothing fits, never paid; Bazaar one mixed grid reshuffled to unseen items, finite pages, categories behind an owner flag; tap → seller's Shop tab at that product, Back restores the scroll spot. Payments stay in TEST mode. | 23b (+14) | TODO |
| 7c | **Moving Day for shops**: free CSV import of a shop's own Discogs/eBay/web-store inventory export, preview, select, batch price/shipping, publish (task 19, last section) | 19 | TODO |
| 8 | **AI promoter reader** (14-A) on the same Anthropic provider and secret: reads the public promoter pages Brave finds and keeps real promoters, crews and booking contacts with sources. Fail-closed without a key (today's keyword filter stays). | 14 | TODO |
| 9 | Rebase hometown skins #394 → #398 → #399 and Events #389 onto main | 15, 14-D | TODO |
| 9b | **Live translation in calls** (captions first, spoken later; consent from both; Translation packs 30 min $5 (+fees $6.30) or 180 min $30 (+fees $31.80), calls free, Stripe Test Mode) — only after the SYNC fixes and a passing two-device call test | 21 | TODO |
| 10 | SYNC 16-B / 16-B2 / 16-B3: wallpaper, ringtones, "set up this phone" after registration with an invite link | 16 | 16-B3 starter PR #448, 16-B PR #458, 16-B2 PR #462 |
| 11 | SYNC 16-F: lock-screen push for messages, calls, booking replies and "venue opened your EPK" | 16 | PR #465 |
| 12 | SYNC 16-D ticks/typing/presence, then 16-E reply/forward/edit/delete | 16 | 16-D PR #467, 16-E PR #472 |
| 12b | **SYNC contacts + "SYNC up" invites** (phone contact picker on Android, opt-in number matching, invite links that land in a chat with the inviter, group invite links) | 24 | TODO |
| 13 | SYNC 16-H: Make it yours | 16 | Part 1 (look, sound and feel, previews, reactions) PR #474; part 2 (contacts, SYNC profile/status, SYNC lock, disappearing messages) TODO |
| 14 | Share everywhere with tracked links (replaces the current share UI) | 17 | TODO |
| 15 | Follow alongside Friends | owner 2026-11-17 (Friend = two-way, Follow = one-way; artist pages lead with Follow) | TODO |
| 16 | SYNC 16-G: standalone launch | 16 | PR #477 |
| 17 | **Answer to join:** SYNC call invites — a non-member opens the link, taps Answer, signs up, verifies the phone by SMS and the call connects; signing up for SYNC makes them a DanzStak member and SYNC-first members land in SYNC (owner 2026-11-18). Owner approved 2026-11-18 (option A: email + password for now; passwordless later). | 24 | PR #492 |

**Order (owner 2026-11-17):** make what exists work and look finished before adding features: SYNC layout, buttons and the fix-it list come before the AI builder and new features.

**Parked (don't touch unless the owner moves them up):** fees PRs #363–#370 and #352/#359 (older work needing the owner's review), the legacy `codex/*` PRs, and Bedrock itself (AWS quota hold; the AI features now use the Anthropic API instead).

**Ready (2026-11-17):** the Anthropic API key is stored in Secrets Manager `danzstak/ai/anthropic-key` (us-west-1, JSON `{"apiKey": ...}`), and a live test call to `claude-haiku-4-5` answered. The auth API role can read it through the attached managed policy `DanzStakAnthropicKeyRead`, because the role's inline policy is at its 10 KB size limit, so add new permissions as managed policies, not inline. Items 7 and 8 can use it.

**Payments are in TEST mode (owner, 2026-11-17).** The Auth API and Tour Manager Lambdas were found on the LIVE Stripe key with live payments on; on the owner's word they were switched to the test secrets (`danzstak/stripe/secret-key`, `webhook-secret`, `sync-network-webhook-secret`) and `TOUR_MANAGER_LIVE_PAYMENTS=false`. Open issue: that test key belongs to the separate sandbox "DanzStak Test" (a different account id), while the code's test price IDs and `STRIPE_EXPECTED_ACCOUNT_ID` belong to the main account's test mode, so checkouts answer 503 "not connected to the approved Stripe account" (safe: nothing can be charged). Fix: the owner puts the **main DanzStak account's test-mode secret key** (and its test webhook secrets) into those secrets, or the products are recreated in the sandbox and the expected account id points there. Owner's Claude decides with the owner.

**Before going live (owner, 2026-11-17): test every paid product end to end in test mode** — single email, Starter/Club/Tour packs, AI EPK, AI redesign, AI profile, AI shop, Tour Itinerary, contact unlock, translation packs (30/180 min), DS number, StakGuard month, shop items and event tickets (buyer, seller payout hold, refund, dispute), refunds under Terms 8A, unopened-pitch credit returns, and the all-in price shown before every checkout. Only after a clean pass does the owner approve live keys.

**Blocked on the owner:**
- AWS support case: Bedrock quotas at 0, and SMS sandbox / Notify rejected.

- ~~Twilio upgrade from Trial~~ done by the owner (2026-11-19).
