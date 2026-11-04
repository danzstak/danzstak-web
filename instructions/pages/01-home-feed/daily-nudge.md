# Daily Nudge — fleeting human-world thought in the DANZSTAK header

**Owner idea — 2026-11-04. Status: product specification only, not implemented or tested.**

## Purpose

DANZSTAK should help people put their phones away and engage with actual people, places and nature. Add a **short, playful "Daily Nudge"** to the signed-in app's top header. This is **not** a word dictionary, advertising slot, daily-streak system, forced onboarding banner or motivational lecture. The spirit is affectionate, irreverent and gently punk rock. It is for *all* members, not only musicians.

### Owner's examples (retain spirit and exact intent)

- “Did you say buongiorno to the lady at the deli?”
- “Did you plant a tree today?”
- “Did you make a salad from your garden?”
- “Did you smell the fresh air today?”
- “When was the last time you smelled a daisy?”
- “Did you hear the river today, or just your notifications?”
- “Have you seen your friends somewhere other than a screen?”
- “Go make a memory nobody needs to photograph.”

Draft further lines with similarly human voice. Use sensible localization: “buongiorno” is deliberately Italian; localized variants may use the local greeting while preserving its warmth. Avoid making gardening, physical ability, home ownership or having friends a prerequisite; the list must have many accessible alternatives. Keep it funny and human; no guilt/shaming, political/religious slogans, ads, product promotions, external click-throughs, engagement bait or metrics based on dwell time. The message should **not** hijack the existing feed, search, navigation, notifications, install/update prompts, Chat or offline operation.

## MVP functional behavior

1. Audit **current** `feed.html` header and its shared mobile/desktop styles, service worker, cache versions, strict script CSP and localization. Read `instructions/00c-design-direction-80-20.md` plus mobile-first/PWA release rules. Do not assume a generic header or overwrite the compact 320–430px navigation.
2. Display exactly **one** brief nudge in an unobtrusive header-area ephemeral surface on the signed-in Home view. Make it readable and elegant; do not shrink or crowd the brand, search or action buttons. No permanent extra header row, layout shift, overlay blocking UI or collision with PWA Install/Update. On tiny phones, use a compact temporary overlay/slot with no horizontal scrolling.
3. Fade/hide on its own after roughly **7 seconds**, and provide a clear accessible dismiss control; respect `prefers-reduced-motion`, focus/screen-reader behavior and avoid content disappearing while actively focused or being read.
4. Show at most **once per member/device/day** (with a stable local-date choice), not every navigation or SPA re-render. It may rotate to a different preapproved phrase the following day. Hide after user dismissal. Store only lightweight local acknowledgement; never store or infer private behavior, location or attendance.
5. Static, preapproved curated phrase library for initial release; do **not** call an AI service every visit. Support the existing localization architecture (all supported languages, fallback text), XSS-safe rendering and reliable timezone/date handling. Do not require login beyond existing normal session.
6. No notifications, badges, streaks, rewards, click targets, tracking pixels, campaigns or behavioral advertising. Do not gate ordinary social use on opening it. Keep it free.
7. Accessibility: accessible label for one fleeting thought, readable contrast and typography, 44px dismissal control where appropriate; keyboard/focus semantics; reduced-motion support.

## Required evidence before owner review

- Separate implementation branch and small PR, not direct production change.
- Automated checks: only one phrase, local-date rotation, no repeat after dismiss, not shown again on navigation, inaccessible markup and unsafe text rejected, reduced-motion behavior, localization fallback, no user/account data leakage, offline PWA/cache upgrade path, safe CSP hashes and assets.
- Browser geometry/screenshot checks at 320/360/390/414/430/768/1024/1366px; no overflow, blocked controls, extra empty band or duplicated install/update actions, even at long text lengths.
- Re-run complete regression tests for Home, Friends, Chat, Buzz, media audio isolation, Events, Booking, EPK, Stripe Test Mode and PWA.
- Provide an actual verified **phone-accessible staging PWA URL**, commit SHA, screenshots, pass/fail list and physical-device limitations. Owner approval required before merge or production deployment.
- Update `docs/DANZSTAK-DEVELOPMENT-REPORT.md` with only observed evidence, not claims based on instructions.

**Codex:** start with a header feasibility audit and propose smallest implementation consistent with the compact header. Do not change other products or enable live payments.
