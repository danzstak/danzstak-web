# DanzStak shops and event tickets

Status: **CATALOG FOUNDATION AND BAZAAR IMPLEMENTED ON REVIEW BRANCHES; NOT DEPLOYED; LIVE PAYMENTS DISABLED.**

## Product placement

- The **DanzStak Official Store** is a main-menu destination.
- **DanzStak Bazaar** is a separate main-menu destination. It aggregates available published products from every published member shop, shows the seller's shop name, and deep-links to the original product in that shop. It never creates a second copy of the product record.
- A member may open one named shop. Its public catalog appears as a **Shop** tab on that member's profile; management is owner-only.
- Ticket sales attach to a published DanzStak event. Products and ticket offers may be shared as ordinary chronological Mix posts, but neither becomes a permanent Mix sales block.

## Server-owned records

One encrypted, point-in-time-recoverable DynamoDB table stores shops, products, published events, ticket tiers, inventory reservations, orders, tickets, shipment evidence, refunds and provider-event idempotency records. Browser code never decides ownership, price, inventory, the 5% fee, payout eligibility or ticket validity.

## Checkout and payout invariants

1. Prices are positive integer cents and initially use USD only.
2. The buyer sees item subtotal, shipping, taxes when supplied by the provider, and the final total before leaving for Checkout.
3. Bazaar listings are fixed-price only; no auction or bidding state exists. The seller sets the item price and a separate shipping charge.
4. DanzStak's marketplace fee is exactly 5% of the completed **item price only**. Seller-set shipping is excluded. The ticketing fee remains 5% of the completed ticket subtotal. Both are calculated server-side, and refunds reverse the corresponding fee.
5. Server validation rejects disproportionate shipping before persistence or Bazaar indexing. The initial guard rejects shipping of at least $10 when it exceeds twice the item price; for example, a $1 item with $15 shipping is blocked. This is a fee-avoidance safeguard, not a browser-only warning.
6. Physical seller proceeds use the payment provider's separate-charge/delayed-transfer workflow and remain unreleased until tracked carrier delivery or explicit buyer receipt. This is described as a provider-supported hold, never as licensed escrow.
7. Ticket inventory is reserved atomically before Checkout and restored once when a session expires or payment fails. Successful payment issues unique, non-guessable tickets; check-in consumes each ticket once.
8. Every Checkout and webhook path is idempotent. Duplicate requests, events and receipt confirmations cannot double-charge, double-sell, double-transfer or issue duplicate tickets.
9. Live charging remains fail-closed until the owner approves seller onboarding, Stripe Connect/provider terms, tax handling, refunds, disputes, fraud controls and the live-payment flag.

## Delivery phases

1. **Implemented on the review branches:** durable shops and physical-product catalogs, official store authorization, profile Shop tab, owner management, the mixed Bazaar catalog and mobile visual gates.
2. **Implemented on the review branch:** published events, ticket tiers, atomic tier-capacity allocation and public ticket availability. Ticket issuance and check-in remain part of the payment phase.
3. **Implemented on the dependent review branch; disabled and not deployed:** Stripe Connect recipient onboarding, server-priced Checkout, atomic inventory reservation, signed Stripe webhooks, durable orders, exact 5% item-only fee ledger and account-isolated order reads.
4. **Implemented on the dependent review branch; disabled and not deployed:** seller tracking, signed EasyPost delivery events, buyer receipt confirmation, one-time seller transfer, payout blocking/reversal for refunds and disputes, and race compensation. Partial refunds remain manual review.
5. **Current review gate:** screenshots at 320/360/390/414/430/1366px, complete regression/CI gate and owner review. Controlled two-account hosted Test Mode payment tests require the dedicated DanzStak Stripe/EasyPost secrets and endpoints; production remains off.

Production activation is a separate owner-approved release after all phases and payment-provider configuration pass.

Detailed payment architecture, routes, configuration and blockers: [MARKETPLACE-COMMERCE.md](MARKETPLACE-COMMERCE.md).

## Visual evidence

- [Official store at 390px](screenshots/bazaar-local/official-store-390.png)
- [DanzStak Bazaar at 390px](screenshots/bazaar-local/bazaar-390.png)
- [DanzStak Bazaar at 1366px](screenshots/bazaar-local/bazaar-1366.png)
- [Member shop at 390px](screenshots/bazaar-local/member-shop-390.png)
- [Member item detail at 390px](screenshots/bazaar-local/member-product-390.png)
- [Shop manager at 390px](screenshots/bazaar-local/shop-manager-390.png)
- [Published event and ticket availability at 390px](screenshots/bazaar-local/published-event-390.png)
- Matching desktop evidence is stored in the same folder at 1366px.

The browser gate also renders every changed marketplace screen at 320, 360, 390, 414, 430 and 1366px, rejects horizontal overflow or clipped controls, enforces 44px interactive targets, verifies complete uncropped product media, gallery thumbnails and item specifics, and requires every product image to load.
