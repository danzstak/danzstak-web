# 30: Text button in calls — a note over the other person's video (owner, 2026-11-18)

**Owner:** "Have SYNC have one of the buttons at the bottom be a text button that sends a text to the user over their image until they close it. Currently there's four buttons at the bottom; add one more button saying Text that opens a text box the user can type into, hit send, and it sends to the other user over their picture until they close that text box."

Read first: `CLAUDE.md` (SYNC rules, "SYNC feels like the phone"), `assets/chat.js` (call setup; the WebRTC data channel `danzstak-call` already exists and today sends strings ≤ 2000 chars to `addMessage`), `assets/call-screen.js` + `assets/call-screen.css` (the bottom control row), `messages.html`, `docs/tasks/16-sync-feels-like-the-phone.md` (16-C button system).

## What to build
1. **5th button in the call control row:** a **Text** button (speech-bubble icon, accessible name "Send a note", 44px+, the same 16-C round icon style as the other four). It shows in phone and video calls once the call is connected. On a 320px phone all five buttons fit on one row without overlapping.
2. **Tap Text →** a compact bottom sheet over the call: one text field (max 280 characters, live counter near the limit), **Send**, and ✕. The keyboard must not hide the field (visualViewport). The call keeps running and nothing else on the call screen moves.
3. **Send →** the note goes to the other person over the **existing data channel**, as a typed JSON message such as `{"type":"call-note","id":"…","text":"…","sentAt":…}` (peer-to-peer; no server storage, no new API, nothing logged). Keep plain strings working for the current chat path; route `call-note` messages to the overlay instead of `addMessage`.
4. **The receiver sees the note on top of the sender's video/picture**: a readable card (white text on a dark translucent panel, DanzStak orange left edge, sender's first name in small mono), placed over the remote video above the controls and the subtitle band, never covering the controls. It **stays until the receiver closes it** (✕, 44px). A new note replaces the old one with a quick fade. A screen reader announces it (`aria-live="polite"`).
5. The sender sees a small "Sent" tick on their sheet, and the sheet closes after sending. A failed send (channel not open) says "Note not sent, try again" and keeps the text.
6. **Safety:** render the text as text only (no HTML, links not clickable), trim it, block empty notes, at most 1 note every 2 seconds, and ignore incoming notes longer than 280 characters.
7. Notes disappear when the call ends. They are not saved to the chat. A later owner choice can add "also save to chat".

## Tests
- Unit test: `call-note` messages are parsed and rendered as text only; plain-string messages still go to chat; oversized or empty notes are ignored; rate limit.
- Browser check (two pages with a mocked data channel, or the existing `call-video-two-party` harness): 5 buttons fit at 320/360/390/430px; tap Text, type, Send; the other page shows the note over the remote video until ✕; the keyboard doesn't cover the field; screenshots at 360 and 390px.
- The two-device video call that the owner confirmed works must keep working (run `browser-checks/call-video-two-party.cjs`).
