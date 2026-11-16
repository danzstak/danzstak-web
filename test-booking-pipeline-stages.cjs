const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const server = await import('./infrastructure/auth-api/booking-pipeline.mjs');
  const browser = require('./assets/booking-pipeline.js');

  // One rule set: the browser copy must match the server module exactly.
  for (const key of ['BOOKING_STATUSES', 'PIPELINE_STAGES', 'STAGE_BY_STATUS', 'NEXT_STAGES']) assert.deepEqual(browser[key], server[key], `${key} drifted between assets/booking-pipeline.js and booking-pipeline.mjs`);
  assert.deepEqual(Object.keys(browser.STAGE_LABELS), server.PIPELINE_STAGES);
  for (const status of server.BOOKING_STATUSES) assert.ok(server.PIPELINE_STAGES.includes(server.stageOf(status)), `${status} maps to a pipeline stage`);
  const indexSource = fs.readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
  assert.deepEqual(JSON.parse(indexSource.match(/const bookingPipelineStatuses = new Set\((\[[^\]]+\])\)/)[1]), server.BOOKING_STATUSES, 'workspace save accepts exactly the pipeline statuses');
  assert.deepEqual(server.PIPELINE_STAGES, ['found', 'pitched', 'replied', 'offer', 'confirmed', 'played', 'passed', 'no_reply']);

  // Transitions only from allowed states.
  const today = '2026-11-16';
  assert.ok(server.canMove('Not contacted', 'Email sent'));
  assert.ok(server.canMove('Email sent', 'Reply received'));
  assert.ok(server.canMove('Reply received', 'Date proposed'));
  assert.ok(server.canMove('Date proposed', 'Confirmed'));
  assert.ok(server.canMove('Date proposed', 'Negotiating'), 'an offer can go back to talking terms');
  assert.ok(!server.canMove('Confirmed', 'Date proposed'), 'a confirmed show cannot slide back to an offer');
  assert.ok(!server.canMove('Confirmed', 'Not contacted'));
  assert.ok(!server.canMove('Reply received', 'Email sent'), 'a reply cannot be undone');
  assert.ok(!server.canMove('Declined', 'Interested'), 'passed is final; add the venue again for a fresh pitch');
  assert.ok(!server.canMove('Played', 'Confirmed'));
  assert.ok(!server.canMove('Email sent', 'Made up'));
  assert.ok(!server.canMove('Confirmed', 'Played', { showDate: '2026-12-01', today }), 'played only after the show date');
  assert.ok(server.canMove('Confirmed', 'Played', { showDate: '2026-11-15', today }));
  assert.ok(server.canMove('Confirmed', 'Declined'), 'a cancelled show can be marked passed');

  // The card offers one step at a time.
  assert.deepEqual(browser.nextStatuses('Not contacted'), ['Not contacted', 'Email prepared', 'Email sent']);
  assert.ok(!browser.nextStatuses('Email sent').includes('Confirmed'), 'no skipping from pitched to confirmed on the card');
  assert.ok(!browser.nextStatuses('Confirmed', { showDate: '2026-12-01', today }).includes('Played'));
  assert.ok(browser.nextStatuses('Confirmed', { showDate: '2026-11-01', today }).includes('Played'));
  assert.deepEqual(browser.nextStatuses('Declined'), ['Declined']);

  // Status changes come from real events: a send marks pitched; an inbound reply marks replied and links the thread.
  const send = (id, fields) => ({ tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${id}` }, venueKey: { S: 'venue-a' }, ...fields });
  let events = server.venueEvents([send('restoredpitch000001', { status: { S: 'restored' }, createdAt: { S: '2026-11-01T00:00:00Z' } })]);
  assert.equal(events.size, 0, 'a failed send that restored the credit is not a pitch');
  events = server.venueEvents([send('initialpitch0000001', { status: { S: 'sent' }, sentAt: { S: '2026-11-01T10:00:00.000Z' } })]);
  assert.equal(server.floorStatus('Not contacted', events.get('venue-a')), 'Email sent');
  assert.equal(server.floorStatus('Confirmed', events.get('venue-a')), 'Confirmed', 'events never move a card backwards');
  events = server.venueEvents([
    send('initialpitch0000001', { status: { S: 'replied' }, sentAt: { S: '2026-11-01T10:00:00.000Z' }, repliedAt: { S: '2026-11-02T08:00:00.000Z' } }),
    send('followup00000000001', { status: { S: 'sent' }, sentAt: { S: '2026-11-07T10:00:00.000Z' }, followUpTo: { S: 'initialpitch0000001' } })
  ]);
  const venue = { venueKey: 'venue-a', booking: { status: 'Email sent' } };
  server.withPipeline([venue], events);
  assert.equal(venue.booking.status, 'Reply received');
  assert.equal(venue.booking.pipeline.threadId, 'initialpitch0000001', 'the thread is the initial pitch, not the follow-up');
  assert.equal(venue.booking.pipeline.stage, 'replied');

  // Follow-up: only after 5 days, never earlier than that even if the artist typed an earlier date.
  assert.equal(server.followUpDate('', '2026-11-01T10:00:00.000Z'), '2026-11-06');
  assert.equal(server.followUpDate('2026-11-02', '2026-11-01T10:00:00.000Z'), '2026-11-06');
  assert.equal(server.followUpDate('2026-11-20', '2026-11-01T10:00:00.000Z'), '2026-11-20');
  assert.equal(server.followUpDate('2026-11-20', ''), '2026-11-20');
  const sentAt = '2026-11-01T10:00:00.000Z', day = 86400000;
  assert.ok(!server.followUpEligible(sentAt, Date.parse(sentAt) + 5 * day - 1));
  assert.ok(server.followUpEligible(sentAt, Date.parse(sentAt) + 5 * day));
  assert.ok(!server.followUpEligible('', Date.now()));

  // EPK gate: name, photo, bio, music link, live video or photo, contact, and published.
  const epkItem = (kit, published = true) => ({ plan: { S: JSON.stringify(kit) }, published: { BOOL: published } });
  const ready = { artistName: 'Static', heroImage: 'https://danzstak.com/a.jpg', shortBio: 'Loud.', musicLinks: [{ label: 'Bandcamp', url: 'https://x.bandcamp.com' }], videoLinks: [{ label: 'Live', url: 'https://youtu.be/x' }], bookingEmail: 'b@example.com' };
  assert.deepEqual(server.epkGate(epkItem(ready)), { ready: true, published: true, done: 6, total: 6, missing: [] });
  assert.equal(server.epkGate(undefined).ready, false, 'no EPK, no pitches');
  assert.deepEqual(server.epkGate(undefined).missing, server.EPK_REQUIREMENTS.map(([, label]) => label));
  assert.equal(server.epkGate(epkItem(ready, false)).ready, false, 'a complete but unpublished EPK cannot pitch');
  assert.match(server.epkGateMessage(server.epkGate(epkItem(ready, false))), /6 of 6 done[\s\S]*Publish your EPK/);
  const noLive = { ...ready, videoLinks: [] };
  assert.deepEqual(server.epkGate(epkItem(noLive)).missing, ['A live video or photo']);
  assert.equal(server.epkGate(epkItem({ ...noLive, media: [{ role: 'press-photo', key: 'epk/x/y.jpg' }] })).ready, true, 'a second photo counts as the live photo');
  assert.deepEqual(server.epkGate(epkItem({ ...ready, heroImage: '', videoLinks: [] })).missing, ['A photo', 'A live video or photo']);
  assert.deepEqual(server.epkGate(epkItem({ ...ready, musicLinks: [{ label: 'Bad', url: 'javascript:alert(1)' }] })).missing, ['A music link']);
  assert.equal(server.epkGate(epkItem({ ...ready, bookingEmail: '', bookingPhone: '+1 916 555 0100' })).ready, true, 'phone counts as contact');
  assert.equal(server.epkGate({ plan: { S: '{broken' }, published: { BOOL: true } }).ready, false);

  // Nothing auto-sends: the follow-up only sends from the artist's click, with an editable draft.
  const client = fs.readFileSync('assets/booking-selections.js', 'utf8');
  assert.match(client, /Follow up\? No reply in 5 days/);
  assert.match(client, /followDraft\.value\.trim\(\)[\s\S]*followButton\.addEventListener|followButton\.addEventListener\("click"[\s\S]*followDraft\.value\.trim\(\)/, 'the follow-up sends the edited draft');
  const followUpSends = client.match(/followUpTo:initialPitch\.id/g) || [];
  assert.equal(followUpSends.length, 1, 'exactly one follow-up send path');
  assert.ok(!/setInterval|setTimeout\([^)]*danzstakSendBookingEmail/.test(client), 'no timer may send booking email');

  // The page loads the rules before the board.
  const html = fs.readFileSync('booking-selections.html', 'utf8');
  assert.ok(html.indexOf('assets/booking-pipeline.js') > 0 && html.indexOf('assets/booking-pipeline.js') < html.indexOf('assets/booking-selections.js'));
  assert.match(fs.readFileSync('service-worker.js', 'utf8'), /"\/assets\/booking-pipeline\.js"/);
  assert.match(fs.readFileSync('aws-deploy-auth-api.ps1', 'utf8'), /booking-pipeline\.mjs/, 'the Lambda bundle must include the pipeline module');

  console.log('Booking pipeline stage checks passed: EPK gate, shared rules, allowed transitions only, real-event stages, 5-day artist-sent follow-up.');
})().catch(error => { console.error(error); process.exitCode = 1; });
