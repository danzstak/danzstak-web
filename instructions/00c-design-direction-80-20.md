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
- **Register once** for DANZSTAK and use the same account, protected authentication session, profile and navigation across all actual available modules: Feed/Friends, Chat and calling, Events/Make Plans, Phone, StakGuard, worldwide venue/record-store discovery, Booking Agent, EPK and Tour Manager. Some of those modules remain planned or unverified; do not advertise them as live until validated.
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


## Founding ownership principle — users control their original content (2026-11-04)

**Owner decision:** "Users own their content on DANZSTAK. If they want to delete their content they can delete it from everything on DANZSTAK."

DANZSTAK must not claim ownership of original works merely because they were posted. A member retains whatever intellectual-property rights they legitimately hold in their original text, photos, videos and other media; platform terms should request only the limited permission necessary to host, display and share the content according to the member's audience settings, subject to legal/privacy requirements. Do not tell members they automatically own somebody else's copyrighted material or that uploading confers rights they did not hold.

**Every eligible original publication has understandable creator-controlled distribution choices:**
- **Remove from here** removes the selected publication/location only, preserving other separately authorized publications and first-party reshares.
- **Delete everywhere** is an explicit, confirmed creator action which removes that original content and every in-service reshare/repost referencing it from all DANZSTAK surfaces, including feeds, profiles, Tribes, chat, story/video rails, search, notifications, previews and old in-service links. The shares disappear completely; no removed-content placeholder or resharer caption remains. DanzStak-hosted links and embeds on other sites stop working, and associated media/derivatives are purged from active storage and caches under the account-erasure backup rules. The same rule applies to original **text posts, photos, videos, captions when part of their original publication, and event/media posts**, not just videos; exact delete scope for authored comments and private chat messages needs dedicated safeguards and tests.
- A resharer can remove **their own share**, not revoke the original creator's asset. Reshares must be references to a revocable original rather than uncontrolled new content ownership.
- No guarantee of deletion from **external sites, downloaded files, screenshots or unrelated independent reuploads**. Authorized security/legal holds, account export/deletion and compliance are separate and must be truthfully explained; the member-facing first-party withdrawal should take effect promptly and persist across caches and devices.
- **Dailies** expire automatically at 24 hours; **The Roll, The Mix and profile content** otherwise remain until creator deletion, privacy change, account deletion or legal/moderation action. Daily expiry must not globally delete a separate persistent publication sharing the same underlying asset.

**Implementation requirements:** server-side ownership authorization and stable canonical content IDs, distinct publication/share IDs, idempotent deletion and revocation across fanout, API/media URLs/caches, clear confirmation for Delete everywhere, no extra fees, audits without copying deleted content, and tested negative/permission cases. The confirmation says screenshots, downloads and external copies cannot be recalled. Design is not complete until genuine two-account tests prove the original and all in-service shares are absent after creator Delete everywhere.

See [cross-content deletion Issue #40](https://github.com/Danzstak/Danzstak-web/issues/40). Do not advertise the control as currently working before Codex produces code, actual tests, staged review and owner approval.


## Account exit policy — remove original content from active DANZSTAK servers (2026-11-04)

**Owner's requirement:** if a member permanently leaves DANZSTAK, none of their original content should remain on **active DANZSTAK-owned servers** after the documented deletion process completes. Deleting the account MUST trigger free, owner-authorized Delete Everywhere for all that account's original text, photos, videos, Dailies, posts and eligible other media, plus withdrawal of dependent shares across other members' feeds. This is not satisfied by merely hiding UI cards, revoking login, anonymizing author labels or deleting a profile.

**Concrete technical product contract:** Purge source content and all dependent in-service shares from active backend databases, media storage and derivative images/previews/transcodes, CDN/app caches and search, notification/public previews, generated exports and durable queues. Stop all old playback URLs, shared links, embeds and deep links; ensure old backups cannot revive withdrawn content. Keep only minimal non-content revocation metadata for integrity where needed. Do not leave placeholders or resharer captions attached to the deleted share.

**Honest exceptions:** Backup/version expiry and legal/security holds may prevent immediate deletion of every byte; inventory, minimize, restrict access, disclose exact retention categories and purge schedules, and provide accurate completion status. Copies saved externally or independently reuploaded cannot be promised erased. DANZSTAK should not claim absolute immediate or universal erasure before the full backend/storage audit and proof.

Settings must make **Download my information** and **Delete account and my content** obvious and **free** to all users. Durable deletion must proceed after login shutdown, with secure confirmation, retries, status/receipt, real disposable-account integration tests and owner-approved staging. The technical deletion workflow is P0 [Issue #32](https://github.com/Danzstak/Danzstak-web/issues/32); creator-level cross-share revocation is [Issue #40](https://github.com/Danzstak/Danzstak-web/issues/40).

**Policy claim may be published as live only after Codex actually implements and verifies all relevant systems; this document does not prove deployment.**


## Optional account return — private 30-day restore, not mandatory deletion delay (owner request, 2026-11-04)

Owner wants former members who return and log in soon after leaving to be given a **choice to restore their content**. **Proposed recovery window: 30 days**, configurable/subject to owner approval. This does NOT supersede owner control to delete permanently without a waiting period.

**Exit choices displayed openly in Privacy & Data:**
1. **Leave with 30-day recovery** (optional): make entire account and originals publicly unavailable across DANZSTAK and dependent shares promptly, while keeping an encrypted, private, time-limited recovery archive. Be accurate: this data **still exists privately on our servers** until recovery expires or member chooses permanent deletion.
2. **Delete permanently now — no restore**: promptly withdraw originals everywhere and start actual permanent purge without mandatory grace period; disclose backups/legal exceptions, no promise of future restore.

For the recoverable state, a subsequent **authenticated login before the exact deadline** opens a dedicated choice: **Restore my account and content / Delete permanently now / Sign out**. Logging in alone must never silently republish posts or cancel deletion. Restoring must be deliberate, respect original privacy settings, moderation/legal decisions and other members' independent deletions, and explain that previously withdrawn dependent reshares may become accessible again if their shares still exist. Do not automatically reenable payments, subscriptions, DS phone assignments or other paid features without new consent/eligibility. The expired or immediately deleted archive must be purged and cannot be restored; returning users then create a new account.

Strong account verification and explicit confirmation are required; durable scheduled purge and precise time/date reporting must be backend-verified. Export is always optional and free. Keep a truthful deletion receipt and disclose backup schedules. **[Implementation task: #32](https://github.com/Danzstak/Danzstak-web/issues/32)**, with [share revocation #40](https://github.com/Danzstak/Danzstak-web/issues/40). Documentation does not mean Codex has shipped this feature.
