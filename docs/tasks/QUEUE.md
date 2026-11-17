# DanzStak build queue

**Claude Code:** read this file at the start of every session and after every PR you open.
1. Take the **first** item whose status is `TODO`, set it to `IN PROGRESS (Claude Code)`, and commit that change on your branch.
2. Build it as described in its spec, open the PR against main, and set the status to `PR #<n>`. **Don't merge or deploy.**
3. Go on to the next `TODO`.
4. If a PR of yours shows conflicts with main, rebase it first. Use `node scripts/bump-versions.cjs` for version clashes and take the higher number.

**Owner's Claude (review/deploy):** reviews each PR, merges it, deploys it (Auth API Lambdas; CloudFormation change sets for call-signaling), tests it live, then sets the status to `DONE (date)`. It adds new owner requests to this queue, in priority order.

The owner should never have to paste prompts: everything Claude Code needs is in this file and the specs it links.

| # | Item | Spec | Status |
|---|------|------|--------|
| 1 | SYNC texts via Twilio Verify | CLAUDE.md "SYNC SMS provider decision" | DONE (2026-11-17, #402 + ttl fix) |
| 2 | People search: name + @username, placeholder accounts named first, search on every page | CLAUDE.md signup rule | DONE (2026-11-17, #409, call-signaling deployed) |
| 3 | One phone verification across the same person's accounts (up to 10) | owner 2026-11-17 | PR #405 (main merged in 2026-11-17) |
| 4 | (Owner 2026-11-17: a two-device **video call worked well** — Chrome/computer ↔ phone. Keep it working.) SYNC 16-A: native shell + layout (messages scroll under the header, nothing cut off, keyboard) | 16 | TODO |
| 5 | SYNC 16-C: button system, SYNC first, then site-wide (no "HTML-looking" buttons) | 16 | TODO |
| 6 | **Fix-it pass:** work through `docs/tasks/18-fix-it.md` top to bottom (broken or unfinished-looking screens found by the owner's Claude in phone-size walkthroughs). One PR per screen or small group; tick each item with its PR number. The owner's Claude keeps adding to that file. | 18 | TODO |
| 6b | **Verify the artist before the EPK goes public or pitches** (anti-impersonation; owner 2026-11-17) | 20 | TODO |
| 7 | **AI EPK builder** via the Anthropic API (AWS Bedrock is on hold for this account, with every model throttled). Build `ai-epk.mjs` with the `llm` provider = Anthropic Messages API (plain fetch, model `claude-haiku-4-5` for extraction and Sonnet for writing), key read from Secrets Manager `danzstak/ai/anthropic-key` (JSON `{"apiKey": "..."}`, us-west-1; the auth API role may read only that secret). Fail-closed: with no key, the "Let AI build it" choice says "AI builder coming soon" and nothing is charged. Keep the provider swappable (Bedrock later). Everything else as in the spec: Stripe Test Mode only. | 08 | TODO |
| 7b | **AI profile** and **AI shop** ($5 + fees = $6.30 each; shop covers setup + up to 10 listings), then the other AI helpers behind flags (pitch, event post, town plan). Shop Manager AI for big catalogs waits for a price. | 19 | TODO |
| 7c | **Moving Day for shops**: free CSV import of a shop's own Discogs/eBay/web-store inventory export, preview, select, batch price/shipping, publish (task 19, last section) | 19 | TODO |
| 8 | **AI promoter reader** (14-A) on the same Anthropic provider and secret: reads the public promoter pages Brave finds and keeps real promoters, crews and booking contacts with sources. Fail-closed without a key (today's keyword filter stays). | 14 | TODO |
| 9 | Rebase hometown skins #394 → #398 → #399 and Events #389 onto main | 15, 14-D | TODO |
| 9b | **Live translation in calls** (captions first, spoken later; consent from both; Translation packs 30 min $5 (+fees $6.30) or 180 min $30 (+fees $31.80), calls free, Stripe Test Mode) — only after the SYNC fixes and a passing two-device call test | 21 | TODO |
| 10 | SYNC 16-B / 16-B2 / 16-B3: wallpaper, ringtones, "set up this phone" after registration with an invite link | 16 | 16-B3 starter PR #448, 16-B PR #458, 16-B2 PR #462 |
| 11 | SYNC 16-F: lock-screen push for messages, calls, booking replies and "venue opened your EPK" | 16 | PR #465 |
| 12 | SYNC 16-D ticks/typing/presence, then 16-E reply/forward/edit/delete | 16 | 16-D PR #467, 16-E PR #472 |
| 13 | SYNC 16-H: Make it yours | 16 | Part 1 (look, sound and feel, previews, reactions) PR #474; part 2 (contacts, SYNC profile/status, SYNC lock, disappearing messages) TODO |
| 14 | Share everywhere with tracked links (replaces the current share UI) | 17 | TODO |
| 15 | Follow alongside Friends | owner 2026-11-17 (Friend = two-way, Follow = one-way; artist pages lead with Follow) | TODO |
| 16 | SYNC 16-G: standalone launch | 16 | PR (this branch) |

**Order (owner 2026-11-17):** make what exists work and look finished before adding features: SYNC layout, buttons and the fix-it list come before the AI builder and new features.

**Parked (don't touch unless the owner moves them up):** fees PRs #363–#370 and #352/#359 (older work needing the owner's review), the legacy `codex/*` PRs, and Bedrock itself (AWS quota hold; the AI features now use the Anthropic API instead).

**Ready (2026-11-17):** the Anthropic API key is stored in Secrets Manager `danzstak/ai/anthropic-key` (us-west-1, JSON `{"apiKey": ...}`), and a live test call to `claude-haiku-4-5` answered. The auth API role can read it through the attached managed policy `DanzStakAnthropicKeyRead`, because the role's inline policy is at its 10 KB size limit, so add new permissions as managed policies, not inline. Items 7 and 8 can use it.

**Blocked on the owner:**
- AWS support case: Bedrock quotas at 0, and SMS sandbox / Notify rejected.

- Twilio upgrade from Trial before real members register.
