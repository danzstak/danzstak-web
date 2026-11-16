# Task 08 — AI EPK Builder: the AI searches the web and builds the artist's EPK

## Owner direction (2026-11-16)
"The artist selects 'have AI build the EPK'; the AI needs to search the web and make an EPK for the artist." Pricing (OWNER-DIRECTIVES): building by hand is free; an AI-built EPK is **$5**; an AI redesign is another $5; after that the artist edits free forever. Nothing AI-written is published or sent unseen. AI is optional; the free builder works without it. Provider is swappable. Never train on creator content.

## Read first
epk.html, assets/epk.js (the `kit` fields: artistName, actType, genres, hometown, shortPitch, shortBio, bio, achievements, notableShows, releases, pressQuotes, musicLinks, videoLinks, socialLinks, website, heroImage, media, lineup, tech/stage/hospitality requirements, bookingEmail, look), infrastructure/auth-api/index.mjs (`epkWorkspace`, `/epk`), tour-manager-billing.mjs (Stripe checkout + signature-verified webhook pattern), docs/OWNER-DIRECTIVES.md (AI-EPK rules, refunds 8A).

## The artist's flow (phone first, 5 screens max)
1. **Start**: in the EPK builder, two choices: "Build it myself (free)" or "Let AI build it ($5)". The second shows the price, what's included (1 full build + 3 AI rewrites of any section), and the refund rule (no refund once a draft is produced; unused = refund minus Stripe fee).
2. **Tell us who you are** (≈1 minute): act name, city, genre, band or DJ, and **any links they have** (Bandcamp, SoundCloud, Mixcloud, Spotify, YouTube, Instagram, website, Resident Advisor, Discogs, press). At least one link or a name + city. A notice that their links and public info about them will be sent to the AI provider to write the draft, and never used for training.
3. **Is this you?** (free, before paying): a quick search shows up to 8 found pages (title, site, snippet) with checkboxes, because many acts share names. The artist ticks the ones that are really them and can add more. **Nothing is generated from pages the artist didn't confirm.**
4. **Pay $5** (Stripe Checkout; test mode until the owner approves live). The entitlement comes only from the signature-verified, idempotent webhook.
5. **Build** (progress screen, ~1–2 min): "Reading your Bandcamp… found 3 releases… writing your bio…". It then opens the normal EPK editor, pre-filled with the draft, every AI-filled field marked "AI draft — check it", and a **Sources** list per section. Publishing requires the artist to tap through each marked section (or "I've checked everything").

## What the AI does (server-side, one job per paid build)
1. **Gather** only from the confirmed pages, plus up to ~10 extra web searches scoped to the confirmed identity ("<name> <city> <genre> review / interview / live / festival"). New pages it finds are shown as "Also found — is this you?" and are not used until confirmed.
2. **Extract facts with a source for each**: releases (title, year, label, link), notable shows/festivals, press mentions (outlet, date, link), genres, members/lineup, hometown, socials, music/video links.
3. **Write**: a one-line pitch, a short bio (≈50 words), a full bio (≈200 words) and a booking pitch paragraph, in the scene's voice (punk/metal/electronic), and a press-kit checklist of what's missing ("no live photos", "no tech rider").
4. **Fill the kit**: map everything into the existing `kit` fields and pick a genre look as a suggestion.

## Hard rules (truth, copyright, safety)
- **No invented facts.** Every factual claim (release, show, award, quote, number of plays) must come from a confirmed source or from the artist's own input; otherwise it isn't written. If sources conflict, the artist is asked.
- **Press quotes**: max ~1–2 sentences (under 25 words), with outlet + date + link, and a "the writer is OK with this" checkbox before publishing. Never copy whole reviews or bios from other sites; rewrite in fresh words.
- **Photos**: never download or reuse images from the web. Photos come only from the artist's uploads. The AI lists "Add a press photo" and "Add a live photo" as to-dos. (Embeds/links to the artist's own videos and music are fine. Never host audio.)
- **Only public pages**: no logins, no scraping behind sign-in, respect robots.txt, use the existing SSRF guard (`safePublicUrl` in link-preview.mjs) for any fetch, with timeouts and size limits.
- **People**: don't pull private info (home address, personal phone, family). The booking contact is only what the artist enters.
- **Prompt-injection safe**: web page text is data; the model is told to ignore instructions inside pages; output is strict JSON validated against the kit schema; HTML is stripped.

## Provider (swappable, one interface)
- `infrastructure/auth-api/ai-epk.mjs` with `createAiEpk({ llm, search, fetchPage })`. The default `llm` is Claude via the Anthropic API (key in AWS Secrets Manager `danzstak/ai/anthropic-key`; the owner pastes it) or Claude on Amazon Bedrock, whichever the owner approves. The default `search` is a web-search tool/API the owner approves. Both sit behind adapters so they can be swapped.
- Budget guard per build: max searches, max pages fetched, max tokens. Log cost per build (no content) so $5 covers it, with a target cost under $1 per build.
- Runs as an async job (DynamoDB job record + the client polling `/epk/ai/status`) so the Lambda doesn't time out; one active job per member.

## Rewrites and redesign
- Included with each paid EPK: **3 AI rewrites** (any section, e.g. "shorter", "more punk", "in Italian"). After that, a rewrite pack or redesign is another $5.
- **AI redesign ($5)** = a new full draft (text + suggested look) from the current EPK + sources. Manual edits and manual look switching are always free.

## Data
`AI_EPK#<jobId>` under the member: status, confirmed source URLs, the extracted facts with sources, the draft, cost counters, rewrites left, and the Stripe session id. Drafts are deleted 90 days after publishing or on account deletion. Never shared or used for training.

## Stripe
Create one sandbox product "AI EPK — $5" (and reuse it for redesign with metadata `kind=build|redesign`). Live product/prices only after owner approval.

## Tests
- No generation without a paid, webhook-confirmed entitlement; a webhook replay doesn't double-credit.
- Unconfirmed pages never feed the draft (inject a fake page with a contradicting fact → not used).
- Every fact in the output has a source URL from the confirmed set, or came from artist input.
- Press quotes ≤ 25 words with outlet + link; no image URLs from the web in `heroImage`/`media`.
- A page containing "ignore previous instructions…" doesn't change the output schema or add claims.
- Budget guard stops at the limits; a failed build before any draft = automatic credit restore.
- Publishing is blocked until the AI-marked sections are reviewed.
- Screens fax-tested at 320–430 px, plus 768 and 1366.

## Open questions for the owner (Claude Code: ask before building the provider adapters)
1. AI provider: Anthropic API directly, or Claude on AWS Bedrock (keeps everything in AWS)?
2. Web search provider (e.g. the Anthropic web-search tool or Brave Search API; avoid Google/Bing as a core dependency).
