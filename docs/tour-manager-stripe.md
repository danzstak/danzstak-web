# Tour Manager Stripe credits

The Tour Manager billing endpoint sells one booking-email credit per unit of Stripe Price `price_1UXjMtFgtfNMBXOVCLeEk8vI`. The backend independently requires a USD unit amount of 150 cents; changing the Stripe Price amount without changing and reviewing the backend causes the webhook to reject the purchase.

The same service sells a venue-specific booking-contact unlock using Product `prod_VYruR0GLph8xsy` and Price `price_1UXkB5FgtfNMBXOVVeUOGJjX`. The expected one-time Price is USD 0.75. The backend independently verifies the full Price ID, Product ID, product metadata, one-unit quantity, USD currency, and 75-cent total before creating an entitlement.

Assigned-number activation uses Product `prod_VYrUnT8yvXS0Ek` and Price `price_1UXjlYFgtfNMBXOVD42xjrTc`, expected at USD 3.00 one time. Verified payment creates only a `pending_provisioning` entitlement. It does not assign a number or promise that the one-time payment covers carrier rental, calling or messaging costs.

## Routes

- `POST /tour-manager/checkout` — authenticated DanzStak member; accepts `{ "quantity": 1..500 }` and creates a Stripe Checkout session.
- `POST /tour-manager/stripe/webhook` — public Stripe webhook; accepts only signed Stripe events.
- `GET /tour-manager/credits` — authenticated member; returns remaining, purchased, reserved, and sent counts plus recent ledger activity.
- `GET /tour-manager/outreach` — authenticated member; returns the account's provider-submission state for the Tour Manager dashboard without exposing another member's records.
- `POST /tour-manager/emails/send` — authenticated member; reserves one credit, validates the saved venue contact, submits through Amazon SES, and finalizes or restores the credit from the provider result.
- `POST /tour-manager/contact-unlock/checkout` — authenticated member; creates a one-time Checkout only for a saved venue with a direct public contact.
- `GET /tour-manager/contact-unlocks` — authenticated member; returns active venue-specific contact entitlements.
- `POST /phone-number/checkout` — authenticated member; creates a one-time assigned-number activation Checkout.
- `GET /phone-number/entitlement` — authenticated member; distinguishes paid/pending provisioning from an active provider-provisioned number.

Official websites, maps, and source evidence remain visible without payment. Direct email and phone controls remain hidden in the Tour Manager until the signed webhook grants the account-and-venue-specific entitlement. Repeat purchases return the existing entitlement instead of opening another Checkout Session. A public contact is still only a lead and does not guarantee availability, genre fit, or acceptance of unsolicited pitches.

The webhook verifies the exact unmodified request body, the endpoint signing secret, a five-minute timestamp tolerance, event and session IDs, Stripe test/live environment, `payment_status=paid`, `status=complete`, `mode=payment`, USD currency, the configured Price ID, amount, quantity, total, metadata, authenticated-user checkout record, and the session returned directly by Stripe. A DynamoDB transaction records the event, closes the pending checkout, adds a provider-neutral ledger entry, and grants access exactly once. Full refund events are matched back to the Stripe Checkout Session and persistent DANZSTAK purchase before access is reversed; partial refunds create a manual-review ledger entry. Ledger entries identify `paymentMethod=stripe`; a future verified SFS Token processor can write to the same balance without sharing Stripe verification code.

## Required AWS secrets and Lambda configuration

- `danzstak/stripe/secret-key` — Stripe test key retrieved at runtime through the Lambda IAM role.
- `danzstak/stripe/webhook-secret` — endpoint-specific signing secret retrieved separately at runtime.
- `TOUR_MANAGER_LIVE_PAYMENTS` — omit or set to `false` during testing. Live Stripe keys fail closed unless this is explicitly `true` after review.

Never store keys in the repository or logs. The deployment policy grants only `secretsmanager:GetSecretValue` for these two secret ARNs. The deployment preflight refuses to alter Lambda if either secret is absent or unreadable.

## Stripe test configuration

Webhook URL: `https://api.danzstak.com/tour-manager/stripe/webhook`

Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`. Configure the endpoint in Stripe test mode first, save its endpoint-specific signing secret to `danzstak/stripe/webhook-secret`, and run a Stripe test-card checkout. A delayed Checkout completion remains pending until the async success event; async failure and expiration grant no credits. Confirm one successful payment grants exactly the purchased quantity, a webhook retry grants zero additional credits, invalid signatures are rejected, mismatched sessions do not grant credits, and a controlled full refund reverses only its matching entitlement. Do not enable `TOUR_MANAGER_LIVE_PAYMENTS` until the complete Stripe-hosted test and refund/dispute policy are reviewed.

The configured Stripe secret, Price objects and webhook signing secret must all belong to the same approved mode and account before operational payment processing is enabled. The endpoint fails closed when that verification is incomplete.
