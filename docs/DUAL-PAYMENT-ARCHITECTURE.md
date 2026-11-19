# DANZSTAK dual-payment entitlement architecture

Status: **Stripe implemented locally; Stripe-hosted test blocked; SFS/Phantom disabled and not implemented**.

## Non-negotiable boundaries

- Stripe and SFS Token via Phantom are the only approved payment methods. They share DanzStak entitlements but keep independent verification paths.
- SFS is payment only. DANZSTAK does not award, let members earn, hold, custody, exchange or display a stored SFS balance, and it does not require or integrate another platform account.
- DANZSTAK remains fully usable without Phantom, a crypto wallet, or SFS Tokens. Card checkout and free functionality must not depend on wallet infrastructure.
- The existing SFS token contract, liquidity pool and token economics are outside this integration and must not be modified.
- No entitlement is granted from a client assertion. A trusted server-side verifier must first produce final payment evidence.

## Shared entitlement model

Payment verification and entitlement fulfillment are separate responsibilities:

1. A payment adapter verifies one provider's payment using provider-specific evidence.
2. The adapter emits normalized evidence containing `paymentMethod`, an immutable `paymentReference`, authenticated DANZSTAK user ID, purchase type, amount, currency/token quantity, environment/network and settlement time.
3. The entitlement service validates the purchase request and atomically writes the provider event, purchase record, entitlement and ledger entry.
4. A repeated provider reference or entitlement request returns the existing result and never grants access twice.

The existing DynamoDB records already use this separation:

- Professional Tour Manager: `TOUR_MANAGER#PROFESSIONAL_ENTITLEMENT`
- Booking contact: `TOUR_MANAGER#CONTACT_UNLOCK#<venueKey>`
- Assigned-number activation: `PHONE#ACTIVATION_ENTITLEMENT`
- Booking-email balance: `TOUR_MANAGER#BOOKING_EMAIL_CREDITS`
- Provider-neutral history: `TOUR_MANAGER#LEDGER#<timestamp>#<providerEventId>` with `paymentMethod` and `paymentReference`

Stripe currently writes `paymentMethod=stripe`. A future SFS adapter must write `paymentMethod=sfs` into the same entitlement and ledger structures after independent verification. It must not call the Stripe webhook or share Stripe signature logic.

## Stripe adapter — current implementation

- Creates Stripe Checkout Sessions using the three existing Price IDs.
- Receives the raw webhook body at `https://api.danzstak.com/tour-manager/stripe/webhook`.
- Verifies the endpoint signature and timestamp, then re-fetches the Checkout Session from Stripe.
- Validates Product, Price, amount, currency, quantity, environment, authenticated-user binding and the stored pending checkout.
- Uses Stripe event IDs and DynamoDB conditional transactions for idempotent fulfillment.
- Fails closed when test secrets are absent and when a live key is supplied without the explicit live-payments gate.

Stripe is **not operationally complete** until the three Price objects and full hosted Checkout/webhook flow pass in Test Mode using the configured Stripe account.

## Future Phantom/SFS adapter — blocked design

The SFS adapter must not be enabled until the owner approves all of the following:

- exact blockchain network and cluster;
- canonical SFS token contract/mint address and token decimals;
- DANZSTAK receiving wallet or reviewed payment-program address;
- authoritative USD-to-SFS quote source, quote lifetime and rounding rule;
- wallet ownership challenge format, domain binding, nonce lifetime and replay protection;
- minimum confirmation/finality rule and chain reorganization policy;
- transaction parsing rules that verify sender, receiver, mint, amount and unique reference/memo;
- refund/reversal policy and operational monitoring;
- Phantom SDK origin/CSP permissions and supported mobile deep-link behavior.

Proposed flow after approval:

1. Authenticated user chooses a DANZSTAK purchase and requests a short-lived server quote.
2. Server returns purchase ID, exact SFS amount, approved receiver, network, expiry and one-time nonce.
3. Phantom connects only after explicit user action. The wallet signs a domain-bound ownership challenge; connecting alone grants nothing.
4. User reviews and signs the token transfer in Phantom.
5. Client submits only the transaction signature and purchase ID.
6. Server queries an approved chain RPC, waits for the configured finality and independently validates mint, decimals, sender, receiver, amount, reference and quote expiry.
7. A conditional record keyed by network plus transaction signature prevents reuse. Only then does the shared entitlement transaction run with `paymentMethod=sfs`.

Connecting Phantom, signing a challenge, submitting an unconfirmed transaction or presenting a client-computed token amount must never grant access.

## Required tests before SFS activation

- valid wallet-ownership challenge and rejection of expired, wrong-domain and replayed signatures;
- wrong network, mint, receiver, sender, amount, decimals and expired quote rejection;
- failed, unconfirmed and reorganized transaction handling;
- duplicate transaction submission across users and purchase types;
- atomic entitlement idempotency under concurrent requests;
- parity tests proving Stripe and SFS unlock the same purchase-specific entitlement but retain distinct payment evidence;
- Phantom desktop extension, Android and iPhone flows;
- operation when Phantom and the SFS verification provider are unavailable;
- privacy, CSP, dependency and wallet-phishing review.

No Phantom dependency, wallet button, token quote endpoint, receiving address or SFS transaction verifier is present in the application today.
