# 27 — Shops: "Opening soon", then a Grand opening

Owner 2026-11-18: "Make it public with opening soon. Users can set their shop up like this — coming soon — and then open with a grand opening."

First user: **Eroticon** (shop "Eroticon", 8 draft items and the cap sold out until he's back in Europe). Set his shop to Opening soon as soon as this ships.

## Shop states
`draft` (only the owner sees it) → **`coming_soon`** (public, nothing for sale) → `published` (open) → `closed`.

## Opening soon (public)
- [ ] The shop page and profile Shop tab are public. The header carries a big **OPENING SOON** banner (a poster/stencil look in the shop's genre look), the shop name, and an optional opening date the seller can set ("Grand opening Fri 5 Dec").
- [ ] Items the seller marks ready show as a **preview**: photo, title and price, greyed, with **Coming soon** where the buy button goes. Nothing can be bought, and the server refuses checkout for a coming-soon shop.
- [ ] **Notify me** (members, one tap): they get one notification and push when the shop opens, and nothing else. A count only: the seller sees "42 people waiting".
- [ ] Coming-soon shops and items are **not** in the Bazaar grid or the Mix item slot. The Bazaar may show one row of "Opening soon" shops (cover + name + date) at the bottom. The shop can be shared (task 17) with an "Opening soon" link preview.

## Grand opening
- [ ] One button for the seller: **Grand opening**. It asks to confirm (the shop goes live and ready items go on sale), then:
  - sets the shop to `published` and its ready items to `published` (drafts stay drafts);
  - notifies everyone who tapped Notify me ("Eroticon's shop is open");
  - creates **one** chronological Mix post from the seller, "Grand opening", with the shop cover and 3–4 item photos (never repeated, never boosted);
  - adds the items to the Bazaar and the Mix item rotation as normal.
- [ ] If an opening date is set, the seller is reminded that day. The shop never opens automatically without the seller tapping Grand opening.
- [ ] The shop shows a small "Just opened" ribbon for 7 days.

## Server
- [ ] `cleanShop` accepts `coming_soon` (and an optional `openingDate`, a future ISO date). Public `GET /marketplace/shop/{memberId}` returns coming-soon shops with `forSale:false`. Checkout and orders are refused for a non-published shop. A new `POST /marketplace/shop/open` does the grand opening transaction (idempotent). There's a Notify-me list per shop that stores only member ids and is deleted after the opening.

## Tests
- [ ] A coming-soon shop is visible publicly; its items have no buy button and checkout is refused; it's not in `/marketplace/bazaar` or the Mix slot.
- [ ] Notify me sends exactly one notification on opening.
- [ ] Grand opening is idempotent and makes exactly one Mix post.
- [ ] 360px screenshots of the coming-soon shop and the opened shop.
