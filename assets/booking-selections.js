"use strict";

(() => {
  const cards = document.getElementById("selectedVenueCards");
  const status = document.getElementById("selectionStatus");
  const printButton = document.getElementById("printVenueSheet");
  const downloadButton = document.getElementById("downloadVenueCsv");
  const clearButton = document.getElementById("clearVenueSelections");
  const storageKey = "danzstakBookingVenueSelections";
  const stages = ["Research", "Ready to pitch", "Contacted", "In conversation", "Hold", "Confirmed", "Declined"];
  let venues = [];
  let revision = "";
  let accountLoaded = false;
  let dirty = false;
  const accountStatus = document.getElementById("bookingAccountStatus");
  const saveAccount = document.getElementById("saveBookingAccount");
  const loadAccount = document.getElementById("loadBookingAccount");
  const artistInputs = { name: "pitchArtist", genre: "pitchGenre", hometown: "pitchHometown", epk: "pitchEpk", pitch: "pitchSummary" };
  const artist = () => Object.fromEntries(Object.entries(artistInputs).map(([key, id]) => [key, document.getElementById(id).value.trim()]));
  const identity = v => String(v.venueKey || `${v.name || ""}|${v.address || ""}`);
  const listingCheckedText = value => {
    const checked = new Date(value || "");
    return Number.isNaN(checked.getTime()) ? "" : `Public listing checked ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(checked)}`;
  };
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    if (Array.isArray(parsed)) venues = parsed.slice(0, 100);
  } catch {}

  const link = (label, href) => {
    const anchor = document.createElement("a");
    anchor.textContent = label;
    anchor.href = href;
    if (href.startsWith("https://")) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    return anchor;
  };

  function updateControls() {
    const available = venues.length > 0;
    for (const button of [printButton, downloadButton, clearButton]) if (button) button.disabled = !available;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const due = venues.filter(v => v.booking?.followUp && v.booking.followUp <= today && !["Confirmed", "Declined"].includes(v.booking.stage)).length;
    const confirmed = venues.filter(v => v.booking?.stage === "Confirmed").length;
    status.textContent = `${venues.length} selected club${venues.length === 1 ? "" : "s"} · ${confirmed} confirmed · ${due} follow-ups due`;
  }

  function persist() {
    dirty = true;
    if (accountStatus) accountStatus.textContent = "Unsaved changes. Save to your account to continue on another device.";
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(venues));
    } catch {
      status.textContent = "Changes could not be saved in this tab. Download CSV before leaving.";
      return;
    }
    updateControls();
  }

  function bookingFields(venue) {
    const fields = document.createElement("fieldset");
    fields.className = "booking-progress";
    const legend = document.createElement("legend");
    legend.textContent = "Move this booking forward";
    fields.append(legend);
    const booking = venue.booking && typeof venue.booking === "object" ? venue.booking : {};
    venue.booking = booking;
    for (const [key, title, type] of [
      ["stage", "Booking stage", "select"],
      ["showDate", "Proposed show date", "date"],
      ["followUp", "Follow up on", "date"],
      ["deal", "Offer / agreed deal", "text"],
      ["notes", "Buyer, fit, and next action", "textarea"]
    ]) {
      const label = document.createElement("label");
      label.append(document.createTextNode(title));
      const input = document.createElement(type === "select" ? "select" : type === "textarea" ? "textarea" : "input");
      input.setAttribute("aria-label", title);
      if (type === "select") {
        for (const stage of stages) {
          const option = document.createElement("option");
          option.value = stage; option.textContent = stage; input.append(option);
        }
      } else if (type !== "textarea") input.type = type;
      if (type === "text" || type === "textarea") input.maxLength = 2000;
      input.value = String(booking[key] || (key === "stage" ? "Research" : ""));
      input.addEventListener("change", () => { booking[key] = input.value; persist(); render(); });
      label.append(input); fields.append(label);
    }
    const hint = document.createElement("small");
    hint.textContent = "Save to your account after editing. Update stages after the buyer replies. Opening an email draft does not mark it sent.";
    fields.append(hint);
    return fields;
  }

  function showEmpty() {
    cards.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No clubs are selected yet. Return to the map, open a club pin, and add it to the booking list.";
    cards.append(empty);
    updateControls();
  }

  function render() {
    if (!venues.length) { showEmpty(); return; }
    cards.replaceChildren();
    updateControls();
    venues.forEach((venue, index) => {
    const card = document.createElement("article");
    const body = document.createElement("div");
    const title = document.createElement("h2");
    const address = document.createElement("p");
    const links = document.createElement("div");
    const evidence = document.createElement("p");
    const note = document.createElement("small");
    const remove = document.createElement("button");
    card.className = "venue-card";
    body.className = "venue-card-body";
    title.textContent = String(venue.name || "Live music venue");
    address.className = "venue-address";
    address.textContent = String(venue.address || "Address unavailable");
    evidence.className = "venue-evidence";
    evidence.textContent = [
      Array.isArray(venue.categories) ? venue.categories.slice(0, 4).join(" · ") : "",
      String(venue.activityEvidence || ""),
      listingCheckedText(venue.discoveredAt)
    ].filter(Boolean).join(" — ");
    links.className = "venue-links";
    if (typeof venue.imageUrl === "string" && /^https:\/\//.test(venue.imageUrl)) {
      const image = document.createElement("img");
      image.src = venue.imageUrl;
      image.alt = `${title.textContent} venue photo`;
      image.loading = "lazy";
      card.append(image);
    }
    for (const website of venue.websites || []) if (/^https:\/\//.test(website)) links.append(link("Website", website));
    for (const email of venue.emails || []) if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) links.append(link("Email", `mailto:${email}`));
    for (const phone of venue.phones || []) links.append(link("Call", `tel:${String(phone).replace(/[^+0-9]/g, "")}`));
    if (Array.isArray(venue.position) && venue.position.length === 2) links.append(link("Map", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.position[1]},${venue.position[0]}`)}`));
    if (typeof venue.sourceUrl === "string" && /^https:\/\//.test(venue.sourceUrl)) links.append(link(`Source: ${String(venue.sourceName || "public listing")}`, venue.sourceUrl));
    note.className = "venue-note";
    note.textContent = "Verify the booking contact and availability before outreach.";
    remove.type = "button";
    remove.className = "remove-venue secondary";
    remove.textContent = "Remove from list";
    remove.setAttribute("aria-label", `Remove ${title.textContent} from booking list`);
    remove.addEventListener("click", () => {
      venues.splice(index, 1);
      persist();
      render();
    });
    body.append(title, address, links, note);
    if (evidence.textContent) address.after(evidence);
    body.append(bookingFields(venue), outreach(venue), remove);
    card.append(body);
    cards.append(card);
    });
  }

  function outreach(venue) {
    const section = document.createElement("section");
    section.className = "outreach";
    const fit = document.createElement("p");
    const genres = artist().genre.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    const categories = (venue.categories || []).map(s => String(s).toLowerCase());
    const matches = genres.filter(g => categories.some(c => c === g || c.split(/[^a-z0-9-]+/).includes(g)));
    fit.textContent = matches.length ? `Listed genre match: ${matches.join(", ")}. Check the current calendar for comparable acts.` : "Genre fit unverified. Review the venue's calendar before pitching.";
    if (["Confirmed", "Declined"].includes(venue.booking?.stage)) {
      const closed = document.createElement("p");
      closed.textContent = venue.booking.stage === "Confirmed" ? "Booking confirmed by you. Keep agreed terms and production details in your notes." : "Lead closed. Change its stage if you want to reopen outreach.";
      section.append(fit, closed);
      return section;
    }
    const label = document.createElement("label");
    label.textContent = "Review your booking pitch";
    const draft = document.createElement("textarea");
    draft.rows = 9;
    draft.setAttribute("aria-label", `Booking pitch for ${venue.name}`);
    const a = artist();
    draft.value = `Hello ${venue.name} booking team,\n\nI'm reaching out about ${a.name || "[act name]"}${a.hometown ? ` from ${a.hometown}` : ""}${a.genre ? ` (${a.genre})` : ""}. We're interested in playing ${venue.name}${venue.booking?.showDate ? ` on ${venue.booking.showDate}` : " on [proposed date]"}.\n\n${a.pitch || "[Add a short introduction and relevant live experience.]"}\n${a.epk ? `\nEPK: ${a.epk}\n` : "\n[Add a public EPK or live performance link.]\n"}\nAre you accepting bookings for this date? Please share your submission requirements, available slots, and deal terms.\n\nThank you,\n${a.name || "[your name]"}`;
    label.append(draft);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Open reviewed draft in email";
    const email = (venue.emails || []).find(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    button.disabled = !email;
    button.addEventListener("click", () => {
      if (!a.name || !venue.booking?.showDate || /\[[^\]]+\]/.test(draft.value)) {
        window.alert("Add your act name, proposed date, and replace draft placeholders before opening email.");
        return;
      }
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${a.name} — booking enquiry for ${venue.booking.showDate}`)}&body=${encodeURIComponent(draft.value)}`;
    });
    const note = document.createElement("small");
    note.textContent = email ? "Public contact, not independently verified. Check official booking instructions. Draft edits last until this list refreshes. Your email app sends the message." : "No public booking email listed. Use the venue website to find its submission form.";
    section.append(fit, label, button, note);
    return section;
  }

  async function accountRequest(method, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
    const response = await fetch("https://api.danzstak.com/booking-pipeline", {
      method, credentials: "include", cache: "no-store", signal: controller.signal, headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401 ? "Sign in to save your private booking workspace." : data.error || "Account workspace unavailable. Your tab copy is still available; export CSV as a backup.");
    return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Booking service took too long. Reload the account workspace before retrying a save; a timed-out save may have completed.");
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function loadWorkspace(manual = false) {
    if (manual && dirty && !window.confirm("Reload account records? Unsaved edits to existing venues and artist details will be replaced. Export CSV first to keep a copy.")) return;
    saveAccount.disabled = true;
    loadAccount.disabled = true;
    const enabled = [...document.querySelectorAll("main input, main select, main textarea, main button")].filter(c => !c.disabled);
    enabled.forEach(c => { c.disabled = true; });
    try {
      const data = await accountRequest("GET");
      const saved = Array.isArray(data.venues) ? data.venues : [];
      const savedKeys = new Set(saved.map(identity));
      // A stale tab copy must not resurrect records deleted on another device.
      const additions = sessionStorage.getItem("danzstakBookingMapAdditions") === "true" ? venues.filter(v => !savedKeys.has(identity(v))) : [];
      const retainedAdditions = additions.slice(0, Math.max(0, 100 - saved.length));
      venues = [...saved, ...retainedAdditions];
      revision = data.revision || "";
      for (const [key, id] of Object.entries(artistInputs)) document.getElementById(id).value = data.artist?.[key] || "";
      try { sessionStorage.setItem(storageKey, JSON.stringify(venues)); } catch {}
      accountLoaded = true;
      dirty = retainedAdditions.length > 0;
      render();
      accountStatus.textContent = dirty ? "Account workspace loaded with new map selections. Save to keep the additions." : "Private account workspace loaded.";
      if (additions.length > retainedAdditions.length) accountStatus.textContent += ` Workspace limit: ${additions.length - retainedAdditions.length} new selections could not be added. Remove old leads and select them again on the map.`;
    } catch (error) {
      accountStatus.textContent = error.message;
    } finally {
      enabled.forEach(c => { c.disabled = false; });
      saveAccount.disabled = !accountLoaded;
      loadAccount.disabled = false;
    }
  }

  saveAccount?.addEventListener("click", async () => {
    saveAccount.disabled = true;
    loadAccount.disabled = true;
    // Lock edits while a snapshot is saving so later changes cannot appear saved.
    const controls = [...document.querySelectorAll("main input, main select, main textarea, main button")];
    const enabled = controls.filter(c => !c.disabled);
    enabled.forEach(c => { c.disabled = true; });
    try {
      const data = await accountRequest("POST", { venues, artist: artist(), revision });
      revision = data.revision;
      try { sessionStorage.removeItem("danzstakBookingMapAdditions"); } catch {}
      dirty = false;
      accountStatus.textContent = "Saved privately to your account. Available on your other devices.";
    } catch (error) { accountStatus.textContent = error.message; }
    finally {
      enabled.forEach(c => { c.disabled = false; });
      saveAccount.disabled = false;
      loadAccount.disabled = false;
    }
  });
  loadAccount?.addEventListener("click", () => loadWorkspace(true));
  for (const id of Object.values(artistInputs)) document.getElementById(id)?.addEventListener("change", () => { persist(); render(); });
  window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  }

  function downloadCsv() {
    const rows = [["Venue", "Address", "Website", "Email", "Phone", "Categories", "Evidence", "Source", "Stage", "Proposed show date", "Follow-up date", "Deal", "Notes"]];
    for (const venue of venues) rows.push([
      venue.name,
      venue.address,
      (venue.websites || []).join(" | "),
      (venue.emails || []).join(" | "),
      (venue.phones || []).join(" | "),
      (venue.categories || []).join(" | "),
      venue.activityEvidence,
      venue.sourceUrl || venue.sourceName,
      venue.booking?.stage || "Research",
      venue.booking?.showDate,
      venue.booking?.followUp,
      venue.booking?.deal,
      venue.booking?.notes
    ]);
    const blob = new Blob(["\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `danzstak-booking-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  printButton?.addEventListener("click", () => window.print());
  downloadButton?.addEventListener("click", downloadCsv);
  clearButton?.addEventListener("click", () => {
    if (!window.confirm("Clear every selected club from this booking list?")) return;
    venues = [];
    persist();
    render();
  });
  render();
  if (loadAccount) loadWorkspace();
})();
