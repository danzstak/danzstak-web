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
- **Edit profile is its own screen** (owner 2026-11-18): today it opens as a panel stacked on top of the profile page, with the profile still underneath and a "Pivot — Moving Day" box at the bottom. Make it a separate full screen (`profile.html?edit=1` or its own page) with the profile's top bar (← back, "Edit profile", Save on the right); Back returns to the profile at the same scroll spot. Remove the Pivot/Moving Day box from it — Pivot lives in Menu. Sticky Save/Cancel at the bottom on phones.
- While here, tidy the screen: no "This is the name friends and other members will see" or "Choose the name you want…" explanation lines (fix-it rule: no explanatory sub-lines); the four collapsed boxes become plain rows with chevrons in the 16-C style, not bordered HTML disclosure boxes.

## Shop Manager AI (bulk) — owner 2026-11-18
- For shops listing many items (record stores moving a Discogs crate). **Hard cap: 250 listings per purchase.** Never 500.
- Going past 250 means **filing for an upgraded shop account** (owner 2026-11-18): an application from the Shop Manager screen ("Apply for an upgraded shop") with the shop's name, what it sells, roughly how many items, its existing store or Discogs/eBay seller page, location and contact. DanzStak staff review it in an admin queue and approve or decline with a short reason. Only an upgraded shop can buy further batches of 250. No self-serve unlimited use.
- Drafts are reviewed in batches (the seller sees every listing before it goes live); nothing publishes unseen.
- Price (owner confirmed 2026-11-18): **$20 for up to 250 listings, $21.20 with fees.** Create the Stripe product in **Test Mode** only, like every other product, until the go-live test.

## Shop size: 250 listings unless upgraded (owner 2026-11-18)
"To have more than 250 listings" a shop needs an upgraded account — this applies to the shop itself, not only to the AI.
- **Standard shop:** up to **250 active listings** (sold-out, archived and drafts don't count). Server-enforced in `marketplace.mjs` (today `MAX_SHOP_PRODUCTS = 5000` → 250 for standard shops) for manual listings, Moving Day imports and Shop Manager AI alike. At 250 the Add/Import buttons say "Your shop is full — apply for an upgraded shop" instead of failing.
- **Upgraded shop:** applies once (form above); DanzStak staff approve in the admin queue; approved shops get the higher limit (5000) and can buy further Shop Manager AI batches. A declined shop keeps everything it has; nothing is unlisted.
- Moving Day for shops shows the limit up front ("You can bring 250 items; you have 3,412 in the file — pick your best 250 or apply for an upgraded shop") and lets the seller choose which items come over.
- Upgrade is free to apply for; any fee for upgraded shops is the owner's decision and not built until set.
