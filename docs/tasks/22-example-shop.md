# 22 — Example shop: show members how to build theirs

Owner, 2026-11-18: "make a test store … a model to show users how to build their shop."

A built-in **example shop** that looks exactly like a real member shop done well, with short guide notes, so a musician or record shop can copy the pattern. It is **not** real listings: it never appears in Bazaar search or Mix (except the labelled Bazaar fill above), nothing can be bought, and every item says "Example".

## Examples show in the Bazaar until it fills up (owner 2026-11-18, overrides "never appears in Bazaar" below)
- [ ] While the Bazaar has fewer than **24 real published items**, the example shops' items are mixed into the Bazaar grid (and nowhere else: never in Mix item slots, never in search results for a real shop name).
- [ ] Every example card wears a clear **EXAMPLE** tag on the photo and "Example shop · not for sale" in place of the seller line. There's **no price button**, the price is shown greyed, and tapping opens `shop-example.html` at that item with the guide notes and **Start my shop**.
- [ ] Real items always come first in the shuffled grid. Example items fill the rest. Once the 24 real items are reached, examples leave the Bazaar automatically (they stay at `shop-example.html`).
- [ ] The server never returns example items as purchasable. Checkout for an example id is refused (400), and there's a test for it.
- [ ] Eroticon's real shop is **not** an example. It's a real member shop and shows in the Bazaar once its items are published.

## Where
- `shop-example.html`, opened from **My Shop** ("See an example shop"), from **Moving Day for shops**, and from the empty Bazaar state ("+ Sell something" → example first).
- Same layout, components and buttons as the real shop page (profile Shop tab + Bazaar card), so what members see is what they will get.

## Three example shops (owner, 2026-11-18: "a fan shop, a band shop and a record shop")
A switcher at the top: **Fan shop · Band shop · Record shop**. All fictional, original artwork, no real brands or people.

1. **Fan shop** — what a fan/maker sells: hand-made patches, zines, buttons, a custom battle vest, prints, a few records from their own crate. Shows: crafts with good photos, one-of-a-kind stock (1), simple shipping.
2. **Band shop** — light guidance only (owner: "bands know how to sell stuff"): T-shirts with sizes, LP + bundle (LP + shirt), cassette, poster, tour-only item marked sold out, pre-order with a ship date. Shows how merch, releases and tour stock sit together and how it links to their EPK and gigs.
3. **Record shop** — a full crate: LPs, 7"s, tapes, CDs with Discogs-style grading (Media/Sleeve), new arrivals, a box set over $30, staff picks. **Leads with the Discogs import:** a step-by-step "Bring your Discogs inventory over" walkthrough with screenshots-style illustrations (Dashboard → Inventory → Export → download CSV → Moving Day → pick → price → publish) and a "Start Moving Day" button.

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

## Discogs collection export too (owner, 2026-11-18)
Some sellers start from their **collection** export, not an inventory export. Moving Day must accept it: map Artist, Title, Label, Catalog#, Format, Released, release_id, "Collection Media Condition", "Collection Sleeve Condition", "Collection Notes". A collection export has **no prices**, so Moving Day shows a "Set a price for all picked items" field and per-item price editing before Move; nothing without a price can be moved. The record-shop example explains both: inventory export (already priced, for sellers) and collection export (for collectors pricing their crate).

## Make shops easy to make (owner, 2026-11-18)
Today's My Shop asks for an "HTTPS image URL" and a long form; nobody will do that from a phone. Replace it with:
1. **Open your shop in one tap**: name pre-filled from the profile (editable), one optional line "about", Publish later. No separate visibility dropdown on first open.
2. **Add an item like posting a photo**: tap +, take or pick up to 4 photos (uploaded to DanzStak media, resized; no URLs), then only: title, price, stock (default 1), shipping (with a "same as last item" default). Category chips (Record, Shirt, Tape, CD, Poster, Craft, Other) fill sensible fields, e.g. Record adds Format + Media/Sleeve condition pickers; Shirt adds sizes.
3. **All-in price preview** under the price ("Buyer pays $X with DanzStak's fee; you get $Y + shipping").
4. **Duplicate item** to list variants fast; edit inline; sold out with one tap.
5. Three ways in, shown side by side on the empty shop: **Add an item** · **Moving Day (import Discogs/eBay/Shopify)** · **AI shop ($6.30, drafts listings from photos)**, plus "See example shops".
6. Works at 320–430px with the keyboard open; every control 44px; no stacked boxes.

## "Every order comes with…" (owner, 2026-11-18)
Shops can set one short free-extras line in shop settings, e.g. **"Every order comes with free stickers."** It shows as a small badge on every item in that shop, in the Bazaar card, on the item page and at checkout, and is printed on the order/packing note for the seller. Optional, one line, max ~60 characters; no price attached. The band-shop example uses it.
