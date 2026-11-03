# DANZSTAK Stripe Integration

**Branch:** `danzstak-patch-1`  
**Status:** Test-mode implementation complete locally; Stripe-hosted checkout/webhook validation is blocked by an account/Price mismatch and missing webhook secret.
**Account decision:** DANZSTAK intentionally uses the existing SFScoop Stripe account. Do not create a second Stripe account and do not modify SFScoop's existing checkout or webhook behavior.

## Product configuration

| Feature | Price | Product ID | Price ID | Billing |
| --- | --- | --- | --- | --- |
| Intermediate: Unlock Booking Contact | $0.75 per venue | `prod_VYruR0GLph8xsy` | `price_1UXkB5FgtfNMBXOVVeUOGJjX` | One-time |
| Professional: Tour Manager / booking-email unit | $1.50 | `prod_VYr5JIwpaFSX7b` | `price_1UXjMtFgtfNMBXOVCLeEk8vI` | One-time |
| DANZSTAK assigned-number activation | $3.00 expected | `prod_VYrUnT8yvXS0Ek` | `price_1UXjlYFgtfNMBXOVD42xjrTc` | One-time |

The backend fails closed unless Stripe returns these exact Price and Product IDs, currency, one-time quantity and unit amount. On 2026-11-03 the AWS secret `danzstak/stripe/secret-key` was confirmed to contain a test key, but all three supplied Price IDs returned Stripe `404`. That key resolves to account `acct_1UXmCxDahXMLrQax`, which has zero active one-time Test Mode Prices and reports card charges disabled. This is not evidence that the live Prices are invalid; it proves only that they are unavailable to this Test Mode account/key. Do not recreate them or change SFScoop configuration. Supply a restricted Test Mode key for the existing SFScoop account and confirm that account contains test counterparts before continuing.

## Feature entitlements

- **Beginner / Bedroom (free):** Social network and discovery of clubs, radio stations, and record stores; professional contacts locked.
- **Intermediate / Garage ($0.75 per venue):** Unlock one verified club booking contact permanently for that user; no EPK automation, calendar, routing, or professional radio/store contacts.
- **Professional / Rehearsal Room ($1.50 one-time):** A verified Tour Manager purchase activates the Professional entitlement and grants the purchased booking-email units. Available professional features remain subject to their own operational readiness and sending controls. No expiration is applied by this implementation.
- **Assigned number:** Separate one-time product; do not assume it includes external carrier/SMS service.

## Webhook implementation checklist

1. Replace or correct the AWS test secret with a restricted Test Mode key for the existing SFScoop Stripe account. Retrieve all three test Price counterparts and verify Product ID, active status, USD amount, one-time type and `livemode=false`. Do not put a live key into the test Lambda.
2. Public HTTPS webhook receiver: `https://api.danzstak.com/tour-manager/stripe/webhook`. The route exists in API Gateway, but the current test Lambda has no Stripe secret or webhook secret and is therefore not operational.
3. In Stripe test mode, register that destination for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.
4. Verify Stripe signatures using the webhook signing secret stored only in a secure backend secret manager. Never commit `sk_` or `whsec_` credentials.
5. Fulfill entitlements only after confirmed successful payment. Validate account, price, user, and selected venue server-side. Make processing idempotent; prevent duplicate charges/unlocks.
6. Handle refunds, failed or delayed payments, and Stripe retries safely.
7. Test each tier and the assigned-number entitlement with Stripe-hosted test transactions and controlled accounts. A phone purchase creates `pending_provisioning`; it does not assign a number until a telecommunications provider confirms provisioning.
8. Record the deployed endpoint URL, selected event names, test evidence, commit SHA, and deployment status in `docs/DANZSTAK-DEVELOPMENT-REPORT.md`.
9. Do not enable live payments until the existing account's live keys, live prices, live webhook, and entitlement tests are verified.

## Implemented routes

- `POST /tour-manager/checkout` — Tour Manager / booking-email Checkout.
- `POST /tour-manager/contact-unlock/checkout` — one saved venue contact Checkout.
- `POST /phone-number/checkout` — one assigned-number activation Checkout.
- `POST /tour-manager/stripe/webhook` — common signed Stripe fulfillment endpoint for all three products.
- `GET /tour-manager/credits`, `GET /tour-manager/contact-unlocks`, and `GET /phone-number/entitlement` — account-isolated entitlement state.

All fulfillment uses DynamoDB conditional transactions and a global Stripe event record for retry idempotency. Ledger entries retain a `paymentMethod` field so a future independently verified Phantom/SFS Token processor can grant the same provider-neutral entitlements. No Phantom or token-payment path is active.

## Security note

If any Stripe secret was ever committed, removing it from the current file is insufficient: rotate/revoke the exposed secret and investigate Git history. Public product and price IDs are not secret credentials.
