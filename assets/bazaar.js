"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const list = document.getElementById("bazaarProducts");
  const status = document.getElementById("bazaarStatus");
  const search = document.getElementById("bazaarQuery");
  let catalog = [], nextOffset = null, total = 0, searchTimer = 0;
  // Owner 2026-11-19: items from every shop mixed up, never one shop's items then the next. One seed per visit keeps the
  // server's scrambled pages consistent while "Show more" loads the next page; a new visit gets a new mix.
  const seed = Math.random().toString(36).slice(2, 12);
  const scramble = items => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]; }
    const sellers = new Map();
    for (const item of shuffled) { const key = item.memberId || item.shopName || ""; if (!sellers.has(key)) sellers.set(key, []); sellers.get(key).push(item); }
    const queues = [...sellers.values()], out = [];
    while (queues.some(queue => queue.length)) for (const queue of queues) if (queue.length) out.push(queue.shift());
    return out;
  };
  const more = document.createElement("button");
  more.type = "button"; more.className = "bazaar-more"; more.textContent = "Show more"; more.hidden = true;
  list.after(more);

  const money = cents => new Intl.NumberFormat(undefined, { style:"currency", currency:"USD" }).format(Number(cents || 0) / 100);
  const node = (tag, text = "", className = "") => { const value = document.createElement(tag); value.textContent = text; if (className) value.className = className; return value; };
  async function request(offset = 0) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}/marketplace/bazaar?offset=${offset}&seed=${seed}&q=${encodeURIComponent(search.value.trim())}`, { credentials:"include", cache:"no-store", signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The Bazaar could not be loaded.");
      nextOffset = Number.isInteger(data.nextOffset) ? data.nextOffset : null;
      total = Number(data.total) || 0;
      return Array.isArray(data.products) ? data.products : [];
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The Bazaar took too long to respond. Try again.");
      if (error instanceof TypeError || error.message === "Failed to fetch") throw new Error("The Bazaar is temporarily unavailable. Try again shortly.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  // Until the Bazaar has 24 real items (and only when not searching), labelled examples fill the grid after real items.
  let exampleMix = null;
  const scrambledExamples = () => exampleMix || (exampleMix = scramble(Array.isArray(window.danzstakBazaarExamples) ? window.danzstakBazaarExamples : []));
  const examplesFor = (term, realCount) => {
    const limit = Number(window.danzstakBazaarExampleLimit) || 24;
    // A shop that has real items (e.g. Eroticon once it's live) never also appears as an example.
    const realShops = new Set(catalog.map(product => String(product.shopName || "").trim().toLowerCase()).filter(Boolean));
    return term || realCount >= limit ? [] : scrambledExamples().filter(item => !realShops.has(item.shopName.toLowerCase())).slice(0, Math.max(0, limit - realCount));
  };
  function exampleCard(product) {
    // Not a link and no buy action: examples never reach a product page or checkout.
    const card = document.createElement("article"); card.className = "bazaar-card bazaar-example"; card.dataset.example = "true";
    card.setAttribute("aria-label", `Example: ${product.title}. Not for sale.`);
    const frame = node("span", "", "bazaar-image-frame");
    const image = document.createElement("img"); image.src = product.imageUrl; image.alt = ""; image.decoding = "async"; frame.append(image, node("span", "Example", "bazaar-example-tag")); // eager: a short, fixed set (keeps every visible card fully loaded)
    const copy = node("span", "", "bazaar-card-copy");
    copy.append(node("strong", product.title, "bazaar-title"), node("span", product.shopName, "bazaar-seller"), node("span", money(product.priceCents), "bazaar-price bazaar-example-price"), node("span", "Example · not for sale", "bazaar-shipping bazaar-example-line"));
    card.append(frame, copy);
    return card;
  }
  function render() {
    const term = search.value.trim();
    const real = catalog, examples = examplesFor(term, total || real.length);
    const shown = real;
    more.hidden = nextOffset === null;
    list.replaceChildren();
    if (examples.length) {
      const note = node("p", "Shops open soon. These are examples of what the Bazaar will look like; nothing here is for sale yet.", "bazaar-example-note");
      list.before(note); document.querySelectorAll(".bazaar-example-note").forEach(old => { if (old !== note) old.remove(); });
    } else document.querySelectorAll(".bazaar-example-note").forEach(old => old.remove());
    if (!shown.length && examples.length) {
      for (const product of examples) list.append(exampleCard(product));
      status.textContent = `${examples.length} example items. Nothing is for sale yet.`;
      return;
    }
    if (!shown.length) {
      list.append(node("p", term ? "No products match that search." : "The community is stocking its shops. Check back soon.", "bazaar-empty"));
      status.textContent = term ? "0 products found." : "No published products are available right now.";
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
    if (nextOffset === null) for (const product of examples) list.append(exampleCard(product));
    status.textContent = `${total || shown.length} product${(total || shown.length) === 1 ? "" : "s"}. Fixed price, no bidding.`;
  }
  // Search runs on the server so shops with thousands of records are searchable; "Show more" loads the next page (no infinite scroll).
  const load = () => request(0).then(products => { catalog = search.value.trim() ? products : scramble(products); render(); }).catch(error => {
    list.replaceChildren(); more.hidden = true; status.textContent = error.message;
    // Pre-launch: the examples still show what the Bazaar looks like when the live list can't load.
    if (!search.value.trim() && examplesFor("", 0).length) { catalog = []; nextOffset = null; total = 0; render(); status.textContent = error.message; }
  });
  document.querySelector(".bazaar-search").addEventListener("submit", event => { event.preventDefault(); load(); });
  search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 300); });
  more.addEventListener("click", () => { if (nextOffset === null) return; more.disabled = true; request(nextOffset).then(products => { catalog = catalog.concat(search.value.trim() ? products : scramble(products)); render(); }).catch(error => { status.textContent = error.message; }).finally(() => { more.disabled = false; }); });
  load();
})();
