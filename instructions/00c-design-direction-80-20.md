# 00C — Product design direction: 80% Facebook familiarity / 20% DANZSTAK identity

## Owner-approved design principle
**80% familiar Facebook-like UI/UX patterns; 20% distinctive DANZSTAK identity and music-specific functionality.** This is a qualitative design target, not a pixel-accurate cloning instruction. Do not copy Facebook logos, artwork, proprietary code or branded assets.

## The familiar 80%
- Light-mode only, simple navigation and immediately recognizable social-network information architecture.
- Mobile-first single-column feed with top bar, search, notifications, composer, stories only if product-approved, post cards, reactions, comments, replies and sharing.
- Familiar profile header with cover photo, avatar, bio, friends, photos and posts.
- Friends list, requests and messaging patterns that need no training.
- Consistent spacing, readable typography, modest card borders, predictable interaction feedback and intuitive privacy controls.
- On desktop, conventional left navigation, central feed and optional right contacts/utility column.
- Avoid empty whitespace, excessive decorative panels and oversized controls.

## The DANZSTAK 20%
- DANZSTAK wordmark and restrained brand accent colors.
- Music-oriented features integrated into familiar navigation, not forced into every post.
- Discovery of record stores, clubs and live venues worldwide; Tour Manager; EPK; events; future marketplace.
- External music/video embeds rather than rehosting.
- Keep DANZSTAK independent of SFScoop; no required shared login or token integration.

## Execution
- Audit current UI before changing it. Preserve successful elements and existing data.
- Build mobile reference designs and compare actual screenshots at 360/390px before implementation.
- Refine page-by-page, beginning with Home Feed and global navigation.
- Apply mobile-first and PWA review requirements in 00-mobile-first.md and 00b-pwa-release-review.md.
- Do not deploy a full redesign or replace existing brand direction without owner review.

## Acceptance
A first-time Facebook user should understand basic feed/profile/friends/chat tasks without instruction; artist tools should be discoverable but not overwhelm everyday users. Report concrete usability issues and before/after screenshots.


## One comfortable stack — one signup, every DANZSTAK product (2026-11-04)

**Owner language:** “A stack users can dance on.” A comfortable, unified foundation for social life, useful paid services, music and real-world connections. This is a product-experience direction, not a request to add literal dancing mechanics or an overly playful visual theme.

### One account, many products
- **Register once** for DANZSTAK and use the same account, protected authentication session, profile and navigation across all actual available modules: Feed/Friends, Chat and calling, Events/Make Plans, Phone, Privacy Shield, worldwide venue/record-store discovery, Booking Agent, EPK and Tour Manager. Some of those modules remain planned or unverified; do not advertise them as live until validated.
- Do not require a second product-specific password, signup page, separate profile, new external identity provider or Stripe account. Ordinary members must not need to be musicians to use consumer features.
- Reuse verified shared Cognito/API authentication; audit current app routes, cookies, auth redirects, product entitlements and security. **Do not replace or weaken authentication** just to eliminate repeated logins.
- Each optional feature retains its own clear privacy consent and independently server-verified access/paid entitlement. One account does **not** mean indiscriminate sharing of contacts, scan results, phone identifiers, chat history or payment data across unrelated products.
- When a signed-out member follows a deep link to a product, one sign-in then return to the intended screen. No repeated sign-in between normal product navigation. Keep account settings, receipts, optional product access and cancel/stop actions discoverable in one place.

### “Comfortable UX” means
- **Familiar light-mode social interface** (80% recognizable patterns, 20% DANZSTAK brand), not a noisy app-store storefront; place optional products in a clearly organized **Tools / Services** destination, not constant upsells in the main feed.
- **Easy reading:** phone body text roughly 16px or larger with good contrast and legible profile subtitles; coherent heading sizes, useful line lengths and support for user browser zoom/system text scaling.
- **Space that earns its place:** reduce dead white space, excessive card borders, duplicate blocks, oversized empty panels, unnecessary two-line controls and inconsistent gutters. Posts, replies and chat should feel inviting rather than compressed or wasteful.
- **Easy touch and navigation:** comfortable ≥44px touch targets when feasible, thumb-friendly mobile nav, clear active-section highlighting, understandable labeled icons and properly aligned Reply/Delete controls. Every actual password field has the show/hide eye specified by issue #35.
- **Calm predictable behavior:** no unexpected sound/video autoplay, overlapping audio, surprise overlays, forced walkthroughs or nagging purchase prompts. Clear loading/empty/error/retry states; preserve draft content and navigation context when safe; respect PWA offline and return paths.
- **Inclusive:** keyboard/screen reader access, reduced-motion preference, mobile safe areas, 15-language content expansion, account access without required phone number or precise location.
- **Purpose:** help people connect outside the app — “From Screens to Scenes” — while keeping day-to-day participation free and optional tools affordable, without annual lock-in.

### Verification / review
1. Inventory the actual **implemented** product routes (distinguish from instruction scaffolds) and reproduce UX problems in real source and accessible previews. Prioritize Home/Profile/Chat/Tools/Account before redesigning secondary modules.
2. Small isolated PRs rather than a giant redesign; preserve working auth, Friends, messages, calls, discovery, payment protections and user data.
3. Test single-account login and navigation through all **available** products, permitted and unauthorized account access, paid/free entitlements, logout and deep-link flows, browser/PWA refresh, accessibility, and phone widths 320/360/390/414/430px plus desktop. Capture clear before/after screenshots.
4. Publish exact tested commit, tests passed/failed, phone-accessible staging PWA URL and known limitations for **owner approval before deployment**. Filing this spec alone does not mean the UI is changed.
