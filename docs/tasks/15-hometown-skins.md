# Task 15 — Hometown skins for the EPK and the Tour Manager

Owner, 2026-11-17: "make the themes of the EPK like the user's hometown … the skin … and the skin of the tour manager like their hometown vibe."

Read `CLAUDE.md`, `docs/DANZSTAK-DESIGN-SYSTEM.md` and `docs/QUALITY-ASSURANCE-POLICY.md` first. Plan before code; one PR per part (15-A, 15-B, 15-C). Fax the room before every PR.

## The idea

A band from Tacoma should open its EPK and feel the Puget Sound: wet grey-green, mill steam, rain on the van windshield. A Bologna act gets portico terracotta and ochre. The look says where the band comes from before anyone reads a word.

The existing **genre look** (Techno, Punk, Metal, House in `assets/epk-looks.css`) still sets the type and structure. The **hometown skin** is a second layer on top of it: palette tint, a texture/motif, and local detail on the laminate. Techno from Detroit and techno from Berlin share fonts and grid but feel like different cities.

**Not a ton of HTML boxes (owner, 2026-11-17).** The skin is the page itself, not a theme painted onto stacked bordered cards. Remove panels-inside-panels on the EPK and Tour Manager screens you touch: one fluid page, motif and colour carrying the sections, hairline dividers only where they help reading. A form field still looks like a field, and a button still looks like a button.

## Rules (do not break)

- **No photos, logos, sports-team marks, transit-system branding, flags or any third party's trademark or artwork.** Motifs are original CSS gradients/SVG patterns that suggest a place (rain streaks, brick, concrete, portico arches, rail ties, waterline, desert heat haze), not copies of anything.
- Each hometown is a **token set**, not a separate stylesheet or codebase (same rule as genre looks).
- One accent per look; every text/background pair keeps **contrast ≥ 4.5:1** (add an automated contrast check in the test).
- Touch targets 44px, phone first (320–430px), `prefers-reduced-motion` respected, no motion required.
- Hometown never changes **where** anything is. Navigation, SYNC, notifications, buttons and forms keep the standard DanzStak frame.
- The artist can switch the hometown skin off, or pick a different city ("I live in Seattle but I'm from Bremerton"). Manual switching is free forever.
- Nothing is sent to a third party to pick the skin. Matching is local, from the hometown text the artist already typed.

## 15-A — Hometown token sets + matcher

New `assets/hometown-looks.js` (data + matcher, no DOM) and tokens in `assets/epk-looks.css`.

1. Curated set, punk/metal/electronic scene cities first (owner priority):
   - **US West:** Tacoma, Seattle, Bremerton, Olympia, Portland, San Francisco, Oakland, Los Angeles, San Diego
   - **US Midwest and South:** Milwaukee, Chicago, Detroit, Nashville, Austin
   - **US East:** New York, Philadelphia
   - **Europe:** Berlin, Mannheim, Bologna, Milan, Rome, Paris, London, Manchester, Amsterdam, Barcelona
   - Each city: `id`, display name, match aliases (including local spellings, e.g. `München`/`Munich`), `ground`, `ink`, `accent`, `tint` (0–1 strength over the genre ground), `motif` (one of a small fixed library: `rain`, `brick`, `concrete`, `arches`, `rails`, `waterline`, `haze`, `grid`, `pines`), and a one-line `vibe` used in copy (e.g. "Puget Sound grey, mill steam").
2. Fallback for any other town: a **deterministic** palette from the normalized town name (hash → hue within a safe band), with a neutral motif. The same town always gets the same skin.
3. Matcher: `hometownLook(hometownText)` normalizes case/accents/"WA"/"USA"/commas and returns `{ id, curated: boolean, tokens }`.
4. Motif library is CSS only (`background-image` gradients/inline SVG data URIs, ≤ 2 KB each), drawn subtle enough that body text over it still passes contrast.
5. Tests: every curated city passes contrast against its genre looks; matcher maps "Tacoma, WA", "tacoma", "TACOMA USA" to the same id; fallback is stable; no external URLs in motifs.

## 15-B — EPK: hometown skin on the builder and the public EPK

1. In the EPK builder, under the genre look picker: **Hometown skin** with three choices: *From my home town (Tacoma)*, *Another city…* (searchable list of curated cities), *Off*. Default: on, from the hometown field.
2. Live preview updates as the artist types the hometown.
3. Public EPK (`public-mode`) applies `data-hometown` tokens on top of `data-look`. The laminate gets the city name, a coordinate line (rounded to 2 decimals, from the city's centre, never the artist's address) and the motif on its band.
4. PDF / press export keeps the palette but drops textures (print-safe).
5. Save `hometownSkin: { mode: "auto" | "city" | "off", city?: id }` with the kit. Old kits without it behave as `auto`.
6. Translations it/fr/es (and de/pt where `i18n.js` has them) for every new string.
7. Tests + visual fax at 320/375/430/tablet/desktop for Tacoma × Techno, Bologna × Punk, Berlin × Metal, a fallback town × House.

## 15-C — Tour Manager: hometown vibe

The Tour Manager (booking workspace, day sheets, route planner) is the band's own backstage, so it wears the band's hometown, but only as accents:

1. Header accent stripe, section eyebrows and the day-sheet header use the hometown accent and motif strip. Forms, buttons, the map and the pipeline keep the DanzStak frame and colours.
2. Day sheet and tour laminate print: "Out of Tacoma" line plus the motif band.
3. "Keep going" leg cards and the "Tour so far" line show the hometown as the tour origin badge.
4. Uses the same `hometownSkin` setting as the EPK (one setting, both places). If the band has no EPK yet, fall back to the account's home town, then to off.
5. Tests + visual fax of `booking.html` and `booking-selections.html` at phone widths in light and dark.

## 15-D — Owner notes, 2026-11-17 (apply in 15-B and 15-C)

1. **Wrap the pages.** The skin covers the whole EPK and Tour Manager page edge to edge, behind every section, not a themed card sitting on a plain page.
2. **No two-line box names.** Section titles, card names, stat labels, tabs and button labels fit on one line at 320px. Shorten the words, or use an icon plus a short word. Never wrap a label onto a second line, and never shrink it below readable size to make it fit. Add a test that checks for wrapped labels at 320px.
3. **Every number is clickable and says what it counts.** Each count in the Tour Manager and Music HQ (Sent, Delivered, Opened, Replied, Booked, credits, shows, days, legs, the "Tour so far" totals) is a link or button that:
   - opens the matching part of the tour doc: the list of those pitches, those shows or that day sheet, filtered to what the number counts;
   - carries a short visible label on one line ("Opened 4") and an accessible name that says exactly what is counted ("4 venues opened your private EPK").

   A number that cannot open anything is not shown as a number on its own.

## Done means

Each PR: tests green, contrast test green, visual fax screenshots attached, i18n strings added, shell + asset versions bumped with test pins, deployed PWA verified (service worker version, assets served), no regressions in booking, EPK publish, PDF export.
