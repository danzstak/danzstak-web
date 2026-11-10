"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const byId = id => document.getElementById(id);
  const status = byId("productStatus"), detail = byId("productDetail"), buyButton = byId("buyProduct"), checkoutStatus = byId("checkoutStatus");
  const params = new URLSearchParams(location.search), productId = params.get("id") || "", orderId = params.get("order") || "";
  const money = cents => new Intl.NumberFormat(undefined, { style:"currency", currency:"USD" }).format(Number(cents || 0) / 100);

  async function api(path, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}${path}`, { credentials:"include", cache:"no-store", ...options, signal:controller.signal, headers:{ ...(options.body ? {"content-type":"application/json"} : {}), ...(options.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(data.error || "The request could not be completed."); error.status = response.status; throw error; }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The request took too long. Try again.");
      if (error instanceof TypeError || error.message === "Failed to fetch") throw new Error("The Bazaar is temporarily unavailable. Try again shortly.");
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function load() {
    if (!/^[a-f0-9-]{36}$/i.test(productId)) { status.textContent = "This product link is not valid."; return; }
    try {
      const { product } = await api(`/marketplace/bazaar/${encodeURIComponent(productId)}`);
      byId("productTitle").textContent = product.title;
      byId("productDescription").textContent = product.description || "No description was provided.";
      byId("productPrice").textContent = money(product.priceCents);
      byId("productShipping").textContent = product.shippingCents ? `Shipping: ${money(product.shippingCents)}` : "Free shipping";
      byId("productShop").textContent = product.shopName;
      byId("productShop").href = `store.html?member=${encodeURIComponent(product.memberId)}`;
      const image = byId("productImage"); image.src = product.imageUrl || "assets/danzstak-d-icon.png"; image.alt = product.imageUrl ? product.title : "DanzStak";
      document.title = `${product.title} | DanzStak Bazaar`;
      buyButton.disabled = !product.available;
      if (!product.available) { buyButton.textContent = "Unavailable"; checkoutStatus.textContent = "This item is no longer available."; }
      status.textContent = ""; detail.hidden = false;
    } catch (error) { status.textContent = error.message; }
  }

  async function loadOrder() {
    if (!/^[a-f0-9-]{36}$/i.test(orderId)) return;
    try {
      const { order } = await api(`/marketplace/orders/${encodeURIComponent(orderId)}`);
      byId("orderStatus").hidden = false;
      byId("orderSummary").textContent = `${order.productTitle}: ${order.status.replaceAll("_", " ")}.`;
      if (order.status === "shipped") byId("confirmDelivery").hidden = false;
    } catch (error) { checkoutStatus.textContent = error.message; }
  }

  buyButton.addEventListener("click", async () => {
    buyButton.disabled = true; checkoutStatus.textContent = "Opening secure Stripe Test Mode Checkout…";
    try {
      const data = await api("/marketplace/checkout", { method:"POST", body:JSON.stringify({ productId }) });
      if (!/^https:\/\/checkout\.stripe\.com\//.test(data.checkoutUrl || "")) throw new Error("Stripe Checkout did not return a secure link.");
      location.assign(data.checkoutUrl);
    } catch (error) {
      if (error.status === 401) { location.assign(`/?return=${encodeURIComponent(`product.html?id=${productId}`)}`); return; }
      checkoutStatus.textContent = error.message; buyButton.disabled = false;
    }
  });

  byId("confirmDelivery").addEventListener("click", async () => {
    const button = byId("confirmDelivery"); button.disabled = true; checkoutStatus.textContent = "Confirming delivery and releasing the Test Mode seller payout…";
    try {
      const data = await api(`/marketplace/orders/${encodeURIComponent(orderId)}/confirm-delivery`, { method:"POST", body:"{}" });
      byId("orderSummary").textContent = `${data.order.productTitle}: delivered; Test Mode seller payout released.`;
      button.hidden = true; checkoutStatus.textContent = "Delivery confirmed. No live funds moved.";
    } catch (error) { checkoutStatus.textContent = error.message; button.disabled = false; }
  });

  load();
  loadOrder();
})();
