"use strict";
// Buying tickets, showing your tickets after checkout, and the organizer's door list. Sandbox until the owner approves live.
(() => {
  const API = "https://api.danzstak.com";
  const params = new URLSearchParams(location.search);
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const money = c => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(c / 100);

  function buyControls(card, event, tier) {
    if (tier.available < 1) { card.append(el("p", { className: "ticket-note", textContent: "Sold out." })); return; }
    const form = el("form", { className: "ticket-buy" });
    const qty = el("select", { "aria-label": `How many ${tier.name} tickets` });
    for (let i = 1; i <= Math.min(10, tier.available); i++) qty.append(el("option", { value: String(i), textContent: String(i) }));
    const names = el("div", { className: "ticket-names" });
    const drawNames = () => {
      if (!event.namedTickets) return;
      const want = Number(qty.value), have = names.children.length;
      for (let i = have; i < want; i++) names.append(el("label", { textContent: `Legal name, ticket ${i + 1}` }, el("input", { required: true, maxLength: 100, autocomplete: i === 0 ? "name" : "off" })));
      while (names.children.length > want) names.lastChild.remove();
    };
    qty.addEventListener("change", drawNames); drawNames();
    const total = el("p", { className: "ticket-total" });
    const sum = () => {
      const fees = window.DanzStakFees, subtotal = tier.priceCents * Number(qty.value);
      if (!fees) { total.textContent = `Tickets ${money(subtotal)} plus DanzStak's 6% fee`; return; }
      const { feeCents, totalCents } = fees.withFees(subtotal);
      total.textContent = `Total ${money(totalCents)} (incl. ${money(feeCents)} fees)` + (subtotal < fees.SMALL_ORDER_LIMIT_CENTS ? " · the $1 processing fee drops off at $30" : "");
    }; qty.addEventListener("change", sum); sum();
    const button = el("button", { type: "submit", className: "ticket-buy-button", textContent: "Buy tickets" });
    const note = el("p", { className: "ticket-note", role: "status" });
    form.append(el("label", { className: "ticket-qty", textContent: "Tickets" }, qty), names, total, button, note);
    form.addEventListener("submit", async e => {
      e.preventDefault(); button.disabled = true; button.textContent = "Opening checkout…"; note.textContent = "";
      try {
        const attendees = [...names.querySelectorAll("input")].map(i => i.value.trim());
        const response = await fetch(`${API}/marketplace/events/${event.id}/checkout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tierId: tier.id, quantity: Number(qty.value), attendees }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || "Checkout is unavailable right now.");
        location.assign(data.url);
      } catch (error) { note.textContent = error.message; button.disabled = false; button.textContent = "Buy tickets"; }
    });
    card.append(form);
  }

  async function showOrder(host) {
    const orderId = params.get("order");
    if (!/^[a-f0-9-]{36}$/i.test(orderId || "")) return;
    const box = el("section", { className: "ticket-order", "aria-live": "polite" }); host.before(box);
    if (params.get("cancelled")) { box.append(el("p", { textContent: "Checkout cancelled. You were not charged." })); return; }
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await fetch(`${API}/marketplace/orders/${orderId}`, { credentials: "include", cache: "no-store" }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => ({})) : {};
      const order = data.order;
      if (order?.tickets?.length) {
        box.replaceChildren(el("h2", { textContent: "Your tickets" }), el("p", { textContent: "Emailed to you with a QR code. At the door, show the QR or say the code." }));
        for (const t of order.tickets) box.append(el("div", { className: "ticket-stub" }, el("strong", { textContent: t.code }), el("span", { textContent: [t.name, t.tier].filter(Boolean).join(" · ") })));
        if (order.named) box.append(el("p", { className: "ticket-note", textContent: "Named tickets are non-transferable. Bring photo ID that matches the name." }));
        return;
      }
      box.replaceChildren(el("p", { textContent: "Payment received — issuing your tickets…" }));
      await new Promise(r => setTimeout(r, 1500));
    }
    box.replaceChildren(el("p", { textContent: "Your tickets are on the way to your email. If they don't arrive in a few minutes, contact the promoter." }));
  }

  async function doorList(host, event) {
    const box = el("section", { className: "door-list" }, el("h2", { textContent: "Door list" }));
    host.after(box);
    const response = await fetch(`${API}/marketplace/events/${event.id}/door`, { credentials: "include", cache: "no-store" }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => ({})) : null;
    if (!data) { box.append(el("p", { textContent: "Door list unavailable." })); return; }
    if (!data.tickets.length) { box.append(el("p", { textContent: "No tickets sold yet." })); return; }
    const search = el("input", { type: "search", placeholder: "Search name or code", "aria-label": "Search the door list" });
    const list = el("ul", { className: "door-rows" });
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      list.replaceChildren(...data.tickets.filter(t => !q || t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)).map(t => {
        const btn = el("button", { type: "button", textContent: t.status === "checked_in" ? "In ✓" : "Check in", disabled: t.status !== "valid" });
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          const r = await fetch(`${API}/marketplace/events/${event.id}/door/${t.code}`, { method: "POST", credentials: "include" }).catch(() => null);
          if (r?.ok) { t.status = "checked_in"; draw(); } else { btn.disabled = false; btn.textContent = "Try again"; }
        });
        return el("li", { className: `door-row is-${t.status}` }, el("span", { className: "door-code", textContent: t.code }), el("span", { className: "door-name", textContent: t.name || "—" }), btn);
      }));
    };
    search.addEventListener("input", draw); draw();
    const printBtn = el("button", { type: "button", className: "door-print", textContent: "Print door list" }); printBtn.addEventListener("click", () => print());
    box.append(el("p", { textContent: `${data.tickets.length} tickets · ${data.tickets.filter(t => t.status === "checked_in").length} in` }), search, list, printBtn);
  }

  window.addEventListener("danzstak:event-loaded", ({ detail: event }) => {
    const tiers = document.getElementById("ticketTiers");
    if (!tiers) return;
    showOrder(tiers);
    if (event.organizerId) {
      // The promoter sees payout status and the door list instead of buy buttons.
      const holder = el("div", { className: "event-payouts" }); tiers.before(holder);
      window.danzstakRenderPayouts?.(holder, "event");
      doorList(tiers, event);
      return;
    }
    if (!event.ticketSalesEnabled) return;
    for (const card of tiers.querySelectorAll(".ticket-tier")) {
      const tier = (event.tiers || []).find(t => t.id === card.dataset.tierId);
      if (tier) buyControls(card, event, tier);
    }
  });
})();
