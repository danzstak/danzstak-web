# DANZSTAK development report

## Stripe products and Tour Manager credits

Status as of 2026-11-03: test infrastructure implemented; live payments disabled.

### Unlock Booking Contact

- Status: **COMPLETE in development; NOT DEPLOYED**.
- Stripe Product: `prod_VYruR0GLph8xsy`
- Stripe Price: `price_1UXkB5FgtfNMBXOVVeUOG`
- Dashboard verification: active, USD 0.75 one time.
- Implementation: uses the existing Tour Manager Stripe Checkout and signed webhook. Checkout is limited to a saved venue with a public direct contact. Successful verified payment creates one account-and-venue-specific entitlement; webhook retries and repeat purchases do not duplicate the entitlement or charge flow.
- Interface: official website, map, and evidence stay available; direct email/phone and email outreach remain locked until the entitlement is active. Locked contacts are excluded from CSV contact exports.
- Tests: fixed Price and amount, saved-contact validation, signature verification, tampered-amount rejection, entitlement persistence, duplicate webhook protection, and repeat-purchase prevention pass locally.
- Deployment: no production deployment or live payment activation was performed.

### Tour Manager booking emails

- Stripe Product: `prod_VYr5JIwpaFSX7b`
- Stripe Price: `price_1UXjMtFgtfNMBXOVCLeEk8vI`
- Expected amount: USD 1.50 one time for each booking-email credit.
- Implementation: Checkout quantities, signed webhook verification, immediate and delayed payment handling, DynamoDB credit ledger, duplicate-event protection, booking-email reservation, provider acceptance, failed-send restoration, and balance/history UI are implemented on `codex/tour-manager-stripe-webhook`.
- Test status: local signature, amount, delayed-payment, idempotency, ledger, reservation, final deduction, failed-send restoration, and Amazon SES mailbox-simulator tests pass.
- Blocker: no Stripe test secret or endpoint signing secret is configured, so the Price object and a Stripe-hosted checkout/webhook cycle have not been verified.

### DANZSTAK phone number

- Stripe Product: `prod_VYrUnT8yvXS0Ek`
- Stripe Price: `price_1UXjlYFgtfNMBXOVD42xjrTc`
- Expected amount: USD 3.00 one time. The dashboard product and amount were verified on 2026-11-03.
- Implementation status: intentionally not implemented yet and outside this booking-contact task. The product and displayed amount were verified in the dashboard, but the local environment and isolated AWS test Lambda still do not have a Stripe test secret for an end-to-end phone-entitlement test.
- Planned entitlement: a verified successful payment will create one idempotent phone-activation entitlement. It will not add booking-email credits. Activation will remain pending until the telecommunications provider confirms provisioning.
- Cost boundary: the one-time activation fee will not be represented as covering number rental, calls, messages, carrier charges, recurring costs, or permanent number availability. Those costs and any renewal policy must be independently configurable before launch.

### Required test configuration

The isolated Lambda is `DANZSTAK-TourManager-Stripe-Test`. It currently has live payments disabled and no Stripe secrets.

Required server-side configuration, without committing secret values:

- `STRIPE_SECRET_KEY`: Stripe test restricted or secret key for the account containing both Prices.
- `STRIPE_TOUR_MANAGER_WEBHOOK_SECRET`: endpoint-specific test webhook signing secret.
- `TOUR_MANAGER_LIVE_PAYMENTS=false`: retain during testing.

Public test webhook URL:

`https://api.danzstak.com/tour-manager/stripe/webhook`

Required webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Before phone-product implementation, retrieve both Price objects from Stripe and verify their active status, currency, unit amount, one-time type, livemode value, Product IDs, and shared Stripe account. Do not activate live processing until both products have complete test-mode checkout, webhook, duplicate-event, entitlement, provisioning-failure, and recovery tests.
