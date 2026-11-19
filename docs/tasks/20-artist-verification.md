# 20 — Verify the artist before an EPK goes public

Owner, 2026-11-17: on SFScoop people signed up claiming to be Katy Perry and other famous artists. On DanzStak a fake EPK is worse than a fake profile: it pitches real venues in a real artist's name, burns our sending reputation and the venue's trust. So an artist proves they are the act before their EPK is public or pitched.

## Rule
- Anyone can **build and preview** an EPK privately. **Publishing the public EPK, sending pitches, emailing record shops/radio, and the Verified mark need a verified artist.**
- Verification is per act (band/DJ name), not per account. A member can verify several acts; a band can have several verified members.
- Nothing here ever asks for a password to another platform or uses a platform API.

## Ways to verify (the artist picks one)
1. **Code in a public profile they control.** DanzStak shows a short code (`DZ-7K4Q`). The artist pastes it into the bio/description of one public page that's clearly the act's: Bandcamp, SoundCloud, Mixcloud, Resident Advisor artist page, Instagram bio, YouTube channel description, or their own website. DanzStak fetches that public page once (no login, no API) and looks for the code. The artist can remove the code afterwards.
2. **Own website.** A `<meta name="danzstak-verify" content="DZ-…">` tag or a DNS TXT record on the act's domain.
3. **Email at the act's domain** (`booking@theband.com`) when that domain is the one the act's public pages link to: a one-time link to that address.
4. **Manual review** (fallback for acts with almost no web presence): a DanzStak editor (directory editors list) checks a link to a gig listing, label page or press mention. Never ID documents or selfies.

## Famous names
- A protected-names list (start with the most-streamed artists and anything a member reports) **always** goes to manual review, even if an automatic check passes, and blocks publishing until an editor approves.
- Exact or near matches (case, spacing, "official", "the") count.
- Reporting: every public EPK and profile gets "Report impersonation". Two reports or one editor flag unpublish the EPK pending review; pitches stop.

## What members see
- EPK builder: a "Verify your act" step in the checklist with the code and the options; "Publish" and "Send pitch" stay disabled with a one-line reason until verified.
- Verified acts get a small mark on the EPK, profile and pitch emails ("Verified artist on DanzStak").
- Status lines: Not verified · Checking · Verified (date, method) · Needs review.

## Records and privacy
- Store: act name, method, the public URL checked, code, timestamps, editor id for manual approvals. Never store page contents beyond the match result.
- Re-check yearly or when the act's name changes; a name change re-opens verification.
- Honest copy: verification means "this member showed control of the act's public page", not a legal guarantee of identity.

## Tests
- Publish and pitch blocked server-side (not just in the UI) without verification.
- Code check: found → verified; not found → stays unverified; code from another act/member never counts; expired codes (24h) rejected.
- Protected name → needs review even with a valid code.
- Reports unpublish and stop pitches.
