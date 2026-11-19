# 21 — Live translation in SYNC calls

Owner, 2026-11-17: "add a real-time voice translator in video calls." Bands on tour and shops abroad talk across languages; SYNC should help.

**Build only after the SYNC fixes and a passing two-device call test (sound and video both ways).**

## Step 1 — live translated captions
- Call screen button **Translate** (icon + accessible name). Each person picks their own language (default: the app language).
- The other person's speech appears as captions translated into your language, with the original text small underneath. Target: under ~2 seconds behind.
- Speech-to-text: **Amazon Transcribe streaming**; translation: **Amazon Translate**. No Google or Apple speech services (independence rule). Provider kept swappable.
- **Own space at the bottom (owner, 2026-11-17).** When subtitles are on, the full-screen video shrinks to end above a dedicated subtitle band at the bottom (above the call controls), so subtitles never sit on top of the picture; turning subtitles off gives the space back to the video.
- **Teleprompter style (owner, 2026-11-17).** Subtitles roll like a teleprompter: words appear as they're spoken (partial results update live, then settle when the sentence is final), the text scrolls smoothly upward, the newest line sits at the bottom of a band above the call controls, and older lines fade out. Large, high-contrast type with a soft dark backdrop for readability on any video; never covers the centre of the other person's face or the buttons. A size control (S/M/L) and a pause-scroll (tap and hold to read back the last few lines) on the band.
- **Languages (owner, 2026-11-17):** English to and from every language the providers support, and **Italian, French, German and Spanish must work at launch** (both directions, including Italian ↔ German etc., not only via English). Test each of these pairs with real speech before release. Show only languages both Transcribe streaming and Translate support.

## Step 2 — spoken translation (later, optional)
- The translated captions read out with **Amazon Polly** while the real voice plays quieter underneath (interpreter style). Opt-in per person; more delay and cost than captions.

## Consent and privacy (non-negotiable)
- Off by default. When one person turns it on, the other sees "Shawn turned on translation — allow your voice to be translated?" Only audio from people who accept is sent, and only while translation is on. Either person can stop it any time.
- Nothing stored: no audio recordings, no transcripts, unless both choose "Save captions to chat".
- The call itself stays peer-to-peer; only the consenting person's audio goes to the translation service, over an authenticated, short-lived stream.
- Honest copy: "Machine translation can be wrong. Double-check prices, dates and deals in writing."

## Price
- **Calls are free; only the translation is paid (owner, 2026-11-17, final).** Two **Translation packs**, both $10 an hour: **Try it — 30 minutes for $5** ($6.30 with the buyer fee: 6% + $1 under $30) and **Tour — 180 minutes for $30** ($31.80 with the 6% fee). Owner asked Claude to set this (2026-11-17); rationale: AWS cost is roughly $2–4 per hour of two-way subtitles, so $10/hour keeps a healthy margin, and the small pack lets members try it before spending $30. Minutes are billed only while subtitles are on, not for the whole call. A bigger, cheaper-per-hour pack can come later if heavy users appear. Minutes are used up across any SYNC calls while subtitles are on, counted per minute of translated speech the member turned on, and shown as "minutes left" on the call screen. This is the **one owner-approved exception** to the no-prepaid-credits rule; every other product stays one-off.
  - Assumption (owner didn't say): **minutes never expire.** Unused minutes refund under Terms 8A (price minus Stripe's fee, pro rata for unused minutes, after the member accepts the exact amount). Minutes can't be transferred, sold or cashed out.
  - When minutes run out mid-call, subtitles stop with a notice and "Buy 30 minutes" and "Buy 180 minutes" buttons; the call continues.
  - The person who turns subtitles on uses their minutes; the other person must still consent to their voice being translated.
  - Stripe Test Mode until the owner approves live charges. Server-side minute ledger (reserve per minute, idempotent, never negative); entitlements only from verified webhooks.

## Tests
- No audio leaves the device before both consent; stopping translation stops the stream within a second.
- Captions render RTL languages correctly; long sentences wrap to two lines.
- Fail-closed: if AWS is unavailable, the call continues normally and the button says translation is unavailable.
