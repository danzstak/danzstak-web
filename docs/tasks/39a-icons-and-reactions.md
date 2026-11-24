# 39a. Icons and reactions like the familiar app (owner 2026-11-24)

Owner, with two phone screenshots of a familiar social app's home feed: "Can you make the icons and emojis more like this". The screenshots show the owner and other people, so they are described here and not committed. The layout and feel are what we match. We never copy the other app's artwork, logo or blue: our icons are Lucide (ISC) and our emoji are Fluent Emoji 3D (MIT), in DanzStak colours. This is part of UIKIT (the kit set-up PR) and applies on every screen.

## Icons (Lucide, one sprite `assets/icons.svg`)
- **Style:** outline, round caps and joins, stroke 2 at 24px (about 28px in the top bar), ink `#0B0B0C` (Night: `#EDEDEA`). No boxes or circles behind them. Every icon keeps an accessible name and a 44px tap area. The centre tap is checked.
- **Top bar:** ☰ menu at the left, then the DanzStak wordmark, then on the right `square-plus` (create), `search` and SYNC (`message-circle`) with a red round count badge on its top-right corner. Pivot stays per F15j.
- **Composer row under the top bar:** your round photo, then a pill field "What's on your mind?" (translated, hairline border, full height 44px), then a photo icon (`image`) at the right.
- **Post action row:** `thumbs-up`, `message-circle`, `repeat-2` (reshare) and `share` (forward arrow), each with its count right beside it in the same grey (the owner's 2026-11-16 rule). The row is evenly spaced on the left. On the right sits the reaction summary (below).
- **Post header:** ⋯ (`more-horizontal`) and ✕ (`x`, hide from my Mix) on the right, plain icons.
- **Bottom tab bar:** icons only, no labels, like the reference: Mix (`house`), The Roll (`clapperboard`/`square-play`), Friends (`users`), Bazaar (`store`), Notifications (`bell`) and your own round photo for Menu/profile. The active tab is the **filled** version of its icon in DanzStak orange; the others stay outlined ink. Each keeps its accessible name, so screen readers still say "Mix" etc. This replaces the earlier "labels + orange dot" line in the UI kit.

## Reactions (Fluent Emoji 3D, self-hosted in `assets/emoji/`)
- **Set:** Like (thumbs up), Love (red heart), Hug (smiling face with hearts), Haha (grinning squinting face), Wow (face with open mouth), Sad (crying face) and Angry (pouting face). That's seven, in that order, translated names. Like and Love show as round badges: a white thumb on DanzStak orange and a white heart on red. The rest are the 3D faces.
- **Picker:** long-press (about 400 ms) on Like, or hover on desktop, opens a white pill with a soft shadow just above the button. It holds the seven emoji at about 44px, popping in left to right (staggered 20 ms, 150 ms each; no motion with `prefers-reduced-motion`). Slide the finger along it: the emoji under the finger grows to about 1.3×, and lifting picks it. A small grey "Tap to select" line shows under the pill until a pick (translated). Tapping outside closes it. A short tap on Like just likes.
- **On the post:** once picked, the Like button shows that reaction's small emoji and name in its colour. The summary on the right shows the top 2–3 reactions as overlapping 20px round badges, then the total. Tap it to see who reacted, grouped by reaction.
- **Text stays text:** typed emoji in posts and messages stay the phone's own (UI kit rule).

## Checks
`browser-checks/reactions.cjs` (CI), at 320/360/390/430px:
- A long-press opens the pill above Like with seven emoji, all inside the screen.
- A slide-and-release picks the one under the finger, and a short tap only likes.
- The summary shows overlapping badges plus the count.
- It works in Italian.
- Under reduced motion there's no animation.

`browser-checks/app-tabs.cjs` and `app-bar.cjs`, updated:
- Tabs are icon-only with accessible names.
- Exactly one tab is filled orange, on the right page.
- The top-bar icons are outline Lucide symbols from the sprite with no box behind them.
- The SYNC badge sits on the icon's corner.
