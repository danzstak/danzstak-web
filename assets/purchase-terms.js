"use strict";
// Owner policy 2026-11-15: before every purchase the member must accept the refund terms;
// a refund is only for unused purchases and returns the price minus Stripe's processing fee.
(() => {
  const TERMS = {
    credits: {
      title: "Before you pay",
      points: [
        "Your booking emails are ready as soon as you pay.",
        "Once you send a booking email after this purchase, it can't be refunded.",
        "If you refund before using it, you get the price back minus Stripe's processing fee. You pay the fee, not DanzStak."
      ]
    },
    contact: {
      title: "Before you unlock",
      points: [
        "The booking contact is shown right after you pay.",
        "Once it's shown, the unlock can't be refunded."
      ]
    },
    network: {
      title: "Before you pay",
      points: [
        "Your DanzStak Network number is assigned as soon as you pay.",
        "Once you use it in SYNC, it can't be refunded.",
        "If you refund before using it, you get the price back minus Stripe's processing fee. You pay the fee, not DanzStak."
      ]
    }
  };
  const money = cents => `$${(Number(cents || 0) / 100).toFixed(2)}`;

  function ensureStyles() {
    if (document.getElementById("dsPurchaseTermsStyles") || document.querySelector('link[href*="purchase-terms.css"]')) return;
    const style = document.createElement("style");
    style.id = "dsPurchaseTermsStyles";
    style.textContent = `.ds-terms-dialog{max-width:min(440px,calc(100vw - 32px));border:1px solid #2b2b2e;border-radius:12px;padding:20px;background:#111113;color:#ededea;font:inherit}
.ds-terms-dialog::backdrop{background:rgba(0,0,0,.6)}
.ds-terms-dialog h2{margin:0 0 12px;font-size:1.15rem}
.ds-terms-dialog ul{margin:0 0 14px;padding-left:20px;line-height:1.45}
.ds-terms-dialog table{width:100%;border-collapse:collapse;margin:0 0 14px;color:inherit;font:inherit}
.ds-terms-dialog td{padding:6px 0;border-bottom:1px solid #2b2b2e}.ds-terms-dialog td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.ds-terms-dialog tr.total td{font-weight:700;border-bottom:0}
.ds-terms-dialog label{display:flex;gap:10px;align-items:flex-start;margin:0 0 16px;min-height:44px}
.ds-terms-dialog input[type=checkbox]{width:22px;height:22px;flex:none;accent-color:#ff5a1f}
.ds-terms-dialog .ds-terms-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.ds-terms-dialog button{min-height:44px;padding:0 16px;border-radius:8px;border:1px solid #3a3a3e;background:transparent;color:inherit;font:inherit;cursor:pointer}
.ds-terms-dialog button.ds-terms-ok{background:#ff5a1f;border-color:#ff5a1f;color:#0b0b0c;font-weight:700}
.ds-terms-dialog button:disabled{opacity:.45;cursor:not-allowed}
.ds-terms-dialog a{color:#ff8a5c}`;
    document.head.append(style);
  }

  function openDialog({ title, bodyNodes, checkboxText, okText }) {
    ensureStyles();
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "ds-terms-dialog";
      dialog.setAttribute("aria-labelledby", "dsTermsTitle");
      const heading = Object.assign(document.createElement("h2"), { id: "dsTermsTitle", textContent: title });
      const check = Object.assign(document.createElement("input"), { type: "checkbox" });
      const label = document.createElement("label");
      label.append(check, Object.assign(document.createElement("span"), { textContent: checkboxText }));
      const cancel = Object.assign(document.createElement("button"), { type: "button", textContent: "Cancel" });
      const ok = Object.assign(document.createElement("button"), { type: "button", className: "ds-terms-ok", textContent: okText, disabled: true });
      const actions = Object.assign(document.createElement("div"), { className: "ds-terms-actions" });
      actions.append(cancel, ok);
      dialog.append(heading, ...bodyNodes, label, actions);
      document.body.append(dialog);
      let accepted = false;
      check.addEventListener("change", () => { ok.disabled = !check.checked; });
      cancel.addEventListener("click", () => dialog.close());
      ok.addEventListener("click", () => { if (!check.checked) return; accepted = true; dialog.close(); });
      dialog.addEventListener("close", () => { dialog.remove(); resolve(accepted); });
      dialog.showModal();
      check.focus();
    });
  }

  window.danzstakConfirmPurchase = ({ kind = "credits", priceCents } = {}) => {
    const terms = TERMS[kind] || TERMS.credits;
    const list = document.createElement("ul");
    for (const point of terms.points) list.append(Object.assign(document.createElement("li"), { textContent: point }));
    const nodes = [list];
    if (Number(priceCents) > 0) {
      const fees = window.DanzStakFees;
      const { subtotalCents, feeCents, totalCents } = fees ? fees.withFees(priceCents) : { subtotalCents: Number(priceCents), feeCents: 0, totalCents: Number(priceCents) };
      const small = fees && subtotalCents < fees.SMALL_ORDER_LIMIT_CENTS;
      nodes.unshift(Object.assign(document.createElement("p"), { className: "purchase-total", textContent: `Price ${money(subtotalCents)} · DanzStak fee ${money(feeCents)} (6%${small ? " + $1 processing fee under $30" : ""}) · Total ${money(totalCents)} (USD)` }));
    }
    const termsLink = document.createElement("p");
    termsLink.innerHTML = 'Full rules: <a href="terms.html#refunds" target="_blank" rel="noopener">Terms of Service, Refunds</a>.';
    nodes.push(termsLink);
    return openDialog({ title: terms.title, bodyNodes: nodes, checkboxText: "I understand. Delivery starts now, I can't get a refund after I use it, and any refund is minus Stripe's fee.", okText: "Continue to payment" });
  };

  window.danzstakConfirmRefund = quote => {
    const table = document.createElement("table");
    const rows = [["You paid", money(quote.paidCents)], ["Stripe processing fee (not refunded)", `− ${money(quote.feeCents)}`], ["You get back", money(quote.refundCents)]];
    rows.forEach(([a, b], i) => { const tr = document.createElement("tr"); if (i === rows.length - 1) tr.className = "total"; tr.append(Object.assign(document.createElement("td"), { textContent: a }), Object.assign(document.createElement("td"), { textContent: b })); table.append(tr); });
    const note = Object.assign(document.createElement("p"), { textContent: `${quote.quantity} unused booking email credit${quote.quantity === 1 ? "" : "s"} will be removed. The money goes back to your card; your bank may take 5–10 days to show it.` });
    return openDialog({ title: "Refund this purchase?", bodyNodes: [table, note], checkboxText: `I accept a refund of ${money(quote.refundCents)}, not the full price.`, okText: `Accept ${money(quote.refundCents)} refund` });
  };
})();
