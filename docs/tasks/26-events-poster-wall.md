# 26 — Events: a poster wall, and posting a show feels like making a flyer

Owner 2026-11-18 (phone screenshot of Events): "This just looks like another form to fill out for some boring gig. Need to make it look exciting for users to post their event and sell tickets on DanzStak."

Today Events is three plain headings stacked on a white page ("Events", "Shows coming up", "Post an event"), a raw browser **Choose File** button, a bare text box and a grey empty `<select>` for the start time. Nothing about it says *show*. Rebuild it as the place promoters and bands *want* to put their night up, in the DanzStak frame (the app bar and phone tabs stay exactly as they are). It's phone first: test at 320, 360, 375, 390, 414 and 430px. Punk, metal and electronic come first.

## 26-A The page: a poster wall, not a list

- [ ] **Top of Events = the wall.** Upcoming shows are flyers in a 2-column wall on phones (3–4 on desktop), with the flyer filling each tile edge to edge at its own aspect ratio, never stretched. Masonry or a fixed 4:5 crop with `object-fit:cover`. Flyer videos (≤15 s) play muted when they're at least 50% visible, under the same autoplay rules as Mix.
- [ ] Each tile gets a **ticket-stub strip** under the flyer. The strip has a perforated edge (dashed line plus two half-circle notches), the **date block** (big day number and a mono month/weekday), the event name (2 lines max), venue · city, and the price or **"Tickets"**, **"Free"** or **"Sold out"** in the accent color. Tapping a tile opens the event page. Tapping the flyer opens it full screen, like all media.
- [ ] **Filter chips** sit above the wall, scrolling sideways: **Near me · This weekend · Punk · Metal · Techno/Electronic · Free · Friends going**. Order is chronological (soonest first) with no ranking. Near me uses only the city the member chose, never GPS without asking.
- [ ] **"Friends going"** shows on a tile as 2–3 tiny overlapping avatars plus "+N". It's a count only and never a nudge.
- [ ] **Empty wall:** instead of the grey line "No shows posted yet", show a wall of 4 **blank poster frames** (torn-paper/wheat-paste look, tape corners, in the genre look). They read **"YOUR SHOW HERE"**, then **"DOORS 9PM"**, **"ALL AGES"** and **"NO COVER"** in a stencil or display face. One button over them: **Put up a flyer**.
- [ ] **One primary action:** a round orange **+** floats bottom-right above the phone tabs (44px or more, accessible name "Post a show"). On desktop it's a **Post a show** button in the page header. The long form is **not** on the page anymore.

## 26-B Posting a show = making the flyer (full screen, 4 quick steps)

It opens full screen with its own top bar (✕ close · "New show" · step dots), keeps the draft if the member leaves, and Back goes back one step. **The live preview is the poster itself:** what they type appears on the flyer as they type it.

1. [ ] **Flyer.** A big dashed drop zone filling about 70% of the screen with a poster icon reads **"Drop your flyer"** and, smaller, "or a video, 15 seconds max". It uses a hidden `<input type=file accept="image/*,video/*">` behind a styled button, so there's **never a raw Choose File button**. Once picked, the flyer fills the preview. Videos over 15 s get a trim prompt (or a plain error if trimming isn't built yet). No audio files, ever. **No flyer?** Then **"Make one for me"**: pick a genre look (Techno / Punk / Metal / House) and DanzStak renders a type-only poster from the event's name, date and venue, which the member can replace later.
2. [ ] **What · when · where.** The fields sit **under the live flyer**, and the event name echoes onto the flyer's ticket stub as it's typed.
   - Event name, with the placeholder **"Name the night"**.
   - **Date and doors time**, using the phone's native date and time pickers (`<input type=date>` / `type=time`), shown as two big tappable ticket-style chips ("FRI 13 DEC" · "DOORS 9:00 PM"). **No empty grey `<select>`.** End time is optional.
   - **Venue.** Search the venue directory (name + city). If it's not listed, type it in. Address and city fill from the directory.
   - **Lineup**, as chips. Type @username to tag DanzStak artists, who get notified and the show appears on their EPK and tour, or type plain names. Age: All ages / 18+ / 21+ chips. Genre chips.
   - Optional short description (3 lines).
3. [ ] **Tickets.** Three big choice cards, each with an icon and one line:
   - **Sell on DanzStak**: price (per tier if assigned seating, see CLAUDE.md "Seating"), capacity, and the **buyer's all-in price shown live** on a ticket stub ("$20 ticket → buyer pays $21.20, you get $20"; the 6% buyer fee plus $1 under $30 comes from `docs/tasks/12-buyer-paid-fees.md`, so never hardcode it twice). There's a **Named tickets** switch (on by default, explained in one line). There's also a delivery choice: QR + plain-text email (default), plus a printable door list.
   - **Link my tickets**: an https link only (Eventbrite, Resident Advisor…). DanzStak takes no cut, and the composer says so in one line.
   - **Free / pay at the door**: an optional door price.
   - Ticket sales need the promoter's payout account, so if it isn't connected yet, this step says so plainly and the show can still be posted with tickets "coming soon". **Stripe stays in Test Mode** until the owner approves live.
4. [ ] **Preview & put it up.** This is the full event page exactly as members will see it (flyer, ticket stub, lineup, map pin, Tickets button). There's one big orange button, **Put it up**, and a quieter **Save draft**. After posting there's a short celebratory moment (the flyer "slaps" onto the wall with a 150 ms paper-stick animation, respecting reduced motion), then the **Share sheet** (task 17) opens with the event's short link, QR code and "Post to Mix" (one chronological post, no boosting).

## 26-C The event page

- [ ] The flyer is full width at the top, with a **sticky ticket bar** at the bottom on phones showing the price, **Get tickets** (or **Tickets ↗** for outside links) and "Sold out" / "Free" states.
- [ ] Below it, the **ticket-stub info block**: date and doors, venue with map pin, lineup chips (each linking to the artist's profile or EPK), age and genre, and the description.
- [ ] **Going / Interested** (counts only, friends' avatars first). **Add to calendar** (.ics). **Share**.
- [ ] Below that, the town plan if a band booked through DanzStak (record-shop in-store, radio interview), from `03-town-plan.md`.
- [ ] Promoter view: **Edit**, **Door list** (printable and phone; named tickets show the legal names), sales so far, **Cancel show** (refunds to buyers per Terms 8B).

## Look

- [ ] Use the genre look tokens from CLAUDE.md (Techno default, Punk, Metal, House). The wall shows each flyer as is. The stub strip and composer chrome use the poster's chosen look. One accent per look, contrast 4.5:1 or better.
- [ ] Use display type for dates and names (Archivo 900 or the look's display face) and mono for the small labels (DOORS · AGES · TIX). Use paper and texture details (perforations, tape, a slight rotate of ±0.5° on empty frames only), never stock form styling. Keep the hairline-and-fluid page rule: no boxes inside boxes.
- [ ] Remove the three plain section headings. The page title lives in the app bar, so no extra "Events" H1 is visible on phones (keep it visually hidden for screen readers).

## Tests

- [ ] `test-events-poster-wall.cjs`:
  - no raw `type=file` is visible (the input is hidden behind a styled control);
  - no empty `<select>` is used for the date or time;
  - the empty wall renders the 4 poster frames;
  - the FAB has an accessible name and is at least 44px;
  - the composer has 4 steps and keeps its draft on close/reopen;
  - the all-in price matches `12-buyer-paid-fees.md` for $5, $20 and $35;
  - an outside link must be https;
  - videos over 15 s are refused;
  - audio files are refused.
- [ ] Browser check at 360px: the empty wall, the composer at each step, the event page with the sticky ticket bar, and no horizontal overflow.
