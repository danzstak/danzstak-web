"use strict";

(() => {
  const status = document.getElementById("venueMapStatus");
  const mapElement = document.getElementById("venueSearchMap");
  if (!status || !mapElement || !window.L) {
    if (status) status.textContent = "The venue map could not load. Refresh and try again.";
    return;
  }

  const map = L.map(mapElement, { zoomControl: true }).setView([39.5, -98.35], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const drawn = new L.FeatureGroup().addTo(map);
  const venueMarkers = new L.FeatureGroup().addTo(map);
  let searchBounds = null;

  map.addControl(new L.Control.Draw({
    position: "topright",
    draw: { polyline: false, circle: false, circlemarker: false, marker: false, rectangle: true, polygon: { allowIntersection: false } },
    edit: { featureGroup: drawn, edit: false, remove: true }
  }));

  const saveBounds = layer => {
    drawn.clearLayers();
    drawn.addLayer(layer);
    const bounds = layer.getBounds();
    searchBounds = { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() };
    status.textContent = "Area selected. Press the club search button again to show clubs inside this outline.";
  };

  map.on(L.Draw.Event.CREATED, event => saveBounds(event.layer));
  map.on(L.Draw.Event.DELETED, () => {
    if (!drawn.getLayers().length) {
      searchBounds = null;
      status.textContent = "Draw another area, or search the whole city.";
    }
  });

  document.getElementById("clearVenueArea")?.addEventListener("click", () => {
    drawn.clearLayers();
    searchBounds = null;
    status.textContent = "Draw another area, or search the whole city.";
  });

  function popupFor(place) {
    const box = document.createElement("div");
    const name = document.createElement("strong");
    const address = document.createElement("p");
    name.textContent = place.name || "Live music venue";
    address.textContent = place.address || "Address unavailable";
    box.append(name, address);
    for (const website of place.websites || []) {
      const link = document.createElement("a");
      link.href = website;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Venue / booking website";
      box.append(link);
    }
    return box;
  }

  function showResults(data) {
    venueMarkers.clearLayers();
    const routePoints = [data.route?.start, ...(data.route?.stops || []), data.route?.end]
      .filter(point => Array.isArray(point?.position) && point.position.length === 2);
    const venues = (data.candidates || []).flatMap(market => market.venues || [])
      .filter(place => Array.isArray(place.position) && place.position.length === 2);
    for (const place of venues) {
      L.marker([place.position[1], place.position[0]], { title: place.name }).bindPopup(popupFor(place)).addTo(venueMarkers);
    }
    const coordinates = venues.length ? venues.map(place => [place.position[1], place.position[0]]) : routePoints.map(point => [point.position[1], point.position[0]]);
    if (coordinates.length === 1) map.setView(coordinates[0], 12);
    else if (coordinates.length > 1) map.fitBounds(coordinates, { padding: [28, 28], maxZoom: 13 });
    status.textContent = venues.length
      ? `${venues.length} club${venues.length === 1 ? "" : "s"} pinned. Draw an area and search again to narrow it.`
      : "No clubs matched this search. Adjust the drawn area or music style and search again.";
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (resource, options = {}) => {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    let nextOptions = options;
    if (url.includes("/tour/route") && String(options.method || "GET").toUpperCase() === "POST") {
      try {
        const body = JSON.parse(String(options.body || "{}"));
        if (searchBounds) body.searchBounds = searchBounds;
        nextOptions = { ...options, body: JSON.stringify(body) };
      } catch {}
    }
    const response = await nativeFetch(resource, nextOptions);
    if (url.includes("/tour/route") && response.ok) {
      response.clone().json().then(showResults).catch(() => {});
    }
    return response;
  };

  window.addEventListener("resize", () => map.invalidateSize());
  document.addEventListener("DOMContentLoaded", () => {
    const mode = document.getElementById("bookingMode");
    if (mode) {
      mode.value = "local";
      mode.dispatchEvent(new Event("change"));
    }
  }, { once: true });
})();
