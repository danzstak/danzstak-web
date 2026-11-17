# 22 — Example shop: show members how to build theirs

Owner, 2026-11-18: "make a test store … a model to show users how to build their shop."

A built-in **example shop** that looks exactly like a real member shop done well, with short guide notes, so a musician or record shop can copy the pattern. It is **not** real listings: it never appears in Bazaar search or Mix, nothing can be bought, and every item says "Example".

## Where
- `shop-example.html`, opened from **My Shop** ("See an example shop"), from **Moving Day for shops**, and from the empty Bazaar state ("+ Sell something" → example first).
- Same layout, components and buttons as the real shop page (profile Shop tab + Bazaar card), so what members see is what they will get.

## The model shop (fictional, no real brands or people)
- Name and about: a made-up punk/metal/electronic record shop, e.g. "Static Crate Records — vinyl, tapes and tour merch from the underground." One line, clear.
- 6–8 items covering the common cases: 12" LP (condition Media/Sleeve), 7" single, cassette, CD, band T-shirt with sizes, gig poster, a box set over $30, one sold-out item.
- Original artwork only (simple generated sleeves/shirts in the DanzStak genre looks); no copied covers, logos or photos.
- Each item shows price, shipping, stock and the all-in price note ("buyer pays 6% DanzStak fee; +$1 under $30").

## Guide notes (tap to open, never in the way)
- Photos: square, natural light, front + back + label for records; show the real item, not stock images.
- Titles: "Artist – Title (Format, Label Cat#)".
- Condition: Discogs-style grades (M, NM, VG+, VG…) for media and sleeve.
- Price + shipping: you keep your full price and your shipping; shipping can't be higher than the item.
- Stock and sold-out; drafts vs published; your shop lives on your profile and in the Bazaar.
- Moving Day: bring a whole Discogs/eBay/Shopify inventory in one go (free).
- Optional: AI shop ($6.30) drafts listings from photos; you review every word.

## Done when
- Looks finished at 360/390px and desktop; one fluid page, no stacked boxes.
- Not indexed in Bazaar search/Mix; checkout buttons show "Example — not for sale".
- Test: the example items never reach `/marketplace/bazaar`, and the page links back to "Start my shop".
