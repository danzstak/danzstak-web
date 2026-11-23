# 23b: Mix item slot + Bazaar rotation (owner, 2026-11-18)

Build **after task 23**. Read `CLAUDE.md` first, then `docs/tasks/14-promoters-crews-and-city-sweeps.md`, sections **"Mix item slot"** and **"Bazaar rotation"** (owner 2026-11-17 and 2026-11-18). Build exactly that, as summarised below.

## Server
- **A per-member cursor of Bazaar items already shown**, stored in DynamoDB. There is **no client-only state**.
- **Fair order:**
  - one item per seller per pass;
  - nearby and followed sellers first, then newer items.
- **No repeats within 2 weeks.**
- **Rotation** to the next items happens on:
  - a new session;
  - reopening the app;
  - the end-of-feed refresh ("You're caught up", then refresh).

## Mix
- **Every 4 posts a new item (owner 2026-11-18; superseded 2026-11-19 by CLAUDE.md F15d: after 4 member posts comes one slot that alternates Bazaar item → review → Bazaar item → scene news → …)**: after every 4 member posts comes one item card, labelled **"For sale"** or **"Tickets"**, and each card is a **different** item. The 4 is an owner setting. The only time a slot is skipped is when there is no unseen item left to show.
- **Sellers see their own items in Mix too (owner 2026-11-18)**: a member's own listings are part of their rotation like anyone else's, so they can see how their items look and that they're out there. On their own card, a small "Your item · seen by N" line replaces the buy cue, and N is a count only.
- Each slot shows a **different seller and a different kind** from the previous slot. The kinds are gig ticket, band merch, record and craft.
- The slot is **skipped when nothing fits**.
- **Never paid, never boosted.**
- Mix stays **chronological** and ends with **"You're caught up"**.

## Bazaar
- **One mixed grid of all active items**, reshuffled to unseen items on each visit.
- **Finite pages.** Search is unchanged.
- **Categories stay hidden behind an owner flag** until there is enough stock.

## Opening an item
- Tapping an item, in Mix or in the Bazaar, opens the **seller's profile Shop tab with that product page open**.
- **Back restores the exact scroll spot** in Mix or in the Bazaar.

## Tests
- **Regression tests:**
  - rotation across sessions;
  - no repeat within 2 weeks;
  - no same seller or kind twice in a row;
  - the slot is skipped when nothing fits;
  - hidden drafts are never shown;
  - Back restores the position.
- **Visual check** at phone widths, with screenshots in the PR.
- **Payments stay in TEST mode.**

One PR per piece. Don't merge or deploy; the owner reviews and ships.
