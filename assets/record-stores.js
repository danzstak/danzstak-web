"use strict";
(() => {
  const form = document.getElementById("recordStoreForm"), input = document.getElementById("recordStoreLocation"), status = document.getElementById("recordStoreStatus"), results = document.getElementById("recordStoreResults");
  const safeLink = (label, href) => { const link = document.createElement("a"); link.textContent = label; link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; return link; };
  function render(stores) {
    results.replaceChildren();
    stores.forEach(store => {
      const card = document.createElement("article"), title = document.createElement("h2"), address = document.createElement("p"), evidence = document.createElement("p"), links = document.createElement("div");
      card.className = "store-card"; links.className = "store-links"; title.textContent = store.name || "Record store"; address.textContent = store.address || store.locality || "Address unavailable"; evidence.textContent = store.activityEvidence || "Confirm current hours before visiting.";
      (store.websites || []).filter(url => /^https:\/\//.test(url)).slice(0,1).forEach(url => links.append(safeLink("Website", url)));
      if (Array.isArray(store.position) && store.position.length === 2) links.append(safeLink("Map", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.position[1]},${store.position[0]}`)}`));
      links.append(safeLink("Record Stores Love", "https://recordstores.love/"));
      card.append(title, address, evidence, links); results.append(card);
    });
  }
  form.addEventListener("submit", async event => {
    event.preventDefault(); const location = input.value.trim(); if (!location) return;
    status.textContent = `Finding record stores near ${location}…`; results.replaceChildren();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("https://api.danzstak.com/record-stores/search", { method:"POST", credentials:"include", headers:{"content-type":"application/json"}, body:JSON.stringify({location}), signal:controller.signal });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Search failed.");
      render(data.stores || []); status.textContent = data.stores?.length ? `${data.stores.length} record store${data.stores.length === 1 ? "" : "s"} near ${data.location?.label || location}.` : `No solid record-store listings found near ${location}. Try a nearby city or Record Stores Love.`;
    } catch (error) { status.textContent = error.name === "AbortError" ? "The search took too long. Try again." : error.message; }
    finally { clearTimeout(timer); }
  });
})();
