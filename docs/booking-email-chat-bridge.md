# Booking email-to-Chat bridge

Status: development implementation; not deployed.

## Flow

1. Artist approves a Tour Manager email.
2. The authenticated API creates or reuses an opaque 192-bit reply alias for that artist, organization, category and public recipient. The alias contains no user, phone, venue or tour identifier.
3. SES sends the email with `Reply-To: reply+<opaque-token>@reply.danzstak.com` and records the outbound message in the artist-owned booking conversation.
4. Inbound SES receipt rules require TLS and spam/virus scanning, save the raw message to an encrypted private S3 bucket, then asynchronously invoke `DANZSTAK-Booking-Mail-Bridge`.
5. The bridge hashes the alias token, resolves the exact artist/conversation server-side, requires an exact expected envelope sender, requires spam and virus PASS plus at least one SPF/DKIM/DMARC PASS, and conditionally records the SES message ID to stop replay.
6. The parsed plain-text message appears under Clubs, Radio or Stores in the existing DanzStak Chat interface. A generic push job is stored without message text.
7. Artist replies use SES, the same opaque reply alias and the most recent external Message-ID for `In-Reply-To` and `References` headers.
8. Clear confirmed dates create a sourced appointment marker and request route recalculation. Tentative or incomplete dates are labeled `needs-clarification`; they do not become confirmed bookings.

## Required AWS configuration

- Deploy `infrastructure/booking-mail-bridge/template.yaml` in an SES receiving region such as `us-west-2` with a reviewed Lambda artifact.
- Activate the created SES receipt rule set. CloudFormation creates it but does not make it active.
- Add Route 53 MX `reply.danzstak.com` -> `10 inbound-smtp.us-west-2.amazonaws.com` only after the controlled inbound test passes.
- Configure the existing auth Lambda with `BOOKING_REPLY_DOMAIN=reply.danzstak.com` and package `booking-mail-chat.mjs`.
- Grant the auth Lambda its existing Tour table permissions and `ses:SendEmail`; do not grant the public browser access to SES, S3 raw mail, alias lookup records or account email addresses.
- Connect pending `BOOKING_PUSH#` records to the existing privacy-safe Web Push worker. Push text must remain generic.

Raw inbound mail expires after 30 days. Durable conversation text remains in the account-isolated Tour table and follows the platform account-deletion/export policy.

## Launch gates

- SES `us-west-1` production access is currently false, so outbound booking email can reach only verified sandbox recipients.
- No active SES receipt rule exists in `us-west-2` and no `reply.danzstak.com` MX currently exists.
- Web Push job delivery, bounce/complaint handling, real controlled-recipient threading, cancellation/date-change extraction and physical-device UI remain unverified.
- Do not describe the bridge as live until those checks pass.
