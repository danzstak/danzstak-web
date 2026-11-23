"use strict";

(() => {
  const unlockLabel = () => `Unlock booking contact · ${window.DanzStakFees ? window.DanzStakFees.allInShort(75) : "$0.75 + fees"}`;
  const cards = document.getElementById("selectedVenueCards");
  const status = document.getElementById("selectionStatus");
  const printButton = document.getElementById("printVenueSheet");
  const downloadButton = document.getElementById("downloadVenueCsv");
  const clearButton = document.getElementById("clearVenueSelections");
  const chooseVenuesNext = document.getElementById("chooseVenuesNext");
  const storageKey = "danzstakBookingVenueSelections";
  const pipeline = window.danzstakBookingPipeline;
  const stages = pipeline.BOOKING_STATUSES;
  const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
  let stageFilter = "all";
  // EPK gate from GET /booking-pipeline. null = unknown (older backend); the server still enforces it on send.
  let epkGate = null;
  let pitchStats = null;
  const epkBlocked = () => Boolean(epkGate && epkGate.ready === false);
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
  const epkHandoffRequested = new URLSearchParams(location.search).get("from") === "epk";
  const followUpFocusVenue = (() => {
    const url = new URL(location.href), value = String(url.searchParams.get("focusVenue") || "");
    if (url.searchParams.has("focusVenue")) {
      url.searchParams.delete("focusVenue");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return value.length <= 240 ? value : "";
  })();
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

  function clearEpkHandoffQuery() {
    const url = new URL(location.href);
    url.searchParams.delete("from");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function usePublishedEpk({ save = false, clearHandoff = false, auto = false } = {}) {
    const button = document.getElementById("usePublishedEpk");
    if (button) button.disabled = true;
    accountStatus.textContent = "Finding your published EPK…";
    try {
      const response = await fetchWithTimeout("https://api.danzstak.com/epk", { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your EPK could not be loaded.");
      if (!data.published || !data.publicId) throw new Error("Publish your EPK before adding it to a booking inquiry.");
      const kit = data.kit && typeof data.kit === "object" ? data.kit : {};
      const next = {
        name: String(kit.artistName || "").trim(),
        genre: Array.isArray(kit.genres) ? kit.genres.map(value => String(value).trim()).filter(Boolean).join(", ") : "",
        hometown: String(kit.hometown || "").trim(),
        epk: new URL(`epk.html?id=${encodeURIComponent(data.publicId)}`, location.origin).href,
        pitch: String(kit.shortPitch || kit.shortBio || "").trim()
      };
      const current = artist();
      // The published EPK is the source of truth (task 25); only a manual switch asks first.
      if (!auto && current.name && next.name && current.name.localeCompare(next.name, undefined, { sensitivity:"base" }) !== 0) {
        if (!window.danzstakConfirm) throw new Error("DanzStak could not open the act-switch review. Reload and try again.");
        const confirmReplace = await window.danzstakConfirm(`This workspace is for ${current.name}. Use the published EPK for ${next.name} and replace the act details? Saved venues and tour costs will stay.`, { title:"Switch the act for this pitch?", confirmLabel:"Use published EPK" });
        if (!confirmReplace) {
          accountStatus.textContent = "Booking workspace unchanged.";
          return false;
        }
      }
      for (const [key, value] of Object.entries(next)) {
        if (value) document.getElementById(artistInputs[key]).value = value;
      }
      const changed = Object.entries(next).some(([key, value]) => value && current[key] !== value);
      paintPitchingAs();
      if (auto && !changed && !clearHandoff) return true;
      dirty = true;
      persist();
      render();
      accountStatus.textContent = "Published EPK and act details added. Saving your private booking workspace…";
      if (save && accountLoaded) {
        await saveWorkspaceSnapshot();
        if (!dirty) accountStatus.textContent = "Published EPK and act details saved. Choose venues and review each pitch before sending.";
      } else {
        accountStatus.textContent = "Published EPK and act details added. Sign in and save the booking workspace to keep them.";
      }
      if (clearHandoff) clearEpkHandoffQuery();
      return true;
    } catch (error) {
      accountStatus.textContent = error.name === "AbortError" ? "Your EPK took too long to load. Try again." : error.message;
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  // "Pitching as Erotica · techno · San Francisco · View EPK · Edit in the EPK builder"
  function paintPitchingAs() {
    const line = document.getElementById("pitchingAs");
    if (!line) return;
    const a = artist();
    if (!a.name) { line.textContent = "Pitches are built from your published EPK."; return; }
    const who = document.createElement("strong"); who.textContent = a.name; who.setAttribute("data-no-translate", "");
    const facts = [a.genre, a.hometown].filter(Boolean).join(" · ");
    const parts = [document.createTextNode("Pitching as "), who];
    if (facts) parts.push(document.createTextNode(` · ${facts}`));
    if (/^https:\/\//.test(a.epk) || a.epk.startsWith(location.origin)) {
      const view = document.createElement("a"); view.href = a.epk; view.textContent = "View EPK"; view.target = "_blank"; view.rel = "noopener";
      parts.push(document.createTextNode(" · "), view);
    }
    const edit = document.createElement("a"); edit.href = "epk.html"; edit.textContent = "Edit in the EPK builder";
    parts.push(document.createTextNode(" · "), edit);
    line.replaceChildren(...parts);
  }

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

  async function createOutreachPreflight(venue, email, outreachId, followUpTo = "") {
    const response = await fetchWithTimeout("https://api.danzstak.com/tour-manager/outreach/preflight", { method:"POST", credentials:"include", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({ venueKey:identity(venue), to:email, outreachId, ...(followUpTo ? { followUpTo } : {}) }) });
    const data = await response.json().catch(() => ({})), footer = String(data.footer || "");
    if (!response.ok || !footer.includes("DanzStak LLC, 2063 Main St. #237, Oakley, CA 94561, USA") || !/https:\/\/danzstak\.com\/booking-opt-out\.html#token=[a-f0-9]{64}/.test(footer)) throw new Error(data.error || "DanzStak could not verify this contact for review.");
    return data;
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
    document.getElementById("tmSent").textContent = String(outreach.filter(item => ["provider_accepted", "sent", "delivered", "bounced", "complained"].includes(item.status)).length);
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
    if (typeof chooseVenuesNext !== "undefined" && chooseVenuesNext) {
      chooseVenuesNext.textContent = available ? "Add venues" : "Choose venues";
      chooseVenuesNext.setAttribute("aria-label", available ? "Add more venues from the worldwide venue map" : "Choose venues from the worldwide venue map");
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const due = venues.filter(v => v.booking?.followUp && v.booking.followUp <= today && ["found", "pitched", "no_reply"].includes(pipeline.stageOf(bookingStatus(v)))).length;
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
        for (const stage of pipeline.nextStatuses(bookingStatus(venue), { showDate: booking.showDate, today: localToday() })) {
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
    // Owner 2026-11-16: pay to play is the band's call. Marking it warns other bands (counts only, never who).
    const payLabel = document.createElement("label"), pay = document.createElement("select");
    payLabel.append(document.createTextNode("Pay to play?"));
    pay.setAttribute("aria-label", "Pay to play?");
    for (const [value, text] of [["", "No"], ["tickets", "Yes: we must sell a ticket quota"], ["fee", "Yes: we must pay the venue"]]) { const option = document.createElement("option"); option.value = value; option.textContent = text; option.selected = String(booking.payToPlay || "") === value; pay.append(option); }
    pay.addEventListener("change", () => { booking.payToPlay = pay.value; persist(); render(); });
    payLabel.append(pay); fields.append(payLabel);
    if (["replied", "offer"].includes(pipeline.stageOf(bookingStatus(venue)))) fields.append(dateOptionsField(venue, booking));
    const hint = document.createElement("small");
    hint.textContent = "Save after editing. Cards move one step at a time; sending a pitch and a venue reply move them for you. Confirmed requires a date and written evidence of the promoter's agreement. Played unlocks after the show date.";
    fields.append(hint);
    return fields;
  }

  // Task 07-D: every date a club offered, not just one. "Any Thursday in March" expands to dates.
  const MAX_DATE_OPTIONS = 30, WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function prettyDate(value) { try { return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); } catch { return value; } }
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  function weekdayDates(weekday, from, to) {
    const dates = [];
    if (!validDate(from) || !validDate(to)) return dates;
    for (let day = Date.parse(`${from}T00:00:00Z`); day <= Date.parse(`${to}T00:00:00Z`) && dates.length < MAX_DATE_OPTIONS; day += 86400000) if (new Date(day).getUTCDay() === weekday) dates.push(new Date(day).toISOString().slice(0, 10));
    return dates;
  }
  // Owner 2026-11-16: no written confirmation after 3 days → one follow-up email (artist edits and
  // approves) and a call to the club. A phone OK becomes the written evidence: who and when.
  const CONFIRM_WAIT_DAYS = 3;
  function confirmationOverdue(booking) {
    const accepted = Date.parse(booking.acceptedAt || `${booking.acceptedDate}T00:00:00Z`);
    return Number.isFinite(accepted) && Date.now() - accepted >= CONFIRM_WAIT_DAYS * 86400000;
  }
  function confirmationChase(venue, booking) {
    const box = document.createElement("div"), title = document.createElement("h4"), state = document.createElement("p");
    box.className = "confirm-chase"; title.textContent = `No written OK from ${venue.name || "the club"} yet`;
    state.className = "confirm-chase-state"; state.setAttribute("role", "status");
    box.append(title);
    // 1. One follow-up email in the booking thread (free), only after the artist ticks and clicks.
    const threadId = booking.pipeline?.threadId || "";
    if (booking.confirmFollowUpAt) box.append(Object.assign(document.createElement("p"), { className: "hint", textContent: `Follow-up sent ${booking.confirmFollowUpAt}. Time to call them.` }));
    else if (threadId) {
      const a = artist(), draft = document.createElement("textarea"), approveLabel = document.createElement("label"), approve = document.createElement("input"), send = document.createElement("button");
      draft.rows = 6; draft.maxLength = 4000; draft.setAttribute("aria-label", `Follow-up to ${venue.name}`);
      draft.value = `Hello ${venue.name || "venue"} booking team,\n\nJust checking in on ${prettyDate(booking.acceptedDate)}, ${booking.acceptedDate.slice(0, 4)}. Can you confirm the date and the deal so we can announce the show?\n\nThank you,\n${a.name || "[your name]"}`;
      approve.type = "checkbox"; approveLabel.className = "route-accept-approve"; approveLabel.append(approve, document.createTextNode(` I reviewed this follow-up to ${venue.name}`));
      send.type = "button"; send.textContent = "Send follow-up"; send.disabled = true;
      approve.addEventListener("change", () => { send.disabled = !approve.checked; });
      draft.addEventListener("input", () => { approve.checked = false; send.disabled = true; });
      send.addEventListener("click", async () => {
        if (dirty) { window.danzstakShowFeedback?.("Save to your account first.", { urgent: true }); return; }
        if (/\[[^\]]+\]/.test(draft.value)) { window.danzstakShowFeedback?.("Fill in the [bracketed] parts before sending.", { urgent: true }); return; }
        send.disabled = true; approve.disabled = true; state.textContent = "Sending…";
        try {
          const response = await fetchWithTimeout("https://api.danzstak.com/tour-manager/outreach/reply", { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ outreachId: threadId, content: draft.value.trim(), clientMessageId: crypto.randomUUID().replaceAll("-", "") }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "The follow-up was not sent.");
          booking.confirmFollowUpAt = localToday(); persist(); render();
          await saveWorkspaceSnapshot();
        } catch (error) { state.textContent = error.message; send.disabled = false; approve.disabled = false; }
      });
      box.append(draft, approveLabel, send);
    }
    // 2. Call the club.
    const call = document.createElement("p"), phones = (Array.isArray(venue.phones) ? venue.phones : []).filter(Boolean);
    call.className = "confirm-chase-call";
    if (phones.length) {
      call.append(document.createTextNode("Call them: "));
      phones.slice(0, 2).forEach((phone, index) => { if (index) call.append(document.createTextNode(" · ")); call.append(Object.assign(document.createElement("a"), { href: `tel:${String(phone).replace(/[^\d+]/g, "")}`, textContent: phone })); });
    } else call.textContent = "Call the club. No number saved: check their website or listing.";
    box.append(call);
    // 3. They said yes on the phone: record who and when, then it's Confirmed.
    const form = document.createElement("form"), who = document.createElement("input"), when = document.createElement("input"), confirm = document.createElement("button");
    form.className = "confirm-by-phone";
    who.maxLength = 120; who.placeholder = "Who confirmed (name, role)"; who.setAttribute("aria-label", "Who confirmed by phone"); who.required = true;
    when.type = "date"; when.value = localToday(); when.setAttribute("aria-label", "Date of the call"); when.required = true;
    confirm.type = "submit"; confirm.textContent = "They confirmed by phone";
    form.append(who, when, confirm);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!who.value.trim() || !validDate(when.value)) return;
      booking.status = "Confirmed"; booking.showDate = booking.acceptedDate;
      booking.confirmationEvidence = `Confirmed by phone with ${who.value.trim()} on ${when.value} for ${booking.acceptedDate} (recorded by the artist).`;
      persist(); render();
      await saveWorkspaceSnapshot();
    });
    box.append(form, state);
    return box;
  }

  function dateOptionsField(venue, booking) {
    const box = document.createElement("div"), title = document.createElement("h3"), list = document.createElement("ul");
    box.className = "date-options"; title.textContent = "Dates they offered";
    if (booking.acceptedDate && booking.status === "Date proposed") {
      const waiting = document.createElement("p");
      waiting.className = "date-accepted"; waiting.textContent = `You accepted ${booking.acceptedDate}. Waiting for the club to confirm in writing; then it's Confirmed.`;
      box.append(waiting);
      if (confirmationOverdue(booking)) box.append(confirmationChase(venue, booking));
    }
    const options = () => (Array.isArray(booking.dateOptions) ? booking.dateOptions : []).filter(validDate);
    const set = dates => { booking.dateOptions = [...new Set(dates.filter(validDate))].sort().slice(0, MAX_DATE_OPTIONS); persist(); render(); };
    list.className = "date-option-list"; list.setAttribute("aria-label", `Dates ${venue.name || "this venue"} offered`);
    for (const value of options()) {
      const item = document.createElement("li"), remove = document.createElement("button");
      remove.type = "button"; remove.className = "date-option-remove"; remove.textContent = "×"; remove.setAttribute("aria-label", `Remove ${value}`);
      remove.addEventListener("click", () => set(options().filter(date => date !== value)));
      item.append(document.createTextNode(value), remove); list.append(item);
    }
    if (!options().length) list.append(Object.assign(document.createElement("li"), { className: "date-option-empty", textContent: "None yet. Add each date they can do." }));
    const one = document.createElement("div"), single = document.createElement("input"), addOne = document.createElement("button");
    one.className = "date-option-add"; single.type = "date"; single.setAttribute("aria-label", "Date they offered");
    addOne.type = "button"; addOne.className = "secondary"; addOne.textContent = "Add date";
    addOne.addEventListener("click", () => { if (validDate(single.value)) set([...options(), single.value]); });
    one.append(single, addOne);
    const run = document.createElement("div"), weekday = document.createElement("select"), from = document.createElement("input"), to = document.createElement("input"), addRun = document.createElement("button");
    run.className = "date-option-add date-option-run";
    WEEKDAYS.forEach((name, index) => weekday.append(Object.assign(document.createElement("option"), { value: String(index), textContent: `Any ${name}` })));
    weekday.value = "4"; weekday.setAttribute("aria-label", "Weekday they offered");
    from.type = "date"; from.setAttribute("aria-label", "From"); to.type = "date"; to.setAttribute("aria-label", "To");
    addRun.type = "button"; addRun.className = "secondary"; addRun.textContent = "Add these";
    addRun.addEventListener("click", () => { const dates = weekdayDates(Number(weekday.value), from.value, to.value); if (dates.length) set([...options(), ...dates]); else window.danzstakShowFeedback?.("Pick a from and to date that include that weekday.", { urgent: true }); });
    run.append(weekday, from, to, addRun);
    box.append(title, list, one, run);
    return box;
  }

  function showEmpty() {
    cards.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No clubs are selected yet. Return to the map, open a club pin, and add it to the booking list.";
    cards.append(empty);
    updateControls();
  }

  // Artist stats (task 07-C): every first pitch, from the server. Hidden until the first pitch is sent.
  function renderPitchStats() {
    const panel = document.querySelector(".pitch-stats");
    if (!panel) return;
    const stats = pitchStats && Number(pitchStats.sent) > 0 ? pitchStats : null;
    panel.hidden = !stats;
    if (!stats) return;
    const count = value => Number.isFinite(Number(value)) && value !== null ? String(Math.max(0, Math.round(Number(value)))) : "—";
    for (const [id, key] of [["psSent", "sent"], ["psDelivered", "delivered"], ["psOpened", "opened"], ["psReplied", "replied"], ["psBooked", "booked"]]) document.getElementById(id).textContent = count(stats[key]);
    const rates = [`${count(stats.replyRate)}% reply rate`, `${count(stats.bookedRate)}% booked`];
    if (Number(stats.bounced) > 0) rates.push(`${count(stats.bounced)} bounced`);
    document.getElementById("pitchStatsRates").textContent = rates.join(" · ");
  }

  function renderEpkGate() {
    let gate = document.getElementById("epkGateCard");
    if (!epkBlocked()) { gate?.remove(); return; }
    if (!gate) {
      gate = document.createElement("section");
      gate.id = "epkGateCard"; gate.className = "epk-gate"; gate.setAttribute("aria-labelledby", "epkGateTitle");
      (document.getElementById("pipelineFilters") || cards).before(gate);
    }
    const title = document.createElement("h2"), tagline = document.createElement("p"), progress = document.createElement("progress"), progressText = document.createElement("p"), list = document.createElement("ul"), action = document.createElement("a"), note = document.createElement("small");
    title.id = "epkGateTitle"; title.textContent = "Finish your EPK to start booking";
    tagline.className = "epk-gate-tagline"; tagline.textContent = "Get it together to keep it together.";
    const total = Number(epkGate.total) || 6, done = Math.min(total, Math.max(0, Number(epkGate.done) || 0));
    progress.max = total; progress.value = done; progress.setAttribute("aria-label", `EPK essentials: ${done} of ${total} done`);
    progressText.className = "epk-gate-progress"; progressText.textContent = `${done} of ${total} done`;
    for (const item of [...(Array.isArray(epkGate.missing) ? epkGate.missing : []), ...(epkGate.published ? [] : ["Publish your EPK"])]) list.append(Object.assign(document.createElement("li"), { textContent: String(item) }));
    action.className = "booking-next-action"; action.href = "epk.html"; action.textContent = "Open the EPK builder";
    note.textContent = "You can keep searching and saving venues; pitches unlock when your EPK is published.";
    gate.replaceChildren(title, tagline, progress, progressText, list, action, note);
  }

  function renderStageFilters() {
    let bar = document.getElementById("pipelineFilters");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "pipelineFilters"; bar.className = "pipeline-filters"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Filter venues by booking stage");
      cards.before(bar);
    }
    const counts = new Map();
    for (const venue of venues) { const stage = pipeline.stageOf(bookingStatus(venue)); counts.set(stage, (counts.get(stage) || 0) + 1); }
    if (stageFilter !== "all" && !counts.has(stageFilter)) stageFilter = "all";
    bar.replaceChildren();
    bar.hidden = !venues.length;
    for (const stage of ["all", ...pipeline.PIPELINE_STAGES.filter(item => counts.has(item))]) {
      const chip = document.createElement("button");
      chip.type = "button"; chip.className = `pipeline-chip stage-${stage}`; chip.dataset.stage = stage;
      chip.setAttribute("aria-pressed", String(stageFilter === stage));
      chip.textContent = `${stage === "all" ? "All" : pipeline.STAGE_LABELS[stage]} ${stage === "all" ? venues.length : counts.get(stage)}`;
      chip.addEventListener("click", () => { stageFilter = stage; render(); document.querySelector(`#pipelineFilters [data-stage="${stage}"]`)?.focus(); });
      bar.append(chip);
    }
  }

  // Members keep venue data fresh (task 07): one tap to say a club closed or changed booker. DanzStak reviews it.
  function venueReport(venue) {
    const box = document.createElement("details"), summary = document.createElement("summary"), status = document.createElement("p");
    box.className = "venue-report";
    summary.textContent = "Club closed or new booker?";
    status.setAttribute("role", "status");
    if (!venue.venueKey || !accountLoaded) { box.hidden = true; return box; }
    const closedButton = document.createElement("button"), contactForm = document.createElement("form"), emailLabel = document.createElement("label"), email = document.createElement("input"), urlLabel = document.createElement("label"), url = document.createElement("input"), submit = document.createElement("button");
    closedButton.type = "button"; closedButton.className = "secondary"; closedButton.textContent = "This club closed";
    email.type = "email"; email.maxLength = 254; email.autocomplete = "off"; emailLabel.append("New public booking email", email);
    url.type = "url"; url.maxLength = 600; url.placeholder = "https://"; urlLabel.append("or booking page", url);
    submit.type = "submit"; submit.textContent = "Send new contact";
    contactForm.append(emailLabel, urlLabel, submit);
    const send = async (body, button) => {
      button.disabled = true; status.textContent = "Sending…";
      try {
        const response = await fetchWithTimeout("https://api.danzstak.com/booking-pipeline", { method:"POST", credentials:"include", cache:"no-store", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"venue_report", venueKey:venue.venueKey, ...body }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "DanzStak could not save this report. Try again.");
        if (data.freshness) venue.freshness = data.freshness;
        status.textContent = data.alreadyReported ? "You already reported this. Thanks — DanzStak reviews every report." : "Thanks. Other members now see this, and DanzStak reviews every report.";
      } catch (error) { status.textContent = error.message; button.disabled = false; }
    };
    closedButton.addEventListener("click", () => send({ kind:"closed" }, closedButton));
    contactForm.addEventListener("submit", event => { event.preventDefault(); send({ kind:"new_contact", contactEmail:email.value.trim(), contactUrl:url.value.trim() }, submit); });
    box.append(summary, closedButton, contactForm, status);
    return box;
  }

  function render() {
    renderEpkGate();
    renderStageFilters();
    renderRouteDatesPanel();
    if (!venues.length) { showEmpty(); return; }
    cards.replaceChildren();
    updateControls();
    venues.forEach((venue, index) => {
    const stage = pipeline.stageOf(bookingStatus(venue));
    if (stageFilter !== "all" && stage !== stageFilter) return;
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
    const stageChip = document.createElement("p"), threadId = String(venue.booking?.pipeline?.threadId || "");
    stageChip.className = `pipeline-stage stage-${stage}`;
    const stageLabel = document.createElement("span");
    stageLabel.textContent = pipeline.STAGE_LABELS[stage];
    stageChip.append(stageLabel);
    if (/^[a-zA-Z0-9_-]{16,100}$/.test(threadId)) { const thread = link("Open thread", `messages.html?section=bookings&outreach=${encodeURIComponent(threadId)}`); thread.className = "pipeline-thread"; stageChip.append(thread); }
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
    card.dataset.venueKey = venueKey;
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
      unlock.textContent = unlockLabel();
      unlock.addEventListener("click", async () => {
        unlock.disabled = true;
        try {
          if (dirty) {
            unlock.textContent = "Saving current venue…";
            if (!(await saveWorkspaceSnapshot())) throw new Error("DanzStak could not save this venue. Check the account status and try again before checkout.");
          }
          unlock.textContent = "Opening secure checkout…";
          const unlockResult = await window.danzstakUnlockBookingContact(venueKey);
          if (unlockResult?.cancelled) { unlock.disabled = false; unlock.textContent = unlockLabel(); }
        }
        catch (error) { window.danzstakShowFeedback?.(error.message, { urgent: true }); unlock.disabled = false; unlock.textContent = unlockLabel(); }
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
    const freshnessChip = window.danzstakVenueFreshness?.chip(venue);
    let clubChip = null;
    if (venue.club?.label) { clubChip = document.createElement("p"); clubChip.className = `venue-club venue-club-${String(venue.club.tier || "found").replace(/[^a-z]/g, "")}`; clubChip.textContent = venue.club.label; }
    body.append(stageChip, title, ...(freshnessChip ? [freshnessChip] : []), ...(clubChip ? [clubChip] : []), address, links, note, venueReport(venue));
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
    shareEvidence.textContent = openCount ? `Private EPK opened ${openCount} time${openCount === 1 ? "" : "s"}${lastOpenedAt ? ` · last opened ${new Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short" }).format(new Date(lastOpenedAt))}` : ""}. Counts only; DanzStak does not identify the viewer.` : venueShares.some(item => item.creditReturnedAt) ? "Not opened within 30 days. Your credit came back." : "Private venue EPK not opened yet.";
    const venueOutreach = (window.danzstakTourManagerBilling?.outreach || []).filter(item => item.venueKey === identity(venue)).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))), latestDelivery = venueOutreach[0];
    const deliveryEvidence = document.createElement("p");
    deliveryEvidence.className = "booking-delivery-evidence";
    deliveryEvidence.textContent = latestDelivery ? ({ delivered:"Email delivered by the provider.", bounced:"This address bounced — find a newer contact. Your credit came back.", complained:"The recipient reported this email; this contact is now suppressed.", sent:"Email accepted by the provider; delivery is not confirmed yet.", provider_accepted:"Email accepted by the provider; final ledger settlement is pending." }[latestDelivery.status] || `Email status: ${String(latestDelivery.status || "unknown").replaceAll("_", " ")}.`) : "No booking email sent yet.";
    const genres = artist().genre.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    const categories = (venue.categories || []).map(s => String(s).toLowerCase());
    const matches = genres.filter(g => categories.some(c => c === g || c.split(/[^a-z0-9-]+/).includes(g)));
    fit.textContent = matches.length ? `Listed genre match: ${matches.join(", ")}. Check the current calendar for comparable acts.` : "Genre fit unverified. Review the venue's calendar before pitching.";
    if (["Confirmed", "Played", "Declined"].includes(bookingStatus(venue))) {
      const closed = document.createElement("p");
      closed.textContent = { Confirmed: "Confirmed with evidence. Keep the agreed fee, production terms, and promoter confirmation attached to this record.", Played: "Played. Log how the night went in your notes for next time.", Declined: "This venue passed. Remove it, or add it again later for a fresh pitch." }[bookingStatus(venue)];
      section.append(fit, shareEvidence, deliveryEvidence, closed);
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
    button.disabled = !email || epkBlocked();
    const creditPrompt = document.createElement("div"), creditMessage = document.createElement("p"), buyCredit = document.createElement("button");
    creditPrompt.className = "booking-credit-needed";
    creditMessage.textContent = "No booking-email credit is ready. You can still preview the exact message before buying.";
    buyCredit.type = "button";
    buyCredit.className = "secondary";
    buyCredit.textContent = `Buy 1 credit · ${window.DanzStakFees ? window.DanzStakFees.allInShort(150) : "$1.50 + fees"}`;
    buyCredit.addEventListener("click", async () => {
      buyCredit.disabled = true;
      try {
        if (dirty && !(await saveWorkspaceSnapshot())) throw new Error("DanzStak could not save this pitch. Check the account status and try again before checkout.");
        if (typeof window.danzstakStartBookingCreditCheckout !== "function") throw new Error("Secure credit checkout is unavailable. Reload and try again.");
        const opened = await window.danzstakStartBookingCreditCheckout({ quantity:1, venueKey:identity(venue), button:buyCredit });
        if (!opened) buyCredit.disabled = false;
      } catch (error) {
        window.danzstakShowFeedback?.(error.message, { urgent:true });
        buyCredit.disabled = false;
      }
    });
    creditPrompt.append(creditMessage, buyCredit);
    // Task 25 (owner 2026-11-18): no standing paywall on the venue card. The buy prompt appears only when an
    // approved send needs a credit the artist doesn't have (the 402 below); previewing and selecting never ask to pay.
    creditPrompt.hidden = true;
    button.addEventListener("click", async () => {
      const currentArtist = artist(), currentSubject = subject.value.trim(), currentMessage = draft.value.trim();
      if (booking.dateEnd && booking.showDate && booking.dateEnd < booking.showDate) { window.danzstakShowFeedback?.("The end of the date range cannot be before the proposed show date.", { urgent:true }); return; }
      if (!currentArtist.name || !venue.booking?.showDate || /\[[^\]]+\]/.test(currentMessage)) {
        window.danzstakShowFeedback?.("Add your act name, proposed date, and replace draft placeholders before sending.", { urgent: true });
        return;
      }
      if (!currentArtist.epk || !currentMessage.includes(currentArtist.epk) || currentSubject.length < 3) { window.danzstakShowFeedback?.("Use your published EPK link in the message and add a clear subject before review.", { urgent:true }); return; }
      button.disabled = true;
      let outreachId = "";
      try {
        if (dirty) {
          button.textContent = "Saving current pitch…";
          if (!(await saveWorkspaceSnapshot())) throw new Error("DanzStak could not save this pitch. Check the account status and try again before sending.");
        }
        button.textContent = "Creating private EPK link…";
        outreachId = crypto.randomUUID().replaceAll("-", "");
        const share = await createVenueEpkShare(venue, outreachId, allowPdf.checked);
        const preflight = await createOutreachPreflight(venue, email, outreachId);
        const reviewedMessage = `${currentMessage.replaceAll(currentArtist.epk, share.shareUrl)}\n\n---\n${preflight.footer}`;
        if (reviewedMessage.length > 5000) { await revokeVenueEpkShare(venue, outreachId); throw new Error("Shorten the pitch so the required postal and opt-out footer fits in the email."); }
        if (!(await reviewSend({ venue, to:email, subject:currentSubject, message:reviewedMessage }))) { await revokeVenueEpkShare(venue, outreachId); button.disabled = false; button.textContent = "Preview exact email"; return; }
        button.textContent = "Sending…";
        await window.danzstakSendBookingEmail({ venueKey: identity(venue), to: email, subject: currentSubject, message: reviewedMessage, template:template.value, artistApproved:true, idempotencyKey:outreachId });
        venue.booking.status = "Email sent";
        persist();
        render();
        await saveWorkspaceSnapshot();
      } catch (error) {
        if (outreachId) await revokeVenueEpkShare(venue, outreachId);
        window.danzstakShowFeedback?.(error.message, { urgent: true });
        if (error.status === 402 && /booking-email credits/i.test(error.message)) {
          creditPrompt.hidden = false;
          creditMessage.textContent = "Your pitch is saved. Buy one credit, then DanzStak will return you to this venue to review it again. Nothing sends automatically.";
          buyCredit.focus();
        }
        button.disabled = false;
        button.textContent = "Preview exact email";
      }
    });
    const note = document.createElement("small");
    note.textContent = epkBlocked() ? "Finish and publish your EPK to send pitches. Your venue and draft stay saved." : email ? "DanzStak saves your current pitch before review. Nothing sends until you review the exact recipient and message and tick approval. DanzStak then reserves one credit, submits the email, and restores the credit if the provider rejects it. Venue replies arrive in your private SYNC Bookings inbox." : (venue.emails || []).length ? "Unlock this venue's booking contact before sending an email." : "No public booking email listed. Use the venue website to find its submission form.";
    section.append(fit, shareEvidence, deliveryEvidence, builder, subjectLabel, label, button, creditPrompt, note);
    const initialPitch = venueOutreach.find(item => !item.followUpTo && ["sent", "delivered", "replied"].includes(item.status)), existingFollowUp = initialPitch && venueOutreach.find(item => item.followUpTo === initialPitch.id), venueReplies = window.danzstakTourManagerBilling?.replies || [], hasReply = initialPitch && (initialPitch.repliedAt || booking.pipeline?.repliedAt || !["found", "pitched", "no_reply"].includes(pipeline.stageOf(bookingStatus(venue))) || venueReplies.some(item => item.outreachId === initialPitch.id && item.direction === "inbound")), today = new Date().toISOString().slice(0, 10), followUpDue = Boolean(booking.followUp && booking.followUp <= today);
    if (initialPitch && (followUpDue || existingFollowUp || hasReply)) {
      const followUp = document.createElement("section"), heading = document.createElement("h3"), state = document.createElement("p");
      followUp.className = "booking-follow-up"; heading.textContent = "Follow-up";
      if (hasReply) {
        state.textContent = "This venue replied. Continue in the private SYNC booking thread instead of sending a reminder.";
        const openThread = link("Open this reply in SYNC", `messages.html?section=bookings&outreach=${encodeURIComponent(initialPitch.id)}`);
        openThread.className = "booking-thread-link";
        followUp.append(openThread);
      }
      else if (existingFollowUp) state.textContent = existingFollowUp.status === "delivered" ? "Your one follow-up was delivered." : "Your one follow-up was submitted. No additional reminder will be sent.";
      else {
        state.textContent = `Follow up? No reply in 5 days. Due ${booking.followUp}. DanzStak allows one reminder, and only you can send it.`;
        const followDraftLabel = document.createElement("label"), followDraft = document.createElement("textarea"), draftArtist = artist();
        followDraftLabel.textContent = "Edit the follow-up";
        followDraft.rows = 7; followDraft.maxLength = 4500; followDraft.setAttribute("aria-label", `Follow-up for ${venue.name}`);
        followDraft.value = typeof booking.followUpDraft === "string" && booking.followUpDraft ? booking.followUpDraft : `Hello ${venue.name || "venue"} booking team,\n\nI'm following up on the booking pitch for ${draftArtist.name || "our act"}${booking.showDate ? ` on ${booking.showDate}` : ""}. If the date or act is not a fit, a quick pass is completely fine.\n\nEPK: ${draftArtist.epk}\n\nThank you,\n${draftArtist.name || "Artist"}`;
        followDraft.addEventListener("input", () => { booking.followUpDraft = followDraft.value; });
        followDraftLabel.append(followDraft);
        const followButton = document.createElement("button");
        followButton.type = "button"; followButton.className = "secondary"; followButton.textContent = "Review one follow-up · 1 credit"; followButton.disabled = epkBlocked();
        followButton.addEventListener("click", async () => {
          const currentArtist = artist(), email = initialPitch.recipient, outreachId = crypto.randomUUID().replaceAll("-", ""), publicEpk = currentArtist.epk, subjectText = `Following up: ${initialPitch.subject || `${currentArtist.name || "Artist"} booking enquiry`}`.slice(0, 180), baseMessage = followDraft.value.trim();
          if (!publicEpk || !baseMessage.includes(publicEpk)) { window.danzstakShowFeedback?.("Keep your published EPK link in the follow-up so DanzStak can swap in this venue's private link.", { urgent:true }); return; }
          followButton.disabled = true; followButton.textContent = "Preparing private EPK link…";
          try {
            const share = await createVenueEpkShare(venue, outreachId, booking.allowEpkPdfDownload === true), preflight = await createOutreachPreflight(venue, email, outreachId, initialPitch.id), reviewedMessage = `${baseMessage.replaceAll(publicEpk, share.shareUrl)}\n\n---\n${preflight.footer}`;
            if (!(await reviewSend({ venue, to:email, subject:subjectText, message:reviewedMessage }))) { await revokeVenueEpkShare(venue, outreachId); followButton.disabled = false; followButton.textContent = "Review one follow-up · 1 credit"; return; }
            followButton.textContent = "Sending follow-up…";
            await window.danzstakSendBookingEmail({ venueKey:identity(venue), to:email, subject:subjectText, message:reviewedMessage, template:booking.pitchTemplate || "band", artistApproved:true, idempotencyKey:outreachId, followUpTo:initialPitch.id });
            await window.danzstakTourManagerBilling?.refreshOutreach?.();
            render();
          } catch (error) { window.danzstakShowFeedback?.(error.message, { urgent:true }); followButton.disabled = false; followButton.textContent = "Review one follow-up · 1 credit"; }
        });
        followUp.append(followDraftLabel, followButton);
      }
      followUp.prepend(heading, state); section.append(followUp);
    }
    return section;
  }

  function focusCreditVenue(detail, attempt = 0) {
    const venueKey = String(detail?.venueKey || "");
    if (!venueKey) return;
    const card = [...document.querySelectorAll(".venue-card[data-venue-key]")].find(node => node.dataset.venueKey === venueKey);
    const target = card?.querySelector(".booking-follow-up button, .outreach > button:not(.secondary)");
    if (!card || !target) {
      if (attempt < 50) setTimeout(() => focusCreditVenue(detail, attempt + 1), 100);
      return;
    }
    target.scrollIntoView({ block:"center", behavior:"auto" });
    target.focus({ preventScroll:true });
    if (detail.status === "verified") window.danzstakShowFeedback?.("Credit ready. Review this venue's exact email again; nothing was sent automatically.");
  }

  function focusFollowUpVenue(venueKey, attempt = 0) {
    if (!venueKey) return;
    const card = [...document.querySelectorAll(".venue-card[data-venue-key]")].find(node => node.dataset.venueKey === venueKey);
    const target = card?.querySelector(".booking-follow-up button");
    if (!card || !target) {
      if (attempt < 50) setTimeout(() => focusFollowUpVenue(venueKey, attempt + 1), 100);
      else window.danzstakShowFeedback?.("This follow-up is no longer due. Your booking workspace is current.");
      return;
    }
    target.scrollIntoView({ block:"center", behavior:"auto" });
    target.focus({ preventScroll:true });
    window.danzstakShowFeedback?.("Follow-up ready. Review the reminder before using one credit; nothing was sent automatically.");
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
    if (manual && dirty && !(await window.danzstakConfirm("Unsaved edits to existing venues and artist details will be replaced. Export CSV first to keep a copy.", { title: "Reload account records?", confirmLabel: "Reload records", danger: true }))) return false;
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
      epkGate = data.epk && typeof data.epk === "object" ? data.epk : null;
      pitchStats = data.stats && typeof data.stats === "object" ? data.stats : null;
      renderPitchStats();
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
      return true;
    } catch (error) {
      accountStatus.textContent = error.message;
      return false;
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
      // The server moves cards forward from real events (sent pitch, venue reply); show what it saved.
      if (data.statuses && typeof data.statuses === "object") {
        for (const venue of venues) {
          const saved = data.statuses[identity(venue)];
          if (saved && pipeline.STAGE_BY_STATUS[saved.status]) venue.booking = { ...(venue.booking || {}), status: saved.status, followUp: saved.followUp || "", pipeline: saved.pipeline || venue.booking?.pipeline };
        }
        try { sessionStorage.setItem(storageKey, JSON.stringify(venues)); } catch {}
        render();
      }
      try { sessionStorage.removeItem("danzstakBookingMapAdditions"); } catch {}
      dirty = false;
      accountStatus.textContent = "Saved privately to your account. Available on your other devices.";
      return true;
    } catch (error) { accountStatus.textContent = error.message; return false; }
    finally {
      enabled.forEach(c => { c.disabled = false; });
      saveAccount.disabled = false;
      loadAccount.disabled = false;
    }
  }
  saveAccount?.addEventListener("click", saveWorkspaceSnapshot);
  loadAccount?.addEventListener("click", () => loadWorkspace(true));

  // Task 07-D: route-aware date picker. Suggestions only; accepting dates is a separate, approved step.
  let routeDates = null;
  const routeForm = document.getElementById("routeDatesForm"), routeResult = document.getElementById("routeDatesResult");
  const miles = value => `${Math.round(Number(value) || 0).toLocaleString()} mi`;
  function renderRouteDatesPanel() {
    const panel = document.querySelector(".route-dates");
    if (!panel) return;
    panel.hidden = !venues.some(venue => ["replied", "offer", "confirmed"].includes(pipeline.stageOf(bookingStatus(venue))));
    const home = document.getElementById("routeHome"), hometown = document.getElementById(artistInputs.hometown)?.value || "";
    if (home && !home.value && hometown) home.value = hometown;
  }
  function renderRouteDates(result) {
    routeResult.replaceChildren();
    if (!result) return;
    const t = result.totals || {}, summary = document.createElement("p"), list = document.createElement("ol");
    summary.className = "route-summary";
    const compare = t.shows > t.baselineShows ? `${t.shows - t.baselineShows} more show${t.shows - t.baselineShows === 1 ? "" : "s"} than taking dates first-come` : t.savedMiles > 0 ? `${miles(t.savedMiles)} less driving than taking dates first-come` : "same as taking dates first-come";
    summary.textContent = t.shows ? `${t.shows} show${t.shows === 1 ? "" : "s"} · ${miles(t.miles)} round trip, about ${Math.round(t.hours || 0)} h driving${t.estimated ? " (estimated)" : ""} · ${compare}` : "No dates fit yet. See what didn't fit below.";
    list.className = "route-plan";
    for (const stop of result.plan || []) {
      const item = document.createElement("li");
      item.append(Object.assign(document.createElement("strong"), { textContent: `${prettyDate(stop.date)} · ${stop.name}` }), Object.assign(document.createElement("span"), { textContent: `${miles(stop.driveMiles)}, ${stop.driveHours} h${stop.fixed ? " · confirmed" : ""}` }));
      if (stop.fixed) item.className = "route-fixed";
      list.append(item);
    }
    if (result.returnLeg && result.plan?.length) list.append(Object.assign(document.createElement("li"), { className: "route-home", textContent: `Home · ${miles(result.returnLeg.miles)}, ${result.returnLeg.hours} h` }));
    routeResult.append(summary, list);
    const section = (title, items, className) => {
      if (!items.length) return;
      const box = document.createElement("div"), heading = document.createElement("h3"), ul = document.createElement("ul");
      box.className = className; heading.textContent = title;
      for (const node of items) ul.append(node);
      box.append(heading, ul); routeResult.append(box);
    };
    section("Conflicts", (result.conflicts || []).map(item => Object.assign(document.createElement("li"), { textContent: item.text })), "route-conflicts");
    section("Didn't fit", (result.unplaced || []).map(item => Object.assign(document.createElement("li"), { textContent: `${item.name}: ${item.reason}` })), "route-unplaced");
    renderAcceptDates(result);
    section("Open nights to fill", (result.gaps || []).map(gap => {
      const li = document.createElement("li"), link = document.createElement("a");
      li.textContent = `${prettyDate(gap.from)}–${prettyDate(gap.to)}: ${gap.nights} open nights between ${gap.after} and ${gap.before}. `;
      link.href = "booking.html"; link.textContent = "Find clubs to pitch";
      li.append(link); return li;
    }), "route-gaps");
  }
  // Task 07-E: accept the suggested dates. One editable confirmation per club, sent only after the
  // artist ticks and clicks. The venue then waits at "Date proposed" for the club's written OK.
  const confirmationDraft = (venue, date) => {
    const a = artist();
    return `Hello ${venue.name || "venue"} booking team,\n\nThanks for the dates. We'd love to lock in ${prettyDate(date)}, ${date.slice(0, 4)} at ${venue.name || "your venue"}.\n\nPlease reply to confirm the date and the deal (doors and set time, guarantee or door split, ticket price) so we can announce it.\n\nEPK: ${a.epk || "[Add your published EPK link.]"}\n\nThank you,\n${a.name || "[your name]"}`;
  };
  async function acceptDate(venue, date, sentReplyId) {
    const data = await accountRequest("POST", { action: "accept_date", venueKey: venue.venueKey, date, ...(sentReplyId ? { sentReplyId } : {}) });
    Object.assign(venue.booking, { status: "Date proposed", showDate: date, acceptedDate: date, acceptedAt: new Date().toISOString(), ...(sentReplyId ? { acceptedReplyId: sentReplyId } : {}) });
    if (data.revision) revision = data.revision;
    try { sessionStorage.setItem(storageKey, JSON.stringify(venues)); } catch {}
    return data;
  }
  function renderAcceptDates(result) {
    const stops = (result.plan || []).filter(stop => !stop.fixed);
    if (!stops.length) return;
    const box = document.createElement("div"), heading = document.createElement("h3"), intro = document.createElement("p"), list = document.createElement("div");
    box.className = "route-accept"; heading.textContent = "Accept these dates";
    intro.className = "hint"; intro.textContent = "Each club gets its own confirmation in your booking thread (no credit used). Edit it, tick the box, then send. The show is confirmed when the club confirms in writing.";
    list.className = "route-accept-list";
    for (const stop of stops) {
      const venue = venues.find(item => item.venueKey === stop.venueKey);
      if (!venue) continue;
      const card = document.createElement("section"), title = document.createElement("h4"), state = document.createElement("p");
      card.className = "route-accept-card"; card.dataset.venueKey = stop.venueKey;
      title.textContent = `${prettyDate(stop.date)} · ${stop.name}`; state.className = "route-accept-state"; state.setAttribute("role", "status");
      card.append(title);
      const waiting = () => { card.replaceChildren(title, state); state.textContent = `Sent. Waiting for ${venue.name} to confirm ${prettyDate(stop.date)} in writing.`; card.classList.add("route-accept-done"); };
      if (venue.booking?.acceptedDate === stop.date && venue.booking?.status === "Date proposed") { waiting(); list.append(card); continue; }
      const threadId = venue.booking?.pipeline?.threadId || "";
      const saveOnly = document.createElement("button");
      saveOnly.type = "button"; saveOnly.className = "secondary"; saveOnly.textContent = "Save date only";
      saveOnly.addEventListener("click", async () => {
        if (dirty) { window.danzstakShowFeedback?.("Save to your account first.", { urgent: true }); return; }
        saveOnly.disabled = true;
        try { await acceptDate(venue, stop.date); waiting(); state.textContent = `Date saved. Waiting for ${venue.name} to confirm ${prettyDate(stop.date)} in writing.`; render(); }
        catch (error) { state.textContent = error.message; saveOnly.disabled = false; }
      });
      if (!threadId) {
        state.textContent = "No DanzStak booking thread with this club. Confirm by your own email, then save the date.";
        card.append(state, saveOnly); list.append(card); continue;
      }
      const draft = document.createElement("textarea"), approveLabel = document.createElement("label"), approve = document.createElement("input"), send = document.createElement("button"), actions = document.createElement("div");
      draft.maxLength = 4000; draft.rows = 8; draft.value = confirmationDraft(venue, stop.date); draft.setAttribute("aria-label", `Confirmation to ${venue.name}`);
      approve.type = "checkbox"; approveLabel.className = "route-accept-approve"; approveLabel.append(approve, document.createTextNode(` I reviewed this email to ${venue.name}`));
      send.type = "button"; send.textContent = "Send confirmation"; send.disabled = true;
      approve.addEventListener("change", () => { send.disabled = !approve.checked || !draft.value.trim(); });
      draft.addEventListener("input", () => { approve.checked = false; send.disabled = true; });
      send.addEventListener("click", async () => {
        if (dirty) { window.danzstakShowFeedback?.("Save to your account first.", { urgent: true }); return; }
        if (!approve.checked || /\[[^\]]+\]/.test(draft.value)) { window.danzstakShowFeedback?.("Fill in the [bracketed] parts and tick the box before sending.", { urgent: true }); return; }
        send.disabled = true; approve.disabled = true; draft.readOnly = true; state.textContent = "Sending…";
        const clientMessageId = crypto.randomUUID().replaceAll("-", "");
        let sent = false;
        try {
          const response = await fetchWithTimeout("https://api.danzstak.com/tour-manager/outreach/reply", { method: "POST", credentials: "include", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ outreachId: threadId, content: draft.value.trim(), clientMessageId }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "The confirmation was not sent.");
          sent = true;
          await acceptDate(venue, stop.date, clientMessageId);
          waiting(); render();
        } catch (error) {
          state.textContent = sent ? `Email sent, but the date wasn't saved: ${error.message} Use "Save date only" — don't send again.` : error.message;
          if (sent) { card.append(saveOnly); send.remove(); } else { send.disabled = false; approve.disabled = false; draft.readOnly = false; }
        }
      });
      actions.className = "route-accept-actions"; actions.append(send, saveOnly);
      card.append(draft, approveLabel, actions, state); list.append(card);
    }
    box.append(heading, intro, list); routeResult.append(box);
  }

  routeForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (dirty) { window.danzstakShowFeedback?.("Save to your account first so the picker uses your latest dates.", { urgent: true }); return; }
    const button = document.getElementById("routeDatesButton");
    button.disabled = true; routeResult.textContent = "Working out the shortest route…";
    try {
      const data = await accountRequest("POST", { action: "route_dates", home: document.getElementById("routeHome").value.trim(), settings: { maxDriveHours: Number(document.getElementById("routeMaxDrive").value), nightsInARow: Number(document.getElementById("routeNights").value) } });
      routeDates = data.routeDates || null;
      renderRouteDates(routeDates);
    } catch (error) {
      routeDates = null; routeResult.textContent = error.message || "Dates could not be suggested. Try again.";
    } finally { button.disabled = false; }
  });
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
  document.addEventListener("danzstak-tour-manager-credits", render);
  document.addEventListener("danzstak-booking-credit-return", event => { render(); focusCreditVenue(event.detail); });
  render();
  if (loadAccount) {
    loadWorkspace().then(async loaded => {
      paintPitchingAs();
      // Task 25: act name, genres, hometown, EPK link and pitch always come from the published EPK.
      if (epkHandoffRequested) await usePublishedEpk({ save:loaded, clearHandoff:true, auto:true });
      else if (loaded && epkGate?.published) await usePublishedEpk({ save:true, auto:true });
      if (loaded && followUpFocusVenue) focusFollowUpVenue(followUpFocusVenue);
    });
  }
  if (window.danzstakBookingCreditReturn) focusCreditVenue(window.danzstakBookingCreditReturn);
})();
