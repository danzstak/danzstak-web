# DanzStak Bazaar commerce

Status: **TEST-MODE IMPLEMENTATION ON REVIEW BRANCH; FAIL-CLOSED; NOT DEPLOYED.**

## Scope

This release candidate adds fixed-price Checkout and delivery-based seller payouts for physical products in member shops and the DanzStak Bazaar. It does not add auctions, bidding, music-file sales, live payments, or Official Store checkout.

DanzStak uses Stripe Connect separate charges and transfers. Buyer funds settle to the DanzStak platform balance and are recorded as a **pending seller payout**. DanzStak does not call this escrow. A one-time transfer to the seller is attempted only after signed carrier delivery evidence or explicit buyer confirmation.

## Money rules

- DanzStak's fee is exactly 5% of the item price, rounded to integer cents on the server.
- Shipping is excluded from the DanzStak fee and passes to the seller in full.
- The server owns item price, shipping, inventory, fee, payout and order state. Browser values are never trusted.
- Tax remains applicable according to the approved tax configuration. No payment method bypasses tax obligations.
- A disproportionate-shipping guard remains enforced before publication. A $1 item with $15 shipping is rejected.
- The platform is responsible for its Stripe processing fees, negative balances, refunds and disputes under the separate-charges model. Owner review of pricing and reserves is required before Live Mode.

Example: a $20 item plus $5 shipping produces a $1 DanzStak fee and a $24 seller payout before Stripe fees, tax adjustments, refunds or disputes.

## Secure workflow

1. A seller completes Stripe-hosted Connect onboarding. DanzStak stores only the connected account identifier and current transfer capability, never bank credentials.
2. Checkout retrieves the published product from DynamoDB, rechecks the seller's live transfer capability, atomically reserves inventory, and creates a 30-minute Stripe-hosted Checkout Session.
3. A signed Stripe webhook retrieves the Session and Charge from Stripe, verifies mode, amount, currency, product, buyer, seller and order metadata, and records a paid order exactly once.
4. The seller attaches a valid carrier tracking number through EasyPost. A signed EasyPost webhook can advance the order to delivered.
5. Delivery uses one conditional state transition. Stripe receives the associated Charge ID as `source_transaction`; the PaymentIntent ID is not used for that field.
6. Duplicate webhooks and duplicate delivery confirmations cannot create a second transfer.
7. A refund or dispute blocks an unreleased payout. If it races a transfer request, DanzStak immediately reverses the new transfer. A full refund after release reverses the transfer once. Partial refunds require manual review.

## API routes

| Method | Route | Access |
|---|---|---|
| POST | `/marketplace/checkout` | Signed-in buyer |
| POST | `/marketplace/payouts/onboarding` | Signed-in seller |
| GET | `/marketplace/payouts/status` | Signed-in seller |
| POST | `/marketplace/stripe/webhook` | Stripe signature |
| POST | `/marketplace/shipping/webhook` | EasyPost HMAC v2 signature |
| GET | `/marketplace/orders/{orderId}` | Order buyer or seller |
| POST | `/marketplace/orders/{orderId}/tracking` | Order seller |
| POST | `/marketplace/orders/{orderId}/confirm-delivery` | Order buyer |

Order reads are account-isolated. Buyer responses omit the seller's internal payout amount and connected Stripe account identifier.

## Required configuration

The marketplace uses a separate DanzStak secret namespace so it cannot silently charge through the older Tour Manager/SFScoop Stripe configuration.

| Setting | Location | Purpose |
|---|---|---|
| `danzstak/stripe/marketplace-secret-key` | AWS Secrets Manager | DanzStak marketplace Stripe key |
| `danzstak/stripe/marketplace-webhook-secret` | AWS Secrets Manager | Marketplace endpoint signing secret |
| `danzstak/easypost/api-key` | AWS Secrets Manager | EasyPost tracker creation |
| `danzstak/easypost/webhook-secret` | AWS Secrets Manager | EasyPost HMAC verification |
| `MARKETPLACE_CHECKOUT_ENABLED` | Lambda environment | Must equal `true` to allow Checkout |
| `MARKETPLACE_LIVE_PAYMENTS` | Lambda environment | Must equal `true` in addition to the Checkout flag for live keys |

Neither activation flag is enabled by this branch. No secret values belong in Git, Lambda environment variables, browser code or logs.

Required Stripe endpoint events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`

EasyPost must send signed `tracker.updated` payloads. The server treats only the provider's delivered state as carrier delivery evidence.

## SFS payment boundary

SFS remains disabled. The owner supplied proposed mainnet mint `H2147Ppmd4CESHuCzPQf89rNnEgKrx98NDF4vi6HZZeK`; a finalized Solana RPC read on 2026-11-09 identified Token-2022 metadata as **SFS Token / SFS**, two decimals, no freeze authority, and an active mint/update authority. The currently indexed Raydium SFS/SOL pair is `AzeRe3RMmHPTG2Tkh4HLV3npHz1BsQhS856QVK4y1FQN`. The owner-supplied settlement wallet `8Cx5YqBgS43uqDrBzeSpDyBoQSp9fH71SwQ1e39m631C` owns initialized SFS token account `8haVhbmoDEkRNp3TGzbgmM4zjDbxy5BMhVp9m1Gtn548`; both were verified at finalized commitment.

The owner selected DexScreener pricing on 2026-11-09. The production design uses the official DexScreener API and the exact pair endpoint `GET https://api.dexscreener.com/latest/dex/pairs/solana/AzeRe3RMmHPTG2Tkh4HLV3npHz1BsQhS856QVK4y1FQN`. DanzStak will not scrape the website and will not silently substitute a different pool or price provider. A quote is valid only when the response identifies Solana, Raydium, the approved pair, the exact SFS mint as base token and wrapped SOL as quote token. The server, never the browser, calculates the amount.

The quote contract is deliberately conservative:

- Fetch a fresh quote for every checkout; cache it for no longer than three minutes.
- Record source, pair, USD price, liquidity, fetch time, USD order value, exact SFS amount, expiry, order ID and one-time nonce.
- Round the buyer's SFS amount **up** to the next `0.01 SFS`, matching the mint's two decimals.
- Reject missing, non-numeric, zero or negative price/liquidity; reject pair, chain, DEX, mint or quote-token mismatches.
- Start with a configurable USD-liquidity floor of `$5,000` and an order-value ceiling of `1%` of reported pool liquidity. Owner/risk review may raise either threshold, but the browser cannot override them.
- Never reuse an expired or last-known-good price. If a provider times out, the response is invalid, liquidity falls below the floor or the risk checks fail, SFS Checkout is unavailable and card Checkout remains available.
- Display the USD total, source, rate, SFS amount and expiry before Phantom opens. Requote after expiry or before signing if the amount changes.

At the 2026-11-09 verification read, DexScreener reported approximately `$0.3011` per SFS, `$9,638.91` liquidity and `$77.21` 24-hour volume for that pair. Those figures are evidence from that read only, not a fixed price. The low volume is a manipulation and availability risk; SFS Checkout remains blocked until the quote controls, on-chain verifier and owner-approved risk limits pass controlled tests.

The owner states that the SFS/SOL pool began near `300 SFS = 1 SOL` and intends SFS to move to a `$0.50` USDC market once SOL reaches `$150` or more. DanzStak does not hard-code either value. A live 2026-11-09 read already showed about `289.8551 SFS/SOL`, demonstrating that the pool ratio moves. The quote service stays on the approved SFS/SOL pair until an actual SFS/USDC pool or reviewed on-chain mechanism exists and its exact address is approved. Crossing a SOL price threshold by itself does not authorize DanzStak to invent a peg or switch price sources.

### Order QR contract

The supplied Phantom receive QR confirms the owner wallet `8Cx5YqBgS43uqDrBzeSpDyBoQSp9fH71SwQ1e39m631C`, but the static receive QR is not a checkout request. DanzStak must generate a new standards-based Solana Pay QR for every order. Its encoded transfer request contains the owner wallet as `recipient`, the exact quoted amount, `spl-token=H2147Ppmd4CESHuCzPQf89rNnEgKrx98NDF4vi6HZZeK`, an opaque one-time `reference`, a DanzStak label and a non-sensitive order memo. The recipient is the native wallet address—not the associated token account—because the Solana Pay transfer-request specification derives the token account from recipient plus mint.

The QR and same-device payment link expire with the three-minute quote. They never permit an editable amount. DanzStak grants nothing merely because the QR was displayed or Phantom returned a signature: the server waits for finalized chain evidence, then verifies the unique reference, exact Token-2022 mint, exact amount, sender, owner wallet and derived destination token account `8haVhbmoDEkRNp3TGzbgmM4zjDbxy5BMhVp9m1Gtn548`. The reference cannot fulfill a second order. Phantom/Solana Pay compatibility with this Token-2022 mint must pass Android, iPhone and desktop tests before the QR is enabled.

### Getting SFS

The future payment chooser may offer two optional, clearly external paths before the payment QR:

- **Earn SFS on SFScoop** opens the independent SFScoop service. DanzStak does not create or link an SFScoop account, track participation, award tokens or promise earnings.
- **Buy SFS externally** shows the verified SFS mint and opens an independent wallet or trading venue that is legally available to that user. DanzStak does not sell, swap, custody, mark up or recommend an investment in SFS.

External links use `noopener noreferrer`, carry no DanzStak account data and never count as payment. Current Raydium interface terms list the USA among prohibited jurisdictions, so DanzStak must not hard-wire a Raydium purchase link for every member. Provider availability and financial-promotion wording require legal/jurisdiction review before this control is enabled. When the member returns, DanzStak discards the old quote and requests a fresh DexScreener quote before showing the payment QR.

These public addresses and the quote decision do not authorize activation. The wallet can technically own SOL and other token accounts; DanzStak must enforce the exact mint and destination token account. The owner must still approve a signing mechanism or reviewed payment program, finality threshold, server RPC/provider, refund method and tax treatment. A direct user-to-user wallet transfer cannot be presented as delivery-protected Bazaar Checkout because it bypasses DanzStak's payout hold, refund and dispute controls. SFS payments must use the same canonical order, inventory, delivery and tax rules as Stripe or remain an explicitly unprotected wallet action outside Buy It Now.

## Release blockers

- Register and review the DanzStak Stripe Connect platform and marketplace terms.
- Confirm the DanzStak Stripe account and Test Mode key; do not reuse the SFScoop marketplace account.
- Create the dedicated secrets and signed webhook endpoints.
- Configure an EasyPost Test Mode account and webhook.
- Decide tax collection, returns, buyer claims, delivery exceptions, seller reserves and payout timing.
- Run controlled two-account Test Mode purchases, failed/expired Checkout, delivery, refund, dispute and race-condition tests against hosted Stripe/EasyPost events.
- Add Official Store order handling separately before enabling its Buy It Now control.
- Obtain owner phone approval of the review PWA.

No Test Mode or Live Mode payment is activated until every blocker above is cleared.
