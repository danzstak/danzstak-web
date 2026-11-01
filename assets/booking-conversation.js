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

  function parseDepartureDate(text) {
    const validDate = (year, month, day) => {
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    };
    const iso = text.match(/\b(?:depart(?:ing)?|starting|leaving|first show(?: is)?|on)\s+(\d{4}-\d{2}-\d{2})\b/i);
    if (iso) {
      const [year, month, day] = iso[1].split("-").map(Number);
      return validDate(year, month, day) ? iso[1] : "";
    }
    const monthNames = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
    };
    const named = text.match(/\b(?:depart(?:ing)?|starting|leaving|first show(?: is)?|on)\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i);
    if (!named) return "";
    const month = monthNames[named[1].toLowerCase()], day = Number(named[2]), year = Number(named[3]);
    if (!validDate(year, month, day)) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

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
    if (!parsed.act) {
      const commaAct = text.match(/^\s*([^,.!?]+)\s*,\s*(?=(?:(?:diy\s+)?punk|hardcore|metal|rock|jazz|dj|electronic|techno|house)\b)/i);
      if (commaAct && !/^(?:plan|tour|trip|run)\b/i.test(commaAct[1].trim())) parsed.act = tidyPlace(commaAct[1]);
    }
    const chainedRoute = text.match(/\bfrom\s+(.+?)\s+to\s+(.+?)\s+and\s+(?:then\s+)?(?:up|down|over|on|to)?\s*(.+?)\s+and\s+back(?:\s+to\s+.+?)?(?=\s+(?:for\s+\d+\s*(?:-| )?days?|and\s+(?:do|play|book)?\s*\d+\s*(?:shows?|gigs?|dates?))\b|[.!?]|$)/i);
    if (chainedRoute) {
      parsed.home = tidyPlace(chainedRoute[1]);
      parsed.stops = [tidyPlace(chainedRoute[2])];
      parsed.destination = tidyPlace(chainedRoute[3]);
      parsed.mode = "tour";
    }
    const routeText = text.replace(/^tour\s+(?!from\b)/i, "from "),
      route = !chainedRoute && routeText.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?=\s+(?:and\s+back|then\s+back|and\s+home|return(?:ing)?\s+home|(?:for|in)\s+\d+\s*(?:-| )?days?|starting\s+\d{4}-\d{2}-\d{2})\b|$)/i),
      bareRoute = !chainedRoute && !route && routeText.match(/(?:^|[,.!?]\s*)([a-z][a-z '-]{1,80}?)\s+to\s+([a-z][a-z '-]{1,80}?)(?=\s+and\s+back(?:\s+to\s+[a-z][a-z '-]{1,80}?)?(?:[,;.!?]|\s+|$))/i);
    const parsedRoute = route || bareRoute;
    if (parsedRoute) { parsed.home = tidyPlace(parsedRoute[1]); parsed.destination = tidyPlace(parsedRoute[2]); parsed.mode = "tour"; }
    else if (!chainedRoute && !bareRoute) {
      const home = text.match(/\b(?:from|home(?:town)?\s+is)\s+(.+?)(?=\s+(?:and|travel|tour|head|go)\b|$)/i);
      if (home) parsed.home = tidyPlace(home[1]);
      if (/\b(?:near|around|close to)\s+home\b/.test(lower)) parsed.mode = "local";
      const direction = lower.match(/\b(?:travel|tour|head|go)\s+(northwest|northeast|southwest|southeast|north|south|east|west)\b/);
      if (direction) { parsed.direction = direction[1]; parsed.mode = "direction"; }
    }
    parsed.departOn = parseDepartureDate(text) || undefined;
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
    if (parsed.mode) {
      const stops = field("tourStops");
      if (stops) stops.value = (parsed.stops || []).join("\n");
    }
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
      document.querySelector("details.booking-tools")?.setAttribute("open", "");
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
  const routeStatus = field("routeSearchStatus");
  if (routeStatus && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => { status.textContent = routeStatus.textContent; })
      .observe(routeStatus, { childList: true, characterData: true, subtree: true });
  }
})();
