# 19 — AI-assisted pages, AI shop and Moving Day for shops

Owner, 2026-11-17: the EPK builder "and a few others" should be AI assisted. Same provider as task 08 / queue item 7 (`ai-epk.mjs` provider: Anthropic Messages API, key from Secrets Manager `danzstak/ai/anthropic-key`, fail-closed: no key → "AI coming soon", nothing charged). Never train on member content. The member reviews and edits every generated word; nothing is published, posted or sent unseen.

## AI helpers

| Helper | Where | What it drafts | Price |
|---|---|---|---|
| **AI profile** | Profile (owner only) | Bio and About section from the member's EPK, links and a few questions; suggests which of their photos to use as cover and profile picture | **$5 + fees = $6.30** (owner 2026-11-17) |
| **AI shop** | My Shop | Sets up the member's shop (name, about, policies text) and drafts listings (title, description, condition) from photos for a small shop | **$5 + fees = $6.30** (owner 2026-11-17), covering shop setup plus up to **10 listings** (cap pending owner confirmation) |
| **Shop Manager AI** | My Shop (large catalogs) | Writes and cleans up descriptions for hundreds of items after Moving Day; the seller reviews in a table before publishing | **Different price, owner to set** — not built until priced |
| Pitch writer | Booking Agent | The per-venue pitch from the EPK and the venue's page | Owner to set — build behind a flag, off |
| Event post | Events composer | Event text from the flyer image and details | Owner to set — build behind a flag, off |
| Town plan | Tour Manager | Day plan for a booked stop: record shops, radio stations, in-store and on-air suggestions | Owner to set — build behind a flag, off |

Rules:
- Buyer-paid fees as in CLAUDE.md "Fees" (6% + $1 under $30, so $5 → $6.30). Show the all-in price before the button. One-off charge, no credits, no subscription. Stripe **Test Mode** only until the owner approves live.
- Refund rule (Terms 8A): once a draft has been generated it counts as used.
- One button style ("Draft it with AI") on every page, from the 16-C button system; the result opens in the normal editor, never auto-saved.
- Fair-use caps per member per day so a stuck loop can't run up costs; log token use per feature (counts only).
- Build order: AI profile and AI shop right after the AI EPK (shared checkout and provider), then the flagged helpers so the owner can switch each on once priced.

## Moving Day for shops (owner, 2026-11-17) — BUILT (moving-day.html)

Record shops pivot their online shop to DanzStak the same way members pivot their timeline: **Moving Day**. The shop downloads its own inventory export from Discogs, eBay, Shopify or a spreadsheet (a CSV it gets itself, **no platform login or API**), uploads it, previews every item, chooses exactly what moves, sets prices and shipping in batches, and publishes. Nothing goes live unseen.

- **Free**, like the rest of Pivot. Leaving a billionaire platform must be easy.
- The file is read in the browser (`assets/moving-day-parse.js`); only the picked items are sent, 100 per request, to `POST /marketplace/products/import`.
- Maps the common columns (artist, title, label, catalog number, format, media and sleeve condition, comments, price, quantity, shipping, image) to DanzStak listings. Unknown columns are listed on screen, never silently dropped.
- Each row keeps a source reference (`discogs:<listing_id>` and so on). The product id is derived from it, so moving the same file twice never duplicates anything ("already here").
- A shop holds up to 5,000 items. Shop and Bazaar reads page through every item; the Bazaar searches on the server and shows more with a "Show more" button (no infinite scroll).
- Release photos: the shop's own photos only. Never copy images or text from the source marketplace's database; listings start with the shop's own words.
- No audio files, ever.
- After the move, the shop's "I pivoted to DanzStak" card links to its shop on DanzStak.
- Prices are USD; the page tells shops with euro or pound exports to use the % change. Multi-currency listings are a later task.
- Seller-side pitch: the buyer pays DanzStak's 6% (+$1 under $30), so the shop keeps its full price and shipping. Compare with marketplaces that take a selling fee from the shop, without naming rates as guaranteed (they change).

## Where the AI profile lives (owner 2026-11-18, phone screenshot of Edit profile)
- On **Edit your profile**, right under the title: a single **"Write it with AI"** row (sparkle icon, "$6.30" shown only until bought). Tapping it asks 3–4 quick questions (what you do, scene/genres, city, one line about you, links) and drafts the bio, the "More profile details" fields and an @username suggestion; the member reviews every word, edits, then saves. Nothing is saved or published unseen.
- Price follows the paywall rule: the price shows only when the member chooses AI and hasn't bought it; once bought, the row just says "Write it with AI" (rewrites included for that profile).
- While here, tidy the screen: no "This is the name friends and other members will see" or "Choose the name you want…" explanation lines (fix-it rule: no explanatory sub-lines); the four collapsed boxes become plain rows with chevrons in the 16-C style, not bordered HTML disclosure boxes.
