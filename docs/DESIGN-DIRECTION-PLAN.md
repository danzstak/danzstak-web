# DanzStak visual-direction plan

Status: **PLAN ONLY — OWNER APPROVAL REQUIRED BEFORE IMPLEMENTATION**
Goal: preserve familiar social navigation while replacing generic template styling with DanzStak identity and token-driven artist looks. No restyling or deployment is included in this PR.

## 1. Preserve the familiar frame; replace its tokens — 3–5 engineer-days

Keep the existing top-bar, desktop-left-menu, phone-bottom-tabs, center-content, profile, post-action, and standard-icon positions. Do not invent navigation patterns or rebuild working structure. In `assets/mobile-design-system.css`, replace stock social blue/white target values with semantic DanzStak base tokens for ground, surface, ink, accent, focus, type, radii, and borders; migrate legacy aliases and hard-coded colors without stacking overrides.

Add `[data-look="techno|punk|metal|house"]` token blocks only for artist-owned public EPK, profile, and gig content roots. The navigation, SYNC, settings, safety UI, and Mix frame never inherit artist looks. Components and data remain shared.

**Future files:** `assets/mobile-design-system.css`, shared component/page styles, theme bootstrap, `service-worker.js`, token tests.
**Risks:** hard-coded colors, wrong-theme first paint, theme leakage into the shell, inaccessible user content, and stale PWA assets.
**Gate:** familiar geometry unchanged, scoped tokens, no generic stock-blue/phpFox finish, 4.5:1 text contrast, visible focus, reduced motion, 44px targets, and no overflow.

## 2. Self-hosted type — 2–3 engineer-days

Subset and self-host only approved WOFF2 fonts under `assets/fonts/`: Archivo and JetBrains Mono; Anton, Special Elite, Work Sans; Pirata One, Oswald, Source Serif 4; Syne and DM Sans. Keep only used weights/required language subsets, record licenses and versions, preload only critical base faces, lazy-load public artist-look faces, and define metric-compatible fallbacks. Make no third-party font request.

**Future files:** font binaries, `assets/fonts/fonts.css`, license/source manifest, CSP/preload/service-worker references, font tests.
**Risks:** licensing, payload growth, layout shift, missing glyphs, and offline-cache bloat.
**Gate:** WOFF2/local-origin audit, approved payload budget, slow-font fallback screenshots, and supported-language samples.

## 3. Familiar five-destination navigation — 3–4 engineer-days

Use the current familiar positions while exposing **HQ, Tour/Gigs, EPK, Scene, Mix** in the existing menu/tab system. Do not remove Feed; Mix is its familiar destination. Search, SYNC, and notifications remain in the top bar; standard controls stay where users expect them. DJ/electronic contexts label the same Tour route **Gigs** and show set times without changing URLs, focus order, history, or meaning.

**Future files:** shared navigation markup/logic/styles, affected page shells, role/genre label helper, localization, PWA references and tests.
**Risks:** divergent shells, stale assets, role-label confusion, back-button regressions, and overlapping mobile screens.
**Gate:** one primary mobile screen, stable routes/history, all languages, keyboard/screen-reader navigation, and 320–1366px browser checks.

## 4. Universal EPK builder and Look picker — 5–8 engineer-days

The EPK is data-driven and works for every artist. A guided **Build your EPK in 5 minutes** flow collects name, genre, home town, pitch, bio, releases, external music/video links, photos, press, shows, production details, and contact while showing a live preview in the selected look. Music/video are clean external link cards only—no upload, copy, proxy, hosting, or stored-file player.

The artist chooses Techno, Punk, Metal, or House/EDM and may switch at any time without changing or losing content. Save a validated look enum separately from EPK content/profile fields. Bands see stage plot plus input list; DJs/electronic live acts see booth plot plus tech-rider fields. Public rendering handles one-photo/no-release beginners and 20-release veterans; empty sections hide without public placeholders, while the editor identifies optional missing material privately.

Eroticon is example fixture data only. Never hard-code its name, history, releases, remix credits, or Bandcamp URL into pages, CSS, components, or templates. Any fixture is replaceable input and never ships as a default artist.

**Future files:** EPK settings/onboarding/preview, profile and EPK validation, public serializers/renderers, stage/booth plot models, localization and tests.
**Risks:** content loss during look changes, incorrect act fields, giant catalogs, sparse-page gaps, theme injection, and fixture leakage.
**Gate:** owner-only save, content/look separation, cross-device persistence, band/DJ field selection, sparse/full fixtures, hidden empty sections, live preview, safe fallback, and no hard-coded artist data.

## 5. Screen rollout — one screen per PR

1. **Navigation shell** (3–4 days): restyle the existing familiar shell; do not move controls.
2. **HQ home** (4–6 days): music tasks inside the familiar center-column layout.
3. **Mix** (5–7 days): retain familiar posts/actions in the single base platform frame and implement the owner-approved finite content rhythm below.
4. **Public EPK** (5–7 days): Techno laminate, Punk Xerox folder, Metal dossier, House/EDM arched page.
5. **Gigs/Tour** (4–6 days): familiar list/route flow with mono rows, ticket stubs, bills, or date/BPM treatment inside artist content.

Each PR removes superseded source rules rather than stacking overrides. Public artist-page PRs include all four looks; shell/HQ/Mix PRs show the one consistent platform frame.

### Mix phone and center-column order

Use one deterministic server-backed sequence. Phone and desktop center columns have the same content order:

1. Compact header with search, notifications and SYNC.
2. Horizontal Dailies row. Its pinned first tile uses the signed-in member's real photo plus today's local date and **SCENE 1 · TAKE N**. N is the server-authoritative lifetime count of distinct successfully uploaded DanzStak video assets; uploaded Dailies count once and expiry never decrements it.
3. Four chronological Mix posts.
4. A compact **The Roll** launcher row opening the existing fullscreen vertical swipe player. It is not another video feed or inline player.
5. Three chronological posts, then the newest unseen show review from the member's people/scene.
6. Three chronological posts, then the newest unseen album review from the member's people/scene.
7. Three chronological posts, then the newest unseen event flyer from the member's people/scene.
8. Repeat the three-post/show-review, three-post/album-review, three-post/event-flyer rhythm until **You're caught up**.

Posts never move from chronological order. Supplemental slots are deterministic and user-scoped—not ranking or recommendations. If a slot has no eligible unseen item, omit it without a blank card and continue. Never substitute an ad, promotion, sponsored item or algorithm pick. Mark a supplemental item seen only after a server-authoritative visibility threshold, and use stable IDs/idempotent writes so refresh/back navigation does not reshuffle or skip content. Pagination must preserve the sequence across page boundaries and terminate; there is no infinite scroll.

Desktop keeps **HQ, Tour, EPK, Scene, Mix** in the familiar left menu, the same center-column ordering, and **News (including Reviews)** plus **Shows near you** in the right column. The artist-selected genre look never changes this platform frame.

**Future files:** feed query/sequence API, Dailies aggregate, `feed.html`, `assets/feed-enhancements.js`, shared Mix/Dailies/Roll styles, News/Reviews/event adapters, i18n, service-worker versions, unit/browser tests.

**Risks:** lifetime upload-count drift, Daily expiry decrementing TAKE N, duplicated supplemental cards, chronological-post displacement, unstable pagination, false seen state, Roll/media audio overlap, stale PWA assets, and empty-slot whitespace.

**Plan evidence:** [390px Mix order reference](screenshots/design-direction/mix-order-390.png). This is a planning mock, not implementation evidence.

## 6. Expandable component language

| Component | Techno | Punk | Metal | House / EDM |
| --- | --- | --- | --- | --- |
| Show | Mono line and set time | Ticket stub | Symmetrical bill | Date/BPM pill |
| EPK | Backstage laminate | Xerox folder | Centered dossier | Arched press page |
| Release | Indexed sleeve | Pasted sleeve | Framed sleeve | Rounded catalog sleeve |
| Tour | Routing rows | Poster stack | Centered itinerary | Club-night schedule |
| Production | Technical stage/booth grid | Paper plot | High-contrast plot | Rounded plot |

Later Hip hop, Indie, Country, Jazz, or other looks add a reviewed token set, font assets, and fixtures only. They do not fork page logic, content models, routes, or navigation.

## 7. Visual regression and acceptance — 2–4 days foundation, then per PR

Extend `browser-checks/` to render every artist look at 390px and 1366px and the stable platform frame at the same sizes. Use replaceable sparse and full-catalog fixtures. Assert local font origins, token scope, normal-text contrast ≥4.5:1, 44px targets, focus visibility, no overflow, stable media, hidden empty sections, and unchanged familiar control positions. Mix fixtures must prove the exact four-post/Roll/three-post supplemental rhythm, chronological post IDs across pagination, skipped empty slots, unseen selection, finite caught-up state, stable refresh, lifetime TAKE N after Daily expiry, and the desktop right column. Store screenshots by screen/look/viewport and run `test-regressions.ps1` plus GitHub review checks.

## 8. Documentation and rollout control

`docs/DANZSTAK-DESIGN-SYSTEM.md` records the 80/20 target and retires stock-blue/phpFox styling without rejecting familiar social navigation. Every screen PR lists affected files, removed legacy rules, applicable-look screenshots, functional/visual/integration results, known limits, and rollback. No implementation begins until the owner approves this plan; no deployment occurs without separate approval.

**Overall rough effort:** 31–47 engineer-days for tokens/fonts, familiar navigation integration, universal EPK/onboarding, the deterministic Mix sequence, five-screen rollout, and visual harness, excluding owner review, physical-device checks, and deployment.
