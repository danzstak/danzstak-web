# Task 11 — Checkout consent, partial use and chargeback evidence

## Owner direction (2026-11-16)
Maximum refund protection for DanzStak direct purchases (credits, contact unlocks, DanzStak numbers, AI EPK): the EU right of withdrawal, partial use, card-fee deduction, chargeback deterrence against "friendly" chargebacks, usage logs submitted to defeat chargebacks, and "the user must click an unchecked box or a dedicated confirmation". The final wording of ToS 8A waits for the lawyer (packet, Nov 20). Build the mechanics now, behind the current 8A text.

## Build
1. **Consent at checkout** (every DanzStak direct purchase, before redirecting to Stripe):
   - An **unchecked** checkbox, required: "I want this delivered right away. I understand that once it's used I lose my right to withdraw and get a refund." Plus a link to ToS 8A. It can't be pre-ticked and can't be bypassed (the server rejects checkout without `consent:true`).
   - Shows the price, what counts as "used" for this item, and the refund rule.
   - Stored server-side: `CONSENT#<orderId>` with timestamp, terms version and hash, IP (truncated per privacy policy), user agent, and the exact wording shown.
2. **Confirmation email** after payment, repeating the item, price, the consent given and the refund rule (the EU "durable medium"). Sent via SES us-east-1 like ticket emails.
3. **Partial use**: credit packs track `creditsUsed` / `creditsUnused`. A refund request computes the amount from unused credits only. Until the lawyer answers Q1–Q2 in the packet, EU buyers within 14 days of purchase get unused credits refunded **without** fee deduction (feature flag `REFUND_EU_FULL_UNUSED=on`); everyone else gets current 8A (minus the Stripe fee, after accepting the exact amount).
4. **Usage logs** (append-only): every consumption event (email queued, email sent, contact shown, number activated, AI draft shown) with order id, timestamp and item id. The member can see their own log in Your data.
5. **Dispute evidence**: on Stripe webhook `charge.dispute.created`, assemble evidence automatically (consent record, terms version, confirmation email, usage log, account age, IP/device match) and submit via the Stripe Disputes API (`evidence` fields: `customer_purchase_ip`, `access_activity_log`, `refund_policy`, `refund_policy_disclosure`, `service_date`, `uncategorized_text`). Owner gets an email with the dispute and what was sent. Freeze the disputed items (revoke unused credits); don't auto-ban. Account suspension is a manual owner decision.
6. **Pre-dispute deflection**: a visible "Problem with a purchase? Ask us first" link on receipts and in Your data, answered within 2 business days.

## Tests
- Checkout without the box ticked → 400; the box is never pre-ticked.
- Consent record and confirmation email exist for every paid order.
- Partial refund equals unused credits × unit price (EU in-window: no fee deduction while the flag is on).
- A dispute webhook submits evidence once (idempotent) and freezes unused items.
- Usage log entries can't be edited or deleted by the app.
