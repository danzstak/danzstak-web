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
- **Every 4th post** (an owner setting) is one item card, labelled **"For sale"** or **"Tickets"**.
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
