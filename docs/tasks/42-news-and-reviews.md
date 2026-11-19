# 42 — News: writers, photographers and member reviews

Owner 2026-11-19 (phone):
- "In the main Menu there is no News anymore. News should have reviews from writers: show reviews and album reviews. That is part of the News."
- "On the desktop there is an RSS news, but that also should incorporate writers from magazines, photographers, reviews for albums and concert reviews."
- "If we get writers on DanzStak then we should have their reviews posted in the Mix on a rotating schedule from different writers."
- "When a user clicks on News it should say Add your review, for an album or for a concert. For an album they can load two pictures, and for a concert they can do a short video to accompany their review."
- Mix slots (owner answer 2026-11-19, "Alternate"): after The Roll, every 4th post is a slot that alternates **Bazaar item → review → Bazaar item → event flyer → …**; reviews rotate between different writers.

## News (Menu → News on phones; right column on desktop)
- Back in the Menu grid as **News**, the same page on phone and desktop.
- Pill tabs: **All · Show reviews · Album reviews · Photos · Headlines**.
  - **Headlines** = the existing RSS news (desktop today), on phones too.
  - **Show reviews / Album reviews** = reviews by DanzStak writers and members, newest first.
  - **Photos** = show photo sets by DanzStak photographers (credited).
- Top of the page: **Add your review** (big, one tap) → choose **Album** or **Concert**.

## Writing a review
- **Album review:** artist, album title, release link (Bandcamp etc., never an audio upload), rating (optional, 1–5), text, **up to 2 photos** (cover shot, your copy on the turntable…).
- **Concert review:** artist(s), venue (venue directory) and date, rating (optional), text, **one short video up to 15 s** (same rule as event flyers; DMCA/rights note) or up to 2 photos.
- Same composer, UI-kit forms (F8), translation layer, tag people and venue (F18). Posts as a normal post with a "Review" label and appears in News and on the author's profile.

## Writers and photographers
- A member can apply to be a **DanzStak writer** or **photographer** (Menu → News → ⋯ → Write for DanzStak): name, outlet/magazine (optional), links to past work. The owner approves on the ops page (F25); approved members get a small "Writer"/"Photographer" badge.
- Magazine writers keep their byline and a link to their outlet. DanzStak never copies outside articles: headlines are RSS titles/links only.

## In Mix
- The supplemental slot after every 3 posts (every 4th position) alternates Bazaar item / review / Bazaar item / event flyer, as decided above, replacing the old 3-post show-review/album-review/event pattern in `docs/OWNER-DIRECTIVES.md` where they conflict.
- Reviews come from **different writers in rotation** (never the same writer twice in a row, newest unseen first; member reviews from the member's people and scene fill in when no writer review is unseen). Never paid, never ranked by engagement; a slot with nothing eligible is skipped.

## Checks
- Menu shows News; News has the five tabs and Add your review at 360/390px and on desktop.
- An album review accepts 2 photos and refuses a 3rd and any audio file; a concert review accepts one video ≤ 15 s and refuses a longer one.
- Mix slots alternate Bazaar/review/Bazaar/event and never show the same writer twice in a row (fixture with 3 writers).
- A non-approved member can't post with a Writer badge (server-checked).
