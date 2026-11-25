"use strict";
// Owner 2026-11-22: "link goes to the sign in, I think it should go to the store. And the user that clicks the link can
// only see the eroticon shop or exit out." Someone who isn't signed in gets the member's published shop: the items, a
// tap opens one, ✕ leaves to the landing page. No shop (or not published) → the landing page.
(() => {
  const API = "https://api.danzstak.com";
  // The shop front at the seller's Move to fit position (F12/F21; same meaning as image-position.js apply()).
  const placeFront = (image, position) => {
    if (!image || !position) return;
    const clamp = (value, low, high, start) => { const n = Number(value); return Math.min(high, Math.max(low, Number.isFinite(n) ? n : start)); };
    const x = clamp(position.x, 0, 100, 50), y = clamp(position.y, 0, 100, 50), zoom = clamp(position.zoom, 1, 3, 1);
    image.style.objectPosition = `${x}% ${y}%`; image.style.transformOrigin = `${x}% ${y}%`; if (zoom > 1) image.style.transform = `scale(${zoom})`;
  };
  const byId = id => document.getElementById(id);
  const t = value => window.danzstakTranslate?.(value) || value;
  const member = new URLSearchParams(location.search).get("member") || "";
  const status = byId("shopStatus"), retry = byId("shopRetry"), dialog = byId("shopItem");
  const money = cents => new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency: "USD" }).format(Math.max(0, Number(cents || 0)) / 100);
  const shipping = item => item.shippingCents ? `+${money(item.shippingCents)} ${t("shipping")}` : t("Free shipping");
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const picture = (url, alt = "") => {
    const image = document.createElement("img"); image.src = url; image.alt = alt; image.decoding = "async"; image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true }); return image;
  };

  function openItem(item, opener) {
    const frame = byId("shopItemImage"); frame.replaceChildren(); if (item.imageUrl) frame.append(picture(item.imageUrl, item.title));
    frame.hidden = !item.imageUrl;
    byId("shopItemTitle").textContent = item.title;
    byId("shopItemPrice").textContent = money(item.priceCents);
    byId("shopItemShipping").textContent = shipping(item);
    byId("shopItemAbout").textContent = item.description || ""; byId("shopItemAbout").hidden = !item.description;
    dialog.onclose = () => opener.focus();
    dialog.showModal(); dialog.scrollTop = 0;
  }

  function show(shop) {
    document.title = `${shop.name} | DanzStak`;
    byId("shopName").textContent = shop.name;
    const about = byId("shopAbout"); about.textContent = shop.description || ""; about.hidden = !shop.description;
    const cover = byId("shopCover"); if (shop.coverUrl) { const front = picture(shop.coverUrl); placeFront(front, shop.coverPosition); cover.replaceChildren(front); cover.hidden = false; }
    const grid = byId("shopGrid"); grid.replaceChildren();
    const items = (shop.products || []).filter(item => item.available);
    for (const item of items) {
      const card = el("button", "shop-public-card"); card.type = "button";
      const frame = el("span", "shop-public-image"); if (item.imageUrl) frame.append(picture(item.imageUrl));
      const title = el("strong", "shop-public-title", item.title); title.setAttribute("data-no-translate", "");
      card.append(frame, title, el("span", "shop-public-detail", shipping(item)), el("span", "shop-public-price", money(item.priceCents)));
      card.setAttribute("aria-label", `${item.title}, ${money(item.priceCents)}`);
      card.addEventListener("click", () => openItem(item, card));
      grid.append(card);
    }
    status.textContent = items.length ? "" : t("Nothing for sale right now.");
    status.hidden = !!items.length;
    byId("shop").hidden = false;
  }

  async function load() {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(member)) { location.replace("./"); return; }
    retry.hidden = true; status.hidden = false; status.textContent = t("Loading shop…");
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}/marketplace/shop/${encodeURIComponent(member)}`, { cache: "no-store", signal: controller.signal });
      if (response.status === 404 || response.status === 400) { location.replace("./"); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.shop) throw new Error("Shop unavailable");
      show(data.shop);
    } catch {
      status.textContent = t("The shop couldn't be loaded. Try again."); retry.hidden = false;
    } finally { clearTimeout(timer); }
  }

  byId("shopItemClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  retry.addEventListener("click", load);
  load();
})();
