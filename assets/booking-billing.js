"use strict";
(() => {
  const api = "https://api.danzstak.com", balance = document.getElementById("bookingCreditBalance"), summary = document.getElementById("bookingCreditSummary"), status = document.getElementById("bookingCreditStatus"), activity = document.getElementById("bookingCreditActivity"), form = document.getElementById("buyBookingCredits"), quantity = document.getElementById("bookingCreditQuantity"), checkoutTotal = document.getElementById("bookingCheckoutTotal"), sfsPanel = document.getElementById("sfsPaymentPanel"), sfsQuoteText = document.getElementById("sfsPaymentQuote"), sendSfsPayment = document.getElementById("sendSfsPayment");
  const unlockedContacts = new Set();
  let activeSfsQuote = null;
  window.danzstakTourManagerBilling = { credits: null, outreach: [] };
  async function request(path, options = {}) { const response = await fetch(api + path, { credentials: "include", cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Tour Manager billing is unavailable."); return data; }
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
    } catch (error) { summary.textContent = error.message; }
  }
  async function refreshOutreach() {
    try {
      const data = await request("/tour-manager/outreach");
      window.danzstakTourManagerBilling.outreach = Array.isArray(data.messages) ? data.messages : [];
      document.dispatchEvent(new CustomEvent("danzstak-tour-manager-billing", { detail: window.danzstakTourManagerBilling }));
    } catch (error) { if (status && !status.textContent) status.textContent = error.message; }
  }
  function paymentMethod() { return form?.querySelector('input[name="tourPaymentMethod"]:checked')?.value || "stripe"; }
  function updateCheckoutTotal() {
    const count = Number(quantity?.value || 0), total = Number.isInteger(count) && count > 0 ? count * 1.5 : 0;
    if (checkoutTotal) checkoutTotal.textContent = `Total: $${total.toFixed(2)}`;
    if (sfsPanel) sfsPanel.hidden = paymentMethod() !== "sfs";
    const continueButton = document.getElementById("buyBookingCreditsButton");
    if (continueButton) continueButton.textContent = paymentMethod() === "sfs" ? "Get verified SFS quote" : "Continue to Stripe";
    activeSfsQuote = null;
    if (sendSfsPayment) sendSfsPayment.disabled = true;
    if (sfsQuoteText && paymentMethod() === "sfs") sfsQuoteText.textContent = "Request a current verified SFS quote before opening your wallet.";
  }
  form?.addEventListener("change", updateCheckoutTotal);
  quantity?.addEventListener("input", updateCheckoutTotal);
  form?.addEventListener("submit", async event => {
    event.preventDefault(); const count = Number(quantity.value);
    if (!Number.isInteger(count) || count < 1 || count > 500) { status.textContent = "Choose 1 to 500 credits."; return; }
    const button = form.querySelector("button"); button.disabled = true;
    if (paymentMethod() === "stripe") {
      status.textContent = "Opening secure Stripe Checkout...";
      try { const data = await request("/tour-manager/checkout", { method: "POST", body: JSON.stringify({ quantity: count }) }); location.assign(data.checkoutUrl); } catch (error) { status.textContent = error.message; button.disabled = false; }
      return;
    }
    status.textContent = "Getting the current verified SFS exchange rate...";
    try {
      activeSfsQuote = await request("/tour-manager/sfs/quote", { method: "POST", body: JSON.stringify({ quantity: count }) });
      sfsQuoteText.textContent = `${activeSfsQuote.tokenAmount} SFS = $${(activeSfsQuote.totalUsdCents / 100).toFixed(2)} USD. Rate checked ${new Date(activeSfsQuote.rateObservedAt).toLocaleString()}. Quote expires ${new Date(activeSfsQuote.expiresAt).toLocaleTimeString()}.`;
      sendSfsPayment.disabled = false;
      status.textContent = "Review the exact SFS amount, then approve the transfer in your wallet.";
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  async function verifySfsPayment(transactionHash) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const result = await request("/tour-manager/sfs/verify", { method: "POST", body: JSON.stringify({ quoteId: activeSfsQuote.quoteId, transactionHash }) });
      if (result.status === "paid") return result;
      status.textContent = `Blockchain confirmation ${result.confirmations || 0} of ${result.requiredConfirmations || "required"}. Waiting...`;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    throw new Error("The transfer is still confirming. Return to this page and verify it again later.");
  }
  sendSfsPayment?.addEventListener("click", async () => {
    if (!activeSfsQuote || !window.ethereum?.request) { status.textContent = "Install or open a compatible EVM wallet to pay with SFS Tokens."; return; }
    sendSfsPayment.disabled = true;
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }), from = accounts?.[0];
      if (!from) throw new Error("The wallet did not provide an account.");
      const currentChain = String(await window.ethereum.request({ method: "eth_chainId" })).toLowerCase();
      if (currentChain !== activeSfsQuote.chainId) {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: activeSfsQuote.chainId }] });
      }
      status.textContent = "Approve the exact SFS Token transfer in your wallet.";
      const transactionHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from, to: activeSfsQuote.tokenContract, data: activeSfsQuote.transferData, value: "0x0" }] });
      if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash || "")) throw new Error("The wallet did not return a valid transaction hash.");
      status.textContent = "Transfer submitted. Waiting for verified blockchain confirmations...";
      const result = await verifySfsPayment(transactionHash);
      status.textContent = result.duplicate ? "This SFS transfer was already credited. No duplicate credits were added." : `${result.creditsIssued} booking email credits added after verified SFS payment.`;
      activeSfsQuote = null;
      await refresh();
    } catch (error) { status.textContent = error.message || "The SFS Token payment was not completed."; sendSfsPayment.disabled = !activeSfsQuote; }
  });
  window.danzstakSendBookingEmail = async payload => { const id = crypto.randomUUID().replaceAll("-", ""); const data = await request("/tour-manager/emails/send", { method: "POST", body: JSON.stringify({ ...payload, idempotencyKey: id }) }); await Promise.all([refresh(), refreshOutreach()]); return data; };
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
    } catch (error) { if (status && !status.textContent) status.textContent = error.message; }
  }
  const result = new URLSearchParams(location.search).get("credits");
  if (result === "success") status.textContent = "Payment received. Credits appear after Stripe verifies the webhook.";
  if (result === "cancelled") status.textContent = "Checkout cancelled. No credits were added.";
  const contactResult = new URLSearchParams(location.search).get("contact");
  if (contactResult === "success") status.textContent = "Payment received. The contact appears after Stripe verifies the payment.";
  if (contactResult === "cancelled") status.textContent = "Contact unlock cancelled. No charge was completed.";
  try { const selected = JSON.parse(sessionStorage.getItem("danzstakBookingVenueSelections") || "[]"); if (Array.isArray(selected) && selected.length) quantity.value = String(Math.min(500, selected.length)); } catch {}
  updateCheckoutTotal();
  refresh();
  refreshOutreach();
  refreshContactUnlocks();
})();
