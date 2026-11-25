"use strict";
// Events page (task 14-D, owner 2026-11-17): not another HTML form.
// Fans: search, My tickets (offline), a short "Tonight & this weekend" list (max 5, no feed).
// Promoters: + (or "Create event") opens Create event on the UI kit (CLAUDE.md F10): flyer first, one short form,
// Who can see it? and Tickets as sheets (ticket options as stubs), one green Create event button.
// Publishing uses the same API calls as before: upload the flyer, create the event, add ticket sections, post to Mix.
(() => {
  const API = "https://api.danzstak.com";
  const TICKETS_KEY = "danzstak_my_tickets_v1";
  const MAX_TONIGHT = 5, MAX_RESULTS = 8, MAX_SAVED_ORDERS = 30;

  // Buyer-paid fee (task 12): 6% + $1 on orders under $30. Uses the shared helper when it is loaded.
  const buyerFees = cents => window.DanzStakFees ? window.DanzStakFees.buyerFees(cents) : cents > 0 ? Math.round(cents * 6 / 100) + (cents < 3000 ? 100 : 0) : 0;
  const money = cents => `$${(Number(cents || 0) / 100).toFixed(2)}`;
  const parsePrice = value => { const m = String(value || "").trim().replace(/^\$/, "").match(/^(\d{1,5})(?:\.(\d{1,2}))?$/); return m ? Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0")) : null; };
  const locale = () => document.documentElement.lang || undefined;
  const when = (iso, timeZone) => { const d = new Date(iso); if (Number.isNaN(d.valueOf())) return ""; try { return new Intl.DateTimeFormat(locale(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(d); } catch { return d.toLocaleString(); } };
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(k => k !== null && k !== undefined && k !== false)); return n; };
  const value = text => el("span", { className: "ev-value", textContent: text }); // member data: never translated
  const longDate = local => { const d = new Date(local); if (!local || Number.isNaN(d.valueOf())) return ""; try { return new Intl.DateTimeFormat(locale(), { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d); } catch { return d.toLocaleString(); } };
  // Fix-it 18 (owner 2026-11-17): the composer is its own screen. Device Back closes it (the draft stays) instead of
  // re-rendering the Events page underneath. feed-enhancements' route restore asks this first.
  let closeCreatorScreen = null;
  // Back while a sheet (Who can see it? / Tickets) is open closes only the sheet; the screen and the Events page stay.
  function closeCreatorFromHistory() {
    if (!closeCreatorScreen) return false;
    window.danzstakSheet?.closeFromHistory?.();
    if (history.state?.danzstakEventCreator === true) return true;
    return closeCreatorScreen({ fromHistory: true });
  }

  // ---------- My tickets: saved on this device when the buyer opens their order, readable offline ----------
  function readTickets(now = Date.now()) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(TICKETS_KEY) || "[]"); } catch { list = []; }
    if (!Array.isArray(list)) return [];
    return list.filter(o => o && Array.isArray(o.tickets) && o.tickets.length && new Date(o.startsAt || 0).getTime() > now - 2 * 86400000).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  }
  function saveTickets(order) {
    if (!order || !/^[a-f0-9-]{36}$/i.test(order.orderId || "") || !Array.isArray(order.tickets) || !order.tickets.length) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(TICKETS_KEY) || "[]"); } catch {}
    if (!Array.isArray(list)) list = [];
    const clean = { orderId: order.orderId, eventId: String(order.eventId || ""), title: String(order.title || "").slice(0, 140), startsAt: String(order.startsAt || ""), timezone: String(order.timezone || ""), venue: String(order.venue || "").slice(0, 300), tickets: order.tickets.slice(0, 10).map(t => ({ code: String(t.code || "").slice(0, 9), name: String(t.name || "").slice(0, 100), tier: String(t.tier || "").slice(0, 80) })), savedAt: new Date().toISOString() };
    list = [clean, ...list.filter(o => o?.orderId !== clean.orderId)].slice(0, MAX_SAVED_ORDERS);
    try { localStorage.setItem(TICKETS_KEY, JSON.stringify(list)); } catch {}
  }

  // ---------- Finding a night ----------
  function matches(event, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const hay = [event.title, event.venueName, event.venueAddress, event.description].join(" ").toLowerCase();
    return q.split(/\s+/).every(word => hay.includes(word));
  }
  function search(events, query) { return String(query || "").trim() ? events.filter(e => matches(e, query)).slice(0, MAX_RESULTS) : []; }
  // Tonight and this weekend: from now to the end of the coming Sunday. If that is empty, the next few nights.
  function tonightAndWeekend(events, now = new Date()) {
    const end = new Date(now); const toSunday = (7 - end.getDay()) % 7; end.setDate(end.getDate() + toSunday); end.setHours(23, 59, 59, 999);
    const upcoming = events.filter(e => new Date(e.startsAt).getTime() >= now.getTime() - 3 * 3600000).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    const soon = upcoming.filter(e => new Date(e.startsAt) <= end);
    return { soon: soon.length > 0, list: (soon.length ? soon : upcoming).slice(0, MAX_TONIGHT) };
  }
  const cheapest = event => { const p = (event.tiers || []).map(t => Number(t.priceCents)).filter(c => c > 0); return p.length ? Math.min(...p) : 0; };

  function nightCard(event) {
    const card = el("a", { className: "ev-night", href: `event.html?id=${encodeURIComponent(event.id)}` });
    const thumb = el("span", { className: "ev-night-thumb" });
    if (event.mediaUrl && event.mediaType === "image") thumb.append(el("img", { src: event.mediaUrl, alt: "", loading: "lazy", decoding: "async" }));
    else thumb.append(el("span", { className: "ev-night-thumb-blank", textContent: (event.title || "?").slice(0, 1).toUpperCase() }));
    const price = cheapest(event);
    const tag = price ? el("span", { className: "ev-night-price" }, el("span", { textContent: "From" }), " ", value(money(price + buyerFees(price)))) : event.ticketUrl ? el("span", { className: "ev-night-price", textContent: "Outside tickets" }) : el("span", { className: "ev-night-price", textContent: "Free entry" });
    card.append(thumb, el("span", { className: "ev-night-copy" }, el("strong", { className: "ev-value", textContent: event.title }), el("span", { className: "ev-night-when ev-value", textContent: when(event.startsAt, event.timezone) }), el("span", { className: "ev-night-venue ev-value", textContent: event.venueName || "" }), tag));
    return card;
  }

  function ticketStubs(orders) {
    const wrap = el("div", { className: "ev-my-tickets" });
    for (const order of orders) for (const t of order.tickets) {
      wrap.append(el("a", { className: "ev-my-ticket", href: `event.html?id=${encodeURIComponent(order.eventId)}&order=${encodeURIComponent(order.orderId)}` },
        el("span", { className: "ev-my-ticket-code ev-value", textContent: t.code }),
        el("span", { className: "ev-my-ticket-copy" },
          el("strong", { className: "ev-value", textContent: order.title }),
          el("span", { className: "ev-value", textContent: [when(order.startsAt, order.timezone), order.venue].filter(Boolean).join(" · ") }),
          t.name ? el("span", { className: "ev-value", textContent: [t.name, t.tier].filter(Boolean).join(" · ") }) : el("span", { className: "ev-value", textContent: t.tier }))));
    }
    return wrap;
  }

  // ---------- Creator state, validation and publishing (no DOM: unit-tested) ----------
  function newDraft() {
    return { media: null, title: "", startsLocal: "", endsLocal: "", venue: "", address: "", sellTickets: true, price: "", lineup: "", sections: [], namedTickets: true, outsideUrl: "", audience: "public", sectionSize: "100", certified: false };
  }
  function ticketList(draft) {
    const first = { name: draft.sections[0]?.name || "General admission", price: draft.price, size: draft.sectionSize };
    return [first, ...draft.sections.slice(1)].map(s => ({ name: String(s.name || "").trim(), priceCents: parsePrice(s.price), size: Number(s.size) }));
  }
  // Returns { ok, step, message } where step is the question to send the promoter back to.
  function validate(draft) {
    if (!draft.media) return { ok: false, step: "flyer", message: "Drop your flyer first: an image, or a video of 15 seconds or less." };
    if (!draft.title.trim()) return { ok: false, step: 0, message: "Give your night a name." };
    if (!draft.startsLocal || Number.isNaN(new Date(draft.startsLocal).valueOf())) return { ok: false, step: 1, message: "Add the date and doors time." };
    if (draft.endsLocal && !(new Date(draft.endsLocal) > new Date(draft.startsLocal))) return { ok: false, step: "more", message: "The end time must be after doors." };
    if (!draft.venue.trim()) return { ok: false, step: 2, message: "Add the venue." };
    const outside = draft.outsideUrl.trim();
    if (outside) { let ok = false; try { const u = new URL(outside); ok = u.protocol === "https:" && !u.username && !u.password; } catch {} if (!ok) return { ok: false, step: "more", message: "Outside ticket links must start with https://" }; }
    if (draft.sellTickets) {
      if (draft.audience !== "public") return { ok: false, step: "more", message: "Ticketed nights must be Public so buyers can open the event page." };
      for (const [i, t] of ticketList(draft).entries()) {
        if (!t.name) return { ok: false, step: i ? "more" : 3, message: "Every ticket needs a name." };
        if (t.priceCents === null || t.priceCents < 50) return { ok: false, step: i ? "more" : 3, message: "Ticket prices start at $0.50." };
        if (!Number.isInteger(t.size) || t.size < 1 || t.size > 100000) return { ok: false, step: "more", message: "Each ticket section needs 1 to 100,000 tickets." };
      }
    }
    if (!draft.certified) return { ok: false, step: "publish", message: "Confirm that you made this event post before publishing." };
    return { ok: true };
  }

  async function publish(draft, deps, ids) {
    const { postActionFetch, fetchWithDeadline, mediaUploadDeadline, discardUploadedMedia, timezone = "UTC", onStatus = () => {} } = deps;
    const tickets = draft.sellTickets ? ticketList(draft) : [];
    const capacity = tickets.length ? tickets.reduce((sum, t) => sum + t.size, 0) : Math.max(1, Math.min(100000, Number(draft.sectionSize) || 100));
    let uploadedKey = "";
    try {
      onStatus("Uploading flyer…");
      const ticketResponse = await postActionFetch("/stories", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: draft.media.file.type, purpose: "post" }) }, 15000);
      const upload = await ticketResponse.json().catch(() => ({}));
      if (!ticketResponse.ok || !upload.uploadUrl) throw new Error(upload.error || "Flyer upload could not start.");
      const options = { method: "PUT", headers: { "Content-Type": draft.media.file.type }, body: draft.media.file };
      const put = typeof fetchWithDeadline === "function" ? await fetchWithDeadline(upload.uploadUrl, options, typeof mediaUploadDeadline === "function" ? mediaUploadDeadline(draft.media.file) : 120000) : await fetch(upload.uploadUrl, options);
      if (!put.ok) throw new Error("Flyer upload failed.");
      uploadedKey = upload.mediaKey;
      const media = { mediaKey: upload.mediaKey, mediaType: draft.media.type, ...(draft.media.type === "video" ? { mediaSeconds: draft.media.seconds } : {}) };
      onStatus("Publishing your night…");
      const startsAt = new Date(draft.startsLocal), endsAt = draft.endsLocal ? new Date(draft.endsLocal) : null;
      const eventResponse = await postActionFetch("/marketplace/events", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientEventId: ids.event, title: draft.title.trim(), description: draft.lineup.trim(), venueName: draft.venue.trim(), venueAddress: draft.address.trim(), startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() || "", timezone, capacity, status: draft.audience === "public" ? "published" : "draft", ticketSalesEnabled: draft.sellTickets, namedTickets: draft.namedTickets, ticketUrl: draft.outsideUrl.trim(), ...media }) });
      const eventData = await eventResponse.json().catch(() => ({}));
      if (!eventResponse.ok) throw new Error(eventData.error || "Event details could not be saved.");
      uploadedKey = "";
      for (const [i, t] of tickets.entries()) {
        const tierResponse = await postActionFetch(`/marketplace/events/${encodeURIComponent(eventData.event.id)}/tiers`, { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientTierId: ids.tiers[i], name: t.name, description: "", priceCents: t.priceCents, capacity: t.size, status: "on_sale" }) });
        const tierData = await tierResponse.json().catch(() => ({}));
        if (!tierResponse.ok) throw new Error(tierData.error || "Ticket offer could not be saved.");
      }
      const dateText = startsAt.toLocaleString(undefined, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
      const ticketCopy = tickets.length ? `\nTickets from ${money(Math.min(...tickets.map(t => t.priceCents)) + buyerFees(Math.min(...tickets.map(t => t.priceCents))))} incl. fees\nhttps://danzstak.com/event.html?id=${eventData.event.id}` : draft.outsideUrl.trim() ? `\nTickets: ${draft.outsideUrl.trim()}` : "";
      const postResponse = await postActionFetch("/secure-posts", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `Event: ${draft.title.trim()}\n${dateText}\n${draft.venue.trim()}${ticketCopy}`, audience: draft.audience, mediaKey: media.mediaKey, mediaType: media.mediaType === "video" ? "video" : "image", reel: media.mediaType === "video", originalContentCertified: true }) });
      const postData = await postResponse.json().catch(() => ({}));
      if (!postResponse.ok) throw new Error(postData.error || "Event could not be published");
      return { ok: true, eventId: eventData.event.id };
    } catch (error) {
      if (uploadedKey && typeof discardUploadedMedia === "function") await discardUploadedMedia(uploadedKey).catch(() => {});
      return { ok: false, message: error.message };
    }
  }

  // ---------- DOM ----------
  const icon = name => window.danzstakIcon ? window.danzstakIcon(name) : el("span");
  let fieldSerial = 0;
  // datetime-local value for the next full hour on this phone ("2026-11-25T21:00").
  const nextHourLocal = (now = new Date()) => { const d = new Date(now); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`; };
  const videoSeconds = file => new Promise(resolve => { const probe = document.createElement("video"); probe.preload = "metadata"; const url = URL.createObjectURL(file); probe.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(probe.duration); }; probe.onerror = () => { URL.revokeObjectURL(url); resolve(NaN); }; probe.src = url; });
  function render(host, { isCurrent = () => true, postActionFetch = window.postActionFetch } = {}) {
    host.classList.add("ev-skin");
    const status = el("p", { className: "ev-status", role: "status" });
    status.setAttribute("aria-live", "polite");
    let events = [];

    // Fan side: search + My tickets + tonight.
    const searchInput = el("input", { type: "search", className: "ev-search-input", placeholder: "Night, artist, venue or city", autocomplete: "off" });
    searchInput.setAttribute("aria-label", "Search nights");
    // + opens the composer screen (familiar "new" control next to search, accessible name kept).
    const addButton = el("button", { type: "button", className: "ev-add" });
    addButton.setAttribute("aria-label", "Post an event");
    addButton.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" fill="none"/></svg>';
    const searchForm = el("form", { className: "ev-search", role: "search" }, searchInput, addButton);
    const results = el("div", { className: "ev-results", hidden: true });
    searchForm.addEventListener("submit", e => { e.preventDefault(); showResults(); });
    searchInput.addEventListener("input", () => showResults());
    function showResults() {
      const query = searchInput.value;
      results.hidden = !query.trim();
      if (results.hidden) return;
      const found = search(events, query);
      results.replaceChildren(...(found.length ? found.map(nightCard) : [el("p", { className: "ev-muted", textContent: "No nights match. Try the venue or the city." })]));
    }
    const mine = readTickets();
    const myTickets = el("section", { className: "ev-block ev-mine" }, el("h2", { className: "ev-h2", textContent: "My tickets" }),
      mine.length ? ticketStubs(mine) : el("p", { className: "ev-muted", textContent: "Tickets you buy show up here with their door code, even offline." }));
    const tonightList = el("div", { className: "ev-nights" }, el("p", { className: "ev-muted", textContent: "Loading nights…" }));
    const tonightHeading = el("h2", { className: "ev-h2", textContent: "Tonight & this weekend" });
    const tonight = el("section", { className: "ev-block" }, tonightHeading, tonightList);

    // Promoter side: the pitch, then the creator.
    const perks = el("ul", { className: "ev-perks" },
      el("li", {}, el("strong", { textContent: "Keep the full ticket price." }), " ", el("span", { textContent: "Buyers pay the 6% fee (+$1 under $30)." })),
      el("li", {}, el("strong", { textContent: "QR + plain-text tickets." }), " ", el("span", { textContent: "Works at doors that can't scan." })),
      el("li", {}, el("strong", { textContent: "Door list." }), " ", el("span", { textContent: "Print it or check people in from your phone." })),
      el("li", {}, el("strong", { textContent: "Named tickets against scalpers." }), " ", el("span", { textContent: "Turn it off if your door doesn't check names." })),
      el("li", {}, el("strong", { textContent: "Your crowd sees it." }), " ", el("span", { textContent: "Your night goes in Mix and Events." })));
    const openCreator = el("button", { type: "button", className: "ev-primary", textContent: "Create event" });
    const promo = el("section", { className: "ev-block ev-promo" }, el("p", { className: "ev-eyebrow", textContent: "For promoters" }), el("h2", { className: "ev-display", textContent: "Sell tickets to your night" }), perks, openCreator);
    // Create event (UI kit screen 2, CLAUDE.md F10): its own full-screen screen on phones, a centred dialog on
    // computers, outside the Events page's dark skin. Closing keeps the draft; the phone's Back closes it.
    const yours = el("section", { className: "ev-block ev-yours", hidden: true });
    document.querySelectorAll("body > .ev-creator-screen").forEach(old => old.remove()); // a previous Events visit's screen
    const creatorHost = el("div", { className: "ev-creator-host" });
    const footHost = el("div", { className: "ev-creator-foot" });
    const closeButton = el("button", { type: "button", className: "ds-icon-btn ev-screen-close" }, icon("x"));
    closeButton.setAttribute("aria-label", "Close");
    const screenTitle = el("h2", { className: "ds-form-screen__title", id: "evCreatorTitle", textContent: "Create event" });
    const screenBody = el("div", { className: "ds-form-screen__body" }, creatorHost);
    const screen = el("div", { className: "ds ds-form-screen ev-creator-screen", role: "dialog", hidden: true },
      el("div", { className: "ds-form-screen__panel" }, el("header", { className: "ds-form-screen__bar" }, closeButton, screenTitle), screenBody, el("footer", { className: "ds-form-screen__foot" }, footHost)));
    screen.setAttribute("aria-modal", "true"); screen.setAttribute("aria-labelledby", "evCreatorTitle");
    let opener = null;
    function openScreen(from) {
      if (!creatorHost.firstChild) { const made = creator(); creatorHost.append(made.body); footHost.append(made.foot); }
      opener = from || null;
      if (!screen.isConnected) document.body.append(screen);
      screen.hidden = false; document.body.classList.add("ds-form-screen-open");
      if (history.state?.danzstakEventCreator !== true) history.pushState({ ...(history.state && typeof history.state === "object" ? history.state : {}), danzstakEventCreator: true }, "");
      closeCreatorScreen = closeScreen;
      requestAnimationFrame(() => (creatorHost.querySelector(".ev-title") || closeButton).focus({ preventScroll: true }));
    }
    function closeScreen({ fromHistory = false } = {}) {
      if (screen.hidden) return false;
      if (!fromHistory && history.state?.danzstakEventCreator === true) { history.back(); return true; } // popstate closes it
      screen.hidden = true; document.body.classList.remove("ds-form-screen-open");
      if (closeCreatorScreen === closeScreen) closeCreatorScreen = null;
      opener?.focus?.({ preventScroll: true });
      return true;
    }
    openCreator.addEventListener("click", () => openScreen(openCreator));
    addButton.addEventListener("click", () => openScreen(addButton));
    closeButton.addEventListener("click", () => closeScreen());
    screen.addEventListener("keydown", e => { if (e.key === "Escape" && !window.danzstakSheet?.isOpen()) { e.preventDefault(); closeScreen(); } });

    host.append(searchForm, results, myTickets, tonight, promo, yours, status);

    // Load upcoming nights (public) and the promoter's own nights (signed in).
    (async () => {
      try {
        const r = await fetch(`${API}/marketplace/events/upcoming`, { credentials: "include", cache: "no-store" });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Nights could not be loaded.");
        events = Array.isArray(data.events) ? data.events : [];
        if (!isCurrent()) return;
        const { soon, list } = tonightAndWeekend(events);
        tonightHeading.textContent = soon ? "Tonight & this weekend" : "Coming up";
        tonightList.replaceChildren(...(list.length ? [...list.map(nightCard), el("p", { className: "ev-end", textContent: "That's it for now." })] : [el("p", { className: "ev-muted", textContent: "Nothing on yet. Promoters: post the first night." })]));
        showResults();
      } catch (error) { if (isCurrent()) tonightList.replaceChildren(el("p", { className: "ev-muted", textContent: navigator.onLine === false ? "You're offline. Your tickets above still work." : error.message })); }
      try {
        const r = await fetch(`${API}/marketplace/events`, { credentials: "include", cache: "no-store" });
        const data = r.ok ? await r.json().catch(() => ({})) : {};
        const own = Array.isArray(data.events) ? data.events : [];
        if (!isCurrent()) return;
        renderYours(own);
      } catch { renderYours([]); }
    })();

    function renderYours(own) {
      yours.hidden = false;
      if (own.length) {
        yours.replaceChildren(el("h2", { className: "ev-h2", textContent: "Your nights" }), ...own.slice(0, 10).map(e => {
          const sold = (e.tiers || []).reduce((sum, t) => sum + Number(t.sold || 0), 0), size = (e.tiers || []).reduce((sum, t) => sum + Number(t.capacity || 0), 0);
          return el("a", { className: "ev-own", href: `event.html?id=${encodeURIComponent(e.id)}` }, el("strong", { className: "ev-value", textContent: e.title }), el("span", { className: "ev-value", textContent: when(e.startsAt, e.timezone) }),
            e.ticketSalesEnabled ? el("span", { className: "ev-own-sold" }, value(`${sold}/${size}`), " ", el("span", { textContent: "tickets sold" })) : el("span", { className: "ev-own-sold", textContent: e.status === "draft" ? "Draft" : "No DanzStak tickets" }));
        }));
      } else {
        const ideas = events.slice(0, 3);
        yours.replaceChildren(el("h2", { className: "ev-h2", textContent: "Nights other promoters are running" }), ...(ideas.length ? ideas.map(nightCard) : [el("p", { className: "ev-muted", textContent: "Be the first night on DanzStak in your town." })]));
      }
    }

    // ----- Create event: one short form on the UI kit (CLAUDE.md F10) -----
    // Flyer area at the top with Image / Video over it, the host row, floating-label fields, "Who can see it?" and
    // "Tickets" as tap-to-pick sheets, and one sticky green Create event button, disabled until the flyer, the name
    // and the start time are set. Publishing is unchanged (publish() above).
    function creator() {
      const draft = newDraft();
      draft.startsLocal = nextHourLocal();
      const ids = { event: crypto.randomUUID(), tiers: [crypto.randomUUID()] };
      const screenStatus = el("p", { className: "ds-form-screen__status ev-screen-status", role: "status" });
      screenStatus.setAttribute("aria-live", "polite");

      // Flyer: the picture fills the area; Image and Video sit over it (videos 15 seconds or less).
      const media = el("div", { className: "ds-media-pick__media" },
        el("div", { className: "ds-media-pick__empty" }, icon("image"), el("strong", { textContent: "Add a flyer" }), el("span", { textContent: "Image, or a video of 15 seconds or less" })));
      const pickButton = (label, iconName, accept) => {
        const input = el("input", { type: "file", className: "ev-file", accept });
        const button = el("label", { className: "ds-btn ds-btn--quiet ds-media-pick__btn" }, icon(iconName), el("span", { textContent: label }), input);
        input.addEventListener("change", () => { if (input.files?.[0]) takeFile(input.files[0]); input.value = ""; });
        return { button, input };
      };
      const imagePick = pickButton("Image", "image", "image/jpeg,image/png,image/webp,image/gif");
      const videoPick = pickButton("Video", "video", "video/mp4,video/webm,video/quicktime");
      const flyer = el("div", { className: "ds-media-pick ev-flyer" }, media, el("div", { className: "ds-media-pick__actions" }, imagePick.button, videoPick.button));
      flyer.addEventListener("dragover", e => { e.preventDefault(); flyer.classList.add("is-over"); });
      flyer.addEventListener("dragleave", () => flyer.classList.remove("is-over"));
      flyer.addEventListener("drop", e => { e.preventDefault(); flyer.classList.remove("is-over"); if (e.dataTransfer?.files?.[0]) takeFile(e.dataTransfer.files[0]); });
      async function takeFile(file) {
        const isVideo = file.type.startsWith("video/"), isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) { screenStatus.textContent = "Flyers are images or short videos."; return; }
        if (isVideo) {
          const seconds = await videoSeconds(file);
          if (!(seconds > 0 && seconds <= 15.5)) { screenStatus.textContent = Number.isFinite(seconds) ? "That video is longer than 15 seconds. Trim it and drop it again." : "That video could not be read. Try an MP4."; return; }
          draft.media = { file, type: "video", seconds: Math.min(15, Math.round(seconds * 10) / 10) };
        } else draft.media = { file, type: "image" };
        const url = URL.createObjectURL(file);
        media.replaceChildren(isVideo ? el("video", { src: url, muted: true, loop: true, autoplay: true, playsInline: true }) : el("img", { src: url, alt: "Your flyer" }));
        flyer.classList.add("has-file");
        screenStatus.textContent = "";
        refresh();
      }

      // Host: your own photo and name.
      const hostPhoto = el("span", { className: "ds-person__photo" });
      hostPhoto.setAttribute("aria-hidden", "true");
      const hostName = el("strong", { className: "ds-person__name ev-value" });
      const hostRow = el("div", { className: "ds-person ev-host" }, hostPhoto, el("span", {}, hostName, el("span", { className: "ds-person__sub", textContent: "Event host" })));
      fetch(`${API}/profiles`, { credentials: "include", cache: "no-store" }).then(r => r.ok ? r.json() : {}).then(data => {
        const p = data?.profile || {}, name = String(p.name || "").trim();
        hostName.textContent = name;
        hostPhoto.textContent = name.charAt(0).toUpperCase();
        if (p.picture) { const img = el("img", { src: p.picture, alt: "", referrerPolicy: "no-referrer", decoding: "async" }); img.onerror = () => img.remove(); img.onload = () => { if (img.naturalWidth) hostPhoto.replaceChildren(img); }; }
      }).catch(() => {});

      // Floating-label fields.
      const field = (label, input, note = "") => {
        const id = `evf${++fieldSerial}`;
        input.id = id; input.classList.add("ds-field__input"); input.placeholder = " ";
        const error = el("p", { className: "ds-field__error", id: `${id}e` });
        input.setAttribute("aria-describedby", error.id);
        input.addEventListener("input", () => { input.removeAttribute("aria-invalid"); error.textContent = ""; });
        const box = el("div", { className: "ds-field" }, input, el("label", { className: "ds-field__label", htmlFor: id, textContent: label }));
        if (note) box.append(note);
        box.append(error);
        return box;
      };
      const fieldError = (input, message) => { input.setAttribute("aria-invalid", "true"); const error = document.getElementById(input.getAttribute("aria-describedby")); if (error) error.textContent = message; input.focus(); };
      const titleIn = el("input", { type: "text", className: "ev-title", maxLength: 140, autocomplete: "off" });
      const startsIn = el("input", { type: "datetime-local", lang: locale() || "", value: draft.startsLocal });
      // The picker's own format follows the browser; the line under it reads the date in the member's language.
      const startsRead = el("p", { className: "ds-field__note ev-date-read ev-value" });
      startsRead.setAttribute("aria-live", "polite");
      const endsIn = el("input", { type: "datetime-local", lang: locale() || "" });
      const endField = field("Ends (optional)", endsIn);
      endField.hidden = true;
      const endChip = el("button", { type: "button", className: "ds-chip ev-end-chip" }, icon("plus"), el("span", { textContent: "End time" }));
      endChip.addEventListener("click", () => { endField.hidden = false; endChip.hidden = true; endsIn.focus(); });
      const zone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      const zoneChip = el("span", { className: "ds-chip ev-zone" }, el("span", { textContent: "Time zone" }), " ", value(zone.split("/").pop().replace(/_/g, " ")));
      zoneChip.title = zone;
      const venueIn = el("input", { type: "text", maxLength: 160, autocomplete: "off" });
      const addressIn = el("input", { type: "text", maxLength: 300, autocomplete: "off" });
      const lineupIn = el("textarea", { rows: 3, maxLength: 3000 });
      const bind = (input, key) => input.addEventListener("input", () => { draft[key] = input.value; refresh(); });
      bind(titleIn, "title"); bind(startsIn, "startsLocal"); bind(endsIn, "endsLocal"); bind(venueIn, "venue"); bind(addressIn, "address"); bind(lineupIn, "lineup");
      const readDate = () => { startsRead.textContent = longDate(startsIn.value); draft.startsLocal = startsIn.value; refresh(); };
      startsIn.addEventListener("input", readDate); startsIn.addEventListener("change", readDate);
      startsRead.textContent = longDate(startsIn.value);

      // "Who can see it?" sheet.
      const AUDIENCES = [["public", "Public", "Anyone on DanzStak"], ["friends", "Friends", "Your friends only"], ["private", "Just me", "Saved as a draft only you can see"]];
      const pickRow = (iconName, label) => { const v = el("span", { className: "ds-pick__value" }); return { row: el("button", { type: "button", className: "ds-pick" }, icon(iconName), el("span", { className: "ds-pick__label", textContent: label }), v, icon("chevron-right")), v }; };
      const audiencePick = pickRow("users", "Who can see it?");
      audiencePick.row.classList.add("ev-audience");
      const audienceError = el("p", { className: "ds-field__error" });
      audiencePick.row.addEventListener("click", () => {
        audienceError.textContent = "";
        const list = el("div", { className: "ev-audience-list" });
        list.setAttribute("role", "radiogroup");
        let sheet = null;
        for (const [key, label, sub] of AUDIENCES) {
          const choice = el("button", { type: "button", className: "ds-choice" }, icon(key === "public" ? "users" : key === "friends" ? "user-plus" : "lock"), el("span", { className: "ds-choice__text" }, el("strong", { textContent: label }), el("small", { textContent: sub })), el("span", { className: "ds-choice__check" }, icon("check")));
          choice.setAttribute("role", "radio"); choice.setAttribute("aria-checked", String(draft.audience === key));
          choice.addEventListener("click", () => { draft.audience = key; refresh(); sheet?.close(); });
          list.append(choice);
        }
        sheet = window.danzstakSheet.open({ title: "Who can see it?", content: list });
      });

      // "Tickets" sheet: sell on DanzStak (ticket stubs, named tickets, delivery) or link an outside service.
      const ticketsPick = pickRow("ticket", "Tickets");
      ticketsPick.row.classList.add("ev-tickets");
      const toggle = (checked = false) => { const input = el("input", { type: "checkbox", className: "ds-switch", checked }); input.setAttribute("role", "switch"); return input; };
      const sellIn = toggle(true), namedIn = toggle(true);
      const payout = el("p", { className: "ds-note ev-payout" });
      const stubs = el("div", { className: "ds-stack ev-stubs" });
      const outsideIn = el("input", { type: "url", inputMode: "url", autocomplete: "off" });
      const ticketsError = el("p", { className: "ds-field__error ev-tickets-error" });
      const switchRow = (input, text, small) => el("label", { className: "ds-switch-row" }, el("span", { className: "ds-switch-row__text" }, el("span", { textContent: text }), small ? el("small", { textContent: small }) : null), input);
      function stub(index) {
        const section = draft.sections[index];
        const nameIn = el("input", { type: "text", maxLength: 80, value: section.name || "" });
        const priceBox = el("input", { type: "text", inputMode: "decimal", value: index === 0 ? draft.price : section.price || "" });
        const sizeIn = el("input", { type: "number", min: 1, max: 100000, step: 1, inputMode: "numeric", value: index === 0 ? draft.sectionSize : section.size || "50" });
        const tear = el("div", { className: "ds-stub__tear" }, el("span", { className: "ds-stub__admit", textContent: "Admit one" }));
        const node = el("div", { className: "ds-stub ev-stub" }, el("div", { className: "ds-stub__main" }, field("Ticket", nameIn), field("Price", priceBox), field("How many", sizeIn)), tear);
        nameIn.addEventListener("input", () => { section.name = nameIn.value; });
        priceBox.addEventListener("input", () => { if (index === 0) draft.price = priceBox.value; else section.price = priceBox.value; refresh(); });
        sizeIn.addEventListener("input", () => { if (index === 0) draft.sectionSize = sizeIn.value; else section.size = sizeIn.value; });
        if (index > 0) {
          const remove = el("button", { type: "button", className: "ds-icon-btn ds-stub__remove" }, icon("trash-2"));
          remove.setAttribute("aria-label", "Remove");
          remove.addEventListener("click", () => { draft.sections.splice(index, 1); ids.tiers.splice(index, 1); drawStubs(); });
          tear.append(remove);
        }
        return node;
      }
      function drawStubs() { stubs.replaceChildren(...draft.sections.map((_, i) => stub(i))); }
      draft.sections = [{ name: "General admission" }];
      drawStubs();
      const addSection = el("button", { type: "button", className: "ds-btn ds-btn--quiet ev-add-section" }, icon("plus"), el("span", { textContent: "Add a ticket section" }));
      addSection.addEventListener("click", () => { draft.sections.push({ name: "", price: "", size: "50" }); ids.tiers.push(crypto.randomUUID()); drawStubs(); stubs.lastChild?.querySelector("input")?.focus(); });
      const selling = el("div", { className: "ds-stack ev-selling" }, stubs, payout, addSection,
        switchRow(namedIn, "Named tickets", "Each ticket carries the buyer's legal name and can't be resold. Turn it off if your door doesn't check names."),
        el("p", { className: "ds-note", textContent: "Every buyer gets an email with a QR code and a plain-text ticket code. You get a printable door list." }));
      const doneButton = el("button", { type: "button", className: "ds-btn ds-btn--go ds-btn--block" }, el("span", { textContent: "Done" }));
      const ticketsBody = el("div", { className: "ds-stack ev-tickets-sheet" }, ticketsError,
        switchRow(sellIn, "Sell tickets on DanzStak", "You keep the full ticket price. Buyers pay the 6% fee (+$1 under $30)."),
        selling, field("Outside ticket link (optional)", outsideIn), doneButton);
      sellIn.addEventListener("change", () => { draft.sellTickets = sellIn.checked; refresh(); });
      namedIn.addEventListener("change", () => { draft.namedTickets = namedIn.checked; });
      outsideIn.addEventListener("input", () => { draft.outsideUrl = outsideIn.value; refresh(); });
      let ticketsSheet = null;
      const openTickets = (message = "") => {
        ticketsError.textContent = message;
        ticketsSheet = window.danzstakSheet.open({ title: "Tickets", content: ticketsBody, onClose: () => { ticketsSheet = null; } });
      };
      ticketsPick.row.addEventListener("click", () => openTickets());
      doneButton.addEventListener("click", () => ticketsSheet?.close());

      // Made it yourself (required), then the one button.
      const certIn = toggle(false);
      certIn.addEventListener("change", () => { draft.certified = certIn.checked; certIn.removeAttribute("aria-invalid"); });
      const publishButton = el("button", { type: "button", className: "ds-btn ds-btn--go ds-btn--block ev-publish", disabled: true }, el("span", { textContent: "Create event" }));

      function refresh() {
        const cents = parsePrice(draft.price);
        payout.replaceChildren();
        if (cents >= 50) payout.append(el("span", { textContent: "Buyer pays" }), " ", value(money(cents + buyerFees(cents))), " · ", el("span", { textContent: "You get" }), " ", value(money(cents)));
        selling.hidden = !draft.sellTickets;
        ticketsPick.v.replaceChildren(draft.sellTickets
          ? (cents >= 50 ? el("span", {}, el("span", { textContent: "From" }), " ", value(money(cents + buyerFees(cents)))) : el("span", { textContent: "Set a price" }))
          : el("span", { textContent: draft.outsideUrl.trim() ? "Outside tickets" : "Free entry" }));
        audiencePick.v.replaceChildren(el("span", { textContent: AUDIENCES.find(a => a[0] === draft.audience)[1] }));
        publishButton.disabled = !(draft.media && draft.title.trim() && draft.startsLocal);
      }

      publishButton.addEventListener("click", async () => {
        const check = validate(draft);
        if (!check.ok) {
          screenStatus.textContent = check.message;
          if (check.step === "flyer") imagePick.input.focus();
          else if (check.step === 0) fieldError(titleIn, check.message);
          else if (check.step === 1) fieldError(startsIn, check.message);
          else if (check.step === 2) fieldError(venueIn, check.message);
          else if (check.step === "publish") { certIn.setAttribute("aria-invalid", "true"); certIn.focus(); }
          else if (/after doors/.test(check.message)) { endField.hidden = false; endChip.hidden = true; fieldError(endsIn, check.message); }
          else if (/Public/.test(check.message)) { audienceError.textContent = check.message; audiencePick.row.focus(); }
          else openTickets(check.message);
          return;
        }
        publishButton.disabled = true;
        const result = await publish(draft, { postActionFetch, fetchWithDeadline: window.fetchWithDeadline, mediaUploadDeadline: window.mediaUploadDeadline, discardUploadedMedia: window.discardUploadedMedia, timezone: zone, onStatus: text => { if (isCurrent()) screenStatus.textContent = text; } }, ids);
        publishButton.disabled = false;
        if (!isCurrent()) return;
        if (!result.ok) { screenStatus.textContent = result.message; return; }
        if (typeof window.loadPosts === "function") window.loadPosts().catch?.(() => {});
        // Close the screen (its Back entry is consumed first), then show the success line on the Events page.
        closeScreen(); creatorHost.replaceChildren(); footHost.replaceChildren();
        status.replaceChildren(el("span", { textContent: "Your night is live." }), " ", el("a", { href: `event.html?id=${encodeURIComponent(result.eventId)}`, textContent: "Open the event page" }));
      });

      refresh();
      const fields = el("div", { className: "ds-fields" },
        field("Event name", titleIn),
        field("Start date and time", startsIn, startsRead),
        el("div", { className: "ds-chips" }, endChip, zoneChip),
        endField,
        field("Venue", venueIn),
        field("Address (optional)", addressIn),
        el("div", {}, audiencePick.row, audienceError),
        ticketsPick.row,
        field("Lineup", lineupIn, el("p", { className: "ds-field__note", textContent: "One act per line. Optional." })),
        switchRow(certIn, "I made this event post and DanzStak may share it."));
      startsIn.closest(".ds-field").classList.add("ds-field--fixed");
      endsIn.closest(".ds-field").classList.add("ds-field--fixed");
      return { body: el("section", { className: "ev-creator", "aria-label": "Create event" }, flyer, hostRow, fields), foot: el("div", { className: "ev-creator-actions" }, screenStatus, publishButton) };
    }
  }

  window.danzstakEvents = Object.freeze({ render, closeCreatorFromHistory, longDate, readTickets, saveTickets, search, tonightAndWeekend, newDraft, validate, publish, parsePrice, buyerFees, nextHourLocal });
})();
