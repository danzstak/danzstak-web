"use strict";
// Public event page (task 14-D, owner 2026-11-17): the poster up top, a ticket stub to buy, the lineup and a venue map link.
// It keeps the event's own look; only the Events creator wears the DanzStak skin.
(() => {
  const id = new URLSearchParams(location.search).get("id") || "", status = document.getElementById("eventStatus"), details = document.getElementById("eventDetails"), tiers = document.getElementById("ticketTiers");
  const money = cents => new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
  // All-in price once the buyer-paid fee helper (assets/fees.js) is on the page; the bare price until then.
  const price = cents => window.DanzStakFees ? window.DanzStakFees.allIn(cents) : money(cents);
  const text = (tag, value, className = "") => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };

  function lineup(description) {
    return String(description || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 40);
  }
  function mapUrl(event) {
    const query = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
    return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : "";
  }

  async function load() {
    if (!/^[a-f0-9-]{36}$/i.test(id)) { status.textContent = "This event link is invalid."; return; }
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`https://api.danzstak.com/marketplace/events/${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Event not found.");
      const event = data.event;
      document.getElementById("eventTitle").textContent = event.title;
      document.title = `${event.title} | DanzStak`;
      const media = document.getElementById("eventMedia");
      if (media && event.mediaUrl) {
        const node = event.mediaType === "video"
          ? Object.assign(document.createElement("video"), { src: event.mediaUrl, muted: true, controls: true, playsInline: true, preload: "metadata" })
          : Object.assign(document.createElement("img"), { src: event.mediaUrl, alt: `Flyer for ${event.title}` });
        media.replaceChildren(node);
      } else media?.remove();
      document.getElementById("eventWhen").textContent = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: "full", timeStyle: "short", timeZone: event.timezone }).format(new Date(event.startsAt));
      document.getElementById("eventVenue").textContent = [event.venueName, event.venueAddress].filter(Boolean).join(" · ");
      const map = document.getElementById("eventMap"), url = mapUrl(event);
      if (map && url) { map.href = url; map.hidden = false; }
      const acts = lineup(event.description), lineupList = document.getElementById("eventLineup");
      if (acts.length && lineupList) { lineupList.replaceChildren(...acts.map(act => text("li", act))); document.getElementById("eventLineupSection").hidden = false; }

      tiers.replaceChildren();
      if (event.tiers?.length) tiers.append(text("p", event.namedTickets ? "Named tickets: each ticket carries the attendee's legal name and is non-transferable. Bring a matching photo ID." : "Tickets are transferable; names are not checked at the door.", "event-named-note"));
      if (event.ticketUrl) {
        let host = ""; try { host = new URL(event.ticketUrl).hostname.replace(/^www\./, ""); } catch {}
        if (host) tiers.append(Object.assign(document.createElement("a"), { href: event.ticketUrl, target: "_blank", rel: "noopener noreferrer", className: "event-outside-tickets", textContent: `Tickets on ${host} ↗` }), text("p", `Sold by ${host}, not DanzStak. Their terms and refunds apply.`, "event-outside-note"));
      }
      if (!event.ticketSalesEnabled || !event.tiers.length) { if (!event.ticketUrl) tiers.append(text("p", "Tickets are not offered through DanzStak for this event.")); }
      else for (const tier of event.tiers) {
        // Each ticket type is a ticket stub: name and price on the stub, a perforated "Admit one" tear-off.
        const card = text("article", "", "ticket-tier"), main = text("div", "", "ticket-tier-main");
        const priceLine = text("p", "", "ticket-price"); priceLine.append(text("strong", price(tier.priceCents)));
        const availability = text("p", "", "ticket-available"); availability.append(text("span", String(tier.available), "ticket-left"), " ", text("span", "left"));
        main.append(text("h3", tier.name), priceLine, availability);
        if (tier.description) main.append(text("p", tier.description));
        card.dataset.tierId = tier.id;
        const tear = text("span", "", "ticket-tier-tear"); tear.append(text("span", "Admit one"));
        card.append(main, tear);
        tiers.append(card);
      }
      status.textContent = "";
      status.hidden = true;
      details.hidden = false;
      window.dispatchEvent(new CustomEvent("danzstak:event-loaded", { detail: event }));
    } catch (error) {
      status.textContent = error.name === "AbortError" ? "Event details took too long to load. Try again." : (error instanceof TypeError || error.message === "Failed to fetch") ? "Event details are temporarily unavailable. Try again in a moment." : error.message;
    } finally { clearTimeout(timer); }
  }
  load();
})();
