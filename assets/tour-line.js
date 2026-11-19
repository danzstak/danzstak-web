"use strict";
// Straight-line tour engine (task 25, owner 2026-11-18). Pure functions, no network, no storage.
// Shared by the Booking Agent (line the asks up as a road trip, suggest clubs along the line) and
// the Tour Manager (calendar route, criss-cross check, swap and date-ask suggestions).
//
// Owner: "The tour planner should ... try to get the gigs one after another in a straight line.
// Not Seattle → Portland → Bellingham → Seattle → Sacramento → Salem → San Francisco."
//
// Positions are [lng, lat]. Drive estimates use the same straight-line × road factor at an
// average road speed as infrastructure/auth-api/booking-route-dates.mjs, so the server's
// date picker and this engine agree. Real road legs can be passed in as `drive`.
(() => {
  const ROAD_FACTOR = 1.2, AVERAGE_MPH = 50, DAY_MS = 86400000, SAME_TOWN_MILES = 15, BACKTRACK_MILES = 25;
  // Defaults the artist can change: 3–4 h between shows is the target, warn above 6 h (owner).
  // costPerMile = fuel + van wear (owner's example: +640 mi ≈ +$410). hotelNight = one room-night for the band.
  const DEFAULTS = Object.freeze({ maxDriveHours: 6, targetDriveHours: 4, costPerMile: 0.64, hotelNight: 120, darkDays: [1], offRouteHours: 3 });
  const settingsOf = (value = {}) => {
    const number = (key, min, max) => { const n = Number(value[key]); return Number.isFinite(n) && n >= min && n <= max ? n : DEFAULTS[key]; };
    const dark = Array.isArray(value.darkDays) ? value.darkDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : DEFAULTS.darkDays;
    return { maxDriveHours: number("maxDriveHours", 1, 16), targetDriveHours: number("targetDriveHours", 1, 16), costPerMile: number("costPerMile", 0, 10), hotelNight: number("hotelNight", 0, 2000), darkDays: dark, offRouteHours: number("offRouteHours", 0.5, 48) };
  };

  const isDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const dayOf = value => Math.round(Date.parse(`${value}T00:00:00Z`) / DAY_MS);
  const dateOf = day => new Date(day * DAY_MS).toISOString().slice(0, 10);
  const weekday = day => new Date(day * DAY_MS).getUTCDay();
  const round = (value, places = 0) => { const f = 10 ** places; return Math.round(value * f) / f; };
  const validPosition = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

  function estimateDrive(a, b) {
    const rad = degrees => degrees * Math.PI / 180, [lng1, lat1] = a, [lng2, lat2] = b;
    const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    const miles = 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h))) * ROAD_FACTOR;
    return { miles, hours: miles / AVERAGE_MPH };
  }

  // Local flat projection in miles around a reference latitude: good enough to tell
  // "forward along the route" from "back the way we came" on a regional tour.
  const flat = (p, refLat) => [p[0] * 69.17 * Math.cos(refLat * Math.PI / 180), p[1] * 69.17];

  const pathMiles = (points, drive) => { let miles = 0; for (let i = 1; i < points.length; i++) miles += drive(points[i - 1], points[i]).miles; return miles; };
  const stopsWithPosition = stops => (Array.isArray(stops) ? stops : []).filter(stop => stop && validPosition(stop.position));

  // ---- Route order ------------------------------------------------------------------------
  // One direction of travel: nearest-neighbour from the start, then 2-opt to remove crossings.
  // mode "one_way" (default) or "out_and_back" (ends where it started).
  // With no start, the tour starts at one end of the line (the stop farthest from the others' far end),
  // so a list of towns comes back as a straight run in one direction.
  function orderStops({ stops, start = null, end = null, mode = "one_way", drive = estimateDrive } = {}) {
    const list = stopsWithPosition(stops);
    if (list.length < 2 && !start) return list.slice();
    const anchorStart = start && validPosition(start.position) ? start : null, anchorEnd = end && validPosition(end.position) ? end : null;
    let first = anchorStart;
    if (!first) {
      // Farthest pair: start from the end of the line nearest the north/west so results are stable.
      let best = null;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const miles = drive(list[i].position, list[j].position).miles;
        if (!best || miles > best.miles) best = { miles, a: list[i], b: list[j] };
      }
      first = best.a.position[1] >= best.b.position[1] ? best.a : best.b;
    }
    const remaining = list.filter(stop => stop !== first);
    const order = anchorStart ? [] : [first];
    let at = first.position;
    while (remaining.length) {
      let index = 0, bestMiles = Infinity;
      remaining.forEach((stop, i) => { const miles = drive(at, stop.position).miles; if (miles < bestMiles) { bestMiles = miles; index = i; } });
      const [next] = remaining.splice(index, 1);
      order.push(next); at = next.position;
    }
    const head = anchorStart ? [anchorStart.position] : [];
    const tail = mode === "out_and_back" && anchorStart ? [anchorStart.position] : anchorEnd ? [anchorEnd.position] : [];
    return twoOpt(order, head, tail, drive);
  }

  // Classic 2-opt on an open path with fixed head/tail points. Reverses any segment that shortens the run.
  function twoOpt(order, head, tail, drive) {
    const route = order.slice(), points = () => [...head, ...route.map(stop => stop.position), ...tail];
    let improved = true, guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      const base = pathMiles(points(), drive);
      for (let i = 0; i < route.length - 1 && !improved; i++) for (let j = i + 1; j < route.length && !improved; j++) {
        const candidate = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
        const miles = pathMiles([...head, ...candidate.map(stop => stop.position), ...tail], drive);
        if (miles < base - 0.5) { route.splice(0, route.length, ...candidate); improved = true; }
      }
    }
    return route;
  }

  // ---- Criss-cross check -------------------------------------------------------------------
  // Walks the stops in the order they will be played (date order) and flags:
  //  - backtracks: a leg against the tour's overall direction, or a return to a town already played;
  //  - long days: a leg longer than max drive hours on the days available.
  // Compares with the straight order of the same stops and prices the difference.
  function checkRoute({ stops, start = null, mode = "one_way", settings: raw = {}, drive = estimateDrive } = {}) {
    const settings = settingsOf(raw);
    const played = stopsWithPosition(stops).slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const empty = { backtracks: [], longDays: [], straight: played, extra: { miles: 0, hours: 0, cost: 0, hotelNights: 0 }, ok: true, miles: 0, straightMiles: 0 };
    if (played.length < 2) return empty;
    const head = start && validPosition(start.position) ? [start.position] : [];
    const tail = mode === "out_and_back" && head.length ? head : [];
    const actualPoints = [...head, ...played.map(stop => stop.position), ...tail];
    const straight = orderStops({ stops: played, start: head.length ? start : null, mode, drive });
    const straightPoints = [...head, ...straight.map(stop => stop.position), ...tail];

    // Direction: from the first played point to the farthest point of the straight run (one way),
    // or progress = distance from home rising to the turnaround then falling (out and back).
    const refLat = played.reduce((sum, stop) => sum + stop.position[1], 0) / played.length;
    // The far end is whichever end of the straight run lies farther from where the tour starts.
    const ends = [straight[0].position, straight.at(-1).position];
    const farEnd = drive(actualPoints[0], ends[0]).miles > drive(actualPoints[0], ends[1]).miles ? ends[0] : ends[1];
    const origin = flat(actualPoints[0], refLat), far = flat(farEnd, refLat);
    const axis = [far[0] - origin[0], far[1] - origin[1]], axisLength = Math.hypot(axis[0], axis[1]) || 1;
    const along = p => { const q = flat(p, refLat); return ((q[0] - origin[0]) * axis[0] + (q[1] - origin[1]) * axis[1]) / axisLength; };

    const backtracks = [], longDays = [], seen = [];
    const label = stop => stop.city || stop.name || "";
    let previous = head.length ? { position: head[0], city: start.city || start.name || "", date: "" } : null;
    played.forEach(stop => {
      if (previous) {
        const leg = drive(previous.position, stop.position);
        // Two clubs in the same town on back-to-back nights is staying put, not a revisit.
        const sameTown = (a, b) => drive(a, b).miles / ROAD_FACTOR < SAME_TOWN_MILES;
        const revisit = !sameTown(previous.position, stop.position) && seen.find(town => sameTown(town.position, stop.position));
        const backwards = mode !== "out_and_back" && along(stop.position) < along(previous.position) - BACKTRACK_MILES;
        if (revisit || backwards) backtracks.push({ from: label(previous), to: label(stop), miles: round(leg.miles), hours: round(leg.hours, 1), reason: revisit ? "revisit" : "backwards", fromDate: previous.date || "", toDate: stop.date || "" });
        const days = isDate(previous.date) && isDate(stop.date) ? Math.max(1, dayOf(stop.date) - dayOf(previous.date)) : 1;
        if (leg.hours / days > settings.maxDriveHours) longDays.push({ from: label(previous), to: label(stop), hours: round(leg.hours, 1), days, fromDate: previous.date || "", toDate: stop.date || "" });
      }
      seen.push(stop); previous = stop;
    });

    const miles = pathMiles(actualPoints, drive), straightMiles = pathMiles(straightPoints, drive);
    const extraMiles = Math.max(0, miles - straightMiles);
    const nights = points => { let n = 0; for (let i = 1; i < points.length; i++) n += Math.max(0, Math.ceil(drive(points[i - 1], points[i]).hours / settings.maxDriveHours) - 1); return n; };
    const extra = { miles: round(extraMiles), hours: round(extraMiles / AVERAGE_MPH, 1), cost: round(extraMiles * settings.costPerMile), hotelNights: Math.max(0, nights(actualPoints) - nights(straightPoints)) };
    extra.cost = round(extra.cost + extra.hotelNights * settings.hotelNight);
    return { backtracks, longDays, straight, extra, ok: !backtracks.length && !longDays.length, miles: round(miles), straightMiles: round(straightMiles) };
  }

  // ---- Swap suggestions (Tour Manager → Booking Agent) -------------------------------------
  // "If The Crocodile (Seattle) was booked on Fri 13 and Doug Fir (Portland) on Sun 15, you'd save
  // 10 h of driving and $260 in fuel." Tries swapping the dates of every pair of dated stops that are
  // not confirmed, keeps the ones that save driving, biggest saving first.
  function swapSuggestions({ stops, start = null, mode = "one_way", settings: raw = {}, drive = estimateDrive, limit = 3 } = {}) {
    const settings = settingsOf(raw), dated = stopsWithPosition(stops).filter(stop => isDate(stop.date));
    const head = start && validPosition(start.position) ? [start.position] : [], tail = mode === "out_and_back" ? head : [];
    const total = list => pathMiles([...head, ...list.slice().sort((a, b) => a.date.localeCompare(b.date)).map(stop => stop.position), ...tail], drive);
    const base = total(dated), out = [];
    for (let i = 0; i < dated.length; i++) for (let j = i + 1; j < dated.length; j++) {
      const a = dated[i], b = dated[j];
      if (a.state === "confirmed" || b.state === "confirmed" || a.date === b.date) continue;
      const swapped = dated.map(stop => stop === a ? { ...a, date: b.date } : stop === b ? { ...b, date: a.date } : stop);
      const saved = base - total(swapped);
      if (saved < 10) continue;
      out.push({ moves: [{ id: a.id, name: a.name, city: a.city, date: b.date }, { id: b.id, name: b.name, city: b.city, date: a.date }].sort((x, y) => x.date.localeCompare(y.date)), saves: { miles: round(saved), hours: round(saved / AVERAGE_MPH, 1), fuel: round(saved * settings.costPerMile) } });
    }
    return out.sort((x, y) => y.saves.miles - x.saves.miles).slice(0, limit);
  }

  // ---- Line up the asks (Booking Agent) ----------------------------------------------------
  // Orders the selected clubs along one direction and gives each a date to ask for, one after
  // another on the road: next day when the drive fits the day, a travel day when it doesn't, and
  // never on a dark night (default Monday). Each club also gets one alternative date ("or") when
  // there is slack, and only ever sees its own dates.
  function lineUpAsks({ stops, start = null, mode = "one_way", firstDate, settings: raw = {}, drive = estimateDrive } = {}) {
    const settings = settingsOf(raw);
    if (!isDate(firstDate)) return { asks: [], travelDays: 0 };
    const order = orderStops({ stops, start, mode, drive });
    const asks = [];
    let day = dayOf(firstDate), at = start && validPosition(start.position) ? start.position : null, travelDays = 0;
    const skipDark = value => { let d = value, guard = 0; while (settings.darkDays.includes(weekday(d)) && guard++ < 7) d += 1; return d; };
    order.forEach((stop, index) => {
      if (at) {
        const hours = drive(at, stop.position).hours, needed = Math.max(1, Math.ceil(hours / settings.maxDriveHours));
        if (index > 0 || start) { const offset = index === 0 ? needed - 1 : needed; travelDays += Math.max(0, needed - 1); day += offset; }
      }
      day = skipDark(day);
      asks.push({ id: stop.id, name: stop.name, city: stop.city, date: dateOf(day), driveHours: at ? round(drive(at, stop.position).hours, 1) : 0, longDrive: at ? drive(at, stop.position).hours > settings.maxDriveHours : false });
      at = stop.position;
    });
    // One alternative per club inside the slack around it (never another club's night).
    const taken = new Set(asks.map(ask => ask.date));
    asks.forEach((ask, i) => {
      const d = dayOf(ask.date), options = [d + 1, d - 1].filter(c => !taken.has(dateOf(c)) && !settings.darkDays.includes(weekday(c)));
      const prev = asks[i - 1], next = asks[i + 1];
      const fits = c => (!prev || c > dayOf(prev.date)) && (!next || c < dayOf(next.date)) && (i > 0 || c >= dayOf(firstDate));
      const alt = options.find(fits);
      if (alt !== undefined) ask.orDate = dateOf(alt);
    });
    return { asks, travelDays };
  }

  // ---- Clubs along the line ----------------------------------------------------------------
  // How far out of the way a club is from the planned line: the cheapest insertion detour in hours.
  // Above offRouteHours it is "off route (+N h)" and sorts last; on-route clubs sort by position along the line.
  function alongTheLine({ line, clubs, settings: raw = {}, drive = estimateDrive } = {}) {
    const settings = settingsOf(raw), path = stopsWithPosition(line).map(stop => stop.position);
    const candidates = stopsWithPosition(clubs);
    if (!path.length) return candidates.map(club => ({ ...club, detourHours: 0, offRoute: false }));
    const scored = candidates.map(club => {
      let best = Infinity, slot = 0;
      if (path.length === 1) best = 2 * drive(path[0], club.position).hours;
      for (let i = 1; i < path.length; i++) {
        const detour = drive(path[i - 1], club.position).hours + drive(club.position, path[i]).hours - drive(path[i - 1], path[i]).hours;
        if (detour < best) { best = detour; slot = i; }
      }
      if (path.length > 1) {
        const before = drive(club.position, path[0]).hours, after = drive(path.at(-1), club.position).hours;
        if (before < best) { best = before; slot = 0; }
        if (after < best) { best = after; slot = path.length; }
      }
      const detourHours = round(Math.max(0, best), 1);
      return { ...club, detourHours, offRoute: detourHours > settings.offRouteHours, slot };
    });
    return scored.sort((a, b) => (a.offRoute - b.offRoute) || (a.offRoute ? a.detourHours - b.detourHours : a.slot - b.slot || a.detourHours - b.detourHours));
  }

  // ---- Date asks that keep the line straight -----------------------------------------------
  // For each club still open (asked, no date yet), find its confirmed/held/offered neighbours on the
  // straight route and suggest up to two dates between them that the drives allow.
  // "Ask Salem for Thu 12 or Fri 13 — between Portland (Wed 11) and Sacramento (Sat 14)."
  function dateAsks({ stops, start = null, mode = "one_way", settings: raw = {}, drive = estimateDrive } = {}) {
    const settings = settingsOf(raw), order = orderStops({ stops, start, mode, drive });
    const anchored = stop => isDate(stop.date) && ["confirmed", "held", "offered"].includes(stop.state);
    const out = [];
    order.forEach((stop, index) => {
      if (anchored(stop) || stop.state === "declined") return;
      let prev = null, next = null;
      for (let i = index - 1; i >= 0; i--) if (anchored(order[i])) { prev = order[i]; break; }
      for (let i = index + 1; i < order.length; i++) if (anchored(order[i])) { next = order[i]; break; }
      if (!prev && !next) return;
      const daysFrom = other => Math.max(1, Math.ceil(drive(other.position, stop.position).hours / settings.maxDriveHours));
      const taken = new Set(stops.filter(anchored).map(item => item.date));
      const low = prev ? dayOf(prev.date) + daysFrom(prev) : dayOf(next.date) - daysFrom(next) - 1;
      const high = next ? dayOf(next.date) - daysFrom(next) : dayOf(prev.date) + daysFrom(prev) + 1;
      const dates = [];
      for (let d = low; d <= high && dates.length < 2; d++) if (!taken.has(dateOf(d)) && !settings.darkDays.includes(weekday(d))) dates.push(dateOf(d));
      out.push({ id: stop.id, name: stop.name, city: stop.city, dates, between: [prev && { name: prev.name, city: prev.city, date: prev.date }, next && { name: next.name, city: next.city, date: next.date }].filter(Boolean), fits: dates.length > 0 });
    });
    return out;
  }

  const api = { DEFAULTS, settingsOf, estimateDrive, orderStops, checkRoute, swapSuggestions, lineUpAsks, alongTheLine, dateAsks };
  if (typeof window !== "undefined") window.danzstakTourLine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
