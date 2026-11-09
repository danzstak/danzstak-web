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
  function card(title, value, detail, actions = []) {
    const item = node("section", "", "artist-hq-card"), heading = node("h3", title), metric = node("strong", String(value), "artist-hq-metric"), copy = node("p", detail);
    const controls = node("div", "", "artist-hq-actions");
    actions.forEach(control => controls.append(control));
    item.append(heading, metric, copy, controls);
    return item;
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
  async function render(root, description, isCurrent = () => true) {
    root.classList.add("artist-hq-workspace");
    description.textContent = "Your EPK and booking work in one place. Nothing is sent or confirmed without you.";
    const intro = node("section", "", "artist-hq-intro");
    intro.append(node("p", "ARTIST HQ", "artist-hq-kicker"), node("h2", "What needs you"), node("p", "Finish the EPK, answer venues, and move real date offers into the tour."));
    const grid = node("div", "", "artist-hq-grid");
    grid.setAttribute("aria-live", "polite");
    grid.append(card("EPK", "…", "Checking your press kit…"), card("Venue replies", "…", "Checking booking threads…"), card("Follow-ups", "…", "Checking reminders that need approval…"), card("Email credits", "…", "Checking your outreach balance…"));
    root.append(intro, grid);
    const [epkResult, outreachResult, bookingResult, creditsResult] = await Promise.allSettled([get("/epk"), get("/tour-manager/outreach"), get("/booking-pipeline"), get("/tour-manager/credits")]);
    if (!isCurrent()) return;
    grid.replaceChildren();
    if (epkResult.status === "fulfilled") {
      const data = epkResult.value, ready = Boolean(data.kit?.artistName), published = data.published === true;
      grid.append(card("EPK", published ? "Published" : ready ? "Draft" : "Start", published ? "Your public EPK is ready to send to venues." : ready ? "Your private draft is saved. Publish it when it is ready." : "Build a booker-ready EPK in about five minutes.", [action(ready ? "Edit EPK" : "Build EPK", "epk.html", true)]));
    } else grid.append(card("EPK", "Unavailable", "Your EPK was not changed. Try again when the connection returns.", [action("Open EPK", "epk.html")]));
    if (outreachResult.status === "fulfilled") {
      const data = outreachResult.value, messages = Array.isArray(data.messages) ? data.messages : [], replies = Array.isArray(data.replies) ? data.replies : [], needs = latestNeedsReply(messages, replies), offers = replies.filter(reply => reply.direction === "inbound" && reply.action === "offer_date").length;
      const replyHref = needs.length === 1 ? bookingInboxHref(needs[0].id) : bookingInboxHref();
      grid.append(card("Venue replies", needs.length, needs.length ? `${needs.length} booking thread${needs.length === 1 ? " needs" : "s need"} your answer. ${offers} date offer${offers === 1 ? "" : "s"} received.` : messages.length ? "No venue reply is waiting on you." : "Send a reviewed EPK pitch to start a booking thread.", [action(needs.length === 1 ? "Answer venue" : needs.length ? "Answer venues" : "Open bookings", replyHref, needs.length > 0), action("Tour Manager", "booking-selections.html#tourManagerTitle")]));
    } else grid.append(card("Venue replies", "Unavailable", "Your saved booking work is safe. Try again when the connection returns.", [action("Open SYNC", bookingInboxHref())]));
    if (outreachResult.status === "fulfilled" && bookingResult.status === "fulfilled") {
      const due = followUpsDue(bookingResult.value, outreachResult.value), exactVenue = due.length === 1 ? String(due[0].venueKey || "") : "";
      const href = exactVenue ? `booking-selections.html?focusVenue=${encodeURIComponent(exactVenue)}#selectedVenueCards` : "booking-selections.html#selectedVenueCards";
      grid.append(card("Follow-ups", due.length, due.length ? `${due.length} artist-approved reminder${due.length === 1 ? " is" : "s are"} due. Nothing sends until you review it.` : "No venue reminder needs your approval today.", [action(due.length === 1 ? "Review follow-up" : "Open outreach", href, due.length > 0)]));
    } else grid.append(card("Follow-ups", "Unavailable", "No reminder was sent. Open Tour Manager when the connection returns.", [action("Open outreach", "booking-selections.html#selectedVenueCards")]));
    if (creditsResult.status === "fulfilled") {
      const balance = Math.max(0, Number(creditsResult.value.bookingEmailCredits ?? creditsResult.value.balance ?? 0));
      grid.append(card("Email credits", balance, `${balance} artist-approved booking email${balance === 1 ? "" : "s"} available.`, [action("Review outreach", "booking-selections.html", true)]));
    } else grid.append(card("Email credits", "Unavailable", "No purchase was started. Open Tour Manager to check again.", [action("Open Tour Manager", "booking-selections.html")]));
  }
  window.danzstakArtistHq = { render };
})();
