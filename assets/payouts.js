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

  // My shop on the UI kit (F21: "no paragraph-heavy Get paid box"): one row; the explanation and the bank country
  // live in a sheet that opens from it. The same Stripe-hosted sign-up as the card above.
  async function renderKit(slot, from = "shop") {
    if (!slot || slot.querySelector(".payouts-row-kit")) return;
    const t = text => (typeof window.danzstakTranslate === "function" ? window.danzstakTranslate(text) : text) || text;
    const icon = name => window.danzstakIcon ? window.danzstakIcon(name) : document.createElement("span");
    let status = "none", testing = true;
    try {
      const response = await fetch(API + "/marketplace/payouts", { credentials: "include", cache: "no-store" });
      if (response.status === 401) return;
      const data = await response.json().catch(() => ({}));
      status = data?.payouts?.status || "none"; testing = data?.payouts?.testing !== false;
    } catch {}
    const [title, note] = COPY[status] || COPY.none;
    const done = status === "active" || status === "closed";
    const row = document.createElement(done ? "div" : "button");
    row.className = "ds-pick payouts-row-kit"; row.dataset.status = status; if (!done) row.type = "button";
    const name = document.createElement("span"); name.className = "ds-pick__label"; name.textContent = t(title);
    const value = document.createElement("span"); value.className = "ds-pick__value";
    value.textContent = t(testing ? "Testing: no real money moves yet." : status === "active" ? "Verified by Stripe" : "Stripe, not DanzStak, checks your ID");
    row.append(icon(status === "active" ? "check" : "wallet"), name, value, done ? document.createElement("span") : icon("chevron-right"));
    slot.append(row);
    if (done) return;
    const begin = async (button, country, noteLine) => {
      button.disabled = true; button.textContent = t("Opening Stripe…");
      try {
        const response = await fetch(API + "/marketplace/payouts/onboarding", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country, from }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || "Payout sign-up is unavailable right now.");
        location.assign(data.url);
      } catch (error) { noteLine.textContent = t(error.message); button.disabled = false; button.textContent = t("Try again"); }
    };
    row.addEventListener("click", () => {
      if (!window.danzstakSheet) return;
      const body = document.createElement("div");
      const text = document.createElement("p"); text.className = "ds-note"; text.textContent = t(note);
      body.append(text);
      let country = "";
      if (status === "none") {
        const guess = (navigator.language || "").split("-")[1]?.toUpperCase();
        country = COUNTRIES.some(([code]) => code === guess) ? guess : "US";
        const list = document.createElement("div"); list.setAttribute("role", "radiogroup"); list.setAttribute("aria-label", t("Bank country")); list.className = "payouts-countries";
        const heading = document.createElement("p"); heading.className = "ds-section__title payouts-kit-title"; heading.textContent = t("Bank country");
        for (const [code, label] of COUNTRIES) {
          const choice = document.createElement("button"); choice.type = "button"; choice.className = "ds-choice"; choice.setAttribute("role", "radio"); choice.dataset.country = code;
          choice.setAttribute("aria-checked", String(code === country));
          const words = document.createElement("span"); words.className = "ds-choice__text"; words.append(Object.assign(document.createElement("strong"), { textContent: t(label) }));
          const check = document.createElement("span"); check.className = "ds-choice__check"; check.append(icon("check"));
          choice.append(icon("globe"), words, check);
          choice.addEventListener("click", () => { country = code; for (const other of list.children) other.setAttribute("aria-checked", String(other === choice)); });
          list.append(choice);
        }
        body.append(heading, list);
      }
      const actions = document.createElement("div"); actions.className = status === "none" ? "ds-actions ds-actions--sticky" : "ds-actions";
      const go = document.createElement("button"); go.type = "button"; go.className = "ds-btn ds-btn--go ds-btn--block"; go.textContent = t(status === "none" ? "Get paid with Stripe" : "Continue with Stripe");
      const noteLine = document.createElement("p"); noteLine.className = "ds-note"; noteLine.setAttribute("role", "status");
      go.addEventListener("click", () => begin(go, country, noteLine));
      actions.append(go, noteLine); body.append(actions);
      window.danzstakSheet.open({ title: t(title), content: body });
    });
  }

  window.danzstakRenderPayouts = render;
  const boot = () => {
    if (new URLSearchParams(location.search).get("manage") !== "1") return;
    const slot = document.getElementById("payoutsSlot");
    if (slot) { renderKit(slot, "shop"); return; }
    const manager = document.getElementById("shopManager"); if (manager) render(manager, "shop");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
