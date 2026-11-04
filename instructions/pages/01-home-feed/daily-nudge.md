# Little Word of the Day (Daily Nudge) — fleeting human-world thought in the DANZSTAK header

**Owner idea — 2026-11-04. Status: product specification only, not implemented or tested.**

## Purpose

**Owner's preferred framing:** a *little word of the day* — actually a short, sometimes cheeky question or sentence, not necessarily a single dictionary word. Keep it small, human, and fleeting; it should feel like a passing thought, not a lecture or an additional content feed.

DANZSTAK should help people put their phones away and engage with actual people, places and nature. Add a **short, playful "Daily Nudge"** to the signed-in app's top header. This is **not** a word dictionary, advertising slot, daily-streak system, forced onboarding banner or motivational lecture. The spirit is affectionate, irreverent and gently punk rock. It is for *all* members, not only musicians.

### Owner's examples (retain spirit and exact intent)

- “Did you say buongiorno to the lady at the deli?”
- “Don't forget to take your lady for gelato.”
- “Did you go for a walk after dinner?”
- “Put down the remote and start jamming.”
- “The next hit song might be inside you.”
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

## Owner update — worldwide languages and independent device messages (2026-11-04)

**Required:** These Little Word of the Day messages are for DANZSTAK members worldwide, including the owner's friends in many countries. English-only nudges are not acceptable.

- **Languages:** Translate the full approved nudge library into every currently supported DANZSTAK app language (the development report identifies 15), and make the catalog expandable without a hard-coded 15-language limit. Select the member's configured app language, with sensible locale variants and clearly defined fallback (rather than blank text). Verify actual supported locale codes from the language implementation before coding; do not assume which languages are present.
- **Quality:** Preserve the gentle humor, warmth and everyday context in each language, using culturally natural translations. “Did you say buongiorno to the lady at the deli?” should sound like something a real person would say locally. Handle text expansion, long words, accents, non-Latin scripts and right-to-left layout where needed. No fake claim of certified translation: automated translations need review/QA; the app should never display raw English as though translated.
- **Per-device variety:** Do **not** use a single global daily phrase or choose by account ID alone. Each independently installed browser/PWA gets its own privacy-safe local random installation seed and daily choice from a substantial, curated library. Selection must be stable throughout the local calendar day and not change just by reloading, switching routes, reconnecting, or changing languages. On the same device, changing app language changes the translation of the *same* chosen prompt.
- **Different devices:** Two devices for the same person should select independently, so members around the world are not all served the same nudge. True guaranteed uniqueness across millions of devices is impossible without central allocation; do not build cross-device tracking to force it. Allow occasional chance duplicates and add a short local no-repeat history.
- **Only once per device per day:** Persist shown/dismissed state locally and keep it hidden after the initial ~7-second display or explicit dismissal until the device's next local day. Handle timezone or daylight-saving changes without creating repeat popups.
- **No tracking/costs:** No device fingerprinting, hardware identifiers, server-side user profiling, per-open AI API calls, mandatory GPS, location-derived messages, or analytics of personal behavior. Use curated localized phrases packaged and cached for offline PWA use.
- **Verification:** Automated tests for each supported locale (including missing-translation fallback), device A vs B independent daily selections, same-device stable choice and once-per-day display, translation-only language switches, next-day rotation, local DST/timezone changes, reduced motion, tiny-phone header overflow, focus and screen readers. Use several independently seeded virtual devices and document collision probability/limitations rather than claiming all devices are guaranteed to get unique text.

This update overrides any earlier wording that implies the *same* daily phrase across users or devices. It remains a specification, **not** proof of implementation.

## Required evidence before owner review

- Separate implementation branch and small PR, not direct production change.
- Automated checks: only one phrase, local-date rotation, no repeat after dismiss, not shown again on navigation, inaccessible markup and unsafe text rejected, reduced-motion behavior, localization fallback, no user/account data leakage, offline PWA/cache upgrade path, safe CSP hashes and assets.
- Browser geometry/screenshot checks at 320/360/390/414/430/768/1024/1366px; no overflow, blocked controls, extra empty band or duplicated install/update actions, even at long text lengths.
- Re-run complete regression tests for Home, Friends, Chat, Buzz, media audio isolation, Events, Booking, EPK, Stripe Test Mode and PWA.
- Provide an actual verified **phone-accessible staging PWA URL**, commit SHA, screenshots, pass/fail list and physical-device limitations. Owner approval required before merge or production deployment.
- Update `docs/DANZSTAK-DEVELOPMENT-REPORT.md` with only observed evidence, not claims based on instructions.

**Codex:** start with a header feasibility audit and propose smallest implementation consistent with the compact header. Do not change other products or enable live payments.
