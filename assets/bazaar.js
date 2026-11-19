"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const list = document.getElementById("bazaarProducts");
  const status = document.getElementById("bazaarStatus");
  const search = document.getElementById("bazaarQuery");
  let catalog = [], nextOffset = null, total = 0, searchTimer = 0;
  const more = document.createElement("button");
  more.type = "button"; more.className = "bazaar-more"; more.textContent = "Show more"; more.hidden = true;
  list.after(more);

  const money = cents => new Intl.NumberFormat(undefined, { style:"currency", currency:"USD" }).format(Number(cents || 0) / 100);
  const node = (tag, text = "", className = "") => { const value = document.createElement(tag); value.textContent = text; if (className) value.className = className; return value; };
  async function request(offset = 0) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}/marketplace/bazaar?offset=${offset}&q=${encodeURIComponent(search.value.trim())}`, { credentials:"include", cache:"no-store", signal:controller.signal });
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
  function render() {
    const term = search.value.trim();
    const shown = catalog;
    more.hidden = nextOffset === null;
    list.replaceChildren();
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
    status.textContent = `${total || shown.length} product${(total || shown.length) === 1 ? "" : "s"}. Fixed price, no bidding.`;
  }
  // Search runs on the server so shops with thousands of records are searchable; "Show more" loads the next page (no infinite scroll).
  const load = () => request(0).then(products => { catalog = products; render(); }).catch(error => { list.replaceChildren(); more.hidden = true; status.textContent = error.message; });
  document.querySelector(".bazaar-search").addEventListener("submit", event => { event.preventDefault(); load(); });
  search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 300); });
  more.addEventListener("click", () => { if (nextOffset === null) return; more.disabled = true; request(nextOffset).then(products => { catalog = catalog.concat(products); render(); }).catch(error => { status.textContent = error.message; }).finally(() => { more.disabled = false; }); });
  load();
})();
