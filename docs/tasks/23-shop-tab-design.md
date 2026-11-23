# 23: Shop tab and product page polish (owner, 2026-11-18; model: the Eroticon shop)

> **Brief incomplete.** The owner's brief arrived cut off in item 7 ("…rows Domestic / Rest of region / Worldwide / each extra item, then"). Everything below is the brief as received. The rest of item 7, the **product page** section and anything after it are **still to come from the owner**. Don't build the product page until they arrive.

Read first: `CLAUDE.md`, `docs/tasks/QUEUE.md`, `docs/tasks/22-example-shop.md`, `assets/store.js`, `assets/store.css`, `assets/bazaar.js`, `infrastructure/auth-api/marketplace.mjs`.

## Goal
A member's **Shop tab** on their profile, and the **product page**, must look finished, music-native and phone-first, like the reference (the Eroticon shop).

This is **the template every band, fan and record shop gets**:
- **No hard-coded Eroticon data in code.** Every word, price and image comes from the seller's own shop data.
- The example shops (task 22) use the same components.

## Shop tab (profile → Shop, 390px first)
1. **Profile header as today:**
   - cover, overlapping avatar, name;
   - **@handle + genre tags in mono**;
   - one-line bio;
   - **Follow**, plus icon buttons for **SYNC message** and **Share** (44px targets).
   - Tabs: Posts · About · Friends · Photos · Videos · **Shop**. When Shop is active it has a **3px accent underline**.
1b. **Shop stats bar across the shop's nav (owner 2026-11-18, Discogs seller-page screenshot: "should look like their Discogs shop with # of items and such across the main nav bar")**. A dark band under the cover, full width and edge to edge, with equal cells divided by hairlines, a **big number with a small label** in each cell, and sideways scroll on narrow phones:
   - **For sale N** (taps to the shop grid)
   - **Sold N**
   - **Ratings ★ 4.9 (N)**, only once DanzStak ratings exist
   - **Followers N**
   - **In collection / Crate N**, if the member keeps a crate
   - **Since YEAR**

   Under the band, plain lines (like Discogs): **location**, **"Selling since YEAR"**, links, then the shop description.
   - **History from other platforms (owner 2026-11-18: "a lot of guys have a long history on Discogs")**: Moving Day can bring the seller's **own record from the old shop**, entered or pasted by the seller: joined year, number of sales, rating % and number of ratings. It shows as a separate small line, **"On Discogs since 2002 · 4,812 ratings · 100% positive"**, and links to their old profile so a buyer can check it. It's clearly marked as **from Discogs**, never mixed into DanzStak's own counts, and the seller confirms it's theirs. Never invent or scrape it. The seller can remove it any time.
   - Counts only, no rankings, no "top seller" badges.
2. **Shop header:**
   - a mono kicker in the accent colour: **"\<LABEL OR SHOP NAME\> · SHIPS FROM \<REGION\>"**;
   - a bold heading: the **seller-editable shop title** (e.g. "Records, shirts and slipmats").
3. **"Every order comes with…"**: a seller-set free extra (e.g. free stickers). It sits in a **dashed-accent box with a sticker icon** and is **hidden when empty**.
4. **Filter chips** from the shop's own categories, with counts: **All · N**, Vinyl, Shirts, Gear. 36px pills with `aria-pressed`.
5. **Featured row:** one wide card for a **bundle** or a **pinned item**. It has:
   - stacked thumbnails;
   - a **BUNDLE** kicker;
   - the title;
   - a one-line "what's in it";
   - the **all-in price**.
6. **2-column grid**. Each card has:
   - a **square image** (`object-fit: cover`, full card width);
   - the title;
   - a **mono detail line**: format · cat# · year, or colour · sizes;
   - the bold **ALL-IN price**.

   An **optional small accent badge** on the image is set by the seller (e.g. "SOLD OUT ELSEWHERE"), **max 18 characters**.
7. **Shipping table at the end:** the ships-from city, then rows for **Domestic / Rest of region / Worldwide / each extra item**, then … *(brief cut off here; waiting for the owner)*

## Product page
*(Not received yet. The owner's brief names it in the goal; details are still to come.)*

## Rules that already apply (CLAUDE.md and the owner's fee decisions)
- **Prices:**
  - **All-in prices** shown up front: the buyer pays a 6% fee plus $1 on orders under $30 (`docs/tasks/12-buyer-paid-fees.md`).
  - Shipping is set by the seller and never has the fee applied.
- **Commerce:**
  - The **Bazaar** is the only commerce destination. A shop's items appear there and once in Mix as a normal chronological post.
  - **No ads in Mix**, ever.
- **Uploads:**
  - **No audio files.** Music is links or authorized embeds only.
  - Photos are the seller's own.
- **Layout:**
  - Phone first: 320 / 360 / 375 / 390 / 414 / 430px.
  - No horizontal overflow, 44px targets, contrast at least 4.5:1.
  - Translations: it/fr/es.

## How to build (owner)
- Plan before code, and **post the plan in the PR description**.
- **Small PRs: frontend first**, then any `marketplace.mjs` changes (the new seller-editable fields: shop title, label/shop name, ships-from region, free extra, featured bundle/pin, item badge).
- Each PR needs:
  - a regression test;
  - screenshots at 360 and 390px.
- **Don't merge or deploy.** The owner reviews and ships.
