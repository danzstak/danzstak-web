"use strict";

(() => {
  const cards = document.getElementById("selectedVenueCards");
  const status = document.getElementById("selectionStatus");
  const printButton = document.getElementById("printVenueSheet");
  const downloadButton = document.getElementById("downloadVenueCsv");
  const clearButton = document.getElementById("clearVenueSelections");
  const storageKey = "danzstakBookingVenueSelections";
  const stages = ["Not contacted", "Email prepared", "Email sent", "Reply received", "Interested", "Negotiating", "Date proposed", "Confirmed", "Declined", "No response"];
  const legacyStages = { Research: "Not contacted", "Ready to pitch": "Email prepared", Contacted: "Email sent", "In conversation": "Reply received", Hold: "Interested" };
  let venues = [];
  let revision = "";
  let accountLoaded = false;
  let dirty = false;
  const accountStatus = document.getElementById("bookingAccountStatus");
  const saveAccount = document.getElementById("saveBookingAccount");
  const loadAccount = document.getElementById("loadBookingAccount");
  const artistInputs = { name: "pitchArtist", genre: "pitchGenre", hometown: "pitchHometown", epk: "pitchEpk", pitch: "pitchSummary" };
  const tourInputs = { name: "tmName", currency: "tmCurrency", departOn: "tmDepartOn", returnBy: "tmReturnBy", distanceKm: "tmDistanceKm", vehicleType: "tmVehicleType", fuelLitersPer100Km: "tmFuelUse", fuelPricePerLiter: "tmFuelPrice", people: "tmPeople", mealPerPersonDay: "tmMeals", nights: "tmNights", rooms: "tmRooms", roomRate: "tmRoomRate", tolls: "tmTolls", parking: "tmParking", vehicleRental: "tmVehicleRental", equipment: "tmEquipment", crew: "tmCrew", miscellaneous: "tmMisc", contingencyPercent: "tmContingency", confirmedRevenue: "tmConfirmedRevenueInput", potentialRevenue: "tmPotentialRevenue" };
  const artist = () => Object.fromEntries(Object.entries(artistInputs).map(([key, id]) => [key, document.getElementById(id).value.trim()]));
  const tour = () => Object.fromEntries(Object.entries(tourInputs).map(([key, id]) => { const input = document.getElementById(id); return [key, input.type === "number" ? Number(input.value || 0) : input.value.trim()]; }));
  const bookingStatus = venue => legacyStages[venue.booking?.stage] || venue.booking?.status || venue.booking?.stage || "Not contacted";
  const identity = v => String(v.venueKey || `${v.name || ""}|${v.address || ""}`);
  let serverEstimate = null;
  async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error("DanzStak cannot connect right now. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
    }
  }
  const listingCheckedText = value => {
    const checked = new Date(value || "");
    return Number.isNaN(checked.getTime()) ? "" : `Public listing checked ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(checked)}`;
  };
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
    if (Array.isArray(parsed)) venues = parsed.slice(0, 100);
  } catch {}

  document.getElementById("usePublishedEpk")?.addEventListener("click", async () => {
    const button = document.getElementById("usePublishedEpk");
    button.disabled = true;
    accountStatus.textContent = "Finding your published EPK…";
    try {
      const response = await fetchWithTimeout("https://api.danzstak.com/epk", { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your EPK could not be loaded.");
      if (!data.published || !data.publicId) throw new Error("Publish your EPK before adding it to a booking inquiry.");
      document.getElementById("pitchEpk").value = new URL(`epk.html?id=${encodeURIComponent(data.publicId)}`, location.origin).href;
      dirty = true;
      accountStatus.textContent = "Published EPK added. Save the booking workspace to keep it.";
    } catch (error) {
      accountStatus.textContent = error.name === "AbortError" ? "Your EPK took too long to load. Try again." : error.message;
    } finally {
      button.disabled = false;
    }
  });

  const link = (label, href) => {
    const anchor = document.createElement("a");
    anchor.textContent = label;
    anchor.href = href;
    if (href.startsWith("https://")) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    return anchor;
  };

  function localEstimate() {
    const values = tour(), depart = Date.parse(`${values.departOn || ""}T12:00:00Z`), back = Date.parse(`${values.returnBy || ""}T12:00:00Z`);
    const durationDays = Number.isFinite(depart) && Number.isFinite(back) && back >= depart ? Math.floor((back - depart) / 86400000) + 1 : 1;
    const fuel = values.distanceKm / 100 * values.fuelLitersPer100Km * values.fuelPricePerLiter;
    const accommodation = values.nights * values.rooms * values.roomRate;
    const meals = Math.max(1, values.people) * durationDays * values.mealPerPersonDay;
    const transportation = fuel + values.tolls + values.parking + values.vehicleRental;
    const base = transportation + accommodation + meals + values.equipment + values.crew + values.miscellaneous;
    const bookingEmailsUsd = Number(window.danzstakTourManagerBilling?.credits?.sentEmails || 0) * 1.5, bookingEmails = String(values.currency || "USD").toUpperCase() === "USD" ? bookingEmailsUsd : 0;
    const fees = venues.filter(venue => String(venue.booking?.feeCurrency || "USD").toUpperCase() === String(values.currency || "USD").toUpperCase()).map(venue => ({ status: bookingStatus(venue), amount: Math.max(0, Number(venue.booking?.performanceFee) || 0) }));
    const confirmedRevenue = Math.max(values.confirmedRevenue, fees.filter(item => item.status === "Confirmed").reduce((sum, item) => sum + item.amount, 0));
    const potentialRevenue = Math.max(values.potentialRevenue, fees.filter(item => !["Declined", "No response"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0));
    const total = base + base * Math.min(100, values.contingencyPercent) / 100 + bookingEmails;
    return { total, confirmedRevenue, potentialRevenue, confirmedProfit: confirmedRevenue - total, potentialProfit: potentialRevenue - total, breakEvenRevenue: total, bookingEmailsUsd };
  }

  function renderDashboard() {
    const statuses = venues.map(bookingStatus), outreach = window.danzstakTourManagerBilling?.outreach || [];
    document.getElementById("tmSelected").textContent = String(venues.length);
    document.getElementById("tmSent").textContent = String(outreach.filter(item => item.status === "sent").length);
    document.getElementById("tmReplies").textContent = String(statuses.filter(value => ["Reply received", "Interested", "Negotiating", "Date proposed", "Confirmed", "Declined"].includes(value)).length);
    document.getElementById("tmConfirmed").textContent = String(statuses.filter(value => value === "Confirmed").length);
    document.getElementById("tmDeclined").textContent = String(statuses.filter(value => value === "Declined").length);
    const values = tour(), estimate = serverEstimate || localEstimate(), currency = /^[A-Z]{3}$/.test(values.currency.toUpperCase()) ? values.currency.toUpperCase() : "USD";
    let money; try { money = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }); } catch { money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }); }
    document.getElementById("tourManagerDates").textContent = values.departOn && values.returnBy ? `${values.name || "Tour"} · ${values.departOn} to ${values.returnBy}` : "Add dates and costs below.";
    document.getElementById("tmTotalCost").textContent = money.format(estimate.total || 0);
    document.getElementById("tmConfirmedRevenue").textContent = money.format(estimate.confirmedRevenue || 0);
    const result = document.getElementById("tmProjectedResult"), projected = Number(estimate.potentialProfit || 0);
    result.textContent = money.format(projected); result.classList.toggle("financial-loss", projected < 0); result.classList.toggle("financial-profit", projected >= 0);
    document.getElementById("tmBreakEven").textContent = money.format(estimate.breakEvenRevenue || 0);
    document.getElementById("tmBookingSpend").textContent = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(estimate.bookingEmailsUsd || 0);
    const calendar = document.getElementById("tourManagerCalendar"), dated = venues.filter(venue => venue.booking?.showDate).sort((a, b) => a.booking.showDate.localeCompare(b.booking.showDate));
    calendar.replaceChildren();
    if (!dated.length) calendar.append(Object.assign(document.createElement("li"), { textContent: "Add proposed dates to selected venues." }));
    dated.forEach((venue, index) => {
      if (index) {
        const previous = dated[index - 1], gap = Math.round((Date.parse(`${venue.booking.showDate}T12:00:00Z`) - Date.parse(`${previous.booking.showDate}T12:00:00Z`)) / 86400000);
        if (gap > 1) { const open = document.createElement("li"); open.className = "calendar-gap"; open.textContent = `${gap - 1} open night${gap === 2 ? "" : "s"} between ${previous.name} and ${venue.name}; search the route for replacement leads.`; calendar.append(open); }
      }
      const row = document.createElement("li"), state = bookingStatus(venue);
      row.textContent = `${venue.booking.showDate} · ${venue.name} · ${state}${venue.booking.performanceFee ? ` · ${venue.booking.feeCurrency || "USD"} ${Number(venue.booking.performanceFee).toFixed(2)}` : ""}`;
      if (state === "Confirmed") row.className = "calendar-confirmed";
      calendar.append(row);
    });
  }

  function updateControls() {
    const available = venues.length > 0;
    for (const button of [printButton, downloadButton, clearButton]) if (button) button.disabled = !available;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const due = venues.filter(v => v.booking?.followUp && v.booking.followUp <= today && !["Confirmed", "Declined"].includes(bookingStatus(v))).length;
    const confirmed = venues.filter(v => bookingStatus(v) === "Confirmed").length;
    status.textContent = `${venues.length} selected club${venues.length === 1 ? "" : "s"} · ${confirmed} confirmed · ${due} follow-ups due`;
    renderDashboard();
  }

  function persist() {
    dirty = true;
    serverEstimate = null;
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
    booking.status = bookingStatus(venue);
    delete booking.stage;
    for (const [key, title, type] of [
      ["status", "Booking status", "select"],
      ["showDate", "Proposed show date", "date"],
      ["followUp", "Follow up on", "date"],
      ["performanceFee", "Performance fee", "number"],
      ["feeCurrency", "Fee currency", "text"],
      ["deal", "Offer / agreed terms", "text"],
      ["replySummary", "Reply and proposed terms", "textarea"],
      ["confirmationEvidence", "Confirmation evidence", "textarea"],
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
      } else if (type !== "textarea") { input.type = type; if (type === "number") { input.min = "0"; input.step = "0.01"; } }
      if (type === "text" || type === "textarea") input.maxLength = 2000;
      input.value = String(booking[key] || (key === "status" ? "Not contacted" : key === "feeCurrency" ? "USD" : ""));
      input.addEventListener("change", () => {
        booking[key] = type === "number" ? Number(input.value || 0) : input.value;
        if (key === "status" && input.value === "Confirmed" && (!booking.showDate || !String(booking.confirmationEvidence || "").trim())) {
          window.danzstakShowFeedback?.("A confirmed show needs its date and written evidence from the promoter.", { urgent: true });
        }
        persist(); render();
      });
      label.append(input); fields.append(label);
    }
    const hint = document.createElement("small");
    hint.textContent = "Save after editing. Confirmed requires a date and written evidence of the promoter's agreement. Drafting or sending an email does not confirm a performance.";
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
    const venueKey = identity(venue);
    const hasDirectContact = (venue.emails || []).some(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (venue.phones || []).length > 0;
    const contactUnlocked = window.danzstakBookingContactUnlocked?.(venueKey) === true;
    if (typeof venue.imageUrl === "string" && /^https:\/\//.test(venue.imageUrl)) {
      const image = document.createElement("img");
      image.src = venue.imageUrl;
      image.alt = `${title.textContent} venue photo`;
      image.loading = "lazy";
      card.append(image);
    }
    for (const website of venue.websites || []) if (/^https:\/\//.test(website)) links.append(link("Website", website));
    if (contactUnlocked) {
      for (const email of venue.emails || []) if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) links.append(link("Email", `mailto:${email}`));
      for (const phone of venue.phones || []) links.append(link("Call", `tel:${String(phone).replace(/[^+0-9]/g, "")}`));
    } else if (hasDirectContact) {
      const unlock = document.createElement("button");
      unlock.type = "button";
      unlock.className = "unlock-contact";
      unlock.textContent = "Unlock booking contact · $0.75";
      unlock.addEventListener("click", async () => {
        if (dirty) { window.danzstakShowFeedback?.("Save your booking workspace before unlocking its contact.", { urgent: true }); return; }
        unlock.disabled = true;
        unlock.textContent = "Opening secure checkout…";
        try { await window.danzstakUnlockBookingContact(venueKey); }
        catch (error) { window.danzstakShowFeedback?.(error.message, { urgent: true }); unlock.disabled = false; unlock.textContent = "Unlock booking contact · $0.75"; }
      });
      links.append(unlock);
    }
    if (Array.isArray(venue.position) && venue.position.length === 2) links.append(link("Map", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.position[1]},${venue.position[0]}`)}`));
    for (const evidence of venueSources(venue)) {
      if (typeof evidence.url === "string" && /^https:\/\//.test(evidence.url)) {
        links.append(link(`Source: ${String(evidence.name)}`, evidence.url));
      } else {
        const source = document.createElement("span");
        source.className = "venue-source";
        source.textContent = `Source: ${String(evidence.name)}`;
        links.append(source);
      }
    }
    note.className = "venue-note";
    note.textContent = contactUnlocked ? "Booking contact unlocked. Verify the buyer and availability before outreach." : hasDirectContact ? "Direct email and phone are hidden until this venue contact is unlocked." : "No direct public booking contact is listed; use the official website to research submissions.";
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
    if (["Confirmed", "Declined"].includes(bookingStatus(venue))) {
      const closed = document.createElement("p");
      closed.textContent = bookingStatus(venue) === "Confirmed" ? "Confirmed with evidence. Keep the agreed fee, production terms, and promoter confirmation attached to this record." : "Lead closed. Change its status if you want to reopen outreach.";
      section.append(fit, closed);
      return section;
    }
    const label = document.createElement("label");
    label.textContent = "Review your booking pitch";
    const draft = document.createElement("textarea");
    draft.rows = 9;
    draft.maxLength = 5000;
    draft.setAttribute("aria-label", `Booking pitch for ${venue.name}`);
    const a = artist();
    const generatedDraft = `Hello ${venue.name} booking team,\n\nI'm reaching out about ${a.name || "[act name]"}${a.hometown ? ` from ${a.hometown}` : ""}${a.genre ? ` (${a.genre})` : ""}. We're interested in playing ${venue.name}${venue.booking?.showDate ? ` on ${venue.booking.showDate}` : " on [proposed date]"}.\n\n${a.pitch || "[Add a short introduction and relevant live experience.]"}\n${a.epk ? `\nEPK: ${a.epk}\n` : "\n[Add a public EPK or live performance link.]\n"}\nAre you accepting bookings for this date? Please share your submission requirements, available slots, and deal terms.\n\nThank you,\n${a.name || "[your name]"}`;
    draft.value = typeof venue.booking?.outreachDraft === "string" ? venue.booking.outreachDraft : generatedDraft;
    draft.addEventListener("input", () => {
      venue.booking.outreachDraft = draft.value;
      persist();
    });
    label.append(draft);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Send reviewed email · 1 credit";
    const contactUnlocked = window.danzstakBookingContactUnlocked?.(identity(venue)) === true;
    const email = contactUnlocked ? (venue.emails || []).find(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) : undefined;
    button.disabled = !email;
    button.addEventListener("click", async () => {
      if (!a.name || !venue.booking?.showDate || /\[[^\]]+\]/.test(draft.value)) {
        window.danzstakShowFeedback?.("Add your act name, proposed date, and replace draft placeholders before sending.", { urgent: true });
        return;
      }
      if (dirty) {
        window.danzstakShowFeedback?.("Save your booking workspace before sending so DanzStak can verify the venue contact.", { urgent: true });
        return;
      }
      button.disabled = true;
      button.textContent = "Sending…";
      try {
        await window.danzstakSendBookingEmail({ venueKey: identity(venue), to: email, subject: `${a.name} — booking enquiry for ${venue.booking.showDate}`, message: draft.value });
        venue.booking.status = "Email sent";
        persist();
        render();
        await saveWorkspaceSnapshot();
      } catch (error) {
        window.danzstakShowFeedback?.(error.message, { urgent: true });
        button.disabled = false;
        button.textContent = "Send reviewed email · 1 credit";
      }
    });
    const note = document.createElement("small");
    note.textContent = email ? "DanzStak reserves one credit, submits the reviewed message, and restores the credit if the email provider rejects it. Replies go to your account email." : (venue.emails || []).length ? "Unlock this venue's booking contact before sending an email." : "No public booking email listed. Use the venue website to find its submission form.";
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
    if (manual && dirty && !(await window.danzstakConfirm("Unsaved edits to existing venues and artist details will be replaced. Export CSV first to keep a copy.", { title: "Reload account records?", confirmLabel: "Reload records", danger: true }))) return;
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
      for (const [key, id] of Object.entries(tourInputs)) {
        const input = document.getElementById(id), value = data.tour?.[key];
        if (value !== undefined && value !== null && value !== "") input.value = String(value);
      }
      serverEstimate = data.estimate || null;
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

  async function saveWorkspaceSnapshot() {
    saveAccount.disabled = true;
    loadAccount.disabled = true;
    // Lock edits while a snapshot is saving so later changes cannot appear saved.
    const controls = [...document.querySelectorAll("main input, main select, main textarea, main button")];
    const enabled = controls.filter(c => !c.disabled);
    enabled.forEach(c => { c.disabled = true; });
    try {
      const data = await accountRequest("POST", { venues, artist: artist(), tour: tour(), revision });
      revision = data.revision;
      serverEstimate = data.estimate || null;
      try { sessionStorage.removeItem("danzstakBookingMapAdditions"); } catch {}
      dirty = false;
      accountStatus.textContent = "Saved privately to your account. Available on your other devices.";
    } catch (error) { accountStatus.textContent = error.message; }
    finally {
      enabled.forEach(c => { c.disabled = false; });
      saveAccount.disabled = false;
      loadAccount.disabled = false;
    }
  }
  saveAccount?.addEventListener("click", saveWorkspaceSnapshot);
  loadAccount?.addEventListener("click", () => loadWorkspace(true));
  for (const id of Object.values(artistInputs)) document.getElementById(id)?.addEventListener("change", () => { persist(); render(); });
  for (const id of Object.values(tourInputs)) document.getElementById(id)?.addEventListener("change", () => { serverEstimate = null; persist(); renderDashboard(); });
  window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  }

  function venueSources(venue) {
    if (Array.isArray(venue.sources) && venue.sources.length) return venue.sources.filter(source => source?.name);
    return venue.sourceName ? [{ name: venue.sourceName, url: venue.sourceUrl || "" }] : [];
  }

  function downloadCsv() {
    const rows = [["Venue", "Address", "Website", "Email", "Phone", "Categories", "Evidence", "Source name", "Source URL", "Listing checked", "Status", "Proposed show date", "Follow-up date", "Performance fee", "Fee currency", "Deal", "Reply summary", "Confirmation evidence", "Notes", "Outreach draft"]];
    for (const venue of venues) {
      const contactUnlocked = window.danzstakBookingContactUnlocked?.(identity(venue)) === true;
      rows.push([
      venue.name,
      venue.address,
      (venue.websites || []).join(" | "),
      contactUnlocked ? (venue.emails || []).join(" | ") : "Locked",
      contactUnlocked ? (venue.phones || []).join(" | ") : "Locked",
      (venue.categories || []).join(" | "),
      venue.activityEvidence,
      venueSources(venue).map(source => source.name).join(" | "),
      venueSources(venue).map(source => source.url).filter(url => /^https:\/\//.test(url)).join(" | "),
      listingCheckedText(venue.discoveredAt),
      bookingStatus(venue),
      venue.booking?.showDate,
      venue.booking?.followUp,
      venue.booking?.performanceFee,
      venue.booking?.feeCurrency,
      venue.booking?.deal,
      venue.booking?.replySummary,
      venue.booking?.confirmationEvidence,
      venue.booking?.notes,
      venue.booking?.outreachDraft
      ]);
    }
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
  clearButton?.addEventListener("click", async () => {
    if (!(await window.danzstakConfirm("This removes every selected club from this booking list.", { title: "Clear booking list?", confirmLabel: "Clear clubs", danger: true }))) return;
    venues = [];
    persist();
    render();
  });
  document.addEventListener("danzstak-contact-unlocks", render);
  document.addEventListener("danzstak-tour-manager-billing", renderDashboard);
  render();
  if (loadAccount) loadWorkspace();
})();
