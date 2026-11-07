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
  let outreachShares = [];
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

  const templateNames = { band: "Band tour pitch", dj: "DJ / electronic gig pitch", festival: "Festival pitch" };
  function pitchCopy(venue, template) {
    const a = artist(), booking = venue.booking || {}, start = booking.showDate || "[proposed date]", end = booking.dateEnd && booking.dateEnd !== start ? ` through ${booking.dateEnd}` : "";
    const format = template === "dj" ? "DJ / electronic set" : template === "festival" ? "festival performance" : "live performance";
    const details = [
      booking.setDetails ? `Format: ${booking.setDetails}` : "",
      Number(booking.expectedDraw) > 0 ? `Artist-entered expected draw: ${Number(booking.expectedDraw)} people` : "",
      booking.deal ? `Requested terms: ${booking.deal}` : ""
    ].filter(Boolean).join("\n");
    return `Hello ${venue.name || "venue"} booking team,\n\nI'm reaching out about ${a.name || "[act name]"}${a.hometown ? ` from ${a.hometown}` : ""}${a.genre ? ` (${a.genre})` : ""}. We'd like to discuss a ${format} at ${venue.name || "your venue"} on ${start}${end}.\n\n${a.pitch || "[Add a short introduction and relevant live experience.]"}${details ? `\n\n${details}` : ""}\n\nEPK: ${a.epk || "[Add a published EPK link.]"}\n\nAre you accepting bookings for this date? Please share your availability, submission requirements, and deal terms.\n\nThank you,\n${a.name || "[your name]"}`;
  }

  function reviewSend({ venue, to, subject, message }) {
    if (typeof HTMLDialogElement === "undefined") return window.danzstakConfirm(`Recipient: ${to}\nSubject: ${subject}\nCost: 1 booking-email credit\n\n${message}`, { title: `Review ${venue.name} email`, confirmLabel: "Approve and send" });
    return new Promise(resolve => {
      const opener = document.activeElement, dialog = document.createElement("dialog"), formNode = document.createElement("form"), title = document.createElement("h2"), meta = document.createElement("dl"), preview = document.createElement("pre"), approval = document.createElement("label"), check = document.createElement("input"), actions = document.createElement("div"), cancel = document.createElement("button"), confirm = document.createElement("button");
      dialog.className = "booking-send-review"; dialog.setAttribute("aria-labelledby", "bookingSendReviewTitle"); formNode.method = "dialog";
      title.id = "bookingSendReviewTitle"; title.textContent = `Review email to ${venue.name}`;
      for (const [term, value] of [["Recipient", to], ["Subject", subject], ["Cost", "1 booking-email credit"]]) { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = term; dd.textContent = value; meta.append(dt, dd); }
      preview.textContent = message; preview.tabIndex = 0; preview.setAttribute("aria-label", "Exact email message");
      approval.className = "booking-send-approval"; check.type = "checkbox"; approval.append(check, document.createTextNode(" I reviewed this exact recipient and message and approve sending it."));
      actions.className = "booking-send-actions"; cancel.type = "submit"; cancel.value = "cancel"; cancel.textContent = "Keep editing"; confirm.type = "submit"; confirm.value = "confirm"; confirm.textContent = "Approve and send · 1 credit"; confirm.className = "primary"; confirm.disabled = true; check.addEventListener("change", () => { confirm.disabled = !check.checked; });
      actions.append(cancel, confirm); formNode.append(title, meta, preview, approval, actions); dialog.append(formNode); document.body.append(dialog);
      let settled = false; const finish = approved => { if (settled) return; settled = true; dialog.remove(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); resolve(approved); };
      dialog.addEventListener("close", () => finish(dialog.returnValue === "confirm" && check.checked), { once:true }); dialog.addEventListener("cancel", event => { event.preventDefault(); dialog.close("cancel"); }); dialog.showModal(); cancel.focus();
    });
  }

  async function createVenueEpkShare(venue, outreachId, allowPdf) {
    const response = await fetchWithTimeout("https://api.danzstak.com/epk/outreach-share", { method:"POST", credentials:"include", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"create", venueKey:identity(venue), outreachId, allowPdf }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !/^https:\/\/danzstak\.com\/epk\.html\?outreach=[a-f0-9]{32}#token=[a-f0-9]{64}$/.test(String(data.shareUrl || ""))) throw new Error(data.error || "A private venue EPK link could not be created.");
    return data;
  }

  async function revokeVenueEpkShare(venue, outreachId) {
    await fetchWithTimeout("https://api.danzstak.com/epk/outreach-share", { method:"POST", credentials:"include", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"revoke", venueKey:identity(venue), outreachId }) }).catch(() => null);
  }

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
    venue.booking ||= {};
    const booking = venue.booking;
    const fit = document.createElement("p");
    const shareEvidence = document.createElement("p"), venueShares = outreachShares.filter(item => item.venueKey === identity(venue) && item.revoked !== true), openCount = venueShares.reduce((sum, item) => sum + Number(item.openCount || 0), 0), lastOpenedAt = venueShares.map(item => item.lastOpenedAt).filter(Boolean).sort().at(-1);
    shareEvidence.className = "epk-open-evidence";
    shareEvidence.textContent = openCount ? `Private EPK opened ${openCount} time${openCount === 1 ? "" : "s"}${lastOpenedAt ? ` · last opened ${new Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short" }).format(new Date(lastOpenedAt))}` : ""}. Counts only; DanzStak does not identify the viewer.` : "Private venue EPK not opened yet.";
    const genres = artist().genre.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    const categories = (venue.categories || []).map(s => String(s).toLowerCase());
    const matches = genres.filter(g => categories.some(c => c === g || c.split(/[^a-z0-9-]+/).includes(g)));
    fit.textContent = matches.length ? `Listed genre match: ${matches.join(", ")}. Check the current calendar for comparable acts.` : "Genre fit unverified. Review the venue's calendar before pitching.";
    if (["Confirmed", "Declined"].includes(bookingStatus(venue))) {
      const closed = document.createElement("p");
      closed.textContent = bookingStatus(venue) === "Confirmed" ? "Confirmed with evidence. Keep the agreed fee, production terms, and promoter confirmation attached to this record." : "Lead closed. Change its status if you want to reopen outreach.";
      section.append(fit, shareEvidence, closed);
      return section;
    }
    const builder = document.createElement("fieldset"), legend = document.createElement("legend"), templateLabel = document.createElement("label"), template = document.createElement("select"), rangeLabel = document.createElement("label"), dateEnd = document.createElement("input"), drawLabel = document.createElement("label"), draw = document.createElement("input"), setLabel = document.createElement("label"), setDetails = document.createElement("input"), downloadLabel = document.createElement("label"), allowPdf = document.createElement("input"), apply = document.createElement("button");
    builder.className = "pitch-builder"; legend.textContent = "1. Choose the pitch facts"; builder.append(legend); templateLabel.append(document.createTextNode("Pitch type"));
    for (const [value, name] of Object.entries(templateNames)) { const option = document.createElement("option"); option.value = value; option.textContent = name; template.append(option); }
    template.value = ["band", "dj", "festival"].includes(booking.pitchTemplate) ? booking.pitchTemplate : "band"; templateLabel.append(template);
    dateEnd.type = "date"; dateEnd.min = booking.showDate || ""; dateEnd.value = booking.dateEnd || ""; rangeLabel.append(document.createTextNode("End of date range (optional)"), dateEnd);
    draw.type = "number"; draw.min = "0"; draw.max = "100000"; draw.step = "1"; draw.value = booking.expectedDraw || ""; draw.placeholder = "Only if you know it"; drawLabel.append(document.createTextNode("Expected crowd — artist supplied (optional)"), draw);
    setDetails.maxLength = 300; setDetails.value = booking.setDetails || ""; setDetails.placeholder = "45-minute live set, 90-minute DJ set…"; setLabel.append(document.createTextNode("Set or performance details (optional)"), setDetails);
    allowPdf.type = "checkbox"; allowPdf.checked = booking.allowEpkPdfDownload === true; downloadLabel.className = "pitch-permission"; downloadLabel.append(allowPdf, document.createTextNode(" Allow this venue to print or save the EPK as PDF"));
    apply.type = "button"; apply.textContent = "Apply template to draft"; apply.className = "secondary";
    const savePitchFacts = () => { booking.pitchTemplate = template.value; booking.dateEnd = dateEnd.value; booking.expectedDraw = Number(draw.value || 0); booking.setDetails = setDetails.value; booking.allowEpkPdfDownload = allowPdf.checked; persist(); };
    for (const control of [template, dateEnd, draw, setDetails, allowPdf]) control.addEventListener("change", savePitchFacts);
    builder.append(templateLabel, rangeLabel, drawLabel, setLabel, downloadLabel, apply);
    const subjectLabel = document.createElement("label"), subject = document.createElement("input");
    subjectLabel.textContent = "2. Edit the subject"; subject.maxLength = 180; subject.value = booking.outreachSubject || `${artist().name || "Artist"} — booking enquiry${booking.showDate ? ` for ${booking.showDate}` : ""}`; subject.addEventListener("input", () => { booking.outreachSubject = subject.value; persist(); }); subjectLabel.append(subject);
    const label = document.createElement("label");
    label.textContent = "3. Edit the message";
    const draft = document.createElement("textarea");
    draft.rows = 9;
    draft.maxLength = 5000;
    draft.setAttribute("aria-label", `Booking pitch for ${venue.name}`);
    const a = artist();
    const generatedDraft = pitchCopy(venue, template.value);
    draft.value = typeof venue.booking?.outreachDraft === "string" ? venue.booking.outreachDraft : generatedDraft;
    draft.addEventListener("input", () => {
      venue.booking.outreachDraft = draft.value;
      persist();
    });
    label.append(draft);
    apply.addEventListener("click", async () => {
      const next = pitchCopy(venue, template.value);
      if (draft.value.trim() && draft.value !== generatedDraft && draft.value !== next && !(await window.danzstakConfirm("Applying the template replaces the current draft. Your saved venue and booking notes stay unchanged.", { title:"Replace this pitch draft?", confirmLabel:"Apply template" }))) return;
      savePitchFacts(); draft.value = next; booking.outreachDraft = next; subject.value = `${a.name || "Artist"} — ${template.value === "festival" ? "festival" : "booking"} enquiry${booking.showDate ? ` for ${booking.showDate}` : ""}`; booking.outreachSubject = subject.value; persist();
    });
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Preview exact email";
    const contactUnlocked = window.danzstakBookingContactUnlocked?.(identity(venue)) === true;
    const email = contactUnlocked ? (venue.emails || []).find(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) : undefined;
    button.disabled = !email;
    button.addEventListener("click", async () => {
      const currentArtist = artist(), currentSubject = subject.value.trim(), currentMessage = draft.value.trim();
      if (booking.dateEnd && booking.showDate && booking.dateEnd < booking.showDate) { window.danzstakShowFeedback?.("The end of the date range cannot be before the proposed show date.", { urgent:true }); return; }
      if (!currentArtist.name || !venue.booking?.showDate || /\[[^\]]+\]/.test(currentMessage)) {
        window.danzstakShowFeedback?.("Add your act name, proposed date, and replace draft placeholders before sending.", { urgent: true });
        return;
      }
      if (!currentArtist.epk || !currentMessage.includes(currentArtist.epk) || currentSubject.length < 3) { window.danzstakShowFeedback?.("Use your published EPK link in the message and add a clear subject before review.", { urgent:true }); return; }
      if (dirty) {
        window.danzstakShowFeedback?.("Save your booking workspace before sending so DanzStak can verify the venue contact.", { urgent: true });
        return;
      }
      button.disabled = true;
      button.textContent = "Creating private EPK link…";
      try {
        const outreachId = crypto.randomUUID().replaceAll("-", ""), share = await createVenueEpkShare(venue, outreachId, allowPdf.checked);
        const reviewedMessage = currentMessage.replaceAll(currentArtist.epk, share.shareUrl);
        if (!(await reviewSend({ venue, to:email, subject:currentSubject, message:reviewedMessage }))) { await revokeVenueEpkShare(venue, outreachId); button.disabled = false; button.textContent = "Preview exact email"; return; }
        button.textContent = "Sending…";
        await window.danzstakSendBookingEmail({ venueKey: identity(venue), to: email, subject: currentSubject, message: reviewedMessage, template:template.value, artistApproved:true, idempotencyKey:outreachId });
        venue.booking.status = "Email sent";
        persist();
        render();
        await saveWorkspaceSnapshot();
      } catch (error) {
        window.danzstakShowFeedback?.(error.message, { urgent: true });
        button.disabled = false;
        button.textContent = "Preview exact email";
      }
    });
    const note = document.createElement("small");
    note.textContent = email ? "Nothing sends until you review the exact recipient and message and tick approval. DanzStak then reserves one credit, submits the email, and restores the credit if the provider rejects it. Replies go to your account email." : (venue.emails || []).length ? "Unlock this venue's booking contact before sending an email." : "No public booking email listed. Use the venue website to find its submission form.";
    section.append(fit, shareEvidence, builder, subjectLabel, label, button, note);
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
      const shareResponse = await fetchWithTimeout("https://api.danzstak.com/epk/outreach-share", { credentials:"include", cache:"no-store" }).catch(() => null);
      if (shareResponse?.ok) outreachShares = (await shareResponse.json().catch(() => ({}))).shares || [];
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
