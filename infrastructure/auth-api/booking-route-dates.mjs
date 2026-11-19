// Route-aware date picker (task 07-D). Pure functions: no AWS calls here.
// Given home base, tour window, confirmed shows and each venue's date options, pick dates
// that minimise total driving while respecting max drive per day and a day off after N
// nights in a row. Never double-books a night. Ordering uses straight-line distance with a
// road factor; index.mjs then checks the chosen order against real road legs (checkLegs).

export const MAX_DATE_OPTIONS = 30;
export const MAX_ROUTE_STOPS = 40;
export const ROUTE_DEFAULTS = { maxDriveHours: 6, nightsInARow: 5 };
const ROAD_FACTOR = 1.2, AVERAGE_MPH = 50, DAY_MS = 86400000;

const isDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const dayOf = value => Math.round(Date.parse(`${value}T00:00:00Z`) / DAY_MS);
const dateOf = day => new Date(day * DAY_MS).toISOString().slice(0, 10);
const round1 = value => Math.round(value * 10) / 10;

// Clean a venue's date options: real dates, unique, sorted, at most 30.
export function cleanDateOptions(value) {
  return Array.isArray(value) ? [...new Set(value.filter(isDate))].sort().slice(0, MAX_DATE_OPTIONS) : [];
}

// "Any Thursday from Mar 1 to Mar 31": weekday 0 (Sun) - 6 (Sat), inclusive range, at most 30 dates.
export function expandWeekday(weekday, from, to) {
  if (!isDate(from) || !isDate(to) || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return [];
  const dates = [];
  for (let day = dayOf(from); day <= dayOf(to) && dates.length < MAX_DATE_OPTIONS; day += 1) if (new Date(day * DAY_MS).getUTCDay() === weekday) dates.push(dateOf(day));
  return dates;
}

export function cleanRouteSettings(value = {}) {
  const hours = Number(value.maxDriveHours), nights = Number(value.nightsInARow);
  return {
    maxDriveHours: Number.isFinite(hours) && hours >= 1 && hours <= 16 ? round1(hours) : ROUTE_DEFAULTS.maxDriveHours,
    nightsInARow: Number.isInteger(nights) && nights >= 1 && nights <= 14 ? nights : ROUTE_DEFAULTS.nightsInARow
  };
}

// Straight-line miles x road factor, at an average road speed. Positions are [lng, lat].
export function estimateDrive(a, b) {
  const rad = degrees => degrees * Math.PI / 180, [lng1, lat1] = a, [lng2, lat2] = b;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  const miles = 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h))) * ROAD_FACTOR;
  return { miles, hours: miles / AVERAGE_MPH };
}

// Days available to drive into a stop: leaving home on the first tour day counts, then one
// day per night between shows.
function travelDays(previous, stop, startDay) { return previous ? stop.day - previous.day : stop.day - startDay + 1; }

function routeMiles(home, stops, drive) {
  let miles = 0, at = home.position;
  for (const stop of stops) { miles += drive(at, stop.position).miles; at = stop.position; }
  return stops.length ? miles + drive(at, home.position).miles : 0;
}

// First rule the added stop breaks in a date-sorted schedule, or "" when it fits. Only the
// legs into and out of that stop and its run of nights are checked, so a confirmed show that
// already breaks a rule (flagged as a conflict) never blocks other dates.
function problem(home, stops, added, startDay, settings, drive) {
  const index = stops.indexOf(added), previous = stops[index - 1], next = stops[index + 1];
  if ((previous && previous.day === added.day) || (next && next.day === added.day)) return "night";
  if (added.day < startDay) return "window";
  if (drive(previous ? previous.position : home.position, added.position).hours > settings.maxDriveHours * travelDays(previous, added, startDay)) return "drive";
  if (next && drive(added.position, next.position).hours > settings.maxDriveHours * (next.day - added.day)) return "drive";
  let first = index, last = index;
  while (first > 0 && stops[first - 1].day === stops[first].day - 1) first -= 1;
  while (last < stops.length - 1 && stops[last + 1].day === stops[last].day + 1) last += 1;
  return last - first + 1 > settings.nightsInARow ? "rest" : "";
}

const insertSorted = (stops, stop) => [...stops, stop].sort((a, b) => a.day - b.day);

function bestInsertion(home, stops, venue, startDay, endDay, settings, drive) {
  const base = routeMiles(home, stops, drive);
  let best = null;
  for (const option of venue.options) {
    const day = dayOf(option);
    if (day < startDay || day > endDay) continue;
    const stop = { ...venue, day, date: option }, next = insertSorted(stops, stop);
    if (problem(home, next, stop, startDay, settings, drive)) continue;
    const added = routeMiles(home, next, drive) - base;
    if (!best || added < best.added - 1e-9) best = { stops: next, added };
  }
  return best;
}

// Greedy cheapest insertion, then relocate passes. Returns a date-sorted schedule.
function optimise(home, fixed, flexible, startDay, endDay, settings, drive) {
  let stops = [...fixed].sort((a, b) => a.day - b.day), pending = [...flexible];
  const fill = () => {
    for (;;) {
      let choice = null;
      for (const venue of pending) {
        const found = bestInsertion(home, stops, venue, startDay, endDay, settings, drive);
        if (found && (!choice || found.added < choice.found.added - 1e-9)) choice = { venue, found };
      }
      if (!choice) return;
      stops = choice.found.stops; pending = pending.filter(venue => venue !== choice.venue);
    }
  };
  fill();
  for (let pass = 0; pass < 25; pass += 1) {
    let improved = false;
    for (const stop of stops.filter(item => !item.fixed)) {
      const without = stops.filter(item => item !== stop), current = routeMiles(home, stops, drive);
      const found = bestInsertion(home, without, stop, startDay, endDay, settings, drive);
      if (found && routeMiles(home, found.stops, drive) < current - 0.5) { stops = found.stops; improved = true; }
    }
    // Swap the dates of two flexible stops when both still fit their own options.
    const flex = stops.filter(item => !item.fixed);
    swaps: for (let i = 0; i < flex.length; i += 1) for (let j = i + 1; j < flex.length; j += 1) {
      const a = flex[i], b = flex[j];
      if (!a.options.includes(b.date) || !b.options.includes(a.date)) continue;
      const movedA = { ...a, day: b.day, date: b.date }, movedB = { ...b, day: a.day, date: a.date };
      const swapped = stops.map(item => item === a ? movedA : item === b ? movedB : item).sort((x, y) => x.day - y.day);
      if (!problem(home, swapped, movedA, startDay, settings, drive) && !problem(home, swapped, movedB, startDay, settings, drive) && routeMiles(home, swapped, drive) < routeMiles(home, stops, drive) - 0.5) { stops = swapped; improved = true; break swaps; }
    }
    if (improved) { pending = flexible.filter(venue => !stops.some(stop => stop.venueKey === venue.venueKey)); fill(); }
    else break;
  }
  return stops;
}

// What you'd get taking dates first-come: venues in the order they replied, each on its
// earliest option that still fits.
function firstCome(home, fixed, flexible, startDay, endDay, settings, drive) {
  let stops = [...fixed].sort((a, b) => a.day - b.day);
  for (const venue of [...flexible].sort((a, b) => String(a.repliedAt || "9").localeCompare(String(b.repliedAt || "9")))) {
    for (const option of venue.options) {
      const day = dayOf(option);
      if (day < startDay || day > endDay) continue;
      const stop = { ...venue, day, date: option }, next = insertSorted(stops, stop);
      if (!problem(home, next, stop, startDay, settings, drive)) { stops = next; break; }
    }
  }
  return stops;
}

function unplacedReason(home, stops, venue, startDay, endDay, settings, drive) {
  const inWindow = venue.options.filter(option => dayOf(option) >= startDay && dayOf(option) <= endDay);
  if (!venue.options.length) return "No dates offered yet.";
  if (!inWindow.length) return "The dates they offered are outside your tour window.";
  const taken = inWindow.filter(option => stops.some(stop => stop.date === option));
  if (taken.length === inWindow.length) {
    const other = stops.find(stop => stop.date === inWindow[0]);
    return `Same night as ${other.name} (${inWindow[0]}).`;
  }
  let worst = null;
  for (const option of inWindow.filter(item => !taken.includes(item))) {
    const stop = { ...venue, day: dayOf(option), date: option }, next = insertSorted(stops, stop), kind = problem(home, next, stop, startDay, settings, drive);
    if (kind === "drive") {
      const index = next.indexOf(stop), neighbour = next[index - 1] || next[index + 1], hours = drive(neighbour ? neighbour.position : home.position, venue.position).hours;
      if (!worst || hours < worst.hours) worst = { hours, from: neighbour ? neighbour.name : "home" };
    }
    if (kind === "rest") return `Every date they offered would make more than ${settings.nightsInARow} nights in a row.`;
  }
  return worst ? `Too far: about ${round1(worst.hours)} h from ${worst.from}, more than ${settings.maxDriveHours} h a day.` : "It doesn't fit the route with the other dates.";
}

function legsOf(home, stops, drive) {
  const legs = [];
  let at = home;
  for (const stop of [...stops, null]) {
    const to = stop || home, leg = drive(at.position, to.position);
    legs.push({ from: at.name || "Home", to: stop ? stop.name : "Home", miles: round1(leg.miles), hours: round1(leg.hours) });
    if (!stop) break;
    at = stop;
  }
  return legs;
}

// Conflicts and gaps for a date-sorted schedule with per-leg hours (estimated or real).
export function checkLegs(stops, legs, startDate, settings) {
  const conflicts = [], gaps = [], startDay = dayOf(startDate);
  stops.forEach((stop, index) => {
    const previous = stops[index - 1], days = previous ? dayOf(stop.date) - dayOf(previous.date) : dayOf(stop.date) - startDay + 1, leg = legs[index];
    if (previous && previous.date === stop.date) conflicts.push({ kind: "same_night", text: `${previous.name} and ${stop.name} both want ${stop.date}.` });
    else if (leg && leg.hours > settings.maxDriveHours * Math.max(1, days)) conflicts.push({ kind: "long_drive", text: `${round1(leg.hours)} h drive from ${leg.from} to ${stop.name}${days <= 1 ? " the day of the show" : ` in ${days} days`}.` });
    if (previous) {
      const nights = dayOf(stop.date) - dayOf(previous.date) - 1;
      if (nights >= 2) gaps.push({ after: previous.name, before: stop.name, from: dateOf(dayOf(previous.date) + 1), to: dateOf(dayOf(stop.date) - 1), nights, near: [(previous.position[0] + stop.position[0]) / 2, (previous.position[1] + stop.position[1]) / 2] });
    }
  });
  return { conflicts, gaps };
}

// venues: workspace venues (with booking.status, booking.showDate, booking.dateOptions,
// booking.pipeline.repliedAt, position). home: { name, position }. window: { start, end }.
export function planRouteDates({ home, window, venues = [], settings: rawSettings = {}, drive = estimateDrive }) {
  const settings = cleanRouteSettings(rawSettings);
  if (!home || !Array.isArray(home.position) || !isDate(window?.start) || !isDate(window?.end) || window.end < window.start) return { error: "Add your tour's departure and return dates and a home base first." };
  const startDay = dayOf(window.start), endDay = dayOf(window.end);
  const located = venues.filter(venue => Array.isArray(venue?.position) && venue.position.length === 2 && venue.position.every(Number.isFinite));
  const stage = venue => String(venue?.booking?.status || "");
  const fixed = located.filter(venue => stage(venue) === "Confirmed" && isDate(venue.booking.showDate) && dayOf(venue.booking.showDate) >= startDay && dayOf(venue.booking.showDate) <= endDay)
    .map(venue => ({ venueKey: venue.venueKey, name: venue.name, position: venue.position, day: dayOf(venue.booking.showDate), date: venue.booking.showDate, options: [venue.booking.showDate], fixed: true, repliedAt: venue.booking.pipeline?.repliedAt || "" }));
  const open = ["Reply received", "Interested", "Negotiating", "Date proposed"];
  const candidates = located.filter(venue => open.includes(stage(venue)))
    .map(venue => ({ venueKey: venue.venueKey, name: venue.name, position: venue.position, options: cleanDateOptions([...(venue.booking.dateOptions || []), ...(stage(venue) === "Date proposed" && isDate(venue.booking.showDate) ? [venue.booking.showDate] : [])]), fixed: false, repliedAt: venue.booking.pipeline?.repliedAt || "" }));
  if (fixed.length + candidates.length > MAX_ROUTE_STOPS) return { error: `Plan up to ${MAX_ROUTE_STOPS} venues at a time.` };
  const missingPosition = venues.filter(venue => [...open, "Confirmed"].includes(stage(venue)) && !located.includes(venue)).map(venue => ({ venueKey: venue.venueKey, name: venue.name, reason: "No map location saved for this venue." }));

  const optimised = optimise(home, fixed, candidates, startDay, endDay, settings, drive), baseline = firstCome(home, fixed, candidates, startDay, endDay, settings, drive);
  const miles = stops => routeMiles(home, stops, drive);
  // Never worse than first-come: more shows wins, then fewer miles.
  const chosen = baseline.length > optimised.length || (baseline.length === optimised.length && miles(baseline) < miles(optimised)) ? baseline : optimised;
  const unplaced = [...candidates.filter(venue => !chosen.some(stop => stop.venueKey === venue.venueKey)).map(venue => ({ venueKey: venue.venueKey, name: venue.name, reason: unplacedReason(home, chosen, venue, startDay, endDay, settings, drive) })), ...missingPosition];
  const legs = legsOf(home, chosen, drive), { conflicts, gaps } = checkLegs(chosen, legs, window.start, settings);
  const total = miles(chosen), baselineMiles = miles(baseline);
  return {
    settings,
    window: { start: window.start, end: window.end },
    home: { name: home.name || "Home", position: home.position },
    plan: chosen.map((stop, index) => ({ venueKey: stop.venueKey, name: stop.name, date: stop.date, fixed: stop.fixed, position: stop.position, driveMiles: legs[index].miles, driveHours: legs[index].hours })),
    returnLeg: legs.at(-1) || null,
    unplaced, conflicts, gaps,
    totals: { shows: chosen.length, miles: round1(total), hours: round1(legs.reduce((sum, leg) => sum + leg.hours, 0)), baselineShows: baseline.length, baselineMiles: round1(baselineMiles), savedMiles: baseline.length === chosen.length ? round1(Math.max(0, baselineMiles - total)) : 0, estimated: true }
  };
}

// Swap estimated legs for real road legs (miles, hours) from AWS Location, then re-check.
export function withRoadLegs(result, roadLegs) {
  if (!result?.plan || !Array.isArray(roadLegs) || roadLegs.length !== result.plan.length + 1 || !roadLegs.every(leg => Number.isFinite(leg?.miles) && Number.isFinite(leg?.hours))) return result;
  const plan = result.plan.map((stop, index) => ({ ...stop, driveMiles: round1(roadLegs[index].miles), driveHours: round1(roadLegs[index].hours) }));
  const legs = roadLegs.map((leg, index) => ({ from: index ? plan[index - 1].name : result.home.name, to: plan[index]?.name || "Home", miles: round1(leg.miles), hours: round1(leg.hours) }));
  const { conflicts, gaps } = checkLegs(plan, legs, result.window.start, result.settings);
  return { ...result, plan, returnLeg: legs.at(-1), conflicts, gaps, totals: { ...result.totals, miles: round1(legs.reduce((sum, leg) => sum + leg.miles, 0)), hours: round1(legs.reduce((sum, leg) => sum + leg.hours, 0)), estimated: false } };
}
