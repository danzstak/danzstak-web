"use strict";

(() => {
  const API = "https://api.danzstak.com";
  const node = (tag, value = "", className = "") => {
    const element = document.createElement(tag);
    if (value) element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  async function get(path) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unavailable");
      return data;
    } finally { clearTimeout(timer); }
  }
  function action(label, href, primary = false) {
    const link = node("a", label, `artist-hq-action${primary ? " primary" : ""}`);
    link.href = href;
    return link;
  }
  function latestNeedsReply(messages, replies) {
    return messages.filter(message => {
      const thread = replies.filter(reply => reply.outreachId === message.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      return thread.length && thread.at(-1).direction === "inbound" && thread.at(-1).action !== "pass";
    });
  }
  function followUpsDue(workspace, outreach) {
    const venues = Array.isArray(workspace?.venues) ? workspace.venues : [];
    const messages = Array.isArray(outreach?.messages) ? outreach.messages : [];
    const replies = Array.isArray(outreach?.replies) ? outreach.replies : [];
    const today = new Date().toISOString().slice(0, 10);
    return venues.filter(venue => {
      const venueKey = String(venue?.venueKey || ""), booking = venue?.booking || {};
      if (!venueKey || !booking.followUp || booking.followUp > today || ["Confirmed", "Declined"].includes(booking.status)) return false;
      const initial = messages
        .filter(message => message.venueKey === venueKey && !message.followUpTo && ["provider_accepted", "sent", "delivered", "replied"].includes(message.status))
        .sort((a, b) => String(b.createdAt || b.sentAt || "").localeCompare(String(a.createdAt || a.sentAt || "")))[0];
      if (!initial) return false;
      if (messages.some(message => message.followUpTo === initial.id)) return false;
      return !replies.some(reply => reply.outreachId === initial.id && reply.direction === "inbound");
    });
  }
  function bookingInboxHref(outreachId = "") {
    const id = String(outreachId || "");
    return /^[a-zA-Z0-9_-]{16,100}$/.test(id) ? `messages.html?section=bookings&outreach=${encodeURIComponent(id)}` : "messages.html?section=bookings";
  }
  // Music HQ dashboard (fix-it 18, owner 2026-11-17): not a long column of "0" counters with a sentence each. One
  // primary action, then small tappable tiles in a 2-column grid (each opens its screen, label on one line), then Pivot.
  const tr = value => window.danzstakTranslate?.(value) || value;
  function tile(label, value, href, { name = "", hot = false } = {}) {
    const link = node("a", "", `artist-hq-tile${hot ? " is-hot" : ""}`);
    link.href = href;
    const metric = node("strong", String(value), "artist-hq-metric"), caption = node("span", tr(label), "artist-hq-label");
    link.append(metric, caption);
    link.setAttribute("aria-label", name || `${tr(label)}: ${value}`);
    return link;
  }
  function upcomingGigs(workspace) {
    const today = new Date().toISOString().slice(0, 10);
    const venues = Array.isArray(workspace?.venues) ? workspace.venues : [];
    return venues.filter(venue => {
      const booking = venue?.booking || {}, date = String(booking.showDate || booking.date || "");
      return /^confirmed$/i.test(String(booking.status || "")) && date >= today;
    }).length;
  }
  function pivotCard() {
    const card = node("section", "", "artist-hq-pivot");
    const copy = node("div", "", "artist-hq-pivot-copy");
    copy.append(node("strong", tr("Pivot off those platforms")), node("span", tr("Bring your posts, photos and people over. Export or delete any time.")));
    const go = node("button", tr("Pivot"), "artist-hq-action primary");
    go.type = "button"; go.setAttribute("data-pivot-trigger", "");
    card.append(copy, go);
    return card;
  }
  async function render(root, description, isCurrent = () => true) {
    root.classList.add("artist-hq-workspace");
    description.textContent = ""; // fix-it 18: no explanatory sub-line under the title
    const primary = node("div", "", "artist-hq-primary");
    const grid = node("div", "", "artist-hq-tiles");
    grid.setAttribute("aria-live", "polite");
    grid.append(tile("Next gigs", "…", "booking-selections.html#selectedVenueCards"), tile("Booking replies", "…", bookingInboxHref()), tile("EPK opens", "…", "epk.html"), tile("Email credits", "…", "booking-selections.html"));
    // Music HQ = EPK, Booking Agent, Record shops (+ Radio stations once that directory exists): one row of shortcuts.
    const tools = node("nav", "", "artist-hq-tools"); tools.setAttribute("aria-label", tr("Music HQ tools"));
    for (const [label, href] of [["EPK", "epk.html"], ["Booking Agent", "booking.html"], ["Record shops", "record-stores.html"]]) { const link = node("a", tr(label), "artist-hq-tool"); link.href = href; tools.append(link); }
    root.append(primary, grid, tools, pivotCard());
    const [epkResult, outreachResult, bookingResult, creditsResult] = await Promise.allSettled([get("/epk"), get("/tour-manager/outreach"), get("/booking-pipeline"), get("/tour-manager/credits")]);
    if (!isCurrent()) return;
    // One primary action: build the EPK, publish the draft, or send a pitch.
    const epk = epkResult.status === "fulfilled" ? epkResult.value : null, ready = Boolean(epk?.kit?.artistName), published = epk?.published === true;
    primary.replaceChildren(published ? action(tr("Send a pitch"), "booking.html", true) : action(tr(ready ? "Publish EPK" : "Build EPK"), "epk.html", true));
    grid.replaceChildren();
    const workspace = bookingResult.status === "fulfilled" ? bookingResult.value : null;
    grid.append(tile("Next gigs", workspace ? upcomingGigs(workspace) : "—", "booking-selections.html#selectedVenueCards"));
    if (outreachResult.status === "fulfilled") {
      const data = outreachResult.value, messages = Array.isArray(data.messages) ? data.messages : [], replies = Array.isArray(data.replies) ? data.replies : [], needs = latestNeedsReply(messages, replies);
      grid.append(tile("Booking replies", needs.length, needs.length === 1 ? bookingInboxHref(needs[0].id) : bookingInboxHref(), { hot: needs.length > 0, name: needs.length === 1 ? tr("Answer venue") : "" }));
    } else grid.append(tile("Booking replies", "—", bookingInboxHref()));
    const opened = workspace?.stats?.opened;
    grid.append(tile("EPK opens", typeof opened === "number" ? opened : "—", "epk.html"));
    if (creditsResult.status === "fulfilled") {
      const balance = Math.max(0, Number(creditsResult.value.bookingEmailCredits ?? creditsResult.value.balance ?? 0));
      grid.append(tile("Email credits", balance, "booking-selections.html"));
    } else grid.append(tile("Email credits", "—", "booking-selections.html"));
    // Follow-ups only take a tile when some are due (artist-approved; nothing sends until reviewed).
    if (outreachResult.status === "fulfilled" && workspace) {
      const due = followUpsDue(workspace, outreachResult.value), exactVenue = due.length === 1 ? String(due[0].venueKey || "") : "";
      if (due.length) grid.append(tile("Follow-ups due", due.length, exactVenue ? `booking-selections.html?focusVenue=${encodeURIComponent(exactVenue)}#selectedVenueCards` : "booking-selections.html#selectedVenueCards", { hot: true, name: due.length === 1 ? tr("Review follow-up") : "" }));
    }
  }
  window.danzstakArtistHq = { render };
})();
