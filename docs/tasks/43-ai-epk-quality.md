# Task 43: The AI EPK has to be really good

Owner, 2026-11-20, after Claude drafted his own EPK: "Ai needs to get really good at making an EPK."

The first draft read three streaming sites and wrote Eroticon up as a three-year artist. The real story starts in
1988 (CyborPunx, Seattle), with vinyl on his own Sleeping Dragon Records since 1996, and all of it was on Bandcamp
and Discogs. Each correction below came from the owner during that session. Together they set the bar: **a paying
artist should not have to tell the AI anything that is already on their own pages.**

This spec builds on `docs/tasks/08-ai-epk-builder.md` and PR #567 (`infrastructure/auth-api/ai-epk.mjs`). The rules
there still hold: only confirmed pages, nothing invented, facts tied to sources, the artist reviews every word, and
no training on creator content.

## 0. No questions for a paying customer
Owner, 2026-11-20: "Paying customers should not have to answer questions."
- The artist gives one thing: their act name (or one link). The AI does the rest.
- **The AI finds everything else itself:** other names come from Discogs `namevariations`/`aliases`/`members`/`groups`,
  Bandcamp and social bios, and credits on the releases; the real name from Discogs; intent from what the artist
  actually does (a release that exists only on vinyl is written "Vinyl only, never released digitally"; radio edits
  online and long mixes on vinyl are described as such).
- **No question screens, no quizzes.** The only artist step is the review: one "Is this you?" tick list and the draft
  itself, where any line can be edited or removed.
- Where no page gives a fact (a pressing city, a booking contact), the draft simply leaves it out and lists it once
  under "Still missing", as an optional field the artist can fill or ignore. It never blocks the draft and never asks.

## 1. Every language
Owner, 2026-11-20: "they will all be in different languages."
- **Reads sources in any language** (Italian blogs, German label pages, Japanese flyers, Spanish radio, French press)
  and understands them; facts keep the original-language source URL.
- **Writes the EPK in the artist's language** (their DanzStak language), and offers the same EPK in the languages of
  the places they play or pitch (English always, plus e.g. Italian, German, Spanish, French, Japanese, Portuguese).
- Names, venue names, label names, titles and sleeve wording stay as printed ("Made in Berlin", "GZ Media Paris"),
  never translated.
- The booking pitch is written in the venue's language when the venue's country is known.
- Scene voice in every language: a native speaker of that scene would write it this way (no machine-translation
  stiffness, no corporate words).

## 2. Look everywhere, release by release
- **Sources, by name, for every name:**
  - Bandcamp (`<name>.bandcamp.com`, then every album and track page linked from `/music`);
  - **Discogs through its public API** (`/database/search`, `/artists/{id}`, `/artists/{id}/releases`,
    `/releases/{id}`); the web pages refuse automated reads, but the API answers;
  - SoundCloud, Mixcloud, Beatport, Resident Advisor;
  - Spotify, Apple Music, Deezer, Tidal;
  - YouTube, Vimeo, Instagram, Facebook, ReverbNation;
  - a general web search.
- **Follow every release link.** Read each release's track list with durations, credits, catalogue number, formats
  and notes before writing anything. ("The albums are on bandcamp, I should not have to tell you anything if I was a
  paying customer.")
- **Read the record itself**, from the Discogs release JSON:
  - `companies`: Recorded At, Mastered At, Lacquer Cut At, Pressed By, (P)/(C);
  - `extraartists`: remixers, design, engineers;
  - `identifiers`: matrix/runout and label codes;
  - `notes`: often where each track was recorded;
  - `videos`.
- **Made in: city and country** for every physical release, as printed on the sleeve or label. ("It's all good is
  from Berlin, it even says right on it made in Berlin.") Use the sleeve's own wording ("GZ Media Paris"). Never
  write "Made in EU" for an artist who wouldn't. If no page says, leave it out and list it under "Still missing"; never guess a city.
- **Live and video:** the act's own YouTube channel, live sets and music videos. A video from someone else's channel
  counts only once the artist ticks it.

## 2a. The whole touring history
Owner, 2026-11-20: "I have been around the world many times from music. And nobody knows."
- An EPK's job is to make that known. The AI builds a **past shows** list from every source, for every name:
  Resident Advisor (events and lineups), Songkick, Bandsintown, setlist.fm, Facebook events, Discogs notes, club and
  festival archive pages, old flyers and posters (image text read with OCR), radio show pages, press and interviews,
  in every language.
- Each show: date (or year), venue, city, country, event/festival, billed with whom. Grouped by country and decade.
- The bio says how far the act has travelled ("has played in N countries across N continents") and names the
  standout rooms, festivals and cities; the booking pitch names the ones that matter to that venue.
- A map/list section "Played in" on the EPK (countries and cities), each entry linked to its source.
- No show is invented; a show with only a year is written with the year.

## 2b. Understands sound systems and what the artist plays on
Owner, 2026-11-20: "Needs to … understand soundsystems and what the artist expects."
- **Gear and setup, read from the artist's own pages, riders, videos and credits:** DJ (vinyl, CDJ/XDJ models, mixer,
  turntables, needles), live electronic (hardware, laptop, controllers, inputs needed), band (backline, inputs).
- **The tech rider it drafts is one a production crew can work from:** inputs and DI count, monitor needs (booth
  monitors, wedges), power, table size, turntable isolation for vinyl sets, mixer model and alternatives accepted,
  set length, changeover. Industry wording, no fluff.
- **Sound-system culture** is understood and written correctly: rigs (e.g. Funktion-One, Void, Martin, d&b, custom
  sound-system crews), free parties/teknivals, warehouse, club and festival stages, and the difference between them
  for the act's sound. The AI writes about it only when a source shows the act's connection to it.
- **What the artist expects (the list every artist will check):** whole discography with years, labels, formats,
  credits and "Made in"; remixers and collaborators; every name they've used; live video; every streaming and store
  link; socials; real name and base; past shows worldwide; press; a press photo; a tech rider; a booking pitch.
  Anything not found goes under "Still missing", never invented.

## 3. "Is this you?", grouped
- Group every candidate by name and source: releases, profiles, videos, photos and stream reports.
- Discogs gives the real name; show it so the artist confirms it.
- Same-name acts (another "Eroticon") are shown separately and are never merged on a guess.

## 4. Write it right
- **Oldest release to newest.** The first line says how long the act has been going ("industrial roots from 1988,
  vinyl since 1996").
- Bio around 200 words, short bio around 50, one-line pitch, booking pitch. Scene voice, no hype words.
- Include:
  - every release with year, format, label, catalogue number, remixers and credits, and "Made in city, country";
  - collaborators (remixers, featured artists such as Patti X);
  - "Vinyl only, never released digitally" where that's true;
  - online edit vs vinyl/club mix, spotted from the titles and track lengths (about 3 min vs about 6 min), described
    only as the artist actually does it.
- **The artist's choice is never judged.** No score for being "online", no "add more streaming links". ("The
  internet devalues the art." "It's up to the artist what they do with their art.")

## 5. Proof, photos and what's missing
- **Verified streams:** the artist adds their distributor's report (TuneCore, DistroKid, CD Baby, Amuse,
  UnitedMasters, Ditto) as a screenshot or export.
  - The AI reads the lifetime streams and the date: "2.58M streams and views · TuneCore report, 18 Nov 2026 ✓".
  - The ✓ appears only when the typed number matches the report. The label says "from the artist's report", never
    "certified".
  - Money figures are never stored, shown or sent.
- **Press photo:** collect several candidates (Bandcamp, Spotify, Instagram, Discogs, YouTube art, DanzStak
  pictures) and show them as "Pick your press photo" plus "Upload your own". Copy the chosen photo into the member's
  own EPK media; never hotlink.
- **Still missing:** list real gaps only: press photo, live video, tech rider, booking contact, press quotes. Never
  flag a missing streaming link on a vinyl-only release.

## 6. Checks (the AI EPK is not done until these pass)
Fixtures are recorded page/API responses. No live network calls run in CI.
- **Eroticon fixture** (`test-ai-epk-eroticon.cjs`), built from the owner's own pages.
  - **No questions:** the build reaches a full draft from the act name alone, with no question screen.
  - **Bio:**
    - names the 1988 and 1996 start;
    - is in oldest-to-newest order.
  - **Releases:**
    - all 10 Bandcamp releases and all 6 Discogs releases appear;
    - "6" is "vinyl only";
    - It's All Good says "Made in Berlin, Germany";
    - More Machine Than Human lists MeccaLab, Big Foot Studios, Room 5, George Horn Mastering and Memphis Record
      Pressing;
    - SpermBot says "GZ Media Paris".
  - **Collaborators:** remixers are listed per release, and Patti X is credited on She's a Goddess.
  - **Not included:**
    - no "add streaming links" item;
    - no dollar figure anywhere;
    - no fact without a source URL.
- **Languages fixture:** an Italian-language source page is read and cited; the EPK comes out in the artist's
  language plus English; sleeve wording and names are untranslated.
- **Touring fixture:** recorded RA/Songkick/flyer pages give a "Played in" list with sources and a bio line with the
  country count.
- **Rider fixture:** a DJ who plays vinyl gets a rider with turntable isolation and booth monitors; a live act gets
  its input list.
- **Short-career fixture:** an act whose streaming pages start in 2023 but whose Discogs history starts in 1996
  gets a bio that names 1996.
- **Same-name fixture:** two acts called "Eroticon" are never merged without the artist's tick.
- **Stream-report fixture:**
  - a matching report gives the ✓ line with its date;
  - a mismatched number gets no ✓;
  - the report's money figures never appear.
- **Grade:** a human reads each fixture draft against `docs/tasks/40-launch-check.md` (Works, Looks, Feels, Words,
  Reach). Only an A ships.

## Owner's own EPK
Eroticon (`@eroticon`) has a private draft rebuilt by hand on 2026-11-20. It does not yet meet this standard: the
worldwide touring history, the tech rider and the other languages are missing. The pressing city of "6" and the
Latch-On plant stay under "Still missing" until a page shows them.

Use it as the reference output for the Eroticon fixture.
