"use strict";

(() => {
  const cards = document.getElementById("selectedVenueCards");
  const status = document.getElementById("selectionStatus");
  const printButton = document.getElementById("printVenueSheet");
  const downloadButton = document.getElementById("downloadVenueCsv");
  const clearButton = document.getElementById("clearVenueSelections");
  const storageKey = "danzstakBookingVenueSelections";
  let venues = [];
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
    status.textContent = `${venues.length} selected club${venues.length === 1 ? "" : "s"}`;
  }

  function persist() {
    sessionStorage.setItem(storageKey, JSON.stringify(venues));
    updateControls();
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
      String(venue.activityEvidence || "")
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
    body.append(remove);
    card.append(body);
    cards.append(card);
    });
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function downloadCsv() {
    const rows = [["Venue", "Address", "Website", "Email", "Phone", "Categories", "Evidence", "Source"]];
    for (const venue of venues) rows.push([
      venue.name,
      venue.address,
      (venue.websites || []).join(" | "),
      (venue.emails || []).join(" | "),
      (venue.phones || []).join(" | "),
      (venue.categories || []).join(" | "),
      venue.activityEvidence,
      venue.sourceUrl || venue.sourceName
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
})();
