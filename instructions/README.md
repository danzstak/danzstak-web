# DANZSTAK — Codex instruction center

This branch contains **specifications and visual references**, not production code. Codex must inspect the actual implementation before modifying files.

## Execution order
1. [Video playback and audio isolation](01-video-playback.md) — [visual](visuals/video-feed.svg)
2. [Feed spacing and navigation](02-feed-layout.md) — [visual](visuals/feed-layout.svg)
3. [Messaging](03-chat.md)
4. [Worldwide discovery](04-discovery.md)
5. [EPK media management](05-epk.md)

## Mandatory Codex workflow
- Read one section, inspect current code, and identify the relevant files and architecture.
- Implement in a separate implementation branch, **not** this instructions branch.
- Run relevant tests and browser-based checks on mobile and desktop. Where browser testing is unavailable, explicitly report that.
- Open a pull request referencing the instruction section, with changed files, tests, screenshots where possible, known limitations, and deployment status.
- Do not mark a feature complete merely because the build passes.
- Preserve DANZSTAK independence from SFScoop; external music/video embeds only, unless a section explicitly specifies otherwise.
- Never deploy or merge without the project's established approval process.

**Important:** GitHub instructions are not automatically executed by Codex. Codex must be directed/configured to read this branch.


## Platform-wide owner pricing and member-choice policy (2026-11-04)

- **Affordable optional products:** no individual optional consumer charge of $50 or more without an explicit new owner decision. Avoid expensive bundles, surprise fees and coercive upsells. Measure vendor, payment and support costs before pricing.
- **No lock-in:** no annual or multiyear consumer subscriptions. Monthly services must be genuinely month-to-month and cancellable any time without a cancellation fee. The default is deliberate member authorization for a new month's payment, not silent renewal.
- **Privacy Shield:** genuinely supported data-broker exposure discovery and initial member-authorized opt-out requests are free. Monitoring of supported sources costs **$4 USD for one month**; one reminder 3–4 days before expiry, and **renewal only if the member chooses and pays again**. No automatic charge and no annual offer. See [Issue #31](https://github.com/Danzstak/Danzstak-web/issues/31).
- **Free rights stay free:** ordinary social accounts, Chat, account data export/deletion, and links to free government removal tools are not paywalled. Live payments and outside provider access require owner approval. Use only DANZSTAK billing; stay out of SFScoop.
