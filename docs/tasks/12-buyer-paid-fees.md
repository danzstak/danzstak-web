# Task 12 — Buyer-paid fees: 6% everywhere + $1 on orders under $30

## Owner decision (2026-11-16, supersedes "buyers pay the flat listed price, no added fees")
- **Every purchase on DanzStak** (member shop items, event tickets, and DanzStak's own products: AI EPK, booking emails, contact unlocks, DanzStak Network numbers, StakGuard) carries a **6% fee paid by the buyer** on top of the price.
- Plus a **$1 processing fee on orders under $30** (order subtotal before fees and shipping). Orders of $30 and up pay no $1. Example: a $5 AI EPK costs **$6.30**; six AI EPKs in one checkout ($30.00) cost **$31.80**.
- Several items in one checkout are allowed. Still **no prepaid credits, credit packs or subscriptions**: each item is delivered and consumed as itself.
- Sellers and promoters receive the **full item or ticket price** (plus the shipping they charged). DanzStak pays Stripe's processing fees out of the 6% + $1.
- Shipping never carries the 6%.
- AI EPK still includes one free distribution (task 08).

## Booking email (club) credits: minimum 20 per purchase (owner, 2026-11-16)
- Booking emails are bought **20 at a time minimum** ($1.50 each, 20 = $30.00 + 6% = **$31.80**, so no $1 fee). The quantity picker starts at 20, with no upper change from today (max 500).
- This is the one exception to "no credit bundles": unused booking credits stay on the account, are consumed one per pitch sent, and follow ToS 8A (unused credits refundable minus the fee; used = final). Partial-use refunds (task 11) apply to these credits.
- Server: `MIN_CREDITS_PER_CHECKOUT = 20`, enforced in checkout creation and webhook validation; the UI copy says "Minimum 20 pitches".
- The AI EPK's free distribution (task 08) is separate and doesn't count toward the 20.

## Product names (owner, 2026-11-16)
| Pack | What's in it | Price | With fees |
| --- | --- | --- | --- |
| **Starter Pack** | AI EPK + 11 booking emails (10 + 1 free), one per account | $20.00 | **$22.20** |
| **Club Pack** | 20 booking emails, any target (clubs, record stores, radio, press) | $30.00 | **$31.80** |
| **Tour Pack** | The Tour Itinerary: tour book PDF + Google Maps route + day sheets for the band; free with 20+ confirmed shows | $5.00 | **$6.30** |
Buy any pack as many times as needed (except the Starter). Prices shown all-in.

## Starter: AI EPK + 11 club emails for $22.20 (owner, 2026-11-16)
- One-off purchase for new artists: **AI EPK ($5) + 10 booking emails ($15) = $20.00 + 6% ($1.20) + $1 = $22.20**. Includes the AI EPK's free distribution, so the artist gets **11 club emails**.
- This is the only way to buy fewer than 20 booking emails. After the Starter, booking emails are 20 minimum ($31.80).
- One Starter per account. The emails stay on the account and are sent whenever the artist wants (not all at once), consumed one per pitch.
- Shown as the main offer on the EPK builder's "Let AI build it" choice and on the Booking Agent for artists with no credits: "Starter: AI EPK + 11 club pitches — $22.20 (incl. fees)".
- Refunds per 8A: the AI EPK is consumed when the first draft is shown; unused emails follow the credit rules.

## Record stores, radio, press and Tour Manager (owner, 2026-11-16)
- **One booking email, any target**: the same credit ($1.50, 20 minimum) sends a pitch to a club, a record-store in-store request, a radio on-air or ad/underwriting request, a program-director rotation package, or a zine/press pitch. One product.
- **Lists are free**: browsing the directory (clubs, record stores, radio, press) and the town plan suggestions costs nothing; artists pay only to send.
- **Tour Itinerary: a one-off product, $5 per tour** ($6.30 with fees): the full tour book PDF with the Google Maps route, contacts, call times and day sheets, for every band member (task 06). Free for tours with 20+ confirmed shows. The Tour Manager's budget, schedule and in-app shared itinerary stay free. Consumed when the first PDF is generated (8A).
- Marketing line: "Clubs, record stores, radio, press and a tour manager in one place." Don't claim no one else offers any of it.

## How it's described (owner, 2026-11-16)
- Not "5% + 3.5%": it's one **6% flat fee**. DanzStak pays Stripe's processing fees out of that 6% (+ $1 under $30). Buyers see "6% fee" (and "$1 processing fee" under $30); the app doesn't break out Stripe.
- The Terms (8A/8B/8C) say plainly where the fee goes: "DanzStak's fee covers payment processing by Stripe and the cost of running the marketplace."

## Sellers and promoters must know (owner, 2026-11-16)
- Shown when creating a shop or listing, in the event composer when DanzStak ticket sales are turned on, and in the Seller and Promoter Agreement: "Buyers pay your price plus DanzStak's 6% fee ($1 more on orders under $30). You receive your full price plus your shipping. No fees come out of your payout." Plus a live preview: "Buyer pays $X · You get $Y".
- An email to every existing seller/promoter when the fee change goes live, and a one-time banner in their shop/event dashboard.

## Build
1. **One fee function** (server, shared): `buyerFees(subtotalCents) = round(subtotal × 6%) + (subtotal < 3000 ? 100 : 0)`. Replace the interim seller-deducted `marketplaceFeeCents` / `ticket-orders feeCents` (6%, $1 minimum, merged in #353). Payout = subtotal (+ shipping); fee = buyerFees.
2. **Stripe Checkout**: add a separate line item "DanzStak fee" (6% + $1 where it applies) so the receipt shows it. Verify `amount_total = subtotal + shipping + fees` in every webhook before fulfilling.
3. **All-in price up front** (US FTC rule on live-event ticket fees; EU total-price rules): wherever a price first appears (listing card, event page, ticket selector, product page, AI EPK button), show the **total including fees** as the main number, e.g. "$6.30 (incl. $1.30 fees)". Never add fees only at the last step. Multi-item carts show the $1 dropping off when the subtotal reaches $30.
4. **Refunds**: refunds of unused/cancelled items return the item price. Whether fees are refunded follows ToS 8A/8B (lawyer to confirm; EU withdrawal within 14 days refunds everything).
5. **Copy and terms**: update ToS 8A/8B, the event composer, the store fee preview, OWNER-DIRECTIVES and CLAUDE.md (already updated in this PR).
6. **Tests**: $5 → $6.30; $29.99 → +$1.80 + $1; $30 → +$1.80 only; multi-item crossing $30 drops the $1; shipping excluded; payouts equal the item price; webhook rejects a wrong `amount_total`; the displayed price matches the server total.
