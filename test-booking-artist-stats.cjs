const assert = require('node:assert/strict');
const fs = require('node:fs');

// Task 07-C: artist stats — pitched, delivered, EPK opened, replied, booked.
(async () => {
  const { pitchStats } = await import('./infrastructure/auth-api/booking-pipeline.mjs');
  const send = (id, venueKey, status, extra = {}) => ({ tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${id}` }, venueKey: { S: venueKey }, status: { S: status }, ...extra });
  const sends = [
    send('a1', 'v1', 'delivered'),
    send('a2', 'v2', 'replied', { repliedAt: { S: '2026-11-10T10:00:00Z' } }),
    send('a3', 'v3', 'bounced'),
    send('a4', 'v4', 'sent'),
    send('a5', 'v5', 'replied', { repliedAt: { S: '2026-11-11T10:00:00Z' } }),
    send('f1', 'v1', 'delivered', { followUpTo: { S: 'a1' } }),   // follow-up: not a new pitch
    send('r1', 'v6', 'reserved'),                                    // never sent
    send('x1', 'v7', 'failed')                                       // never sent
  ];
  const venues = [
    { venueKey: 'v2', booking: { status: 'Confirmed' } },
    { venueKey: 'v5', booking: { status: 'Played' } },
    { venueKey: 'v1', booking: { status: 'Email sent' } },
    { venueKey: 'v9', booking: { status: 'Confirmed' } }               // booked without a DanzStak pitch: not counted
  ];
  const stats = pitchStats(sends, new Set(['a1', 'a2', 'f1', 'zz']), venues);
  assert.deepEqual(stats, { sent: 5, delivered: 3, bounced: 1, opened: 2, replied: 2, booked: 2, replyRate: 40, bookedRate: 40 });

  // No pitches: zero counts, no made-up rates.
  assert.deepEqual(pitchStats([], new Set(), venues), { sent: 0, delivered: 0, bounced: 0, opened: 0, replied: 0, booked: 0, replyRate: null, bookedRate: null });
  // A reply implies delivery even if the SES delivery event never arrived.
  assert.equal(pitchStats([send('b1', 'v1', 'sent', { repliedAt: { S: '2026-11-12T00:00:00Z' } })]).delivered, 1);

  // The API returns stats with the workspace; EPK-open read failures hide only that number.
  const api = fs.readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
  assert.match(api, /import \{[^}]*pitchStats[^}]*\} from "\.\/booking-pipeline\.mjs"/);
  assert.equal((api.match(/stats: withOpens\(pitchStats\(sends, opened \|\| new Set\(\), (\[\]|venues)\), opened\)/g) || []).length, 2, 'both GET paths return stats');
  assert.match(api, /const withOpens = \(stats, opened\) => opened \? stats : \{ \.\.\.stats, opened: null \}/);

  // The board shows the panel only after the first pitch, with honest labels.
  const html = fs.readFileSync('booking-selections.html', 'utf8'), js = fs.readFileSync('assets/booking-selections.js', 'utf8');
  for (const id of ['psSent', 'psDelivered', 'psOpened', 'psReplied', 'psBooked', 'pitchStatsRates']) assert.ok(html.includes(`id="${id}"`), `${id} present`);
  assert.match(html, /<section class="pitch-stats"[^>]*hidden>/);
  assert.match(html, /email opens aren't tracked/);
  assert.match(js, /panel\.hidden = !stats/);
  assert.match(js, /% reply rate/);
  console.log('Booking artist stats tests passed.');
})().catch(error => { console.error(error); process.exit(1); });
