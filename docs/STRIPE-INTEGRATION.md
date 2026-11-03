# DANZSTAK Stripe Integration

**Branch:** `danzstak-patch-1`  
**Status:** Test-mode implementation complete locally; the AWS credential now authenticates to the intended SFScoop account, but Stripe-hosted validation is blocked because the supplied Prices are unavailable in Test Mode and the endpoint signing secret is missing.
**Account decision:** DANZSTAK intentionally uses the existing SFScoop Stripe account. Do not create a second Stripe account and do not modify SFScoop's existing checkout or webhook behavior.

## Product configuration

| Feature | Price | Product ID | Price ID | Billing |
| --- | --- | --- | --- | --- |
| Intermediate: Unlock Booking Contact | $0.75 per venue | `prod_VYruR0GLph8xsy` | `price_1UXkB5FgtfNMBXOVVeUOGJjX` | One-time |
| Professional: Tour Manager / booking-email unit | $1.50 | `prod_VYr5JIwpaFSX7b` | `price_1UXjMtFgtfNMBXOVCLeEk8vI` | One-time |
| DANZSTAK assigned-number activation | $3.00 expected | `prod_VYrUnT8yvXS0Ek` | `price_1UXjlYFgtfNMBXOVD42xjrTc` | One-time |

The backend fails closed unless Stripe returns these exact Price and Product IDs, currency, one-time quantity and unit amount. On 2026-11-03 the updated AWS secret `danzstak/stripe/secret-key` authenticated in Test Mode to Stripe account `acct_1RRZmKFgtfNMBXOV`, display name **SFScoop**. Charges and payouts are enabled on that account. All three supplied Price IDs returned Stripe Test Mode `resource_missing`, so their amounts, billing types, Product relationships, and active states cannot be verified with this test key. This is consistent with the supplied IDs being Live Mode objects, but live configuration remains unverified because no live credential was used. No replacement Product or Price was created.

## Feature entitlements

- **Beginner / Bedroom (free):** Social network and discovery of clubs, radio stations, and record stores; professional contacts locked.
- **Intermediate / Garage ($0.75 per venue):** Unlock one verified club booking contact permanently for that user; no EPK automation, calendar, routing, or professional radio/store contacts.
- **Professional / Rehearsal Room ($1.50 one-time):** A verified Tour Manager purchase activates the Professional entitlement and grants the purchased booking-email units. Available professional features remain subject to their own operational readiness and sending controls. No expiration is applied by this implementation.
- **Assigned number:** Separate one-time product; do not assume it includes external carrier/SMS service.

## Webhook implementation checklist

1. Supply the approved existing Test Mode Price IDs for the three products in account `acct_1RRZmKFgtfNMBXOV`, if they already exist. The current live-looking IDs cannot be used for a test transaction. Do not recreate or alter live SFScoop Products as a workaround.
2. Public HTTPS webhook receiver: `https://api.danzstak.com/tour-manager/stripe/webhook`. The route exists in API Gateway, but `danzstak/stripe/webhook-secret` does not exist, so the test deployment correctly stops before changing Lambda and the endpoint is not operational for Stripe.
3. In Stripe test mode, register that destination for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
4. Verify Stripe signatures using the webhook signing secret stored only in a secure backend secret manager. Never commit `sk_` or `whsec_` credentials.
5. Fulfill entitlements only after confirmed successful payment. Validate account, price, user, and selected venue server-side. Make processing idempotent; prevent duplicate charges/unlocks.
6. Full refunds revoke the matching contact or phone entitlement, or reverse the matching email-credit purchase. Partial refunds are recorded for manual review without silently changing access. Stripe event IDs make retries idempotent.
7. Test each tier and the assigned-number entitlement with Stripe-hosted test transactions and controlled accounts. A phone purchase creates `pending_provisioning`; it does not assign a number until a telecommunications provider confirms provisioning.
8. Record the deployed endpoint URL, selected event names, test evidence, commit SHA, and deployment status in `docs/DANZSTAK-DEVELOPMENT-REPORT.md`.
9. Do not enable live payments until the existing account's live keys, live prices, live webhook, and entitlement tests are verified.

## Implemented routes

- `POST /tour-manager/checkout` — Tour Manager / booking-email Checkout.
- `POST /tour-manager/contact-unlock/checkout` — one saved venue contact Checkout.
- `POST /phone-number/checkout` — one assigned-number activation Checkout.
- `POST /tour-manager/stripe/webhook` — common signed Stripe fulfillment endpoint for all three products.
- `GET /tour-manager/credits`, `GET /tour-manager/contact-unlocks`, and `GET /phone-number/entitlement` — account-isolated entitlement state.

All fulfillment uses DynamoDB conditional transactions and a global Stripe event record for retry idempotency. The backend retrieves the Stripe API and webhook secrets at runtime through its AWS IAM role from separate Secrets Manager records and never places their values in Git, Lambda configuration, or logs. Ledger entries retain a `paymentMethod` field so a future independently verified Phantom/SFS Token processor can grant the same provider-neutral entitlements. No Phantom or token-payment path is active.

## Security note

If any Stripe secret was ever committed, removing it from the current file is insufficient: rotate/revoke the exposed secret and investigate Git history. Public product and price IDs are not secret credentials.
