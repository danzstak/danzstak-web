"use strict";

(() => {
  const form = document.getElementById("bookingBriefForm");
  const brief = document.getElementById("bookingBrief");
  const status = document.getElementById("bookingBriefStatus");
  if (!form || !brief || !status) return;
  let requestStarted = false;
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
    const named = text.match(/\b(?:(?:depart(?:ing)?|starting|leaving|first show(?: is)?|on)\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i);
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
    // One-way runs typed without "from" or "and back", e.g. "Bellingham to San Diego" or
    // "Punk. Bellingham, WA to San Diego, CA. 14 days." (owner bug report 2026-11-16).
    const oneWay = !chainedRoute && !route && !bareRoute && routeText.match(/(?:^|[.!?;]\s+)([a-z][a-z ,'-]{1,80}?)\s+to\s+([a-z][a-z .,'-]{1,80}?)(?=\s+(?:for|in)\s+\d+\s*(?:-| )?days?|\s+starting\b|[.!?;](?:\s|$)|$)/i);
    const oneWayOk = oneWay && !/\b(?:want|need|going|like|love|try|trying|have|plan|planning|hoping|ready|able|i|we|find|look|looking|search|book|get|clubs|shows|gigs|venues)\b/i.test(oneWay[1]) && !/\bbetween\b/i.test(text);
    const parsedRoute = route || bareRoute || (oneWayOk ? oneWay : null);
    if (parsedRoute) { parsed.home = tidyPlace(parsedRoute[1]); parsed.destination = tidyPlace(parsedRoute[2]); parsed.mode = "tour"; }
    else {
      const betweenRoute = text.match(/\bbetween\s+(.+?)\s+and\s+(.+?)(?=\s+(?:for|in)\s+\d+\s*(?:-| )?days?|[.!?]|$)/i);
      if (betweenRoute) {
        parsed.home = tidyPlace(betweenRoute[1]);
        parsed.destination = tidyPlace(betweenRoute[2]);
        parsed.mode = "tour";
      }
    }
    if (!parsed.mode && !chainedRoute && !bareRoute) {
      const home = text.match(/\b(?:from|home(?:town)?\s+is)\s+(.+?)(?=\s+(?:and|travel|tour|head|go)\b|$)/i);
      if (home) parsed.home = tidyPlace(home[1]);
      if (/\b(?:near|around|close to)\s+home\b/.test(lower)) parsed.mode = "local";
      const direction = lower.match(/\b(?:travel|tour|head|go)\s+(northwest|northeast|southwest|southeast|north|south|east|west)\b/);
      if (direction) { parsed.direction = direction[1]; parsed.mode = "direction"; }
    }
    // Natural-language fallback (owner test 2026-11-16): "i want to tour 20 days bellingham to san diego and back tacoma
    // find me clubs ...". Walk outward from the "to" between two places, stopping at filler words.
    if (!parsed.mode) {
      const stop = new Set("i we me my our want wanna would like to tour tours touring play playing go going do book booking find get show shows gig gigs day days week weeks a an the for from in on and then back return returning home with of clubs venues places stay record stores radio stations there calculate cost costs please run trip drive driving up down via".split(" "));
      const words = text.replace(/[.!?;]/g, " , ").split(/\s+/).filter(Boolean);
      const isWord = w => /^[a-z][a-z'-]*,?$/i.test(w) && !stop.has(w.toLowerCase().replace(/,$/, ""));
      const placeBack = i => { const out = []; for (let j = i; j >= 0 && (isWord(words[j]) || (/^[A-Z]{2},?$/.test(words[j]) && out.length === 0)); j--) out.unshift(words[j]); return tidyPlace(out.join(" ")); };
      const placeFwd = i => { const out = []; for (let j = i; j < words.length && (isWord(words[j]) || (/^[A-Z]{2},?$/.test(words[j]) && out.length)); j++) { out.push(words[j]); if (/,$/.test(words[j]) && !/^[A-Z]{2},$/.test(words[j + 1] || "")) break; } return tidyPlace(out.join(" ")); };
      for (let i = 1; i < words.length - 1; i++) {
        if (words[i].toLowerCase() !== "to") continue;
        const from = placeBack(i - 1), to = placeFwd(i + 1);
        if (from && to) {
          parsed.home = from; parsed.destination = to; parsed.mode = "tour";
          const rest = words.slice(i + 1).join(" ");
          const back = rest.match(/\b(?:and|then)\s+back(?:\s+to)?\s+([a-z][a-z' -]*?)(?=\s+(?:find|and|for|with|in|then)\b|[,]|$)/i);
          if (back && !stop.has(back[1].trim().toLowerCase())) parsed.returnTo = tidyPlace(back[1]);
          break;
        }
      }
    }
    if (parsed.home) parsed.home = parsed.home.replace(/^\d+\s*(?:-| )?days?\s+/i, "");
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
      const allStops = [...(parsed.stops || [])];
      if (parsed.returnTo && parsed.returnTo.toLowerCase() !== String(parsed.home || "").toLowerCase()) allStops.push(parsed.returnTo);
      if (stops) stops.value = allStops.join("\n");
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    requestStarted = true;
    const parsed = parseTourBrief(brief.value);
    if (!brief.value.trim()) { status.textContent = "Describe where you are starting, how long you have, and where you want to go."; brief.focus(); return; }
    if (!parsed.mode && !parsed.home && /\bto\b/i.test(brief.value) && !/\b(?:want|need|book|play|near|around|local)\b/i.test(brief.value)) {
      requestStarted = false;
      status.textContent = "I couldn't read the route. Try: From Bellingham to San Diego, 14 days, 10 shows.";
      brief.focus();
      return;
    }
    applyTourBrief(parsed);
    const missing = [];
    if (!field("startCity")?.value.trim()) missing.push("home town");
    if (parsed.mode === "tour" && !field("endCity")?.value.trim()) missing.push("turnaround city");
    if (missing.length) {
      requestStarted = false;
      status.textContent = `Almost there—add the ${missing.join(" and ")}, then press Plan my run again.`;
      document.querySelector("details.booking-tools")?.setAttribute("open", "");
      document.querySelector("details.booking-start")?.setAttribute("open", "");
      field("startCity")?.focus();
      return;
    }
    status.textContent = "Building the route and looking for playable clubs…";
    field("routeSearchAction")?.click();
  });

  document.getElementById("bookingBriefExample")?.addEventListener("click", () => {
    const act = field("bandName")?.value.trim();
    const home = field("startCity")?.value.trim();
    const destination = field("endCity")?.value.trim();
    const artist = act ? `${act}. ` : "";
    if (home && destination) brief.value = `${artist}DIY punk. From ${home} to ${destination} and back home. 10 days. 8 shows.`;
    else if (home) brief.value = `${artist}DIY punk. From ${home} and travel south, then back home. 10 days. 8 shows.`;
    else brief.value = `${artist}DIY punk. Start from your home city and travel south, then return home. 10 days. 8 shows.`;
    status.textContent = "";
    brief.focus();
  });

  window.danzstakParseTourBrief = parseTourBrief;
  const routeStatus = field("routeSearchStatus");
  if (routeStatus && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      if (requestStarted) status.textContent = routeStatus.textContent;
    })
      .observe(routeStatus, { childList: true, characterData: true, subtree: true });
  }
})();
