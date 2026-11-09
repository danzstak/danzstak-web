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
- the selected exact-pair DexScreener quote policy, risk limits and operational monitoring;
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

## Bazaar payment boundary

The Bazaar may offer SFS only after it preserves the same server-owned order, inventory, delivery, refund, dispute and tax rules as Stripe. A direct buyer-to-seller token transfer cannot be represented as protected Buy It Now because DanzStak cannot delay, reverse or reliably adjudicate that transfer. It may exist later only as a clearly unprotected person-to-person wallet action outside protected marketplace Checkout, and only if the owner deliberately expands the current no-wallet-feature product boundary.

On 2026-11-09, a finalized mainnet Solana RPC read verified the owner-supplied mint `H2147Ppmd4CESHuCzPQf89rNnEgKrx98NDF4vi6HZZeK` as a Token-2022 **SFS Token / SFS** mint with two decimals, no freeze authority and an active mint/update authority. The currently indexed Raydium SFS/SOL pair is `AzeRe3RMmHPTG2Tkh4HLV3npHz1BsQhS856QVK4y1FQN`. Finalized reads also verified owner-supplied settlement wallet `8Cx5YqBgS43uqDrBzeSpDyBoQSp9fH71SwQ1e39m631C` and its initialized SFS token account `8haVhbmoDEkRNp3TGzbgmM4zjDbxy5BMhVp9m1Gtn548`.

The owner selected DexScreener as the server-side quote source using the exact Solana pair endpoint. Quotes expire after three minutes, round up to `0.01 SFS`, carry a one-time order nonce and fail closed on any identity, price, liquidity, expiry or risk-limit failure. The initial risk policy requires at least `$5,000` reported pool liquidity and limits an order to `1%` of pool liquidity. Each order gets a Solana Pay QR and same-device link containing the native settlement wallet as recipient, the exact SFS mint and amount, and an opaque unique reference; a static receive-wallet QR is never used for checkout. These are proposed public identifiers and controls only; activation remains blocked on an owner-approved signing mechanism/program, finality, RPC verification, refunds, tax treatment and controlled security tests.

The owner describes the current pool relationship as approximately `300 SFS = 1 SOL`, with an intended later transition to a `$0.50` SFS/USDC market when SOL reaches `$150` or more. That is token policy, not a hard-coded checkout price. DanzStak continues reading the exact approved SFS/SOL pair until the replacement SFS/USDC market or mechanism is live, independently verifiable and explicitly approved.

Members may obtain SFS from independent external sources before returning to Checkout. DanzStak does not advertise or integrate another platform account, treat an external handoff as proof of payment, award tokens, sell or swap SFS, custody funds, mark up SFS, or send member data to an external destination. Checkout refreshes the quote after the member returns. Any direct external acquisition link requires jurisdiction and financial-promotion review; it remains absent from the active product.
