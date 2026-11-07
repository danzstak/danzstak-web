# DANZSTAK Design System

Status: **80/20 DIRECTION APPROVED FOR PLANNING; IMPLEMENTATION NOT STARTED**
Production: **UNCHANGED**

## Product direction

DanzStak uses an **80% familiar, 20% DanzStak** visual model. A person arriving from Facebook should understand the interface on day one: search/messages/notifications in the top bar, a desktop left menu, phone bottom tabs, one center content column, familiar profiles, standard icons, and recognizable post actions. DanzStak must not invent unfamiliar navigation merely to look different.

The distinctive 20% comes from DanzStak's logo, type, palette, language, and music-specific content: ticket-stub shows, record-sleeve releases, backstage-laminate EPKs, poster-list tour dates, and professional stage/booth plots. Stock social-network blue and generic phpFox-template styling are retired. Layout familiarity is preserved; visual identity and music workflow replace generic decoration.

## Stable platform frame

Navigation, SYNC, settings, safety, and Mix use one consistent DanzStak frame. Genre looks never recolor or rearrange this frame.

- Desktop: top bar, left navigation, center content; secondary content only when it earns the space.
- Phone: compact top bar and familiar bottom tabs; one primary screen at a time.
- Profiles retain cover, avatar, tabs, and familiar actions.
- Posts retain like, comment, and share with standard icons in standard places.
- Main destinations are HQ, Tour/Gigs, EPK, Scene, and Mix. SYNC and notifications stay in the top bar.
- For DJ/electronic artist contexts, the same Tour destination is labeled Gigs and includes set times.

## Shared tokens

`assets/mobile-design-system.css` remains the future token source. Implementation replaces stock blue/white target values with semantic DanzStak roles—ground, surface, ink, muted ink, rule, accent, focus, danger, typography, radii, and borders—without rebuilding page structure. Components consume semantic tokens rather than hard-coded page colors.

Artist-owned public EPK, profile, and gig content may select `[data-look="techno|punk|metal|house"]`. The attribute belongs on the artist content root, never the application shell. Looks are token sets, not separate DOM trees, routes, or codebases. Content, permissions, and look remain independent.

## Genre looks for artist-owned public pages

| Look | Ground / ink / accent | Typography | Expression |
| --- | --- | --- | --- |
| Techno | `#0B0B0C` / `#EDEDEA` / `#FF5A1F` | Archivo 900 expanded display, JetBrains Mono detail, Archivo body | Square edges, 1px rules, mono labels |
| Punk | `#EFE8DA` / `#121110` / `#E5452E` | Anton display, Special Elite detail, Work Sans body | Xerox frame, perforated rules, ticket-stub shows |
| Metal | `#0E0D0D` / `#E6DECB` / `#9E1B1B` | Pirata One for artist name only, tracked Oswald labels, Source Serif 4 body | Centered symmetry, heavy hero, restrained red |
| House / EDM | `#0F2E26` / `#FFF4E0` / `#FFC93C` primary; `#FF6FA8` controlled alternate | Syne 800 display, DM Sans body | Rounded pills, arched photo, BPM/genre badge |

Only one interactive accent is active within a component. House/EDM uses sun for actions and pop as a controlled decorative/status alternate. Normal text contrast is at least 4.5:1, focus is not color-only, and targets are at least 44px.

## Universal EPK content

The EPK Builder is for every DanzStak artist. It is not tied to a demo artist or genre. Artists can start with name, genre, home town, pitch, bio, releases, external music/video links, photos, press, shows, production details, and contact. Bands receive stage plot and input list fields; DJs/electronic live acts receive booth plot and tech-rider fields.

Look and content are separate. An artist can switch looks without altering or losing content. Public renderers support sparse new-artist EPKs and long veteran catalogs; empty sections disappear cleanly and no placeholder copy appears publicly. New looks later require a token set and visual fixtures, not new page logic.

Music and video remain external links to artist-controlled providers. DanzStak does not upload, copy, proxy, or host them and does not stream stored music files.

## Typography and independence

Approved fonts are self-hosted under `assets/fonts/` as licensed, subset WOFF2 files. No Google Fonts or other third-party font request is permitted. Load only used weights and required language subsets, keep fallback metrics stable, record licenses/source versions, and budget the total payload before implementation.

## Component expression

| Component | Techno | Punk | Metal | House / EDM |
| --- | --- | --- | --- | --- |
| Show/gig | Mono line item and set time | Perforated ticket | Symmetrical bill | Date pill and BPM/set badge |
| Public EPK | Backstage laminate | Xerox press folder | Centered dossier | Arched press page |
| Release | Indexed sleeve | Pasted sleeve | Framed sleeve | Rounded catalog sleeve |
| Tour dates | Routing rows | Poster stack | Centered itinerary | Club-night schedule |
| Production | Technical stage/booth grid | Drawn paper plot | High-contrast plot | Clean rounded plot |

The platform frame around these components remains unchanged. Decorative treatment never changes reading order, controls, permissions, information density, or navigation.

## Rollout and quality gate

Restyle in this order: navigation shell, HQ, public EPK, Gigs/Tour, then Mix. Preserve familiar layout and control positions; add music tools to the existing menu rather than removing Feed or moving familiar actions. One screen ships per PR.

Public artist-screen PRs include all four looks at 390px and 1366px. Platform-frame screens include the single base look at those sizes. Automated checks cover local-only fonts, token scope, 4.5:1 contrast, 44px targets, focus, overflow, sparse/full content, hidden empty sections, and stable navigation.

Eroticon may appear only as clearly labeled example fixture content. No artist name, biography, release, credit, or link may be hard-coded into production pages, CSS, components, or templates. Tests must never download or host its music/video.

See `docs/DESIGN-DIRECTION-PLAN.md`. No production deployment is authorized by this document.
