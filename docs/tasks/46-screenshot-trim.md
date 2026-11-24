# 46. Screenshots trimmed to the picture inside them (owner 2026-11-24)

Owner: "can you trim screen shot images to the actual picture in danzstak so when users upload a screen shot danzstak fixes their fotos", "framing the image with in the screen shot".

## Why
Members often post a screenshot instead of the photo (seen on 22 Nov: three of four photos in one post were screenshots of earlier posts, with the status bar, header, caption and buttons in them). DanzStak should frame the picture inside the screenshot and post that, so the post's frame (F22: the media's own shape) shows only the photo.

## Part 1: trim on the phone (frontend only, no deploy)
Lives in the one shared picker hook, `assets/media-scale.js`, **before** the 720p scaling (crop from the full screenshot, then scale).

**Where it runs:** pickers that opt in with `data-trim-screenshots`: Mix, profile and Tribe composers, album uploads, profile picture, cover, showcase photo, Tribe cover/picture, shop photos, event flyer. **Never** SYNC chat, Support / "tell us what's broken", or anything where the member means to send the whole screen.

**1. Is it a screenshot?** At least two of:
- no camera details (JPEG without EXIF Make/Model; PNG files have none);
- PNG, or a name like `Screenshot`, `Screen_Shot`, `Schermata`, `Capture`, `Bildschirmfoto`;
- a phone-screen shape (taller than about 1.9:1, or wider than 1:1.9 on tablets and computers);
- a status bar: a thin flat band across the top 2–5 % of the image with small marks (time, battery).

**2. Find the picture:** work on a copy about 360 px wide. Score each row and column for "photo-ness" (many distinct colours and smooth gradients) versus app UI (flat background, sharp text, icons). Take the largest rectangle of photo rows × photo columns and snap its edges to where the score changes sharply. Then crop the full screenshot to it.

**3. Only when sure.** Keep the whole screenshot, and show nothing, when:
- the rectangle is under 25 % of the screenshot or under 200 px on its short side;
- there is more than one photo (a grid or a chat with several pictures);
- it is a text-only screenshot (a chat, a tweet, a receipt);
- the browser can't read the file.

**4. Never silent.** When it trims, the preview shows the framed photo with one small chip: **"Trimmed from a screenshot · Undo"** (translated). Undo puts back the whole screenshot. In the profile picture, cover and showcase editors the trimmed photo opens in Move to fit (F12), so the member can adjust it.

Everything happens on the phone: nothing extra is uploaded or kept.

## Part 2: use the original when it's already on DanzStak (Auth API, after part 1)
- Every photo upload gets a 64-bit perceptual fingerprint (dHash), computed on the phone and stored with that member's media.
- When a trimmed screenshot looks like one of **the member's own** photos (Hamming distance ≤ 10), the chip offers **"Use your original photo"**, which reuses that media key. No re-upload, full quality.
- Only the member's own uploads are searched, never other members'. The route is rate-limited, and fingerprints are deleted with the photo (Delete everywhere).
- Needs the Auth API deploy (deploy.yml).

## Checks
- `browser-checks/screenshot-trim.cjs` (CI) draws test screenshots on a canvas: Android and iPhone shapes with a status bar, an app header, a landscape, square and portrait photo, a caption and a reaction row. Each must crop to within 4 px of the photo on every edge.
- These stay untouched with no chip: a camera JPEG with EXIF; a text-only chat screenshot; a 2×2 photo grid; a SYNC attachment.
- Undo gives back the whole screenshot. The chip is in it/fr/es. Centre taps work at 320/360/390/430 px.
- The posted frame equals the trimmed photo's shape (F22 rule).
- Part 2, `test-photo-fingerprint.cjs`: a cropped, re-compressed copy matches its original; another member's identical photo never matches.
