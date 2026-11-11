"use strict";
(() => {
  const API = "https://api.danzstak.com";
  const status = document.getElementById("syncNetworkNumberStatus");
  const buy = document.getElementById("buySyncNetworkNumber");
  if (!status || !buy) return;
  let loading = false;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(API + path, { credentials: "include", cache: "no-store", signal: controller.signal, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "DanzStak Network number settings are unavailable.");
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function render(data) {
    const active = data?.entitled === true && /^DS-[1-9][0-9]{2}-[0-9]{4}$/.test(String(data.alias || ""));
    status.dataset.state = active ? "active" : "";
    status.textContent = active ? `Your private SYNC alias is ${data.alias}.` : data?.checkoutAvailable === false ? "DS number Test Mode checkout is not available on this build." : "No DS number is assigned to this account yet.";
    buy.hidden = active || data?.checkoutAvailable === false;
    buy.disabled = false;
  }

  async function load() {
    if (loading) return;
    loading = true;
    status.textContent = "Checking your DS number…";
    try {
      render(await request("/sync-network-number/entitlement"));
    } catch (error) {
      status.dataset.state = "error";
      status.textContent = error.name === "AbortError" ? "DS number settings took too long to respond." : error.message;
      buy.hidden = true;
    } finally {
      loading = false;
    }
  }

  buy.addEventListener("click", async () => {
    buy.disabled = true;
    status.dataset.state = "";
    status.textContent = "Opening secure Stripe Test Mode checkout…";
    try {
      const data = await request("/sync-network-number/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (data.entitled && data.alias) return render(data);
      if (!/^https:\/\/checkout\.stripe\.com\//.test(String(data.checkoutUrl || ""))) throw new Error("Stripe did not return a secure checkout link.");
      location.assign(data.checkoutUrl);
    } catch (error) {
      status.dataset.state = "error";
      status.textContent = error.name === "AbortError" ? "Stripe checkout took too long to respond." : error.message;
      buy.disabled = false;
    }
  });

  document.addEventListener("danzstak:calling-devices-opened", load);
  document.addEventListener("DOMContentLoaded", () => {
    const result = new URLSearchParams(location.search).get("sync-number");
    if (result === "payment-success") status.textContent = "Payment received. Waiting for your DS number…";
    else if (result === "payment-cancelled") status.textContent = "Checkout cancelled. No DS number was assigned.";
    load();
  });
})();
