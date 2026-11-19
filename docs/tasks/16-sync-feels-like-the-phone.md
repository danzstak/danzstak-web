# Task 16 — SYNC feels like the phone's own messaging app

Owner, 2026-11-17: "SYNC needs to be the dopest part of DanzStak … good enough to be its own thing … users should be able to change their background so they can have their girlfriend or whatever there … so it looks like the user's phone, not a webchat … users should not recognise if it's their phone or SYNC." Also: "make the SYNC buttons not so bulky; all the buttons on the site need a touch-up so they're not so HTML looking."

Read `CLAUDE.md` (SYNC sections, SYNC SMS provider decision) first. One PR per part, in order. Fax the room every PR: real-browser screenshots at 320, 360, 375, 390, 414 and 430px, plus iPhone safe areas and Android Chrome with the keyboard open.

## The bar

Someone opening SYNC from the installed PWA can't tell it apart from their phone's own messenger: same speed, same gestures, same density, no web-page tells. The familiar pattern (WhatsApp/iMessage-class) is about 80%, DanzStak is about 20%: brand accent, music cards, booking threads.

**Web-page tells to remove:**
- Page scroll behind the chat.
- Bouncing headers.
- Visible focus outlines on tap.
- Grey tap flashes.
- Text selection on long-press, except inside a message's own "Copy".
- Blue links.
- Default form controls.
- 300 ms delays.
- Layout jumps when the keyboard opens.
- Scrollbars.
- Bordered boxes.
- Bulky rectangular buttons.

## 16-A — Native shell and layout (do first; includes the owner's scroll bug)

1. Full-screen, app-like shell inside SYNC. Use `100dvh` and safe-area insets. In a thread, no global bottom nav and no site header. Only the message list scrolls. Header and composer are fixed, and messages scroll **under** the header, never over it.
2. Opens at the latest message. A floating scroll-to-bottom button shows the unread count. Date chips, grouped consecutive bubbles, tails, time and ticks inside the bubble, bubbles max ~80% wide. Nothing overflows or gets cut off: long words, links and cards wrap or scale.
3. Keyboard: the composer rides on top of the keyboard (VisualViewport). The list keeps the latest message visible. Nothing jumps.
4. Gestures:
   - Swipe right on a message to reply.
   - Long-press for the action sheet (React, Reply, Forward, Copy, Edit, Delete).
   - Edge-swipe / system Back returns to the list without losing the draft.
   - Pull to load older messages (finite, not infinite feed).
5. Haptics where the phone supports it: send, long-press, call accept.
6. List screen: 48px avatars, name, last line, time, unread badge, swipe to archive/mute/pin, search on top, a floating new-chat button.
7. Browser check: scroll a 200-message thread, then fail if any message box overlaps the header or composer, if any element overflows the viewport width, or if the page itself scrolls.

## 16-B — Chat wallpaper (owner: "change their background … girlfriend or whatever")

1. **Chat wallpaper** in SYNC settings, with two places to set it: for all chats, or for one chat from the chat's ⋯ menu.
2. Choices:
   - **Your own photo**, from the camera roll or camera.
   - A set of original DanzStak wallpapers, including one per genre look and the hometown motifs from task 15.
   - Solid colors.
   - Default.
3. Dim slider (0–60%) so bubbles stay readable. Bubble text contrast stays ≥ 4.5:1 on any wallpaper: the dim layer and bubble backgrounds guarantee it. Light and dark variants.
4. **Privacy:**
   - The photo is the member's own and is never shared with the other person; each person sees their own wallpaper.
   - Store it privately: per-member private media, never public, deleted with the account.
   - It also works offline: a cached copy on the device.
   - Strip EXIF/GPS before upload. Max 4 MB, resized to the device. Images only, no video or audio.
5. Per-chat wallpaper overrides the global one. "Reset to default" is always one tap.

## 16-B2 — Ringtones (owner, 2026-11-17: "users should be able to change their ring tone")

1. **Ringtone** and **message tone** pickers in SYNC settings, plus a per-contact override in the contact's ⋯ menu. Each one has a preview button and a Vibrate on/off switch.
2. The choices are a set of **original DanzStak tones** made for DanzStak or properly licensed: punk, metal, techno, house, industrial and classic phone rings, about 12 to start, each 1–3 s and loopable, shipped with the app. No member audio uploads: the CLAUDE.md "no music files, ever" rule stands, so there are no custom MP3/WAV files and no songs.
3. Playback: the chosen tone loops while an incoming call rings with the app open, and stops the instant the call is answered, declined or answered elsewhere. It respects the phone's silent mode where the browser exposes it, never plays two tones at once, and gives up after 30 s of ringing.
4. Platform limit, to be stated honestly in settings: with the app closed or the phone locked, the phone's own notification sound plays. Web push can't set a custom sound on iOS, and Android uses its notification channel sound. The in-app tone takes over once the app is open.
5. Tests: one tone at a time, stops on answer/decline/answered-elsewhere, the per-contact override wins, and the setting survives cache updates.

## 16-B3 — "Set up this phone" right after registration (owner, 2026-11-17)

When a device finishes SMS registration, SYNC runs a short, skippable setup, the way a new phone does. One screen per step, with Back/Skip, and every step can be changed later in settings:
1. **Wallpaper:** own photo / DanzStak wallpapers / color (16-B).
2. **Ringtone and message tone:** previewable (16-B2).
3. **Notifications:** turn on lock-screen alerts for messages and calls (16-F), with the honest note about the phone's own sound when locked.
4. **Share your SYNC:** the member's personal invite link and QR (`danzstak.com/@username`, opening "Message <name> on SYNC"). There's a share button (Web Share sheet: WhatsApp, SMS, email, Instagram and so on) and a ready message: "I'm on SYNC by DanzStak. Message me here: <link>". A recipient without an account lands on **Join DanzStak** → name + @username → straight into a chat with the inviter, plus a friend request already sent. Invites are tracked back to the inviter, as in task 17.
   - **Phone numbers are never shared or searchable** (CLAUDE.md SYNC rule): the invite link replaces "share my number". Finding people by phone-contacts matching is not built unless the owner approves a separate opt-in, hashed-contacts design.
5. **Done:** lands in the chat list.

## 16-H — Make it yours (owner, 2026-11-17: "different things the user can do to make their own")

Everything lives in **SYNC → Settings → Make it yours**. Every choice is previewed live, saved to the member's account (so it follows them to every registered device and survives cache updates), and has "Reset" on the same line.
1. **Look:**
   - Light / dark / auto.
   - Accent color: DanzStak orange, the member's genre look (techno, punk, metal, house) or their hometown accent from task 15.
   - Bubble style: rounded or square-edged "techno" bubbles.
   - Text size (4 steps).
   - Wallpaper (16-B).
2. **Sound and feel:**
   - Ringtone and message tone, with per-contact overrides (16-B2).
   - Vibration pattern (short / long / off).
   - Quiet hours (no sound or vibration between set times; calls from favorites can still ring).
3. **Contacts:**
   - Private nicknames (only you see them).
   - Favorites pinned at the top.
   - A custom per-contact wallpaper and ringtone.
   - Mute, archive, and chat folders (e.g. "Band", "Bookings", "Friends", "Crew").
4. **Your SYNC profile:**
   - About line.
   - Status: "on tour", "in the studio", "load-in until 6", or custom, with an optional expiry.
   - An optional "now playing" link: an external music link only, never an uploaded file.
   - Who can see last seen and online (everyone / friends / nobody).
5. **Privacy:**
   - **SYNC lock**: a passkey/biometric via WebAuthn, or a PIN, asked when SYNC opens.
   - Hide message previews in notifications.
   - Read receipts on/off.
   - Disappearing messages per chat (off / 24 h / 7 days).
6. **Reactions:** pick your 6 quick-reaction emojis.

These rules apply to everything in 16-H:
- No paid cosmetics.
- No streaks or engagement bait.
- Every option works offline once set.
- Contrast stays ≥ 4.5:1 for every combination; the contrast test covers accent × theme × wallpaper dim.
- Translations it/fr/es.

## 16-C — Buttons that don't look like HTML (SYNC first, then site-wide)

1. One button system in the design tokens, used everywhere:
   - **Icon buttons:** 44px touch target, a 24px glyph, no border; a soft circular press state.
   - **Primary:** a pill shape, accent fill, medium weight, no heavy borders or shadows.
   - **Secondary:** tonal (accent at ~12% opacity).
   - **Text:** text only.

   Remove every default-looking `<button>` style: grey bevels, square boxes, thick borders, uppercase blocks.
2. SYNC uses icons, not words, wherever a standard icon exists (send, attach, camera, mic, call, video, back, more), with accessible names kept. The send button morphs mic ↔ send as the member types, like familiar messengers.
3. Touch feedback: an instant press state, no tap highlight, and a subtle scale on press. Disabled states are clear but not ugly.
4. Then sweep the site: Mix, Music HQ, Events, Bazaar, profiles, EPK and the booking agent all move to the same tokens. One PR per area. Before/after screenshots per area.

## 16-D — Ticks, typing, presence

Sent / delivered / read ticks, WhatsApp style, server-side. "typing…" in the header and the list. "online / last seen" with a privacy setting (everyone, friends, nobody). Read receipts can be turned off.

## 16-E — Reply, forward, edit, delete

Reply quotes the original; tap the quote to jump to it. Forward to up to 5 chats. Edit within 15 minutes, marked "edited". Delete for me / delete for everyone, following the CLAUDE.md delete rules.

## 16-F — Offline notifications

Installed-PWA push for new messages and incoming calls with the app closed or the phone locked. The lock-screen ring for calls has Accept and Decline. Tapping a notification opens that exact chat or call. Booking replies and "venue opened your EPK" (already in the bell) also push, through the activity push outbox worker in `infrastructure/call-signaling/template.yaml`. Add `booking_reply` handling there: visibility is the recipient's own booking thread, and the URL is `/messages.html?section=bookings&outreach=<id>`.

## 16-G — Standalone-ready

SYNC can launch on its own: its own PWA manifest entry/shortcut ("SYNC by DanzStak"), its own icon, and it starts straight into the chat list. The same account and data as DanzStak, with no second login. This prepares SYNC to become its own app later without forking the code.

## Unchanged rules

The SMS device-registration gate, Twilio Verify, fail-closed behavior, private phone numbers, and the "no music files" rule all stay as they are. SYNC voice messages recorded in the app are not music uploads.

## Done means

Each PR:
- Tests are green, including new browser checks.
- Screenshots are attached at every phone width.
- Strings are added in it/fr/es.
- Versions are bumped with `scripts/bump-versions.cjs`.
- It's tested on the deployed PWA. Be explicit about what was verified on a real phone and what was simulated.
