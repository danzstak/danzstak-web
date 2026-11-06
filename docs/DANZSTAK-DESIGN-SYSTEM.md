# DANZSTAK Design System

Status: **FOUNDATION IN PROGRESS**  
Scope: GitHub Issue #55, stacked on the compact Feed/Dailies work from Issue #49  
Production: **UNCHANGED**

## Product direction

DANZSTAK uses familiar social-network interaction patterns while maintaining its own music-focused identity. Regular screens are light mode. Dark presentation is reserved for active calling/media contexts where it improves focus. The system must remain compact, readable, responsive, and truthful: controls only appear when they work, user content remains primary, and no mock data is shipped.

## Current architecture inventory

The frontend is serverless HTML, CSS, and browser JavaScript; it is not React. Shared behavior is delivered by versioned assets and cached by `service-worker.js`.

| Area | Primary sources | Current shared dependencies | Migration status |
|---|---|---|---|
| Feed / Dailies / Buzz / Friends / Menu | `feed.html`, `assets/feed-enhancements.css`, `assets/feed-enhancements.js` | `soft-ui.css`, `mobile-design-system.css`, `icon-buttons.css`, `responsive-media.css` | Feed foundation adopted; Friends remains in Issue #54 |
| Profile | `profile.html`, `profile-editor.css`, `profile-editor.js`, `profile-collections.js` | Shared mobile, icon, media, and soft UI assets | Foundation adopted |
| SYNC | `messages.html`, `chat.css`, `chat.js`, `direct-messages.js` | Shared mobile, icon, and media assets | Dedicated Issue #48 review |
| Booking Agent | `booking.html`, `booking-agent*.css/js`, `booking-discovery.*`, `booking-map.js` | Shared mobile and icon assets | Page redesign intentionally deferred to Issue #52 |
| Record Stores | `record-stores.html`, `record-stores*.css/js`, `record-placement.css` | Shared mobile and icon assets | Inventory complete; visual migration pending |
| EPK | `epk.html`, `epk*.css/js` | Shared mobile, icon, and media assets | Compact editor and public-preview migration complete in review branch |
| Tour Manager | Booking workspace components and authenticated API routes | Booking and shared tool styles | Inventory complete; visual migration pending |

## Root causes found

1. Two competing token sets (`--ui-*` and `--ds-*`) allowed the same component to receive different colors and density depending on stylesheet order.
2. Feed and Profile still embedded hard-coded Facebook-like palettes even when they loaded the shared mobile stylesheet.
3. Shared element rules and page rules were layered with `!important`, making geometry dependent on cascade order rather than component ownership.
4. Direct desktop Feed images were designed to span the post card but were silently clamped by the global `max-width:100%` rule, leaving a visible right inset.
5. Profile biography/actions remained centered by the older editor stylesheet while the new profile hierarchy was left aligned, producing a visibly broken identity column.
6. Page-specific PWA asset versions can retain prior geometry unless every consumer advances with the shared cache version.

## Semantic foundation

`assets/mobile-design-system.css` is the current source of truth. Legacy `--ui-*` variables resolve through these semantic tokens while modules are migrated.

- Brand: `--ds-brand`, `--ds-brand-strong`, `--ds-brand-soft`
- Accent: `--ds-accent`, `--ds-accent-soft`
- Text: `--ds-ink`, `--ds-ink-soft`, `--ds-muted`
- Surfaces: `--ds-canvas`, `--ds-surface`, `--ds-surface-subtle`
- Structure: `--ds-border`, `--ds-border-strong`, radius and shadow scales
- Type: shared font stack, sizes, and leading
- Density: 4px spacing scale with 44px minimum touch targets
- Layout: shared content and shell widths

The canvas uses restrained blue/orange light-mode accents. User media and content remain on high-contrast white surfaces. Active navigation uses blue plus an orange identity rail rather than generic blue-only highlighting.

## Implemented foundation slice

- Feed and Profile now consume the shared semantic palette, typography, borders, radii, and shadows.
- The Feed header and Profile header use the same branded blue gradient and orange keyline.
- Profile uses actual cover/avatar data in a single cohesive hero; missing covers receive a restrained original DANZSTAK treatment.
- Profile identity, biography, controls, tabs, and details follow one left-aligned hierarchy on desktop and mobile.
- Direct Feed media now reaches both post edges at desktop and mobile widths without distortion.
- Shared asset version is `mobile-design-system.css?v=12`; review PWA cache is `danzstak-shell-v682`.

## EPK editor slice

- Six long form blocks are now progressive, numbered editor sections with a compact section navigator instead of one uninterrupted wall of fields.
- The existing private draft, public choices, media upload, publish, unpublish, private review, print/PDF and deletion workflows remain connected to their original controls and APIs.
- Phone users can jump directly between editing and the live booker preview. Publish and private-save actions remain reachable above the fixed application navigation without obscuring the rest of the editor.
- The EPK editor and preview consume the shared DANZSTAK semantic tokens, use the official icon family, and remove cartoon emoji controls.
- Focused static and real-browser checks cover 320, 390, 430 and 1366px, zero overflow, section interaction, live preview binding and phone touch geometry. Physical-device installed-PWA behavior remains a separate review gate.

## Evidence and gates

`browser-checks/design-system-profile-feed.cjs` renders authenticated, populated Feed and Profile pages at 320, 390, 430, and 1366px. It verifies:

- no horizontal overflow;
- one shared brand/accent/surface token set;
- readable shared typography;
- visible orange header keyline;
- white content surfaces and consistent card radii;
- edge-aligned real post media at mobile and desktop widths;
- 44px mobile navigation targets;
- actual profile cover/avatar integration;
- coherent Profile identity alignment and shared detail surfaces.

Review captures are stored in `docs/screenshots/issue-55-foundation/`.

## Deliberately incomplete

This foundation is not the platform-wide redesign. SYNC, Friends, Record Stores, Booking Agent, EPK, Tour Manager, News, loading/error states, and remaining modal/form styles still require scoped implementation and evidence. Physical installed-PWA review remains an owner/device gate. No production deployment is authorized by this document.
