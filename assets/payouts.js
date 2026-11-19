"use strict";
// "Get paid" card for sellers and promoters: Stripe verifies them on Stripe's own pages; DanzStak never sees ID or bank numbers.
(() => {
  const API = "https://api.danzstak.com";
  const COUNTRIES = [["US", "United States"], ["IT", "Italy"], ["GB", "United Kingdom"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["NL", "Netherlands"], ["IE", "Ireland"], ["PT", "Portugal"], ["BE", "Belgium"], ["AT", "Austria"], ["SE", "Sweden"], ["DK", "Denmark"], ["FI", "Finland"], ["NO", "Norway"], ["PL", "Poland"], ["CZ", "Czechia"], ["GR", "Greece"], ["CA", "Canada"], ["CH", "Switzerland"]];
  const COPY = {
    none: ["Get paid", "Before you can be paid for tickets or items, Stripe checks your ID and bank details on its own secure page. DanzStak never sees them."],
    onboarding: ["Finish getting paid", "Stripe still needs a few details before payouts can start."],
    action_required: ["Stripe needs something", "Payouts are paused until you update your details with Stripe."],
    active: ["Payouts on", "Stripe has verified you. Sales are paid out after each order's release rules are met."],
    closed: ["Payouts closed", "This payout account is closed."]
  };

  async function start(card, select, button, from) {
    button.disabled = true; button.textContent = "Opening Stripe…";
    try {
      const response = await fetch(API + "/marketplace/payouts/onboarding", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: select?.value || "", from }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Payout sign-up is unavailable right now.");
      location.assign(data.url);
    } catch (error) {
      card.querySelector(".payouts-note").textContent = error.message;
      button.disabled = false; button.textContent = "Try again";
    }
  }

  async function render(host, from = "shop") {
    if (!host || host.querySelector(".payouts-card")) return;
    const card = document.createElement("section"); card.className = "payouts-card"; card.setAttribute("aria-labelledby", "payoutsTitle");
    host.prepend(card);
    let status = "none", testing = true;
    try {
      const response = await fetch(API + "/marketplace/payouts", { credentials: "include", cache: "no-store" });
      if (response.status === 401) { card.remove(); return; }
      const data = await response.json().catch(() => ({}));
      status = data?.payouts?.status || "none"; testing = data?.payouts?.testing !== false;
    } catch {}
    const [title, note] = COPY[status] || COPY.none;
    card.dataset.status = status;
    const h = document.createElement("h2"); h.id = "payoutsTitle"; h.textContent = title;
    const p = document.createElement("p"); p.className = "payouts-note"; p.textContent = note;
    card.append(h, p);
    if (testing) { const t = document.createElement("p"); t.className = "payouts-testing"; t.textContent = "Testing: no real money moves yet."; card.append(t); }
    if (status === "active" || status === "closed") return;
    const row = document.createElement("div"); row.className = "payouts-row";
    let select = null;
    if (status === "none") {
      const label = document.createElement("label"); label.textContent = "Bank country";
      select = document.createElement("select"); select.id = "payoutsCountry";
      for (const [code, name] of COUNTRIES) { const o = document.createElement("option"); o.value = code; o.textContent = name; select.append(o); }
      const guess = (navigator.language || "").split("-")[1];
      if (guess && COUNTRIES.some(([code]) => code === guess.toUpperCase())) select.value = guess.toUpperCase();
      label.append(select); row.append(label);
    }
    const button = document.createElement("button"); button.type = "button"; button.className = "payouts-start"; button.textContent = status === "none" ? "Get paid with Stripe" : "Continue with Stripe";
    button.addEventListener("click", () => start(card, select, button, from));
    row.append(button); card.append(row);
    // Stripe sends members back here; an expired link restarts sign-up.
    if (new URLSearchParams(location.search).get("payouts") === "refresh" && status !== "none") start(card, select, button, from);
  }

  window.danzstakRenderPayouts = render;
  const boot = () => { const manager = document.getElementById("shopManager"); if (manager && new URLSearchParams(location.search).get("manage") === "1") render(manager, "shop"); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
