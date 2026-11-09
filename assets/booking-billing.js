"use strict";
(() => {
  const api = "https://api.danzstak.com", balance = document.getElementById("bookingCreditBalance"), summary = document.getElementById("bookingCreditSummary"), status = document.getElementById("bookingCreditStatus"), activity = document.getElementById("bookingCreditActivity"), form = document.getElementById("buyBookingCredits"), quantity = document.getElementById("bookingCreditQuantity");
  const creditCheckoutKey = "danzstakBookingCreditCheckout";
  const unlockedContacts = new Set();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  window.danzstakTourManagerBilling = { credits: null, outreach: [], replies: [], refreshOutreach: null };
  async function request(path, options = {}) { const response = await fetch(api + path, { credentials: "include", cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.error || "Tour Manager billing is unavailable."); error.status = response.status; error.code = data.code || ""; throw error; } return data; }
  async function refresh() {
    try {
      const data = await request("/tour-manager/credits");
      balance.textContent = String(data.bookingEmailCredits || 0);
      summary.textContent = `${data.purchasedCredits || 0} purchased · ${data.sentEmails || 0} sent · ${data.reservedCredits || 0} sending · ${data.bookingEmailCredits || 0} remaining`;
      activity.replaceChildren();
      for (const item of data.activity || []) { const row = document.createElement("li"), date = new Date(item.at); row.textContent = `${item.description}${Number.isNaN(date.getTime()) ? "" : ` — ${date.toLocaleString()}`}`; activity.append(row); }
      if (!activity.children.length) activity.append(Object.assign(document.createElement("li"), { textContent: "No activity yet." }));
      window.danzstakTourManagerBilling.credits = data;
      document.dispatchEvent(new CustomEvent("danzstak-tour-manager-billing", { detail: window.danzstakTourManagerBilling }));
      document.dispatchEvent(new CustomEvent("danzstak-tour-manager-credits", { detail:data }));
      return data;
    } catch (error) { summary.textContent = error.message; return null; }
  }
  async function refreshOutreach() {
    try {
      const data = await request("/tour-manager/outreach");
      window.danzstakTourManagerBilling.outreach = Array.isArray(data.messages) ? data.messages : [];
      window.danzstakTourManagerBilling.replies = Array.isArray(data.replies) ? data.replies : [];
      document.dispatchEvent(new CustomEvent("danzstak-tour-manager-billing", { detail: window.danzstakTourManagerBilling }));
    } catch (error) { if (status && !status.textContent) status.textContent = error.message; }
  }
  window.danzstakTourManagerBilling.refreshOutreach = refreshOutreach;
  async function startCreditCheckout(count, venueKey = "", button = null) {
    if (!Number.isInteger(count) || count < 1 || count > 500) { status.textContent = "Choose 1 to 500 credits."; return false; }
    if (venueKey && (typeof venueKey !== "string" || venueKey.length > 240)) { status.textContent = "Choose a valid saved venue before buying this credit."; return false; }
    if (button) button.disabled = true;
    status.textContent = "Opening secure Stripe Checkout…";
    try {
      const data = await request("/tour-manager/checkout", { method: "POST", body: JSON.stringify({ quantity: count }) });
      if (!data.checkoutUrl?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe Checkout did not return a secure payment page.");
      try { sessionStorage.setItem(creditCheckoutKey, JSON.stringify({ quantity:count, startedAt:Date.now(), ...(venueKey ? { venueKey } : {}) })); } catch {}
      location.assign(data.checkoutUrl);
      return true;
    } catch (error) { status.textContent = error.message; if (button) button.disabled = false; return false; }
  }
  window.danzstakStartBookingCreditCheckout = ({ quantity:count = 1, venueKey = "", button = null } = {}) => startCreditCheckout(Number(count), String(venueKey || ""), button);
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    await startCreditCheckout(Number(quantity.value), "", form.querySelector("button"));
  });
  window.danzstakSendBookingEmail = async payload => { const id = payload.idempotencyKey || crypto.randomUUID().replaceAll("-", ""); const data = await request("/tour-manager/emails/send", { method: "POST", body: JSON.stringify({ ...payload, idempotencyKey: id }) }); await Promise.all([refresh(), refreshOutreach()]); return data; };
  window.danzstakBookingContactUnlocked = venueKey => unlockedContacts.has(String(venueKey || ""));
  window.danzstakUnlockBookingContact = async venueKey => {
    const data = await request("/tour-manager/contact-unlock/checkout", { method: "POST", body: JSON.stringify({ venueKey }) });
    if (data.unlocked) { unlockedContacts.add(String(venueKey)); document.dispatchEvent(new CustomEvent("danzstak-contact-unlocks")); return data; }
    if (!data.checkoutUrl?.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe Checkout did not return a secure payment page.");
    location.assign(data.checkoutUrl);
    return data;
  };
  async function refreshContactUnlocks() {
    try {
      const data = await request("/tour-manager/contact-unlocks");
      unlockedContacts.clear();
      for (const venueKey of data.venueKeys || []) unlockedContacts.add(String(venueKey));
      document.dispatchEvent(new CustomEvent("danzstak-contact-unlocks"));
      return true;
    } catch (error) { if (status && !status.textContent) status.textContent = error.message; return false; }
  }
  function clearContactResult() {
    const url = new URL(location.href);
    url.searchParams.delete("contact");
    url.searchParams.delete("venueKey");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  function focusVenueContact(venueKey, attempt = 0) {
    const card = [...document.querySelectorAll(".venue-card[data-venue-key]")].find(node => node.dataset.venueKey === venueKey);
    const target = card?.querySelector('a[href^="mailto:"],.unlock-contact');
    if (!card || !target) {
      if (attempt < 50) setTimeout(() => focusVenueContact(venueKey, attempt + 1), 100);
      return;
    }
    card.scrollIntoView({ block:"center", behavior:"smooth" });
    target.focus({ preventScroll:true });
  }
  async function finishContactReturn(contactResult, venueKey) {
    if (contactResult === "cancelled") {
      status.textContent = "Contact unlock cancelled. No charge was completed.";
      clearContactResult();
      focusVenueContact(venueKey);
      return;
    }
    if (contactResult !== "success" || !venueKey) return;
    status.textContent = "Payment received. Verifying this booking contact…";
    for (let attempt = 0; attempt < 10; attempt++) {
      if (attempt) await wait(1500);
      if ((await refreshContactUnlocks()) && unlockedContacts.has(venueKey)) {
        status.textContent = "Booking contact unlocked. You can now review the exact email.";
        clearContactResult();
        focusVenueContact(venueKey);
        return;
      }
    }
    status.textContent = "Payment was received, but Stripe is still verifying it. Keep this page open or reload it to check again; you will not be charged twice.";
  }
  function creditCheckoutMarker() {
    try {
      const marker = JSON.parse(sessionStorage.getItem(creditCheckoutKey) || "null");
      const quantity = Number(marker?.quantity), startedAt = Number(marker?.startedAt);
      const venueKey = typeof marker?.venueKey === "string" && marker.venueKey.length <= 240 ? marker.venueKey : "";
      if (Number.isInteger(quantity) && quantity > 0 && quantity <= 500 && Number.isFinite(startedAt)) return { quantity, startedAt, venueKey };
    } catch {}
    return null;
  }
  function clearCreditResult() {
    try { sessionStorage.removeItem(creditCheckoutKey); } catch {}
    const url = new URL(location.href);
    url.searchParams.delete("credits");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  function settledCreditPurchase(data, marker, returnedAt) {
    const earliest = marker ? marker.startedAt - 300000 : returnedAt - 1800000;
    return (data?.activity || []).find(item => {
      const at = Date.parse(item.at || ""), purchased = Number(item.credits);
      return item.type === "purchase" && item.status === "settled" && Number.isFinite(at) && at >= earliest
        && purchased > 0 && (!marker || purchased >= marker.quantity);
    }) || null;
  }
  async function finishCreditReturn(result) {
    if (result === "cancelled") {
      const marker = creditCheckoutMarker();
      status.textContent = "Checkout cancelled. No credits were added.";
      clearCreditResult();
      window.danzstakBookingCreditReturn = { status:"cancelled", venueKey:marker?.venueKey || "" };
      document.dispatchEvent(new CustomEvent("danzstak-booking-credit-return", { detail:window.danzstakBookingCreditReturn }));
      return;
    }
    if (result !== "success") return;
    const marker = creditCheckoutMarker(), returnedAt = Date.now();
    status.textContent = "Payment received. Verifying your booking-email credits…";
    for (let attempt = 0; attempt < 10; attempt++) {
      if (attempt) await wait(1500);
      const data = await refresh(), purchase = settledCreditPurchase(data, marker, returnedAt);
      if (purchase) {
        const purchased = Number(purchase.credits);
        status.textContent = `Credits verified. ${purchased} booking email credit${purchased === 1 ? " is" : "s are"} ready to send.`;
        clearCreditResult();
        window.danzstakBookingCreditReturn = { status:"verified", venueKey:marker?.venueKey || "", purchased };
        document.dispatchEvent(new CustomEvent("danzstak-booking-credit-return", { detail:window.danzstakBookingCreditReturn }));
        return;
      }
    }
    status.textContent = "Payment was received, but Stripe is still verifying the credits. Keep this page open or reload it to check again; you will not be charged twice.";
  }
  const params = new URLSearchParams(location.search), result = params.get("credits");
  const contactResult = params.get("contact"), returnedVenueKey = String(params.get("venueKey") || "").trim().slice(0, 200);
  if (result) finishCreditReturn(result);
  else refresh();
  refreshOutreach();
  if (contactResult) finishContactReturn(contactResult, returnedVenueKey);
  else refreshContactUnlocks();
})();
