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
