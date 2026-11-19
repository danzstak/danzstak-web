# Task 01 — Release held ticket money to promoters (sandbox)

## Goal
Promoters get paid automatically 3 days after their event ends, from money DanzStak is already holding. Buyers can get a refund before the show from the held money. DanzStak never pays out of its own pocket.

## Context (already built — read these first)
- `infrastructure/auth-api/ticket-orders.mjs`: orders `ORDER#<id>/META` with `status` (`pending` → `held`), `subtotalCents`, `feeCents` (5%), `paymentIntent`, `releaseAfter` (event end + 3 days), `organizerId`, `ticketCodes`. Tickets `EVENT#<eventId>/TICKET#<code>` with `status` valid/checked_in.
- `infrastructure/auth-api/payouts.mjs`: seller record `SELLER#<userId>/PAYOUTS` with Stripe `accountId` and `status` (`active` = verified). Stripe key loader refuses live keys unless `MARKETPLACE_PAYOUTS_LIVE=approved`.
- Stripe: separate charges and transfers. Platform paid the Stripe fee.

## Build
1. **Release job** (new module `ticket-release.mjs`, exported `releaseDueOrders({db, stripe, clock})`):
   - Find orders with `status = held` and `releaseAfter <= now`. Add a GSI-free approach: write a small index item `RELEASE#<yyyy-mm-dd>/ORDER#<id>` when an order becomes `held` (update `fulfil` in ticket-orders.mjs) and query today's and past dates.
   - Skip an order if: an open problem/dispute exists, the event was cancelled, or the promoter's payout status is not `active` (leave it held; it releases on a later run once verified).
   - Look up the Stripe fee: GET `/v1/payment_intents/<pi>?expand[]=latest_charge.balance_transaction` → `balance_transaction.fee`.
   - Transfer amount = `subtotalCents − feeCents − stripeFeeCents`. Never negative. Create `POST /v1/transfers` with `amount`, `currency=usd`, `destination=<accountId>`, `transfer_group=ORDER_<id>`, `source_transaction=<charge id>`, and an **Idempotency-Key** `release-<orderId>`.
   - Mark order `status = released`, store `transferId`, `stripeFeeCents`, `payoutCents`, `releasedAt`. Use a conditional update (`status = held`) so a double run can't pay twice.
   - Run it from an EventBridge schedule (hourly) invoking the Auth-API Lambda with `{ "danzstakJob": "release-orders" }`; route that in index.mjs before HTTP handling.
2. **Refund before the show** (buyer): `POST /marketplace/orders/<id>/refund-quote` and `/refund-accept`, same pattern as `tour-manager-billing.mjs` member refunds (owner rule: refund = price minus Stripe's fee; buyer accepts the exact amount first). Allowed only while `status = held`, before the event starts, and no ticket checked in. Refund via `POST /v1/refunds` (payment_intent, amount, idempotency key). Mark tickets `refunded` (door list shows them crossed out) and the order `refunded`; release the tier `sold` count.
3. **Disputes**: handle `charge.dispute.created` in the marketplace webhook → order `status = disputed` (never released). Add that event to the sandbox webhook endpoint (`/marketplace/stripe/webhook`).
4. **Promoter view**: on event.html (organizer), show per-event totals: sold, held, released, refunded, and expected payout date.

## Tests (new test-ticket-release.cjs)
- Released only after `releaseAfter`; never twice (idempotent); never while disputed/problem/unverified.
- Payout math: $20 × 2 tickets, fee 5% = $2.00, Stripe fee 146¢ → transfer 3654¢.
- Refund only before the show, only unused tickets, amount = paid − Stripe fee, needs accept.

## Done when
CI green, sandbox run-through: buy with card 4242 4242 4242 4242 → order held → set releaseAfter in the past → job transfers to the test promoter account → order released. Update docs/SESSION-HANDOFF.md.
