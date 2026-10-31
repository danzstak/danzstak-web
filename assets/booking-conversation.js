"use strict";

(() => {
  const form = document.getElementById("bookingBriefForm");
  const brief = document.getElementById("bookingBrief");
  const status = document.getElementById("bookingBriefStatus");
  if (!form || !brief || !status) return;
  const field = id => document.getElementById(id);
  const setValue = (id, value) => {
    const control = field(id);
    if (!control || value === undefined || value === null || value === "") return;
    control.value = String(value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const tidyPlace = value => String(value || "").trim().replace(/[,.!?]+$/, "").replace(/\s+/g, " ");

  function parseTourBrief(value) {
    const text = String(value || "").trim();
    const lower = text.toLowerCase();
    const parsed = {};
    const days = lower.match(/\b(\d{1,3})\s*(?:-| )?days?\b/);
    if (days) parsed.days = Math.max(1, Math.min(180, Number(days[1])));
    const shows = lower.match(/\b(?:do|play|book)?\s*(\d{1,3})\s*(?:shows?|gigs?|dates?)\b/);
    if (shows) parsed.shows = Math.max(1, Math.min(180, Number(shows[1])));
    const genreRules = [
      [/\b(?:diy\s+)?punk\b|\bhardcore\b/, "DIY Punk"], [/\bmetal\b/, "Metal"], [/\brock\b/, "Rock"],
      [/\b(?:dj|electronic|techno|house)\b/, "DJ / Electronic"], [/\b(?:hip[- ]?hop|rap)\b/, "Hip-Hop"],
      [/\bjazz\b/, "Jazz"], [/\b(?:orchestra|classical|ensemble)\b/, "Orchestra / Classical"]
    ];
    parsed.genre = genreRules.find(([pattern]) => pattern.test(lower))?.[1];
    const act = text.match(/\bfor\s+(.+?)\s+from\s+/i);
    if (act && !/^\d+\s*(?:-| )?days?$/i.test(act[1].trim())) parsed.act = tidyPlace(act[1]);
    if (!parsed.act) {
      const plainAct = text.match(/^\s*(?:plan\s+(?:a\s+)?(?:tour\s+)?for\s+)?([^.!?]+)[.!?]\s*/i);
      if (plainAct && !/^(?:plan|tour|trip|run|punk|rock|metal|jazz|dj)\b/i.test(plainAct[1].trim())) parsed.act = tidyPlace(plainAct[1]);
    }
    const chainedRoute = text.match(/\bfrom\s+(.+?)\s+to\s+(.+?)\s+and\s+(?:then\s+)?(?:up|down|over|on|to)?\s*(.+?)\s+and\s+back(?:\s+to\s+.+?)?(?=\s+(?:for\s+\d+\s*(?:-| )?days?|and\s+(?:do|play|book)?\s*\d+\s*(?:shows?|gigs?|dates?))\b|[.!?]|$)/i);
    if (chainedRoute) {
      parsed.home = tidyPlace(chainedRoute[1]);
      parsed.stops = [tidyPlace(chainedRoute[2])];
      parsed.destination = tidyPlace(chainedRoute[3]);
      parsed.mode = "tour";
    }
    const route = !chainedRoute && text.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?=\s+(?:and\s+back|then\s+back|and\s+home|return(?:ing)?\s+home|for\s+\d+\s*(?:-| )?days?|starting\s+\d{4}-\d{2}-\d{2})\b|$)/i);
    if (route) { parsed.home = tidyPlace(route[1]); parsed.destination = tidyPlace(route[2]); parsed.mode = "tour"; }
    else if (!chainedRoute) {
      const home = text.match(/\b(?:from|home(?:town)?\s+is)\s+(.+?)(?=\s+(?:and|travel|tour|head|go)\b|$)/i);
      if (home) parsed.home = tidyPlace(home[1]);
      if (/\b(?:near|around|close to)\s+home\b/.test(lower)) parsed.mode = "local";
      const direction = lower.match(/\b(?:travel|tour|head|go)\s+(northwest|northeast|southwest|southeast|north|south|east|west)\b/);
      if (direction) { parsed.direction = direction[1]; parsed.mode = "direction"; }
    }
    const date = text.match(/\b(?:starting|leaving|first show)\s+(\d{4}-\d{2}-\d{2})\b/i);
    if (date) parsed.departOn = date[1];
    return parsed;
  }

  function applyTourBrief(parsed) {
    setValue("bandName", parsed.act);
    setValue("startCity", parsed.home);
    setValue("musicGenre", parsed.genre);
    setValue("days", parsed.days);
    setValue("showCount", parsed.shows);
    setValue("departOn", parsed.departOn);
    if (parsed.mode) setValue("bookingMode", parsed.mode);
    if (parsed.direction) setValue("travelDirection", parsed.direction);
    if (parsed.destination) setValue("endCity", parsed.destination);
    if (parsed.stops?.length) setValue("tourStops", parsed.stops.join("\n"));
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const parsed = parseTourBrief(brief.value);
    if (!brief.value.trim()) { status.textContent = "Describe where you are starting, how long you have, and where you want to go."; brief.focus(); return; }
    applyTourBrief(parsed);
    const missing = [];
    if (!field("bandName")?.value.trim()) missing.push("act name");
    if (!field("startCity")?.value.trim()) missing.push("home town");
    if (parsed.mode === "tour" && !field("endCity")?.value.trim()) missing.push("turnaround city");
    if (missing.length) {
      status.textContent = `Almost there—add the ${missing.join(" and ")}, then press Find the run again.`;
      document.querySelector("details.booking-start")?.setAttribute("open", "");
      field(missing[0] === "act name" ? "bandName" : "startCity")?.focus();
      return;
    }
    status.textContent = "Building the route and looking for playable clubs…";
    field("routeSearchAction")?.click();
  });

  document.getElementById("bookingBriefExample")?.addEventListener("click", () => {
    brief.value = "The Rats. DIY punk. From Momo, Italy to Berlin and back home for 10 days.";
    brief.focus();
  });

  window.danzstakParseTourBrief = parseTourBrief;
})();
