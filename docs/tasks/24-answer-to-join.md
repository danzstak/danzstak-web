# 24: Answer to join — SYNC call invites make the invitee a DanzStak member (owner, 2026-11-18)

Read `CLAUDE.md` first ("SYNC", "Current SYNC security rule", "SYNC SMS provider decision", "Signup"). Build after the owner approves this plan. Payments are not involved.

## Owner decisions (2026-11-18)

- **Signing up for SYNC makes them a member of DanzStak.** There is no separate SYNC account: one identity across SYNC, Mix, EPK, Tribes and the Bazaar.
- **A SYNC-first member lands in SYNC** after signup: in the conversation they were invited to, or the SYNC chat list when there was no invite. Mix stays one tap away.
- **People invited to a call just want to answer the call.** Signup must feel like picking up, not like joining a platform. Nothing stands between them and the call except what security and the law require.

## Why this needs new work

Today a member can only call another member who is a friend or shares a Tribe (`canContact` in `infrastructure/call-signaling/template.yaml`), and the invite dialog (`assets/invite-sharing.js`) only links to `https://danzstak.com/`. There is no way to ring someone who is not a member yet.

## Flow

### Caller (existing member, registered device)
1. In SYNC, **Invite to a call** (people search with no result, the contact screen, and the invite dialog). It creates a **call invite** and opens the normal invite share options (text message, share sheet, copy) with a link `https://danzstak.com/answer.html?i=<token>`.
2. The caller sees **"Waiting for <name or 'your friend'> to join…"** instead of ringing, with **Cancel**. Ring timeouts do not apply to a call invite. The caller may close the screen; when the invitee is ready, the caller's device rings through the normal incoming-call path and lock-screen push (16-F) with "<name> joined DanzStak and is ready to talk".

### Invitee (not a member)
1. **Open the link:** caller's name and avatar, one big **Answer** button, one line: "Answering joins you to DanzStak." Terms and Privacy links are visible here.
2. **Tap Answer → create account** through the existing legal acceptance and hosted signup (`/auth/legal-acceptance`, `/auth/signup`). The invite token survives the round trip in a short-lived server record keyed by the auth `state`, never in localStorage.
3. **Name and @username** (the existing onboarding step, owner 2026-11-16), prefilled from the signup where possible.
4. **Phone number → Text me a code → code** — the existing one-flow device registration (Twilio Verify, SMS only, language from `navigator.languages`). No skip here: the call needs a registered device. "Later — text only" is still offered and opens the chat with the caller.
5. **Verified → the call connects.** The server redeems the invite, the caller's device rings (or connects at once if the caller is still on the waiting screen). Media starts only after this point.
6. After hangup the member lands in **that SYNC conversation**. Avatar, profile and everything else can wait.

### Fallbacks
- **Caller cancelled, missed the ring, or the invite expired:** signup still completes; the invitee lands in the conversation with "Missed call from <name>" and **Call back**. Never a dead page.
- **Invitee is already a member:** the link signs them in (if needed) and goes straight to the device check, then the call.
- **SMS unavailable (provider down, country blocked):** fail closed as today; the invitee becomes a member and lands in the chat with the caller, text works, calls say plainly why they're locked.

## Server rules

- **Call invite record** (DynamoDB, call-signaling stack): token stored only as a SHA-256 hash; caller user id; created/expiry (**24 hours**); status `open → redeemed | cancelled | expired`; single use; at most **10 open invites per member** and **20 created per day**.
- **Redeeming** requires: a signed-in account, a device that passed SMS OTP for that account, an open unexpired invite, the invitee is not the caller, and neither side has blocked the other. Redemption makes the two members **friends** (both directions — the caller invited them, and the invitee accepted by answering) so `canContact` passes, creates the conversation, and notifies the caller.
- **Rate limits and abuse:** opening a link is anonymous and reveals only the caller's display name and avatar — never email, phone, username search results or any other member data. Wrong/expired tokens get one generic message. Log hashed ids only.
- **No call media, signaling, ICE, camera or microphone before the device is verified** (existing rule).
- **Phone numbers** stay private: the invite never contains or reveals the caller's or invitee's number.

## Open question for the owner

DanzStak accounts are created through the hosted sign-in page with an **email and password**. That adds two fields to "name, number, code". Options:
- **A (no auth change):** keep email + password on the hosted page for now. Ships soonest.
- **B (later):** passwordless signup (email code or phone as the sign-in) so answering really is name → number → code. This changes authentication and needs its own review.

## Tests

- New `test-call-invite.cjs`: token hashing, expiry, single use, limits, block checks, friendship on redeem, no member data on the public preview, redeem refused without an OTP-verified device.
- `test-signup-onboarding.cjs`: SYNC-first members land in SYNC (invited conversation or chat list).
- Browser checks at 320–430px: invite screen, waiting screen, missed-call fallback.
- Two physical devices, one a brand-new account on a phone in another country, before claiming it works.
