# 21 — Live translation in SYNC calls

Owner, 2026-11-17: "add a real-time voice translator in video calls." Bands on tour and shops abroad talk across languages; SYNC should help.

**Build only after the SYNC fixes and a passing two-device call test (sound and video both ways).**

## Step 1 — live translated captions
- Call screen button **Translate** (icon + accessible name). Each person picks their own language (default: the app language).
- The other person's speech appears as captions translated into your language, with the original text small underneath. Target: under ~2 seconds behind.
- Speech-to-text: **Amazon Transcribe streaming**; translation: **Amazon Translate**. No Google or Apple speech services (independence rule). Provider kept swappable.
- Captions sit above the call controls, two lines max, large readable type, never covering faces' centre or the buttons.

## Step 2 — spoken translation (later, optional)
- The translated captions read out with **Amazon Polly** while the real voice plays quieter underneath (interpreter style). Opt-in per person; more delay and cost than captions.

## Consent and privacy (non-negotiable)
- Off by default. When one person turns it on, the other sees "Shawn turned on translation — allow your voice to be translated?" Only audio from people who accept is sent, and only while translation is on. Either person can stop it any time.
- Nothing stored: no audio recordings, no transcripts, unless both choose "Save captions to chat".
- The call itself stays peer-to-peer; only the consenting person's audio goes to the translation service, over an authenticated, short-lived stream.
- Honest copy: "Machine translation can be wrong. Double-check prices, dates and deals in writing."

## Price
- It costs DanzStak per minute of audio. **Free or paid, and the price, are for the owner to set.** Build behind a flag, off, with Stripe Test Mode only, until priced. One-off charges only (no subscriptions), per the fee rules in CLAUDE.md.

## Tests
- No audio leaves the device before both consent; stopping translation stops the stream within a second.
- Captions render RTL languages correctly; long sentences wrap to two lines.
- Fail-closed: if AWS is unavailable, the call continues normally and the button says translation is unavailable.
