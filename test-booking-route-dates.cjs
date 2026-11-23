const assert = require('node:assert/strict');

// Task 07-D: date options + route-aware date picker.
(async () => {
  const route = await import('./infrastructure/auth-api/booking-route-dates.mjs');
  const { planRouteDates, expandWeekday, cleanDateOptions, cleanRouteSettings, estimateDrive, withRoadLegs, checkLegs } = route;

  // Date options: real dates only, unique, sorted, capped.
  assert.deepEqual(cleanDateOptions(['2027-03-04', 'nope', '2027-02-31', '2027-03-04', '2027-03-01']), ['2027-03-01', '2027-03-04']);
  assert.equal(cleanDateOptions(Array.from({ length: 50 }, (_, i) => `2027-01-${String(i % 28 + 1).padStart(2, '0')}`)).length, 28);
  assert.equal(cleanDateOptions(Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10))).length, 30);
  // "Any Thursday in March 2027".
  assert.deepEqual(expandWeekday(4, '2027-03-01', '2027-03-31'), ['2027-03-04', '2027-03-11', '2027-03-18', '2027-03-25']);
  assert.deepEqual(expandWeekday(9, '2027-03-01', '2027-03-31'), []);
  assert.deepEqual(cleanRouteSettings({ maxDriveHours: 99, nightsInARow: 0 }), { maxDriveHours: 6, nightsInARow: 5 });
  assert.deepEqual(cleanRouteSettings({ maxDriveHours: '8', nightsInARow: 3 }), { maxDriveHours: 8, nightsInARow: 3 });

  // Sacramento home; clubs up the I-5 / I-80 corridor.
  const home = { name: 'Sacramento, CA', position: [-121.49, 38.58] };
  const venue = (key, name, position, status, extra = {}) => ({ venueKey: key, name, position, booking: { status, ...extra } });
  const reno = venue('reno', 'Reno Room', [-119.81, 39.53], 'Date proposed', { showDate: '2027-03-05', dateOptions: ['2027-03-02', '2027-03-05'], pipeline: { repliedAt: '2026-11-01' } });
  const sf = venue('sf', 'SF Basement', [-122.42, 37.77], 'Reply received', { dateOptions: ['2027-03-02', '2027-03-03'], pipeline: { repliedAt: '2026-11-03' } });
  const oak = venue('oak', 'Oakland Hall', [-122.27, 37.80], 'Confirmed', { showDate: '2027-03-03', confirmationEvidence: 'Yes' });
  const pdx = venue('pdx', 'Portland Pit', [-122.68, 45.52], 'Interested', { dateOptions: ['2027-03-04'], pipeline: { repliedAt: '2026-11-02' } });
  const window = { start: '2027-03-01', end: '2027-03-10' };
  const result = planRouteDates({ home, window, venues: [reno, sf, oak, pdx] });
  const byKey = Object.fromEntries(result.plan.map(stop => [stop.venueKey, stop.date]));
  assert.equal(byKey.oak, '2027-03-03', 'a confirmed show keeps its date');
  assert.equal(byKey.sf, '2027-03-02', 'SF takes its other option because Oakland has the 3rd');
  assert.ok(byKey.reno, 'Reno is placed on one of its options');
  assert.ok(['2027-03-02', '2027-03-05'].includes(byKey.reno) && byKey.reno !== byKey.sf);
  assert.equal(byKey.pdx, undefined, 'Portland the day after Oakland is a ~10 h drive');
  assert.match(result.unplaced.find(item => item.venueKey === 'pdx').reason, /Too far: about \d+(\.\d)? h from .*more than 6 h a day/);
  assert.deepEqual(result.plan.map(stop => stop.date), [...result.plan.map(stop => stop.date)].sort(), 'plan is in date order');
  assert.equal(result.totals.estimated, true);
  assert.ok(result.totals.miles <= result.totals.baselineMiles || result.totals.shows > result.totals.baselineShows);
  // Raising the drive limit to 14 h lets Portland in (Oakland to Portland is about 13 h).
  const relaxed = planRouteDates({ home, window, venues: [reno, sf, oak, pdx], settings: { maxDriveHours: 14 } });
  assert.ok(relaxed.plan.some(stop => stop.venueKey === 'pdx'), 'a longer drive day lets Portland fit');

  // Errors and edges.
  assert.match(planRouteDates({ home, window: { start: '', end: '' }, venues: [] }).error, /departure and return dates/);
  const noDates = planRouteDates({ home, window, venues: [venue('x', 'No Dates Club', [-121.5, 38.6], 'Reply received')] });
  assert.equal(noDates.unplaced[0].reason, 'No dates offered yet.');
  const outside = planRouteDates({ home, window, venues: [venue('x', 'Late Club', [-121.5, 38.6], 'Reply received', { dateOptions: ['2027-05-01'] })] });
  assert.match(outside.unplaced[0].reason, /outside your tour window/);
  const clash = planRouteDates({ home, window, venues: [oak, venue('x', 'Clash Club', [-122.3, 37.8], 'Reply received', { dateOptions: ['2027-03-03'] })] });
  assert.equal(clash.unplaced[0].reason, 'Same night as Oakland Hall (2027-03-03).');
  const noMap = planRouteDates({ home, window, venues: [{ venueKey: 'm', name: 'Mystery', booking: { status: 'Reply received', dateOptions: ['2027-03-02'] } }] });
  assert.equal(noMap.unplaced[0].reason, 'No map location saved for this venue.');
  // Two confirmed shows that already break a rule are flagged, and never block other dates.
  const farA = venue('fa', 'Far A', [-122.42, 37.77], 'Confirmed', { showDate: '2027-03-02' });
  const farB = venue('fb', 'Far B', [-122.68, 45.52], 'Confirmed', { showDate: '2027-03-03' });
  const flagged = planRouteDates({ home, window, venues: [farA, farB, venue('n', 'Near Home', [-121.4, 38.6], 'Reply received', { dateOptions: ['2027-03-07'] })] });
  assert.ok(flagged.conflicts.some(item => item.kind === 'long_drive' && /Far B/.test(item.text)), 'a 10 h back-to-back drive is a conflict');
  assert.ok(flagged.plan.some(stop => stop.venueKey === 'n'), 'existing conflicts never block another date');
  // Gaps of 2+ open nights are suggested for more pitching.
  assert.ok(flagged.gaps.some(gap => gap.after === 'Far B' && gap.before === 'Near Home' && gap.nights === 3));

  // Real road legs replace estimates and re-check the limits.
  const road = withRoadLegs(result, [...result.plan.map(() => ({ miles: 100, hours: 9 })), { miles: 100, hours: 2 }]);
  assert.equal(road.totals.estimated, false);
  assert.equal(road.totals.miles, (result.plan.length + 1) * 100);
  assert.ok(road.conflicts.some(item => item.kind === 'long_drive'), 'a 9 h real drive is flagged');
  assert.equal(withRoadLegs(result, [{ miles: 1, hours: 1 }]), result, 'wrong number of legs keeps the estimate');

  // Randomised: every rule from the spec holds, and the plan is never worse than first-come.
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 200; trial += 1) {
    const settings = { maxDriveHours: 3 + Math.floor(rand() * 6), nightsInARow: 2 + Math.floor(rand() * 4) };
    const count = 3 + Math.floor(rand() * 12), venues = [];
    for (let i = 0; i < count; i += 1) {
      const position = [-123 + rand() * 6, 35 + rand() * 8], options = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => `2027-04-${String(1 + Math.floor(rand() * 20)).padStart(2, '0')}`);
      const confirmed = rand() < 0.15;
      venues.push(venue(`v${i}`, `Club ${i}`, position, confirmed ? 'Confirmed' : 'Reply received', confirmed ? { showDate: options[0] } : { dateOptions: options, pipeline: { repliedAt: `2026-11-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}` } }));
    }
    const out = planRouteDates({ home, window: { start: '2027-04-01', end: '2027-04-20' }, venues, settings });
    const nights = out.plan.map(stop => stop.date), flexible = out.plan.filter(stop => !stop.fixed);
    for (const confirmed of venues.filter(v => v.booking.status === 'Confirmed')) assert.ok(out.plan.some(stop => stop.venueKey === confirmed.venueKey && stop.date === confirmed.booking.showDate), 'confirmed shows stay');
    const confirmedNights = venues.filter(v => v.booking.status === 'Confirmed').map(v => v.booking.showDate);
    assert.equal(new Set(flexible.map(stop => stop.date)).size, flexible.length, 'never double-books a night');
    for (const stop of flexible) {
      assert.ok(!confirmedNights.includes(stop.date), 'never books over a confirmed show');
      assert.ok(cleanDateOptions(venues.find(v => v.venueKey === stop.venueKey).booking.dateOptions).includes(stop.date), 'respects date options');
    }
    out.plan.forEach((stop, index) => {
      if (stop.fixed) return;
      const previous = out.plan[index - 1], next = out.plan[index + 1];
      const days = previous ? Date.parse(stop.date) / 864e5 - Date.parse(previous.date) / 864e5 : Date.parse(stop.date) / 864e5 - Date.parse('2027-04-01') / 864e5 + 1;
      assert.ok(stop.driveHours <= settings.maxDriveHours * days + 0.11, `drive into ${stop.name} within the daily limit`);
      if (next) assert.ok(estimateDrive(stop.position, next.position).hours <= settings.maxDriveHours * (Date.parse(next.date) - Date.parse(stop.date)) / 864e5 + 1e-6, 'drive out within the daily limit');
      let run = 1, i = index;
      while (out.plan[i - 1] && Date.parse(out.plan[i].date) - Date.parse(out.plan[i - 1].date) === 864e5) { run += 1; i -= 1; }
      i = index;
      while (out.plan[i + 1] && Date.parse(out.plan[i + 1].date) - Date.parse(out.plan[i].date) === 864e5) { run += 1; i += 1; }
      assert.ok(run <= settings.nightsInARow, `a day off after ${settings.nightsInARow} nights in a row`);
    });
    assert.ok(out.totals.shows >= out.totals.baselineShows, 'books at least as many shows as first-come');
    if (out.totals.shows === out.totals.baselineShows) assert.ok(out.totals.miles <= out.totals.baselineMiles + 0.05, 'total miles <= order-of-replies baseline');
    assert.equal(nights.length, out.plan.length);
  }
  assert.ok(checkLegs([], [], '2027-04-01', cleanRouteSettings()).conflicts.length === 0);

  // Wiring: saved date options, venue date offers join the options, the API suggests only.
  const fs = require('node:fs');
  const api = fs.readFileSync('infrastructure/auth-api/index.mjs', 'utf8'), billing = fs.readFileSync('infrastructure/auth-api/tour-manager-billing.mjs', 'utf8');
  assert.match(api, /dateOptions: cleanDateOptions\(b\.dateOptions\)/, 'workspace save keeps clean date options');
  assert.match(api, /if \(data\?\.action === "route_dates"\) return await bookingRouteDates\(userId, data, reply\);/, 'route dates ride the existing POST /booking-pipeline route');
  assert.match(api, /LegAdditionalFeatures: \["Summary"\]/, 'real road legs come from CalculateRoutes');
  assert.doesNotMatch(api, /CalculateRouteMatrix/, 'no route matrix: the Lambda role only allows CalculateRoutes');
  const routeEnd = api.indexOf('// Accept a date (task 07-E)') > 0 ? api.indexOf('// Accept a date (task 07-E)') : api.indexOf('// Booking sends are the real events'), handler = api.slice(api.indexOf('async function bookingRouteDates'), routeEnd);
  assert.doesNotMatch(handler, /PutItemCommand|UpdateItemCommand|TransactWriteItemsCommand|SendEmail/, 'the picker suggests only: it never saves or sends');
  assert.ok(billing.includes('venue.booking.dateOptions : []), proposedDate])'), 'a venue date offer joins its date options');
  const html = fs.readFileSync('booking-selections.html', 'utf8'), js = fs.readFileSync('assets/booking-selections.js', 'utf8');
  assert.match(html, /<section class="route-dates"[^>]*hidden>/);
  for (const id of ['routeDatesForm', 'routeHome', 'routeMaxDrive', 'routeNights', 'routeDatesResult']) assert.ok(html.includes(`id="${id}"`), `${id} present`);
  assert.match(html, /nothing is saved or sent until you accept/);
  assert.match(js, /action: "route_dates"/);
  assert.match(js, /Save to your account first so the picker uses your latest dates/);
  assert.match(js, /function weekdayDates\(weekday, from, to\)/);
  console.log('Booking route date picker tests passed.');
})().catch(error => { console.error(error); process.exit(1); });
