"use strict";
// "Keep going" (owner 2026-11-17): bands tour in one-way legs. After the I-5 run they head east on
// I-8, I-10, I-20, I-40 or I-80; big tours often start in the Midwest (Nashville, Milwaukee) and go east or west.
// After a one-way leg, the band picks a freeway and direction; the next leg starts where this one ended,
// follows the freeway's music towns and finds clubs all along it.
(() => {
  const CORRIDORS = [
    { name: "I-5", towns: ["San Diego", "Los Angeles", "Sacramento", "Redding", "Medford", "Eugene", "Portland", "Tacoma", "Seattle", "Bellingham"], ends: ["south", "north"] },
    { name: "I-8", towns: ["San Diego", "El Centro", "Yuma", "Tucson"], ends: ["west", "east"] },
    { name: "I-10", towns: ["Los Angeles", "Palm Springs", "Phoenix", "Tucson", "El Paso", "San Antonio", "Houston", "Baton Rouge", "New Orleans", "Mobile", "Pensacola", "Tallahassee", "Jacksonville"], ends: ["west", "east"] },
    { name: "I-20", towns: ["Fort Worth", "Dallas", "Shreveport", "Jackson", "Birmingham", "Atlanta", "Augusta", "Columbia"], ends: ["west", "east"] },
    { name: "I-40", towns: ["Barstow", "Flagstaff", "Albuquerque", "Amarillo", "Oklahoma City", "Little Rock", "Memphis", "Nashville", "Knoxville", "Asheville", "Raleigh", "Wilmington"], ends: ["west", "east"] },
    { name: "I-80", towns: ["San Francisco", "Sacramento", "Reno", "Salt Lake City", "Cheyenne", "Lincoln", "Omaha", "Des Moines", "Iowa City", "Chicago", "Toledo", "Cleveland", "New York"], ends: ["west", "east"] },
    { name: "I-90 / I-94", towns: ["Seattle", "Spokane", "Missoula", "Bozeman", "Billings", "Fargo", "Minneapolis", "Madison", "Milwaukee", "Chicago", "Cleveland", "Buffalo", "Albany", "Boston"], ends: ["west", "east"] },
    { name: "I-70", towns: ["Denver", "Lawrence", "Kansas City", "Columbia", "St. Louis", "Indianapolis", "Columbus", "Pittsburgh", "Baltimore"], ends: ["west", "east"] },
    { name: "I-65", towns: ["Chicago", "Indianapolis", "Louisville", "Nashville", "Birmingham", "Montgomery", "Mobile"], ends: ["north", "south"] },
    { name: "I-95", towns: ["Miami", "Jacksonville", "Savannah", "Richmond", "Washington", "Baltimore", "Philadelphia", "New York", "Providence", "Boston"], ends: ["south", "north"] }
  ];
  const STORE = "danzstak_tour_legs";
  const town = value => String(value || "").split(",")[0].trim().toLowerCase();
  const read = () => { try { const legs = JSON.parse(localStorage.getItem(STORE) || "[]"); return Array.isArray(legs) ? legs.slice(-12) : []; } catch { return []; } };
  const write = legs => { try { localStorage.setItem(STORE, JSON.stringify(legs.slice(-12))); } catch {} };
  const t = text => window.danzstakTranslate?.(text) || text;

  // Freeway options from where this leg ended: every corridor that passes through the town, both ways.
  // If the town is not on a listed freeway, offer every corridor's far ends from here.
  function options(endLabel) {
    const here = town(endLabel), list = [];
    for (const corridor of CORRIDORS) {
      const index = corridor.towns.findIndex(name => name.toLowerCase() === here);
      if (index < 0) continue;
      const forward = corridor.towns.slice(index + 1), backward = corridor.towns.slice(0, index).reverse();
      if (forward.length) list.push({ corridor: corridor.name, direction: corridor.ends[1], towns: forward });
      if (backward.length) list.push({ corridor: corridor.name, direction: corridor.ends[0], towns: backward });
    }
    if (list.length) return list;
    return CORRIDORS.flatMap(corridor => [
      { corridor: corridor.name, direction: corridor.ends[1], towns: corridor.towns, joinFromHere: true },
      { corridor: corridor.name, direction: corridor.ends[0], towns: corridor.towns.slice().reverse(), joinFromHere: true }
    ]);
  }

  function sample(towns, count) {
    if (towns.length <= count) return towns.slice();
    return Array.from({ length: count }, (_, index) => towns[Math.round(index * (towns.length - 1) / (count - 1))]);
  }

  // Remember the legs of this tour in this browser so the band sees the whole run.
  function recordLeg(data) {
    const start = data.route?.start?.label || "", end = data.route?.end?.label || "";
    if (!start || !end) return read();
    let legs = read();
    const last = legs.at(-1);
    if (!last || town(last.end) !== town(start)) legs = last && town(last.start) === town(start) && town(last.end) === town(end) ? legs.slice(0, -1) : [];
    if (legs.at(-1) && town(legs.at(-1).start) === town(start) && town(legs.at(-1).end) === town(end)) return legs;
    legs.push({ start, end, departOn: data.route.departOn || "", returnBy: data.route.returnBy || "" });
    write(legs);
    return legs;
  }

  function nextDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function startLeg(option, data) {
    const set = (id, value) => { const input = document.getElementById(id); if (input && value !== undefined) { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); } };
    const endLabel = data.route.end.label, towns = option.towns, stops = sample(towns.slice(0, -1), Math.min(4, Math.max(0, towns.length - 1)));
    const days = Math.max(4, Math.min(30, towns.length * 2));
    set("bookingMode", "tour");
    set("startCity", endLabel);
    set("endCity", `${towns.at(-1)}`);
    set("tourStops", stops.join("\n"));
    set("days", String(days));
    set("showCount", String(Math.max(1, Math.round(days * 0.7))));
    set("departOn", nextDay(data.route.returnBy));
    const oneWay = document.getElementById("oneWayTour");
    if (oneWay) { oneWay.checked = true; oneWay.dispatchEvent(new Event("change", { bubbles: true })); }
    // Same trigger the tour brief uses; a plain form submit would reload the page (live test 2026-11-17).
    document.getElementById("routeSearchAction")?.click();
    document.getElementById("routeResults")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function render(data) {
    if (!data?.route?.oneWay || data.route.local || !data.route.end?.label) return null;
    const legs = recordLeg(data), section = document.createElement("section"), heading = document.createElement("h3"), hint = document.createElement("p"), grid = document.createElement("div");
    section.className = "tour-keep-going";
    heading.textContent = t("Keep going");
    hint.className = "hint";
    hint.textContent = t("Start the next leg from here. Pick a freeway; DanzStak finds clubs in the music towns along it.");
    if (legs.length > 1) {
      const sofar = document.createElement("p");
      sofar.className = "tour-legs-so-far";
      sofar.textContent = `${t("Tour so far")}: ${legs.map((leg, index) => `${index + 1}. ${town(leg.start).replace(/\b\w/g, c => c.toUpperCase())} → ${town(leg.end).replace(/\b\w/g, c => c.toUpperCase())}`).join(" · ")}`;
      section.append(heading, sofar, hint, grid);
    } else section.append(heading, hint, grid);
    grid.className = "tour-keep-going-options";
    for (const option of options(data.route.end.label).slice(0, 12)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tour-leg-option";
      const label = document.createElement("strong"), path = document.createElement("span");
      label.textContent = `${option.corridor} ${t(option.direction)}`;
      path.textContent = sample(option.towns, Math.min(4, option.towns.length)).join(" → ");
      button.append(label, path);
      button.setAttribute("aria-label", `${t("Next leg")}: ${option.corridor} ${t(option.direction)} ${t("to")} ${option.towns.at(-1)}`);
      button.addEventListener("click", () => startLeg(option, data));
      grid.append(button);
    }
    return section;
  }

  window.danzstakTourLegs = { render, options, corridors: CORRIDORS };
})();
