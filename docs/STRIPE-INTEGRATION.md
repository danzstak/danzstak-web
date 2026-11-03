# DANZSTAK Stripe Integration

**Branch:** `danzstak-patch-1`  
**Status:** Configuration pending verification and end-to-end tests.  
**Important:** The product/price IDs below were provided before the owner requested a separate DANZSTAK Stripe account. They must be verified against the NEW account; do not assume they work there.

## Product configuration

| Feature | Price | Product ID | Price ID | Billing |
| --- | --- | --- | --- | --- |
| Intermediate: Unlock Booking Contact | $0.75 per venue | `prod_VYruR0GLph8xsy` | `price_1UXkB5FgtfNMBXOVVeUOGJjX` | One-time |
| Professional: Tour Manager | $1.50 | **Verify full ID in Stripe** (previously supplied partial `prod_VYr5JI`) | `price_1UXjMtFgtfNMBXOVCLeEk8vI` | One-time |
| DANZSTAK assigned number | Verify configured amount | `prod_VYrUnT8yvXS0Ek` | `price_1UXjlYFgtfNMBXOVD42xjrTc` | One-time |

These are historical configuration references, NOT confirmed live configuration for the new account. If products are recreated in the new account, replace the IDs after checking them in Stripe. Do not publish API secrets.

## Feature entitlements

- **Beginner / Bedroom (free):** Social network and discovery of clubs, radio stations, and record stores; professional contacts locked.
- **Intermediate / Garage ($0.75 per venue):** Unlock one verified club booking contact permanently for that user; no EPK automation, calendar, routing, or professional radio/store contacts.
- **Professional / Rehearsal Room ($1.50 one-time):** Available club, radio, and record-store professional contacts; artist-approved EPK outreach; booking email replies in DANZSTAK Chat; confirmed-date calendar; route optimization and Tour Book. No additional per-venue unlock fee. Confirm the intended entitlement duration with the owner before implementing expiration or lifetime access.
- **Assigned number:** Separate one-time product; do not assume it includes external carrier/SMS service.

## Webhook implementation checklist

1. Confirm the Stripe account ID and whether each product/price belongs to the new DANZSTAK account.
2. Deploy an authenticated HTTPS webhook receiver and record its **public endpoint URL** here: **PENDING CODEX**.
3. In Stripe test mode, register a webhook destination for events required by the implementation. Consider `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and refund events. Determine final exact event selection from the payment design.
4. Verify Stripe signatures using the webhook signing secret stored only in a secure backend secret manager. Never commit `sk_` or `whsec_` credentials.
5. Fulfill entitlements only after confirmed successful payment. Validate account, price, user, and selected venue server-side. Make processing idempotent; prevent duplicate charges/unlocks.
6. Handle refunds, failed or delayed payments, and Stripe retries safely.
7. Test each tier and the assigned-number entitlement with Stripe test transactions and controlled accounts.
8. Record the deployed endpoint URL, selected event names, test evidence, commit SHA, and deployment status in `docs/DANZSTAK-DEVELOPMENT-REPORT.md`.
9. Do not enable live payments until the new account's live keys, live prices, live webhook, and entitlement tests are verified.

## Security note

If any Stripe secret was ever committed, removing it from the current file is insufficient: rotate/revoke the exposed secret and investigate Git history. Public product and price IDs are not secret credentials.
