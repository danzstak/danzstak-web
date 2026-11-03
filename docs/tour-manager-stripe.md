# Tour Manager Stripe credits

The Tour Manager billing endpoint sells one booking-email credit per unit of Stripe Price `price_1UXjMtFgtfNMBXOVCLeEk8vI`. The backend independently requires a USD unit amount of 150 cents; changing the Stripe Price amount without changing and reviewing the backend causes the webhook to reject the purchase.

## Routes

- `POST /tour-manager/checkout` — authenticated DanzStak member; accepts `{ "quantity": 1..500 }` and creates a Stripe Checkout session.
- `POST /tour-manager/stripe/webhook` — public Stripe webhook; accepts only signed Stripe events and handles `checkout.session.completed`.
- `GET /tour-manager/credits` — authenticated DanzStak member; returns the current booking-email credit balance.

The webhook verifies the exact unmodified request body, the endpoint signing secret, a five-minute timestamp tolerance, event and session IDs, Stripe test/live environment, `payment_status=paid`, `status=complete`, `mode=payment`, USD currency, the configured Price ID, the 150-cent unit amount, quantity, total, metadata, authenticated-user checkout record, and the session returned directly by Stripe. A DynamoDB transaction records the event, closes the pending checkout, and increments credits exactly once.

## Required Lambda environment

- `STRIPE_SECRET_KEY` — start with a Stripe test key.
- `STRIPE_TOUR_MANAGER_WEBHOOK_SECRET` — the signing secret for this endpoint only.
- `TOUR_MANAGER_LIVE_PAYMENTS` — omit or set to `false` during testing. Live Stripe keys fail closed unless this is explicitly `true` after review.

Never store keys in the repository. Configure them through the Lambda environment using a secure operator workflow; production should move them to Secrets Manager before live launch.

## Stripe test configuration

Webhook URL: `https://api.danzstak.com/tour-manager/stripe/webhook`

Subscribe only to `checkout.session.completed`. Configure the endpoint in Stripe test mode first, save its `whsec_...` signing secret, and run a Stripe test-card checkout. Confirm one successful payment grants exactly the purchased quantity, a webhook retry grants zero additional credits, invalid signatures are rejected, and unpaid/mismatched sessions do not grant credits. Do not enable `TOUR_MANAGER_LIVE_PAYMENTS` until those tests and refund/dispute policy are reviewed.
