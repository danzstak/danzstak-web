"use strict";

(() => {
  const status = document.getElementById("venueMapStatus");
  const mapElement = document.getElementById("venueSearchMap");
  const searchAreaButton = document.getElementById("searchVisibleVenueArea");
  const clearAreaButton = document.getElementById("clearVenueArea");
  if (!status || !mapElement || !searchAreaButton || !window.L) {
    if (status) status.textContent = "The venue map could not load. Refresh and try again.";
    return;
  }

  if (mapElement.dataset.mapInitialized === "true") return;
  mapElement.dataset.mapInitialized = "true";
  const map = L.map(mapElement, {
    zoomControl: true,
    tap: true,
    tapTolerance: 18,
    touchZoom: true,
    bounceAtZoomLimits: false
  }).setView([39.5, -98.35], 4);
  const baseTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri"
  }).addTo(map);

  const drawn = new L.FeatureGroup().addTo(map);
  const venueMarkers = new L.FeatureGroup().addTo(map);
  const selectedVenues = new Map();
  const selectionCount = document.getElementById("selectedVenueCount");
  const openSelections = document.getElementById("openVenueSelections");
  let searchBounds = null;
  let searchScope = "city";
  let drawingRoute = false;
  let routePoints = [];
  let finalizedRoutePoints = [];
  let routePreview = null;
  let mapDrawControl = null;
  let activeDrawPointer = null;
  let lastDrawPixel = null;
  let suppressMapClickUntil = 0;

  const venueIdentity = place => String(place.venueKey || `${place.name || ""}|${place.address || ""}`);
  const boundsPayload = bounds => ({
    north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest()
  });
  const isSearchableBounds = bounds => bounds.getNorth() - bounds.getSouth() <= 8 && bounds.getEast() - bounds.getWest() <= 8;

  function updateSelectionUi() {
    const count = selectedVenues.size;
    if (selectionCount) selectionCount.textContent = `${count} club${count === 1 ? "" : "s"} selected`;
    if (openSelections) openSelections.disabled = count === 0;
  }

  function useBounds(bounds, scope) {
    searchBounds = boundsPayload(bounds);
    searchScope = scope;
    status.textContent = scope === "drawn"
      ? "Drawn area selected. Press Search this area."
      : "Map area selected. Press Search this area to find clubs visible on the map.";
  }

  function setDrawControl(active) {
    if (!mapDrawControl) return;
    mapDrawControl.setAttribute("aria-pressed", String(active));
    mapDrawControl.setAttribute("aria-label", active ? "Finish drawing route" : "Draw a route on the map");
    mapDrawControl.title = active ? "Finish route" : "Draw a route";
    mapDrawControl.innerHTML = active ? '<span aria-hidden="true">✓</span>' : '<span aria-hidden="true">✎</span>';
  }

  function stopRouteDrawing() {
    drawingRoute = false;
    activeDrawPointer = null;
    lastDrawPixel = null;
    routePoints = [];
    setDrawControl(false);
    document.querySelector(".booking-map-panel")?.classList.remove("is-drawing");
    map.dragging.enable();
    map.touchZoom.enable();
  }

  function startRouteDrawing() {
    drawingRoute = true;
    routePoints = [];
    finalizedRoutePoints = [];
    drawn.clearLayers();
    routePreview = null;
    searchBounds = null;
    searchScope = "drawing";
    setDrawControl(true);
    document.querySelector(".booking-map-panel")?.classList.add("is-drawing");
    map.dragging.disable();
    map.touchZoom.disable();
    status.textContent = "Drag across the map to draw your route. The blue line follows your path; press the checkmark when finished.";
  }

  function finishRouteDrawing() {
    if (routePoints.length < 2) {
      status.textContent = "Add at least one more point so DanzStak can draw a route line.";
      return false;
    }
    drawn.clearLayers();
    routePreview = L.polyline(routePoints, { color: "#1769e0", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(drawn);
    const maximumPathPoints = 40;
    const sampledPoints = routePoints.length <= maximumPathPoints
      ? routePoints
      : Array.from({ length: maximumPathPoints }, (_, index) => routePoints[Math.round(index * (routePoints.length - 1) / (maximumPathPoints - 1))]);
    finalizedRoutePoints = sampledPoints.map(point => [point.lng, point.lat]);
    useBounds(routePreview.getBounds(), "drawn");
    map.fitBounds(routePreview.getBounds(), { padding: [24, 24] });
    stopRouteDrawing();
    status.textContent = "Route selected. Press Search this area to find clubs along it.";
    return true;
  }

  function toggleRouteDrawing() {
    if (drawingRoute) finishRouteDrawing();
    else startRouteDrawing();
  }
  function addRoutePoint(latlng, announce = true) {
    routePoints.push(latlng);
    if (routePreview) drawn.removeLayer(routePreview);
    routePreview = routePoints.length === 1
      ? L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 3, fillColor: "#1769e0", fillOpacity: 1, interactive: false }).addTo(drawn)
      : L.polyline(routePoints, { color: "#1769e0", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(drawn);
    if (announce) status.textContent = `${routePoints.length} route point${routePoints.length === 1 ? "" : "s"} added. ${routePoints.length < 2 ? "Draw farther or tap one more point to make the line." : "Keep drawing or press the checkmark to finish."}`;
  }
  map.on("click", event => {
    if (drawingRoute && Date.now() > suppressMapClickUntil) addRoutePoint(event.latlng);
  });

  const isMapControl = target => target instanceof Element && Boolean(target.closest(".leaflet-control, .leaflet-popup"));
  mapElement.addEventListener("pointerdown", event => {
    if (!drawingRoute || activeDrawPointer !== null || isMapControl(event.target) || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault();
    activeDrawPointer = event.pointerId;
    mapElement.setPointerCapture?.(event.pointerId);
    const latlng = map.mouseEventToLatLng(event);
    lastDrawPixel = map.latLngToContainerPoint(latlng);
    addRoutePoint(latlng, false);
    suppressMapClickUntil = Date.now() + 500;
    status.textContent = "Drawing route… drag through the places you want to travel, then press the checkmark.";
  }, { passive: false });
  mapElement.addEventListener("pointermove", event => {
    if (!drawingRoute || activeDrawPointer !== event.pointerId) return;
    event.preventDefault();
    const latlng = map.mouseEventToLatLng(event);
    const pixel = map.latLngToContainerPoint(latlng);
    if (lastDrawPixel && pixel.distanceTo(lastDrawPixel) < 7) return;
    lastDrawPixel = pixel;
    addRoutePoint(latlng, false);
  }, { passive: false });
  const endDrawStroke = event => {
    if (activeDrawPointer !== event.pointerId) return;
    event.preventDefault();
    try { mapElement.releasePointerCapture?.(event.pointerId); } catch {}
    activeDrawPointer = null;
    lastDrawPixel = null;
    suppressMapClickUntil = Date.now() + 500;
    status.textContent = routePoints.length >= 2
      ? `Route drawn with ${routePoints.length} points. Press the checkmark to finish, or draw again to extend it.`
      : "Draw farther across the map, or tap another point, to create a route.";
  };
  mapElement.addEventListener("pointerup", endDrawStroke, { passive: false });
  mapElement.addEventListener("pointercancel", endDrawStroke, { passive: false });

  const DrawRouteControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const wrapper = L.DomUtil.create("div", "leaflet-bar map-draw-control-wrap");
      mapDrawControl = L.DomUtil.create("button", "map-draw-control", wrapper);
      mapDrawControl.type = "button";
      mapDrawControl.innerHTML = '<span aria-hidden="true">✎</span>';
      mapDrawControl.title = "Draw a route";
      mapDrawControl.setAttribute("aria-label", "Draw a route on the map");
      mapDrawControl.setAttribute("aria-pressed", "false");
      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.on(mapDrawControl, "click", event => {
        L.DomEvent.stop(event);
        toggleRouteDrawing();
      });
      return wrapper;
    }
  });
  map.addControl(new DrawRouteControl());
  map.on("moveend zoomend", () => {
    if (searchScope !== "drawn") {
      searchBounds = null;
      searchScope = "viewport";
      status.textContent = "Map moved. Press Search this area to search the visible region.";
    }
  });

  clearAreaButton?.addEventListener("click", () => {
    if (drawingRoute) stopRouteDrawing();
    drawn.clearLayers();
    searchBounds = null;
    searchScope = "city";
    finalizedRoutePoints = [];
    const search = document.getElementById("routeSearchAction") || document.querySelector(".primary-route");
    if (search) delete search.dataset.mapSearchSignature;
    status.textContent = "Area filter cleared. Search by city, or move the map and press Search this area.";
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !drawingRoute) return;
    stopRouteDrawing();
    drawn.clearLayers();
    routePreview = null;
    status.textContent = "Route drawing canceled. Move the map or use the pencil to try again.";
    mapDrawControl?.focus();
  });
  searchAreaButton.addEventListener("click", () => {
    if (searchScope !== "drawn") {
      const visibleBounds = map.getBounds();
      if (!isSearchableBounds(visibleBounds)) {
        searchBounds = null;
        searchScope = "city";
        status.textContent = "Zoom closer to a city or region, then press Search this area. Your normal home-city search is still available below.";
        return;
      }
      useBounds(visibleBounds, "viewport");
    }
    const search = document.getElementById("routeSearchAction") || document.querySelector(".primary-route");
    if (!search) {
      status.textContent = "Enter an act and home city below first.";
      document.getElementById("bandName")?.focus();
      return;
    }
    search.dataset.mapSearchSignature = JSON.stringify({
      scope: searchScope,
      bounds: searchBounds,
      path: searchScope === "drawn" ? finalizedRoutePoints : []
    });
    status.textContent = "Searching the visible map area for live-music clubs…";
    search.click();
  });

  function popupFor(place) {
    const box = document.createElement("div");
    const name = document.createElement("strong");
    const address = document.createElement("p");
    const evidence = document.createElement("p");
    name.textContent = place.name || "Live music venue";
    address.textContent = place.address || "Address unavailable";
    box.append(name, address);
    evidence.className = "venue-evidence";
    evidence.textContent = [place.categories?.slice(0, 3).join(" · "), place.activityEvidence].filter(Boolean).join(" — ");
    if (evidence.textContent) box.append(evidence);
    for (const website of place.websites || []) {
      const link = document.createElement("a");
      link.href = website;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Venue / booking website";
      box.append(link);
    }
    if (place.sourceName) {
      const source = document.createElement(place.sourceUrl ? "a" : "small");
      source.textContent = `Source: ${place.sourceName}`;
      if (place.sourceUrl) {
        source.href = place.sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
      }
      source.className = "venue-source";
      box.append(source);
    }
    const select = document.createElement("button");
    const key = venueIdentity(place);
    const sync = () => { select.textContent = selectedVenues.has(key) ? "Remove from booking list" : "Add to booking list"; };
    select.type = "button";
    select.className = "map-select-venue";
    select.addEventListener("click", () => {
      if (selectedVenues.has(key)) selectedVenues.delete(key);
      else selectedVenues.set(key, place);
      sync();
      updateSelectionUi();
    });
    sync();
    box.append(select);
    return box;
  }

  function appendDifferentClubsButton() {
    const results = document.getElementById("routeResults");
    const primarySearch = document.getElementById("routeSearchAction") || document.querySelector(".primary-route");
    if (!results || !primarySearch || !results.children.length) return;
    results.querySelector("#searchDifferentClubs")?.remove();
    const button = document.createElement("button");
    button.type = "button";
    button.id = "searchDifferentClubs";
    button.className = "secondary search-different-clubs";
    button.textContent = "Search different clubs";
    button.addEventListener("click", () => primarySearch.click());
    results.append(button);
  }

  function showResults(data) {
    venueMarkers.clearLayers();
    const routePoints = [data.route?.start, ...(data.route?.stops || []), data.route?.end]
      .filter(point => Array.isArray(point?.position) && point.position.length === 2);
    const venues = (data.candidates || []).flatMap(market => market.venues || [])
      .filter(place => Array.isArray(place.position) && place.position.length === 2);
    for (const place of venues) {
      const venueName = String(place.name || "Live music venue").trim();
      L.marker([place.position[1], place.position[0]], {
        title: venueName,
        alt: `${venueName} venue marker`
      }).bindPopup(popupFor(place)).addTo(venueMarkers);
    }
    const coordinates = venues.length
      ? venues.map(place => [place.position[1], place.position[0]])
      : routePoints.map(point => [point.position[1], point.position[0]]);
    if (coordinates.length === 1) map.setView(coordinates[0], 12);
    else if (coordinates.length > 1 && !searchBounds) map.fitBounds(coordinates, { padding: [28, 28], maxZoom: 13 });
    status.textContent = venues.length
      ? `${venues.length} clubs pinned. Move or zoom the map and press Search this area, or search different clubs below the results.`
      : "No clubs matched. Zoom out, change the music style, or search a different area.";
    window.setTimeout(appendDifferentClubsButton, 0);
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (resource, options = {}) => {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    let nextOptions = options;
    if (url.includes("/tour/route") && String(options.method || "GET").toUpperCase() === "POST") {
      try {
        const body = JSON.parse(String(options.body || "{}"));
        if (searchBounds) body.searchBounds = searchBounds;
        if (searchScope === "drawn" && finalizedRoutePoints.length >= 2) body.searchPath = finalizedRoutePoints;
        nextOptions = { ...options, body: JSON.stringify(body) };
      } catch {}
    }
    try {
      const response = await nativeFetch(resource, nextOptions);
      if (url.includes("/tour/route")) {
        if (response.ok) response.clone().json().then(showResults).catch(() => {
          status.textContent = "The club results could not be displayed. Try the search again.";
        });
        else response.clone().json().catch(() => ({})).then(data => {
          status.textContent = data.error || "The club search did not complete. Move the map or change the search and try again.";
        });
      }
      return response;
    } catch (error) {
      if (url.includes("/tour/route")) status.textContent = error?.name === "AbortError"
        ? "The club search took too long. Zoom closer or draw a shorter route and try again."
        : "The club search could not connect. Check the connection and try again.";
      throw error;
    }
  };

  let resizeFrame = 0;
  const resizeMap = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
      baseTiles.redraw();
    });
  };
  window.addEventListener("resize", resizeMap);
  window.addEventListener("orientationchange", resizeMap);
  window.addEventListener("load", resizeMap, { once: true });
  window.addEventListener("pageshow", resizeMap);
  const mapResizeObserver = window.ResizeObserver ? new ResizeObserver(resizeMap) : null;
  mapResizeObserver?.observe(mapElement);
  const mapVisibilityObserver = window.IntersectionObserver ? new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) resizeMap();
  }, { threshold: [0, 0.01] }) : null;
  mapVisibilityObserver?.observe(mapElement);
  document.fonts?.ready.then(resizeMap).catch(() => {});
  window.setTimeout(resizeMap, 100);
  window.setTimeout(resizeMap, 500);
  openSelections?.addEventListener("click", () => {
    if (!selectedVenues.size) return;
    sessionStorage.setItem("danzstakBookingVenueSelections", JSON.stringify([...selectedVenues.values()]));
    sessionStorage.setItem("danzstakBookingMapAdditions", "true");
    window.location.assign("booking-selections.html");
  });
  updateSelectionUi();
  document.addEventListener("DOMContentLoaded", () => {
    const mode = document.getElementById("bookingMode");
    if (mode) {
      mode.value = "local";
      mode.dispatchEvent(new Event("change"));
    }
  }, { once: true });
})();
