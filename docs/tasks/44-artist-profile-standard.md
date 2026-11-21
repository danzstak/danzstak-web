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
