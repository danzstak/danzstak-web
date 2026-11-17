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

## From the walkthrough (owner's Claude adds below)
