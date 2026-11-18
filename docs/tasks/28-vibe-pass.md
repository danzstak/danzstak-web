# 28 — Vibe pass: hipper than Facebook

Owner 2026-11-18: "The site needs to be hipper than FB."

Keep the 80% familiar layout (people must find everything on day one). Make the 20% unmistakably DanzStak, so it feels like a flyer wall and a record shop, not a corporate feed. One token set, applied everywhere, phone first. No change to where things are.

## Type and texture
- [ ] **Display type with attitude**: Archivo 900 at 125% width for names, headings and numbers. JetBrains Mono for small labels (dates, counts, "DOORS", "TAKE 3"). Body stays plain and readable.
- [ ] **A little grain**: a very light paper or noise texture on page grounds (CSS, under 2 KB, off with reduced motion and data saver). Hairline rules instead of boxes.
- [ ] **Stickers, not buttons, for moments**: "NEW", "JUST OPENED", "SOLD OUT", "TONIGHT" as slightly rotated (±2°) sticker badges in the accent. Never on navigation.

## Music-native cards in Mix (the 20%)
- [ ] Shows are **ticket stubs** (perforated edge, big date block). Releases are **record sleeves** (square art, spine strip, cat#). EPK shares are **backstage laminates** (lanyard hole, ALL ACCESS strip). Shop items are **price-gun tags**. The Dailies clapper and set-call film strip stay.
- [ ] **Now playing** strip on a post with a SoundCloud/Bandcamp/YouTube link: a small spinning vinyl and the track title. It stops spinning with reduced motion.

## Motion that feels alive (short, never in the way)
- [ ] Reactions pop (120 ms scale), the like icon does a tiny "needle drop" bounce, a new post slides in like a flyer being pasted, the Grand opening card "slaps" on. All 150 ms or less, all off with `prefers-reduced-motion`.
- [ ] Pull-to-refresh is a **record spinning up**. The empty and end states use scene copy: "You're caught up. Go to a show." (with the next show near you).

## Copy that speaks like the scene
- [ ] Replace corporate words site-wide: "Post" → "Drop it", "Share" stays, "Friends" stays (familiar), empty states and errors in plain scene voice. No exclamation-mark spam, no growth-hack nudges.

## Genre looks reach the people
- [ ] A member's profile header, their shop and their EPK wear their genre look (Techno, Punk, Metal, House) plus their hometown skin. The platform frame stays DanzStak. Their posts in Mix get a 3px left edge in their look's accent, so you can feel the scene as you scroll.

## Rules
- [ ] Contrast 4.5:1 or better, 44px targets, light only (no dark mode until it's designed and tested), no infinite scroll, no engagement bait.
- [ ] Test: a token check (one accent per look, contrast), a reduced-motion check (no animation), and 360px screenshots of Mix, a profile, a shop and SYNC before and after.
