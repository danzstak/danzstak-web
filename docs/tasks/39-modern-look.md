# 39 — Modern look: the UI kit and the screen-by-screen rebuild (UIKIT, F8)

Owner 2026-11-19: "This is janky… if it looks like something an 8th grader could build they won't use it"; "do it so
it's not so HTML", "pick a dope look", "match all the web forms", "get an icon and emoji kit". Owner 2026-11-24: "we need
to make the site look clean" → "Start it now". CLAUDE.md "UI kit" and F8–F11/F21 are the requirements; this file is the
build plan Code follows. Icons and reactions: `39a-icons-and-reactions.md`.

## Where we are (measured on main, 2026-11-24)
- **91 stylesheets, 840 KB, 834 `!important`.** `feed.html` loads 33 stylesheets, `messages.html` 31, `profile.html`
  28, `epk.html` 22. Most screens are the original look plus layers of overrides fighting it.
- **Two token sets.** `--ds-*` in `assets/mobile-design-system.css` (ink `#172033`, accent `#ef6c20`, border
  `#d9e1eb`: a blue-grey social palette) and the Techno look in `epk-looks.css`/`epk-skin.css` (`#0b0b0c`, `#ededea`,
  `#ff5a1f`). The kit keeps **one**: the Backstage tokens below, under the existing `--ds-*` names, so every old rule
  that reads a token moves with it.
- **Fonts are already self-hosted** in `assets/fonts/` (Archivo variable 400–900 / 75–125% width, JetBrains Mono), today
  loaded only by the EPK looks. The kit loads them once for every page.
- **Shared pieces that exist:** `app-bar.js/.css` (B1), `app-tabs.js/.css` (B2), `friendly-error.js`, the i18n layer
  (`i18n*.js`), `--ds-btn-go` green. They move onto the kit; nothing new is written beside them.
- **npm is not reachable from the cloud build session** (seen again 2026-11-24). The kit's files are therefore
  **committed** (built CSS, sprite, emoji, vendor JS with licences), and the build can be re-run anywhere npm works
  (GitHub Actions has it). `test-ds-css-build.cjs` runs in CI, where `npm ci` works.

## 1. Tokens (one source of colour)
Defined once in `assets/ds-tokens.css` (loaded first on every page), read by Tailwind's `@theme` and by old CSS through
the same names. `mobile-design-system.css` keeps only the aliases until its last reader is gone.

| Token | Day (default) | Night | Notes |
|---|---|---|---|
| `--ds-canvas` | `#F4F4F2` | `#0B0B0C` | page ground |
| `--ds-surface` | `#FFFFFF` | `#151517` | content, sheets, cards |
| `--ds-surface-subtle` | `#F4F4F2` | `#1C1C1F` | unread rows, pills at rest |
| `--ds-ink` | `#0B0B0C` | `#EDEDEA` | text, outline icons |
| `--ds-ink-soft` | `#3A3B3F` | `#C9CCD1` | secondary text |
| `--ds-muted` | `#6B6E75` | `#8E9199` | times, counts (≥ 4.5:1 on its surface) |
| `--ds-hairline` (was `--ds-border`) | `#C9CCD1` at 60% | `#2A2A2E` | 1px rules, never boxes |
| `--ds-accent` | `#FF5A1F` | `#FF5A1F` + glow | active tab, unread dot, focus ring, links |
| `--ds-accent-soft` | `#FFF0E8` | `#2A1710` | unread row tint |
| `--ds-btn-go` | `#15803D`, white text | `#16A34A` | every "go" button (owner: "make go buttons green") |
| `--ds-danger` | `#DC2626` | `#EF4444` | End, Decline, Delete only |
| `--ds-focus` | `#FF5A1F` 2px ring, 2px offset | same | visible on every control |
| `--ds-font` | Archivo 400/600/800, width 110% for titles | same | body 15/22 |
| `--ds-font-mono` | JetBrains Mono | same | 11–12px uppercase labels, times, counts |
| type scale | 12 · 13 · 15 · 17 · 22 · 28 | same | the only sizes; titles 22–28 at 800 |
| radius | pill 999 (buttons, chips) · 16 (cards, sheets) · 0 (media) · round (avatars) | same | |
| space | 4 · 8 · 12 · 16 · 24 · 32 | same | no other values |
| shadow | `0 8px 24px rgb(0 0 0 / .12)` floating only | darker | sheets, menus, toasts, reaction pill |
| motion | press 150 ms scale .97 · sheet 220 ms · fade 150 ms | same | all off under `prefers-reduced-motion` |
| z-index | content 0 · sticky bars 20 · floating call controls 30 · sheets/dialogs 40 · toasts 50 | same | one scale (L2: dialogs above every floating control) |

Night follows `prefers-color-scheme` plus a Settings switch (`html[data-theme]`). Contrast is checked by a test for
every ink/surface pair above.

## 2. The kit set-up PR (UIKIT step 2, one PR)
- Root `package.json` with `@tailwindcss/cli` v4 (dev only, exact version), `npm run css` → `assets/ds.css` (minified,
  committed). Tailwind scans `*.html` and `assets/*.js` only. Preflight is **off** until a screen has moved, so old
  screens don't shift; each moved screen opts in with `class="ds"` on `<body>`.
- `assets/vendor/flowbite.min.js` (Flowbite 3, MIT, free version) only on pages that use a Flowbite piece; licence
  file beside it. Nothing from a CDN; CSP stays `'self'`.
- `assets/icons.svg`: Lucide (ISC) sprite with only the icons in use (list in 39a), stroke 2, `currentColor`. Helper
  `assets/ds-icon.js` → `<svg class="ds-icon" aria-hidden="true"><use href="assets/icons.svg#name"></use></svg>`;
  the button carries the accessible name.
- `assets/emoji/`: Fluent Emoji 3D SVGs for the seven reactions, the Feeling picker and empty states only (MIT, licence
  beside them).
- Fonts: one `@font-face` block in `ds-tokens.css` (Archivo, JetBrains Mono), `font-display: swap`, preloaded on the
  shell pages.
- Service worker: `ds-tokens.css`, `ds.css`, `icons.svg` in SHELL (no duplicates: `test-service-worker-shell.cjs`).
- Checks: `test-ds-css-build.cjs` (rebuild = committed file; CI only), `test-ds-tokens.cjs` (every token pair ≥ 4.5:1,
  no hex colour outside `ds-tokens.css` in files that have moved), `test-icon-sprite.cjs` (every `#name` used exists in
  the sprite, no unused symbol).

## 3. Components (one per job, in `assets/ds-components.css` built into `ds.css`)
Each gets a static example in `docs/ui-kit.html` (not shipped in the SHELL) and a browser check at 320/360/390/430px,
Day and Night, centre taps.

| Component | Replaces | Rules |
|---|---|---|
| App bar | `app-bar.css` + per-page headers | frosted (85% surface, blur), sticky, 52px; outline icons per 39a; one back arrow API (`setBack`) |
| Tab bar | `app-tabs.css` | icon-only per 39a, active = filled orange icon, names for screen readers, safe-area bottom |
| Button | 16-C button system, `icon-buttons.css` | `go` (green pill), `primary` (ink pill), `quiet` (text), `danger`; icon button 44px round; one disabled look |
| List row | notification rows, friends rows, settings rows, menu rows | 56px avatar or 24px icon, bold name, one grey sub-line, ⋯ at the end, whole row tappable, hairline between |
| Sheet | share sheet, ⋯ menus, pickers, confirm dialogs | bottom sheet on phones, centred dialog ≥ 640px; drag handle; Back closes it (history step); focus trapped |
| Toast | `friendly-error.js` output, "Saved" lines | bottom, above the tab bar, 4 s, one at a time |
| Form fields | every input/select/checkbox/file picker | floating label; select → tap-to-pick sheet; settings checkbox → switch; radio → tappable rows; date/time native on phones; dropzone instead of "Choose file"; char counter; inline error from `friendly-error.js` |
| Post | Mix post + profile/Tribe/Saved copies (T0-B4) | header (avatar, name, relative time, ⋯), text, media per F22, action row and reactions per 39a, 2 comments + "+N" |
| Comments sheet | Mix inline comments, profile comments (F1a 2b) | the F1a sheet, Newest/Oldest, "Comment as {name}" |
| Pills / tabs | boxed tabs everywhere | scrollable pill row with fade, active filled ink |
| Skeleton | "Loading…" text | shimmer blocks shaped like the content |
| Empty state | grey boxes with paragraphs | one Fluent emoji, one line, one action |
| Cards (music 20%) | — | ticket stub (shows), sleeve (releases), laminate (EPK), mono SCENE/TAKE label, grain on covers |

## 4. Screen order (one screen per PR; that screen's old CSS is deleted in the same PR)
Each PR: before/after screenshots at 360/390px Day and Night in `docs/screenshots/launch/`, the screen's checks
updated, every string through i18n (en, it, fr, es at least), no `!important`, and the old stylesheet removed from the
page, from SHELL and from the repo once nothing else loads it.

1. **Notifications** (F8 example): New / Earlier, list rows with type badge, relative times, ⋯ menu, no "View post".
2. **Create event** (F10): full-screen sheet from + in Events, flyer area, floating fields, sticky Create.
3. **Shop manager** (F21): storefront image area with Move to fit, form fields, no raw select or paragraph box.
4. **Profile + Friends** (F9, keeping F4 header and F12 positions).
5. **Mix** (post component, composer row per 39a, Dailies strip, Roll strip).
6. **Tribes** (home + page; F13 already flat).
7. **Bazaar** (grid, product page).
8. **Events** home (poster wall, spec 26).
9. **Music HQ** (F11 dashboard), then **EPK builder** (the public EPK keeps its genre looks), Booking, Tour Manager.
10. **SYNC** (list, thread, call screen keeps F15k).
11. **Menu** (grid + Radio stations, T2h/T2i), **Settings**, Your data, Support, landing page (B9), legal pages.

After step 11: `mobile-design-system.css`, `soft-ui.css`, `icon-buttons.css` and every `*-polish.css` /
`*-enhancements.css` are gone (G3). Target: one `ds.css` plus at most one page file per screen, zero `!important`.

## 5. Checks that guard the whole pass
- `browser-checks/forms-match.cjs` (CI): every page with a form at 320–430px, Day and Night: fails on a default
  `appearance`, a browser-default border/button, a field outside the shared classes, or a label over its value.
- `browser-checks/no-overflow.cjs`: no horizontal scroll and no control under 44px on any moved screen.
- `test-important-budget.cjs`: the `!important` count may only go down (baseline 834); a moved screen's CSS has none.
- `test-css-per-page.cjs`: stylesheets per page may only go down (baseline above).

## What this spec doesn't decide
- Exact Lucide/Flowbite/Tailwind versions: the set-up PR pins the newest release that is at least two weeks old.
- Genre looks for artist pages stay as they are (`epk-looks.css`); they read the kit's tokens only for the frame.
