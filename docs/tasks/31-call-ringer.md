# 31: Incoming calls must ring (owner, 2026-11-18, phone test)

**Owner:** "SYNC works but the ringer does not work." In the same test, the video call connected and looked right, and the owner could drag the picture-in-picture around (keep all of that working).

Read first: `CLAUDE.md` (SYNC rules), `assets/chat.js` (`unlockCallAudio`, `playTone`, `startRing`/`stopRing`, the incoming poller), `assets/incoming-calls.js`, `assets/sync-tones.js` (16-B2 ringtones), `assets/push-notifications.js`, `service-worker.js` (the call notification: `vibrate`, `requireInteraction`, Answer/Decline actions), and the call push sender in `infrastructure/call-signaling/template.yaml`.

## Likely causes (check each and fix the root cause; say in the PR which ones were real)
1. **The ring is drawn with Web Audio (`playTone`)**, which stays silent until the page has an *unlocked* `AudioContext`. `playTone` returns early unless `audioContext.state === "running"`. On a phone the context is usually still suspended when a call arrives (no tap yet in this session), or it gets suspended again after the screen turns off, so nothing plays.
2. **When the app is in the background or the phone is locked,** only the push notification can ring. Check that a call sends a push to every registered device of the callee, with `type: "call"`. Check the notification's vibration pattern and that it isn't `silent`. Check that the member's device actually has a push subscription (Settings shows whether alerts are on for this device).
3. The ringtone chosen in 16-B2 (`sync-tones.js`) may not be wired into the incoming-call path.

## What to build
- **Foreground ring that works without a prior tap:**
  - play the member's chosen ringtone from an `<audio>` element (a short ringtone file in `assets/`, looped, preloaded);
  - fall back to Web Audio only when that fails;
  - `navigator.vibrate([600,300,600,300,600])`, repeated while ringing, where supported;
  - unlock audio on the member's first tap or keypress in every session and again on `visibilitychange`, so later calls ring;
  - if the browser still blocks sound, the incoming-call screen pulses and says "Tap to hear the ringer". Answer and Decline always work.
- **Stop ringing** at once on answer, decline, caller hang-up, timeout, or when another device answers.
- **Background / locked phone:**
  - the call push uses a long vibration pattern, `requireInteraction`, `renotify` with a call tag, and Answer / Decline actions;
  - while the call is still ringing, re-notify every ~8 s for up to 45 s (the same tag, so there's only one notification);
  - close the notification when the call is answered elsewhere or ends.
  - Be candid in the PR: a web app can't play a full looping phone ringtone on a locked phone like the phone's own dialer. The system notification sound plus repeated vibration is what the web allows.
- **"Test ringer" row** in SYNC ⋮ → Call alerts: plays the ringtone for 3 s and sends a test call push to this device, so the member can check both.
- **One-time prompt:** if this device has no push subscription, SYNC shows a one-line banner "Turn on call alerts so calls ring when SYNC is closed", with **Turn on**.

## Tests
- Unit tests:
  - the ring starts and stops on every call state;
  - audio unlock runs on the first gesture and on `visibilitychange`;
  - the fallback order is `<audio>`, then Web Audio, then visual;
  - re-notify stops when the call ends.
- Browser check: an incoming call with a locked audio context shows "Tap to hear the ringer". After one tap, the `<audio>` element plays and loops until Answer.
- Run `browser-checks/call-video-two-party.cjs` and `browser-checks/foreground-call-ringtone.cjs`; both must stay green.
- The owner tests on two real phones (app open, app in the background, phone locked). Don't claim handset results that were only simulated.
