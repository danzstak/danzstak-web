"use strict";
(() => {
  const api = "https://api.danzstak.com", balance = document.getElementById("bookingCreditBalance"), summary = document.getElementById("bookingCreditSummary"), status = document.getElementById("bookingCreditStatus"), activity = document.getElementById("bookingCreditActivity"), form = document.getElementById("buyBookingCredits"), quantity = document.getElementById("bookingCreditQuantity");
  async function request(path, options = {}) { const response = await fetch(api + path, { credentials: "include", cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Tour Manager billing is unavailable."); return data; }
  async function refresh() {
    try {
      const data = await request("/tour-manager/credits");
      balance.textContent = String(data.bookingEmailCredits || 0);
      summary.textContent = `${data.purchasedCredits || 0} purchased · ${data.sentEmails || 0} sent · ${data.reservedCredits || 0} sending · ${data.bookingEmailCredits || 0} remaining`;
      activity.replaceChildren();
      for (const item of data.activity || []) { const row = document.createElement("li"), date = new Date(item.at); row.textContent = `${item.description}${Number.isNaN(date.getTime()) ? "" : ` — ${date.toLocaleString()}`}`; activity.append(row); }
      if (!activity.children.length) activity.append(Object.assign(document.createElement("li"), { textContent: "No activity yet." }));
    } catch (error) { summary.textContent = error.message; }
  }
  form?.addEventListener("submit", async event => {
    event.preventDefault(); const count = Number(quantity.value);
    if (!Number.isInteger(count) || count < 1 || count > 500) { status.textContent = "Choose 1 to 500 credits."; return; }
    const button = form.querySelector("button"); button.disabled = true; status.textContent = "Opening secure Stripe Checkout…";
    try { const data = await request("/tour-manager/checkout", { method: "POST", body: JSON.stringify({ quantity: count }) }); location.assign(data.checkoutUrl); } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
  window.danzstakSendBookingEmail = async payload => { const id = crypto.randomUUID().replaceAll("-", ""); const data = await request("/tour-manager/emails/send", { method: "POST", body: JSON.stringify({ ...payload, idempotencyKey: id }) }); await refresh(); return data; };
  const result = new URLSearchParams(location.search).get("credits");
  if (result === "success") status.textContent = "Payment received. Credits appear after Stripe verifies the webhook.";
  if (result === "cancelled") status.textContent = "Checkout cancelled. No credits were added.";
  refresh();
})();
