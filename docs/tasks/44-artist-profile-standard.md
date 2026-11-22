# Task 44: Every artist profile looks like Eroticon's

Owner, 2026-11-21, sending a phone screenshot of the Eroticon profile: "We need artist to make profiles that are
like this one." The screenshot shows the owner, so it is described here and not committed.

## The reference (Eroticon, phone, 360px)
1. **Cover:** a real photo of the act's world (Eroticon: the studio, synths and monitors), full width, placed with
   Move to fit (F12).
2. **Profile picture:** a real photo of the artist, large and round, overlapping the cover, with the camera badge
   for the owner only.
3. **Name** beside the picture, big and bold (F4).
4. **Shop band:** "SHOP › Eroticon" and three product tiles (records, a shirt), each opening that item in the shop
   (F19, F21).
5. **One action row:** Edit (green), Shop, Share, then the friends facepile on the right.
6. **Tabs:** Posts · About · Friends · Photos · Videos · Shop, then the composer with the member's own photo.

## The goal
A new artist reaches this look in minutes, without design skills, and nothing on the profile is empty or a
placeholder.

## How
- **AI profile (#542, $6.30) builds it**, using the same sources and rules as the AI EPK (spec 43, no questions):
  - proposes a **cover** and a **profile picture** from the artist's confirmed pages (Bandcamp header and photo,
    Spotify image, Instagram, Discogs, YouTube art), shown as tiles to pick from, plus "Upload your own"; the chosen
    ones are copied into DanzStak media, never hotlinked, and opened in Move to fit;
  - writes the one-line bio, location, work line and links;
  - offers to fill the shop from the artist's Bandcamp merch and records (that is the AI shop, $6.30, sold
    separately; never automatic).
- **Free path, same result:** a "Set up your artist profile" checklist on the artist's own profile until done:
  cover · profile picture · bio · links · first shop item · first post. Each row opens the right editor. It
  disappears when complete and is never shown to visitors.
- **Empty parts never look broken:** no shop band until there is an item; no facepile until there is a friend; no
  letter avatars where a photo exists (F4b).

## Checks
- A fixture artist with only a Bandcamp page gets, after the AI profile build and two taps, a profile with cover,
  picture, name, bio and links, matching the reference layout at 320/360/390/430px (no overlap, no empty band).
- The checklist shows for the owner only, opens the right editor from each row, and goes away when done.
- No image on a built profile loads from another site's host.
- Graded against `docs/tasks/40-launch-check.md`; only an A ships.

## Seen in the same screenshot (to fix in the profile train)
- The facepile's first tile is a dark letter avatar ("D") half hidden behind a photo: show real photos only, or
  drop the tile.
- The selected "Posts" tab has a boxed orange outline: use the pill/underline style of the UI kit, not a focus box.

## Sharing a profile shows the profile (owner, 2026-11-21)
Owner, after sharing a profile link (`profile.html?member=…`): "When a user share their profile it should show just
like the image I uploaded not like this." The quality bar is the invite share card
(`docs/screenshots/owner-reference/invite-share-card-quality-bar-2026-11-19.png`): a clean preview image, a clear
title and the domain.

**Why it fails today:** `profile.html` has no Open Graph tags at all (only `<title>My Profile | DanzStak</title>`),
and it's a static page filled in by JavaScript. Link previews (Messages, WhatsApp, Instagram, Facebook, Telegram,
X, Slack) never run JavaScript, so every profile shares as a bare "My Profile" link with no picture.

**Fix:**
- **Share link:** `https://danzstak.com/@username` (the profile Share button, the share sheet and copy-link all use
  it). Amplify rewrites `/@<username>` with a **200 reverse-proxy rewrite** to an Auth API route
  `GET /share/profile/{username}`, so the preview shows the `danzstak.com` domain.
- **The route** returns a tiny HTML page: `og:title` "Eroticon on DanzStak", `og:description` the one-line bio,
  `og:image` the profile card, `og:url`, `twitter:card=summary_large_image`, then sends people (not crawlers) on to
  `profile.html?member=…`. Only for profiles whose visibility is public; anything else gets the general DanzStak
  card and no name, photo or bio.
- **The profile card image** (1200×630 PNG, under 300 KB) is drawn on the server when the member changes their
  name, picture, cover or shop items, and stored in the media bucket behind the CDN with a versioned key (so apps
  that cache previews pick up a new one). It looks like the profile itself: the cover across the top, the round
  profile picture overlapping it, the name in bold beside it, up to three shop tiles when there is a shop, and a
  small DanzStak mark. Positions come from Move to fit (F12).
- **Same mechanism, same look** for posts, EPKs, events and shop items (task 17 share previews), one shared card
  renderer.

**Built in #677 (2026-11-21), with three decisions:**
- **Drawn by the member's own browser, not the server.** The Lambdas have no image library, and the browser already has the pictures, fonts, every script and the Move-to-fit positions. The card is uploaded like any profile picture, served by the share route, and redrawn when the name, @username, bio, cover, photo or shop photos change (a signature of what it was drawn from).
- **JPEG, not PNG.** A photo card as PNG is about 1 MB, and WhatsApp skips previews over roughly 300 KB.
- **The member turns it on.** Profiles are friends/Tribe-only, so name and photo reach previews only after "Show my photo and name in link previews" (on by default in their own share sheet; off deletes the card). "Public visibility" in the fix above means this switch.

- `test-share-preview.cjs`: the route answers a crawler user agent (`facebookexternalhit`, `WhatsApp`, `Twitterbot`,
  `TelegramBot`, iMessage's `facebookexternalhit/1.1 Facebot Twitterbot`) with the right `og:*` tags; a private
  profile gets the general card with no personal data; a browser is sent on to the profile.
- The card renderer turns a fixture profile into a 1200×630 PNG under 300 KB; a golden-image comparison guards the
  layout.
- The F26 live check fetches `https://danzstak.com/@eroticon` as a crawler and asserts the tags and a 200 image.
- The owner shares his profile to his own phone's Messages and WhatsApp and it looks like the reference.
