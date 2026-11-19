# Task 17 — Share everywhere, tracked back to the member

Owner, 2026-11-17: "when a user posts on DanzStak there should be a share everywhere to all their other socials, with tracking in the share back to that user."

Read `CLAUDE.md` first (creator control, Pivot, "DanzStak can track in-service content identity and outbound share-link engagement, not people across the internet"). One PR. Fax the room.

## Share sheet

1. Every post, EPK, event, shop item, release and profile gets a **Share** icon that opens one sheet:
   - **Share to…:** the phone's native share sheet (Web Share API), which reaches every app the member has installed (Instagram, Facebook, X, TikTok, WhatsApp, Telegram, email, SMS).
   - **Copy link.**
   - **QR code**, for flyers and the merch table.
   - Fallback buttons when Web Share isn't available: X, Facebook, Threads, Bluesky, Reddit, Telegram, WhatsApp, email, all using each site's public share URL. **No platform APIs, no logins, no SDKs, no tracking pixels from those platforms** (independence rule).
2. **A ready caption** the member can edit before sharing, e.g. "New on DanzStak: <title> <link>". It includes the "Pivot off those platforms" invite when the member wants it.
3. Only content the member is allowed to share gets the sheet: a public post, or their own content. Friends-only posts warn: "Only your friends can open this link."

## Tracked links back to the member

1. Each share creates a short link `danzstak.com/s/<code>`. The code maps to the content, the member who shared it, and the channel they picked (instagram, whatsapp, copy, qr, …). One code per member, item and channel, reused rather than created again.
2. What gets counted, per code and only server-side:
   - **opens** (link visits);
   - **joins** (a new account created after arriving through the link, credited to the sharer);
   - **actions** (ticket bought, item bought, EPK opened by a venue, follow).

   Counts only: no IP addresses kept, no fingerprinting, no cookies across sites, no reading of other platforms.
3. Where the member sees it: "Shares" on each item ("42 opens · 3 joins · 2 tickets · top channel: Instagram"), and a total in Music HQ. People who arrived through the link see nothing different.
4. Creator control: **Delete everywhere** kills the item's short links. A deleted or private item's link shows "This post is no longer available", with no placeholder content.
5. The invite links from 16-B3 (`danzstak.com/@username`) use the same counting, so "joins from your invites" shows in Music HQ.

## Done means

- Tests: one code per member, item and channel; counts increment once per visit window; joins are credited to the right member; deleted content kills links; friends-only content can't leak.
- Translations it/fr/es; screenshots at phone widths; versions bumped with `scripts/bump-versions.cjs`.
- Open a PR and don't merge it.
