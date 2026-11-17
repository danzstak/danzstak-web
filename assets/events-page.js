"use strict";
// Events page (task 14-D, owner 2026-11-17): not another HTML form.
// Fans: search, My tickets (offline), a short "Tonight & this weekend" list (max 5, no feed).
// Promoters: "Sell tickets to your night" opens a flyer-first creator with a live gig-poster preview,
// one question at a time, extras under "More options", ticket options as stubs, one orange Publish button.
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
      const ticketCopy = tickets.length ? `\nTickets from $${(Math.min(...tickets.map(t => t.priceCents)) / 100).toFixed(2)}\nhttps://danzstak.com/event.html?id=${eventData.event.id}` : draft.outsideUrl.trim() ? `\nTickets: ${draft.outsideUrl.trim()}` : "";
      const postResponse = await postActionFetch("/secure-posts", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `Event: ${draft.title.trim()}\n${dateText}\n${draft.venue.trim()}${ticketCopy}`, audience: draft.audience, mediaKey: media.mediaKey, mediaType: media.mediaType === "video" ? "video" : "image", originalContentCertified: true }) });
      const postData = await postResponse.json().catch(() => ({}));
      if (!postResponse.ok) throw new Error(postData.error || "Event could not be published");
      return { ok: true, eventId: eventData.event.id };
    } catch (error) {
      if (uploadedKey && typeof discardUploadedMedia === "function") await discardUploadedMedia(uploadedKey).catch(() => {});
      return { ok: false, message: error.message };
    }
  }

  // ---------- DOM ----------
  const videoSeconds = file => new Promise(resolve => { const probe = document.createElement("video"); probe.preload = "metadata"; const url = URL.createObjectURL(file); probe.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(probe.duration); }; probe.onerror = () => { URL.revokeObjectURL(url); resolve(NaN); }; probe.src = url; });
  const QUESTIONS = [
    { key: "title", label: "Name of the night", hint: "What's on the poster in big letters." },
    { key: "when", label: "Date and doors", hint: "When the doors open." },
    { key: "venue", label: "Venue", hint: "Where it happens. The address helps people find it." },
    { key: "price", label: "Ticket price", hint: "You keep all of it. Buyers pay the 6% fee on top." },
    { key: "lineup", label: "Who's playing?", hint: "One act per line. Optional." }
  ];

  function render(host, { isCurrent = () => true, postActionFetch = window.postActionFetch } = {}) {
    host.classList.add("ev-skin");
    const status = el("p", { className: "ev-status", role: "status" });
    status.setAttribute("aria-live", "polite");
    let events = [];

    // Fan side: search + My tickets + tonight.
    const searchInput = el("input", { type: "search", className: "ev-search-input", placeholder: "Night, artist, venue or city", autocomplete: "off" });
    searchInput.setAttribute("aria-label", "Search nights");
    const searchForm = el("form", { className: "ev-search", role: "search" }, searchInput);
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
    const openCreator = el("button", { type: "button", className: "ev-primary", textContent: "Make your poster" });
    const promo = el("section", { className: "ev-block ev-promo" }, el("p", { className: "ev-eyebrow", textContent: "For promoters" }), el("h2", { className: "ev-display", textContent: "Sell tickets to your night" }), perks, openCreator);
    const creatorHost = el("div", { className: "ev-creator-host", hidden: true });
    const yours = el("section", { className: "ev-block ev-yours", hidden: true });
    openCreator.addEventListener("click", () => { creatorHost.hidden = false; openCreator.hidden = true; if (!creatorHost.firstChild) creatorHost.append(creator()); creatorHost.querySelector(".ev-drop")?.focus(); });

    host.append(searchForm, results, myTickets, tonight, promo, creatorHost, yours, status);

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

    // ----- The flyer-first creator -----
    function creator() {
      const draft = newDraft();
      let step = 0;
      const ids = { event: crypto.randomUUID(), tiers: [crypto.randomUUID()] };

      // Live poster preview.
      const posterMedia = el("div", { className: "ev-poster-media" }, el("span", { className: "ev-poster-placeholder", textContent: "Your flyer here" }));
      const pTitle = el("h3", { className: "ev-poster-title" }), pWhen = el("p", { className: "ev-poster-when ev-value" }), pVenue = el("p", { className: "ev-poster-venue ev-value" }), pLineup = el("p", { className: "ev-poster-lineup ev-value" });
      const pStub = el("div", { className: "ev-poster-stub" });
      const poster = el("figure", { className: "ev-poster", "aria-label": "Poster preview" }, posterMedia, el("figcaption", {}, pTitle, pWhen, pVenue, pLineup, pStub));
      function refreshPoster() {
        pTitle.textContent = draft.title.trim() || "Name of the night";
        pTitle.classList.toggle("is-empty", !draft.title.trim());
        pWhen.textContent = draft.startsLocal ? when(new Date(draft.startsLocal).toISOString()) : "";
        pVenue.textContent = [draft.venue.trim(), draft.address.trim()].filter(Boolean).join(" · ");
        pLineup.textContent = draft.lineup.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 6).join(" · ");
        const cents = parsePrice(draft.price);
        pStub.replaceChildren();
        if (draft.sellTickets && cents >= 50) pStub.append(el("span", { textContent: "Tickets" }), " ", value(money(cents + buyerFees(cents))));
        else if (!draft.sellTickets) pStub.append(el("span", { textContent: draft.outsideUrl.trim() ? "Outside tickets" : "Free entry" }));
        refreshPreview();
      }

      // Big drop zone.
      const fileInput = el("input", { type: "file", className: "ev-file", accept: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" });
      fileInput.setAttribute("aria-label", "Choose a flyer image or a video of 15 seconds or less");
      const drop = el("label", { className: "ev-drop", tabIndex: 0 }, el("span", { className: "ev-drop-title", textContent: "Drop your flyer" }), el("span", { className: "ev-drop-hint", textContent: "Image, or a video of 15 seconds or less" }), fileInput);
      drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
      drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("is-over"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
      drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("is-over"); if (e.dataTransfer?.files?.[0]) takeFile(e.dataTransfer.files[0]); });
      fileInput.addEventListener("change", () => { if (fileInput.files?.[0]) takeFile(fileInput.files[0]); });
      async function takeFile(file) {
        const isVideo = file.type.startsWith("video/"), isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) { status.textContent = "Flyers are images or short videos."; return; }
        if (isVideo) {
          const seconds = await videoSeconds(file);
          if (!(seconds > 0 && seconds <= 15.5)) { fileInput.value = ""; status.textContent = Number.isFinite(seconds) ? "That video is longer than 15 seconds. Trim it and drop it again." : "That video could not be read. Try an MP4."; return; }
          draft.media = { file, type: "video", seconds: Math.min(15, Math.round(seconds * 10) / 10) };
        } else draft.media = { file, type: "image" };
        const url = URL.createObjectURL(file);
        posterMedia.replaceChildren(isVideo ? el("video", { src: url, muted: true, loop: true, autoplay: true, playsInline: true }) : el("img", { src: url, alt: "Your flyer" }));
        drop.classList.add("has-file");
        drop.querySelector(".ev-drop-title").textContent = "Change flyer";
        status.textContent = "";
        showStep(step);
      }

      // One question at a time.
      const field = (label, input) => el("label", { className: "ev-field" }, el("span", { className: "ev-label", textContent: label }), input);
      const titleIn = el("input", { type: "text", maxLength: 140, placeholder: "e.g. Basement Frequencies", autocomplete: "off" });
      const startsIn = el("input", { type: "datetime-local" });
      const venueIn = el("input", { type: "text", maxLength: 160, placeholder: "Club or space", autocomplete: "off" });
      const addressIn = el("input", { type: "text", maxLength: 300, placeholder: "Street, city (optional)", autocomplete: "off" });
      const priceIn = el("input", { type: "text", inputMode: "decimal", placeholder: "15.00", autocomplete: "off" });
      const freeIn = el("input", { type: "checkbox" });
      const payout = el("p", { className: "ev-payout" });
      const lineupIn = el("textarea", { rows: 4, maxLength: 3000, placeholder: "Headliner\nSupport\nDJ" });
      const panels = [
        [field("Name of the night", titleIn)],
        [field("Doors open", startsIn)],
        [field("Venue", venueIn), field("Address", addressIn)],
        [field("Price per ticket (USD)", priceIn), payout, el("label", { className: "ev-check" }, freeIn, el("span", { textContent: "Free entry, or tickets sold somewhere else" }))],
        [field("Lineup", lineupIn)]
      ].map((kids, i) => el("div", { className: "ev-step", hidden: true, role: "group" }, el("p", { className: "ev-step-count" }, value(`${i + 1}/${QUESTIONS.length}`)), el("h3", { className: "ev-question", textContent: QUESTIONS[i].label }), el("p", { className: "ev-hint", textContent: QUESTIONS[i].hint }), ...kids));
      const back = el("button", { type: "button", className: "ev-secondary", textContent: "Back" });
      const next = el("button", { type: "button", className: "ev-secondary ev-next", textContent: "Next" });
      const stepNav = el("div", { className: "ev-step-nav" }, back, next);

      function refreshPreview() {
        const cents = parsePrice(draft.price);
        payout.replaceChildren();
        if (draft.sellTickets && cents >= 50) payout.append(el("span", { textContent: "Buyer pays" }), " ", value(money(cents + buyerFees(cents))), " · ", el("span", { textContent: "You get" }), " ", value(money(cents)));
        priceIn.disabled = !draft.sellTickets;
        stubs.querySelectorAll(".ev-stub").forEach(s => s.dispatchEvent(new Event("refresh")));
      }
      const bind = (input, key, transform = v => v) => input.addEventListener("input", () => { draft[key] = transform(input.value); refreshPoster(); });
      bind(titleIn, "title"); bind(startsIn, "startsLocal"); bind(venueIn, "venue"); bind(addressIn, "address"); bind(priceIn, "price"); bind(lineupIn, "lineup");
      startsIn.addEventListener("change", () => { draft.startsLocal = startsIn.value; refreshPoster(); });
      freeIn.addEventListener("change", () => { draft.sellTickets = !freeIn.checked; stubsWrap.hidden = !draft.sellTickets; refreshPoster(); });

      // More options: ticket stubs (sections), named tickets, delivery, outside link, end time, audience.
      const stubs = el("div", { className: "ev-stubs" });
      function stub(index) {
        const section = draft.sections[index];
        const nameIn = el("input", { type: "text", maxLength: 80, value: section.name || "" });
        nameIn.setAttribute("aria-label", "Ticket name");
        const priceBox = el("input", { type: "text", inputMode: "decimal", placeholder: "15.00", value: index === 0 ? draft.price : section.price || "" });
        priceBox.setAttribute("aria-label", "Ticket price (USD)");
        const sizeIn = el("input", { type: "number", min: 1, max: 100000, step: 1, value: index === 0 ? draft.sectionSize : section.size || "50" });
        sizeIn.setAttribute("aria-label", "How many tickets");
        const node = el("div", { className: "ev-stub" },
          el("div", { className: "ev-stub-main" }, field("Ticket", nameIn), field("Price", priceBox), field("How many", sizeIn)),
          el("div", { className: "ev-stub-tear" }, el("span", { className: "ev-stub-admit", textContent: "Admit one" })));
        nameIn.addEventListener("input", () => { section.name = nameIn.value; });
        priceBox.addEventListener("input", () => { if (index === 0) { draft.price = priceBox.value; priceIn.value = priceBox.value; refreshPoster(); } else section.price = priceBox.value; });
        sizeIn.addEventListener("input", () => { if (index === 0) draft.sectionSize = sizeIn.value; else section.size = sizeIn.value; });
        node.addEventListener("refresh", () => { if (index === 0 && document.activeElement !== priceBox) priceBox.value = draft.price; });
        if (index > 0) {
          const remove = el("button", { type: "button", className: "ev-stub-remove", textContent: "Remove" });
          remove.addEventListener("click", () => { draft.sections.splice(index, 1); ids.tiers.splice(index, 1); drawStubs(); });
          node.querySelector(".ev-stub-tear").append(remove);
        }
        return node;
      }
      function drawStubs() { stubs.replaceChildren(...draft.sections.map((_, i) => stub(i))); }
      draft.sections = [{ name: "General admission" }];
      drawStubs();
      const addSection = el("button", { type: "button", className: "ev-secondary", textContent: "Add a ticket section" });
      addSection.addEventListener("click", () => { draft.sections.push({ name: "", price: "", size: "50" }); ids.tiers.push(crypto.randomUUID()); drawStubs(); stubs.lastChild?.querySelector("input")?.focus(); });
      const stubsWrap = el("div", { className: "ev-stubs-wrap" }, el("p", { className: "ev-label", textContent: "Tickets and seating sections" }), stubs, addSection);
      const namedIn = el("input", { type: "checkbox", checked: true });
      namedIn.addEventListener("change", () => { draft.namedTickets = namedIn.checked; });
      const outsideIn = el("input", { type: "url", placeholder: "https://", inputMode: "url" });
      outsideIn.addEventListener("input", () => { draft.outsideUrl = outsideIn.value === "https://" ? "" : outsideIn.value; refreshPoster(); });
      const endsIn = el("input", { type: "datetime-local" });
      endsIn.addEventListener("input", () => { draft.endsLocal = endsIn.value; });
      const audienceIn = el("select", {}, ...[["public", "Public"], ["friends", "Friends"], ["private", "Just me"]].map(([v, l]) => el("option", { value: v, textContent: l })));
      audienceIn.addEventListener("change", () => { draft.audience = audienceIn.value; });
      const more = el("details", { className: "ev-more" }, el("summary", { textContent: "More options" }),
        stubsWrap,
        el("label", { className: "ev-check" }, namedIn, el("span", { textContent: "Named tickets: each ticket carries the buyer's legal name and can't be resold. Untick if your door doesn't check names." })),
        el("div", { className: "ev-delivery" }, el("p", { className: "ev-label", textContent: "Ticket delivery" }), el("p", { textContent: "Every buyer gets an email with a QR code and a plain-text ticket code. You get a printable door list." })),
        field("Outside ticket link (optional)", outsideIn),
        field("Ends (optional)", endsIn),
        field("Who can see it", audienceIn));

      // Publish.
      const certIn = el("input", { type: "checkbox" });
      certIn.addEventListener("change", () => { draft.certified = certIn.checked; });
      const publishButton = el("button", { type: "button", className: "ev-primary ev-publish", textContent: "Publish event" });
      const finish = el("div", { className: "ev-finish", hidden: true }, el("label", { className: "ev-check" }, certIn, el("span", { textContent: "I made this event post and DanzStak may share it." })), publishButton);

      function showStep(i) {
        step = Math.max(0, Math.min(QUESTIONS.length - 1, i));
        panels.forEach((p, n) => { p.hidden = !draft.media || n !== step; });
        stepNav.hidden = !draft.media;
        back.disabled = step === 0;
        next.hidden = step === QUESTIONS.length - 1;
        finish.hidden = !draft.media || step !== QUESTIONS.length - 1;
        more.hidden = !draft.media;
      }
      back.addEventListener("click", () => showStep(step - 1));
      next.addEventListener("click", () => { showStep(step + 1); panels[step].querySelector("input,textarea")?.focus(); });
      for (const p of panels) p.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && step < QUESTIONS.length - 1) { e.preventDefault(); next.click(); } });

      publishButton.addEventListener("click", async () => {
        const check = validate(draft);
        if (!check.ok) {
          status.textContent = check.message;
          if (check.step === "flyer") drop.focus();
          else if (check.step === "more") { more.open = true; more.querySelector("summary").focus(); }
          else if (check.step === "publish") certIn.focus();
          else { showStep(check.step); panels[check.step].querySelector("input,textarea")?.focus(); }
          return;
        }
        publishButton.disabled = true;
        const result = await publish(draft, { postActionFetch, fetchWithDeadline: window.fetchWithDeadline, mediaUploadDeadline: window.mediaUploadDeadline, discardUploadedMedia: window.discardUploadedMedia, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", onStatus: text => { if (isCurrent()) status.textContent = text; } }, ids);
        publishButton.disabled = false;
        if (!isCurrent()) return;
        if (!result.ok) { status.textContent = result.message; return; }
        status.replaceChildren(el("span", { textContent: "Your night is live." }), " ", el("a", { href: `event.html?id=${encodeURIComponent(result.eventId)}`, textContent: "Open the event page" }));
        if (typeof window.loadPosts === "function") window.loadPosts().catch?.(() => {});
        creatorHost.replaceChildren(); creatorHost.hidden = true; openCreator.hidden = false;
      });

      refreshPoster();
      showStep(0);
      const steps = el("div", { className: "ev-steps" }, drop, ...panels, stepNav, more, finish);
      return el("section", { className: "ev-creator", "aria-label": "Sell tickets to your night" }, poster, steps);
    }
  }

  window.danzstakEvents = Object.freeze({ render, readTickets, saveTickets, search, tonightAndWeekend, newDraft, validate, publish, parsePrice, buyerFees });
})();
