"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const byId = id => document.getElementById(id);
  const status = byId("productStatus"), detail = byId("productDetail");
  const productId = new URLSearchParams(location.search).get("id") || "";
  const money = cents => new Intl.NumberFormat(undefined, { style:"currency", currency:"USD" }).format(Number(cents || 0) / 100);
  async function load() {
    if (!/^[a-f0-9-]{36}$/i.test(productId)) { status.textContent = "This product link is not valid."; return; }
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}/marketplace/bazaar/${encodeURIComponent(productId)}`, { credentials:"include", cache:"no-store", signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The product could not be loaded.");
      const product = data.product;
      byId("productTitle").textContent = product.title;
      byId("productDescription").textContent = product.description || "No description was provided.";
      byId("productPrice").textContent = money(product.priceCents);
      byId("productShipping").textContent = product.shippingCents ? `Shipping: ${money(product.shippingCents)}` : "Free shipping";
      byId("productShop").textContent = product.shopName;
      byId("productShop").href = `store.html?member=${encodeURIComponent(product.memberId)}`;
      const image = byId("productImage"); image.src = product.imageUrl || "assets/danzstak-d-icon.png"; image.alt = product.imageUrl ? product.title : "DanzStak";
      document.title = `${product.title} | DanzStak Bazaar`;
      status.textContent = ""; detail.hidden = false;
    } catch (error) {
      status.textContent = error.name === "AbortError" ? "The product took too long to respond. Try again." : (error instanceof TypeError || error.message === "Failed to fetch" ? "The Bazaar is temporarily unavailable. Try again shortly." : error.message);
    } finally { clearTimeout(timer); }
  }
  load();
})();
