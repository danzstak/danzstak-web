# DanzStak shops and event tickets

Status: **IN DEVELOPMENT ON `codex/marketplace-ticketing`; NOT DEPLOYED; LIVE PAYMENTS DISABLED.**

## Product placement

- The official **DanzStak Store** is a main-menu destination.
- A member may open one named shop. Its public catalog appears as a **Shop** tab on that member's profile; management is owner-only.
- Ticket sales attach to a published DanzStak event. Products and ticket offers may be shared as ordinary chronological Mix posts, but neither becomes a permanent Mix sales block.

## Server-owned records

One encrypted, point-in-time-recoverable DynamoDB table stores shops, products, published events, ticket tiers, inventory reservations, orders, tickets, shipment evidence, refunds and provider-event idempotency records. Browser code never decides ownership, price, inventory, the 5% fee, payout eligibility or ticket validity.

## Checkout and payout invariants

1. Prices are positive integer cents and initially use USD only.
2. The buyer sees item subtotal, shipping, taxes when supplied by the provider, and the final total before leaving for Checkout.
3. DanzStak's fee is exactly 5% of the completed item/ticket subtotal and is calculated server-side. Refunds reverse the corresponding fee.
4. Physical seller proceeds use the payment provider's separate-charge/delayed-transfer workflow and remain unreleased until tracked carrier delivery or explicit buyer receipt. This is described as a provider-supported hold, never as licensed escrow.
5. Ticket inventory is reserved atomically before Checkout and restored once when a session expires or payment fails. Successful payment issues unique, non-guessable tickets; check-in consumes each ticket once.
6. Every Checkout and webhook path is idempotent. Duplicate requests, events and receipt confirmations cannot double-charge, double-sell, double-transfer or issue duplicate tickets.
7. Live charging remains fail-closed until the owner approves seller onboarding, Stripe Connect/provider terms, tax handling, refunds, disputes, fraud controls and the live-payment flag.

## Delivery phases

1. **Implemented on the review branch:** durable shops and physical-product catalogs, official store authorization, profile Shop tab, owner management and mobile visual gates.
2. **Implemented on the review branch:** published events, ticket tiers, atomic tier-capacity allocation and public ticket availability. Ticket issuance and check-in remain part of the payment phase.
3. **Not implemented or advertised as available:** Test Mode seller onboarding and Checkout; verified webhooks, inventory reservation, orders and 5% ledger.
4. **Not implemented or advertised as available:** physical shipment/receipt confirmation, delayed payout, returns/refunds and disputes.
5. **Current review gate:** staging PWA, screenshots at 320/360/390/414/430/1366px, full regression gate and owner phone review. Controlled two-account payment tests begin only after phases 3 and 4 exist.

Production activation is a separate owner-approved release after all phases and payment-provider configuration pass.

## Visual evidence

- [Official store at 390px](screenshots/marketplace-ticketing/official-store-390.png)
- [Member shop at 390px](screenshots/marketplace-ticketing/member-shop-390.png)
- [Shop manager at 390px](screenshots/marketplace-ticketing/shop-manager-390.png)
- [Published event and ticket availability at 390px](screenshots/marketplace-ticketing/published-event-390.png)
- Matching desktop evidence is stored in the same folder at 1366px.

The browser gate also renders every changed marketplace screen at 320, 360, 390, 414, 430 and 1366px, rejects horizontal overflow or clipped controls, enforces 44px interactive targets, verifies mobile edge-to-edge product media and requires loaded product images.
