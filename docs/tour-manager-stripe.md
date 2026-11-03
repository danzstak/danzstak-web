# Tour Manager Stripe credits

The Tour Manager billing endpoint sells one booking-email credit per unit of Stripe Price `price_1UXjMtFgtfNMBXOVCLeEk8vI`. The backend independently requires a USD unit amount of 150 cents; changing the Stripe Price amount without changing and reviewing the backend causes the webhook to reject the purchase.

The same service sells a venue-specific booking-contact unlock using Product `prod_VYruR0GLph8xsy` and Price `price_1UXkB5FgtfNMBXOVVeUOG`. The Stripe dashboard shows that active one-time Price as USD 0.75. The backend independently verifies the Price ID, product metadata, one-unit quantity, USD currency, and 75-cent total before creating an entitlement.

## Routes

- `POST /tour-manager/checkout` — authenticated DanzStak member; accepts `{ "quantity": 1..500 }` and creates a Stripe Checkout session.
- `POST /tour-manager/stripe/webhook` — public Stripe webhook; accepts only signed Stripe events.
- `GET /tour-manager/credits` — authenticated member; returns remaining, purchased, reserved, and sent counts plus recent ledger activity.
- `GET /tour-manager/outreach` — authenticated member; returns the account's provider-submission state for the Tour Manager dashboard without exposing another member's records.
- `POST /tour-manager/emails/send` — authenticated member; reserves one credit, validates the saved venue contact, submits through Amazon SES, and finalizes or restores the credit from the provider result.
- `POST /tour-manager/contact-unlock/checkout` — authenticated member; creates a one-time Checkout only for a saved venue with a direct public contact.
- `GET /tour-manager/contact-unlocks` — authenticated member; returns active venue-specific contact entitlements.

Official websites, maps, and source evidence remain visible without payment. Direct email and phone controls remain hidden in the Tour Manager until the signed webhook grants the account-and-venue-specific entitlement. Repeat purchases return the existing entitlement instead of opening another Checkout Session. A public contact is still only a lead and does not guarantee availability, genre fit, or acceptance of unsolicited pitches.

The webhook verifies the exact unmodified request body, the endpoint signing secret, a five-minute timestamp tolerance, event and session IDs, Stripe test/live environment, `payment_status=paid`, `status=complete`, `mode=payment`, USD currency, the configured Price ID, the 150-cent unit amount, quantity, total, metadata, authenticated-user checkout record, and the session returned directly by Stripe. A DynamoDB transaction records the event, closes the pending checkout, adds a provider-neutral ledger entry, and increments credits exactly once. Ledger entries identify `paymentMethod=stripe`; a future verified SFS Token processor can write to the same balance without sharing Stripe verification code.

## Required Lambda environment

- `STRIPE_SECRET_KEY` — start with a Stripe test key.
- `STRIPE_TOUR_MANAGER_WEBHOOK_SECRET` — the signing secret for this endpoint only.
- `TOUR_MANAGER_LIVE_PAYMENTS` — omit or set to `false` during testing. Live Stripe keys fail closed unless this is explicitly `true` after review.

Never store keys in the repository. During isolated testing, configure them as encrypted Lambda environment values using a secure operator workflow. Before live launch, store both in AWS Secrets Manager and grant only the Tour Manager Lambda access to those exact secret ARNs.

## Stripe test configuration

Webhook URL: `https://api.danzstak.com/tour-manager/stripe/webhook`

Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Configure the endpoint in Stripe test mode first, save its endpoint-specific `whsec_...` signing secret, and run a Stripe test-card checkout. A delayed Checkout completion remains pending until the async success event; async failure and expiration grant no credits. Confirm one successful payment grants exactly the purchased quantity, a webhook retry grants zero additional credits, invalid signatures are rejected, and mismatched sessions do not grant credits. Do not enable `TOUR_MANAGER_LIVE_PAYMENTS` until the complete Stripe-hosted test and refund/dispute policy are reviewed.
