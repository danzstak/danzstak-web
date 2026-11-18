"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const list = document.getElementById("bazaarProducts");
  const status = document.getElementById("bazaarStatus");
  const filter = document.getElementById("bazaarFilter");
  const t = value => window.danzstakTranslate?.(value) || value;
  // Fix-it 18 (owner 2026-11-17): one search. The shared top-bar search finds Bazaar products and people together;
  // "See all" filters this page through ?q= so device Back returns to the whole Bazaar.
  const termFromUrl = () => (new URLSearchParams(location.search).get("q") || "").trim().slice(0, 120);
  let term = termFromUrl();
  let catalog = [], nextOffset = null, total = 0;
  const more = document.createElement("button");
  more.type = "button"; more.className = "bazaar-more"; more.textContent = "Show more"; more.hidden = true;
  list.after(more);

  const money = cents => new Intl.NumberFormat(undefined, { style:"currency", currency:"USD" }).format(Number(cents || 0) / 100);
  const node = (tag, text = "", className = "") => { const value = document.createElement(tag); value.textContent = text; if (className) value.className = className; return value; };
  async function fetchPage(query, offset = 0, signal) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const response = await fetch(`${API}/marketplace/bazaar?offset=${offset}&q=${encodeURIComponent(query)}`, { credentials:"include", cache:"no-store", signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The Bazaar could not be loaded.");
      return { products: Array.isArray(data.products) ? data.products : [], nextOffset: Number.isInteger(data.nextOffset) ? data.nextOffset : null, total: Number(data.total) || 0 };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error.name === "AbortError") throw new Error("The Bazaar took too long to respond. Try again.");
      if (error instanceof TypeError || error.message === "Failed to fetch") throw new Error("The Bazaar is temporarily unavailable. Try again shortly.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function request(offset = 0) {
    const page = await fetchPage(term, offset);
    nextOffset = page.nextOffset; total = page.total;
    return page.products;
  }
  function render() {
    const shown = catalog;
    more.hidden = nextOffset === null;
    list.replaceChildren();
    if (!shown.length) {
      // Fix-it 18: one line and one action, not three lines of text on a grey page.
      const empty = node("div", "", "bazaar-empty");
      empty.append(node("p", term ? "Nothing matches that search." : "Nothing for sale yet."));
      if (!term) {
        const sell = node("a", "", "bazaar-sell");
        sell.href = "store.html?manage=1";
        sell.append(node("span", "+", "bazaar-sell-plus"), node("span", "Sell something"));
        sell.querySelector(".bazaar-sell-plus").setAttribute("aria-hidden", "true");
        empty.append(sell);
      }
      list.append(empty);
      status.textContent = "";
      return;
    }
    for (const product of shown) {
      const card = document.createElement("a"); card.className = "bazaar-card"; card.href = `product.html?id=${encodeURIComponent(product.id)}`;
      const frame = node("span", "", "bazaar-image-frame");
      if (product.imageUrl) { const image = document.createElement("img"); image.src = product.imageUrl; image.alt = ""; image.loading = "lazy"; image.decoding = "async"; image.referrerPolicy = "no-referrer"; frame.append(image); }
      else frame.append(node("span", "No image", "image-fallback"));
      const copy = node("span", "", "bazaar-card-copy");
      copy.append(node("strong", product.title, "bazaar-title"), node("span", product.shopName, "bazaar-seller"), node("span", money(product.priceCents), "bazaar-price"), node("span", product.shippingCents ? `+${money(product.shippingCents)} shipping` : "Free shipping", "bazaar-shipping"));
      card.append(frame, copy); list.append(card);
    }
    status.textContent = `${total || shown.length} product${(total || shown.length) === 1 ? "" : "s"}. Fixed price, no bidding.`;
  }
  // Search runs on the server so shops with thousands of records are searchable; "Show more" loads the next page (no infinite scroll).
  const load = () => request(0).then(products => { catalog = products; render(); }).catch(error => { list.replaceChildren(); more.hidden = true; status.textContent = error.message; });
  // The active search shows as one small chip with a clear button, where the second search box used to be.
  function showFilter() {
    filter.replaceChildren();
    filter.hidden = !term;
    if (!term) return;
    const clear = document.createElement("a");
    clear.className = "bazaar-filter-clear"; clear.href = "bazaar.html";
    clear.setAttribute("aria-label", t("Clear search")); clear.title = t("Clear search");
    clear.textContent = "×";
    filter.append(node("span", `“${term}”`, "bazaar-filter-term"), clear);
  }
  function applyTerm(next) { term = next; showFilter(); load(); }
  filter.addEventListener("click", event => {
    if (!event.target.closest?.(".bazaar-filter-clear")) return;
    event.preventDefault();
    try { history.replaceState(null, "", "bazaar.html"); } catch {}
    applyTerm("");
  });
  window.addEventListener("popstate", () => { const next = termFromUrl(); if (next !== term) applyTerm(next); });
  more.addEventListener("click", () => { if (nextOffset === null) return; more.disabled = true; request(nextOffset).then(products => { catalog = catalog.concat(products); render(); }).catch(error => { status.textContent = error.message; }).finally(() => { more.disabled = false; }); });

  // The shared top-bar search sheet (top-search.js) gets a Bazaar section above People.
  function mountSheet({ dialog, input, close }) {
    if (!dialog || dialog.querySelector(".bazaar-sheet")) return;
    input.placeholder = t("Search the Bazaar or people");
    input.setAttribute("aria-label", t("Search the Bazaar or people"));
    dialog.setAttribute("aria-label", t("Search the Bazaar or people"));
    const section = node("section", "", "bazaar-sheet"), rows = node("div", "", "bazaar-sheet-rows"), note = node("p", "", "bazaar-sheet-note");
    section.hidden = true; section.setAttribute("aria-labelledby", "bazaarSheetTitle");
    const heading = node("h2", t("Bazaar")); heading.id = "bazaarSheetTitle";
    const all = node("a", t("See all in the Bazaar"), "bazaar-sheet-all");
    all.hidden = true; note.setAttribute("role", "status");
    section.append(heading, note, rows, all);
    const people = node("h2", t("People"), "bazaar-sheet-people"); people.hidden = true;
    dialog.querySelector(".ds-top-search-bar").after(section, people);
    let timer = 0, controller = null, generation = 0;
    input.addEventListener("input", () => {
      const query = input.value.trim(), version = ++generation;
      clearTimeout(timer); controller?.abort();
      // "@name" is a member search only; everything else also searches products and shops.
      const active = query.length >= 2 && !query.startsWith("@");
      section.hidden = !active; people.hidden = !active;
      rows.replaceChildren(); all.hidden = true; note.textContent = "";
      if (!active) return;
      all.href = `bazaar.html?q=${encodeURIComponent(query.slice(0, 120))}`;
      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const page = await fetchPage(query, 0, controller.signal);
          if (version !== generation) return;
          for (const product of page.products.slice(0, 4)) {
            const row = node("a", "", "bazaar-sheet-row"); row.href = `product.html?id=${encodeURIComponent(product.id)}`;
            const thumb = node("span", "", "bazaar-sheet-thumb");
            if (product.imageUrl) { const image = document.createElement("img"); image.src = product.imageUrl; image.alt = ""; image.loading = "lazy"; image.referrerPolicy = "no-referrer"; thumb.append(image); }
            const copy = node("span", "", "bazaar-sheet-copy");
            copy.append(node("strong", product.title), node("small", [product.shopName, money(product.priceCents)].filter(Boolean).join(" · ")));
            row.append(thumb, copy); rows.append(row);
          }
          note.textContent = page.products.length ? "" : t("Nothing in the Bazaar matches.");
          all.hidden = !page.products.length;
        } catch (error) {
          if (version !== generation || controller.signal.aborted) return;
          note.textContent = t(error.message);
        }
      }, 250);
    });
    // "See all" filters the page underneath without a reload: the sheet's history entry becomes ?q=.
    all.addEventListener("click", event => {
      event.preventDefault();
      const query = input.value.trim().slice(0, 120);
      close(true);
      try { history.replaceState(null, "", all.href); } catch {}
      input.value = ""; input.dispatchEvent(new Event("input"));
      applyTerm(query);
    });
  }
  document.addEventListener("danzstak:top-search", event => mountSheet(event.detail || {}));
  showFilter();
  load();
})();
